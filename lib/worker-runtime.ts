import { currentRuntimeBindings } from "@/lib/request-context";
import {
  executeTool,
  ToolExecutionError,
  toolDefinition,
  type ToolName,
} from "@/lib/tool-runtime";

export type WorkerStatus = "active" | "draining" | "revoked";
export type WorkerEventType = "registered" | "activated" | "draining" | "revoked";

interface WorkerRow {
  id: string;
  user_id: string;
  name: string;
  status: WorkerStatus;
  token_sha256: string;
  max_concurrency: number;
  version: number;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
}

interface WorkerEventRow {
  id: string;
  worker_id: string;
  event_type: WorkerEventType;
  worker_version: number;
  note: string | null;
  created_at: string;
}

interface WorkerJobRow {
  id: string;
  user_id: string;
  project_id: string | null;
  tool_name: ToolName;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled" | "dead_letter";
  input_json: string;
  output_json: string | null;
  error_code: string | null;
  error_message: string | null;
  progress_percent: number;
  attempt: number;
  max_attempts: number;
  version: number;
  worker_id: string | null;
  claim_token: string | null;
  heartbeat_at: string | null;
  claim_expires_at: string | null;
  available_at: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface WorkerRecord {
  id: string;
  name: string;
  status: WorkerStatus;
  maxConcurrency: number;
  version: number;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
}

export interface WorkerEventRecord {
  id: string;
  workerId: string;
  type: WorkerEventType;
  workerVersion: number;
  note: string | null;
  createdAt: string;
}

export interface WorkerIdentity extends WorkerRecord {
  userId: string;
}

export interface ClaimedWorkerJob {
  id: string;
  projectId: string | null;
  toolName: ToolName;
  input: Record<string, unknown>;
  progressPercent: number;
  attempt: number;
  maxAttempts: number;
  version: number;
  claimToken: string;
  claimExpiresAt: string;
}

class WorkerApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
    this.name = code;
  }
}

export class WorkerAuthenticationError extends WorkerApiError {
  constructor() {
    super("Die Worker-Authentifizierung ist ungültig.", 401, "WORKER_AUTHENTICATION_FAILED");
  }
}

export class WorkerConflictError extends WorkerApiError {
  constructor(message = "Der Worker-Zustand wurde zwischenzeitlich verändert.") {
    super(message, 409, "WORKER_CONFLICT");
  }
}

export class WorkerNotFoundError extends WorkerApiError {
  constructor() {
    super("Der Worker wurde nicht gefunden.", 404, "WORKER_NOT_FOUND");
  }
}

export class WorkerLimitError extends WorkerApiError {
  constructor() {
    super("Es können höchstens 20 nicht widerrufene Worker bestehen.", 409, "WORKER_LIMIT_REACHED");
  }
}

function database(): D1Database {
  const db = currentRuntimeBindings().DB;
  if (!db) throw new Error("TankAI D1 ist nicht gebunden.");
  return db;
}

function now(): string {
  return new Date().toISOString();
}

function addMilliseconds(timestamp: string, milliseconds: number): string {
  return new Date(Date.parse(timestamp) + milliseconds).toISOString();
}

function parseRecord(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : { value: parsed };
  } catch {
    return {};
  }
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const base64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/gu, "");
  return `twk_${base64}`;
}

function mapWorker(row: WorkerRow): WorkerRecord {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    maxConcurrency: Number(row.max_concurrency),
    version: Number(row.version),
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revokedAt: row.revoked_at,
  };
}

function mapEvent(row: WorkerEventRow): WorkerEventRecord {
  return {
    id: row.id,
    workerId: row.worker_id,
    type: row.event_type,
    workerVersion: Number(row.worker_version),
    note: row.note,
    createdAt: row.created_at,
  };
}

async function workerRow(workerId: string, userId: string): Promise<WorkerRow> {
  const row = await database()
    .prepare(`SELECT id, user_id, name, status, token_sha256, max_concurrency,
                     version, last_seen_at, created_at, updated_at, revoked_at
              FROM worker_agents WHERE id = ? AND user_id = ?`)
    .bind(workerId, userId)
    .first<WorkerRow>();
  if (!row) throw new WorkerNotFoundError();
  return row;
}

export async function registerWorker(input: {
  userId: string;
  name: string;
  maxConcurrency: number;
}): Promise<{ worker: WorkerRecord; token: string }> {
  const name = input.name.trim();
  if (!name || name.length > 80 || !Number.isInteger(input.maxConcurrency) || input.maxConcurrency < 1 || input.maxConcurrency > 4) {
    throw new WorkerConflictError("Name oder maximale Parallelität des Workers ist ungültig.");
  }
  const active = await database()
    .prepare("SELECT COUNT(*) AS total FROM worker_agents WHERE user_id = ? AND status != 'revoked'")
    .bind(input.userId)
    .first<{ total: number }>();
  if (Number(active?.total ?? 0) >= 20) throw new WorkerLimitError();

  const token = randomToken();
  const tokenSha256 = await sha256(token);
  const id = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const timestamp = now();
  const results = await database().batch([
    database()
      .prepare(`INSERT INTO worker_agents
        (id, user_id, name, status, token_sha256, max_concurrency, version,
         created_at, updated_at)
        SELECT ?, ?, ?, 'active', ?, ?, 1, ?, ?
        WHERE (SELECT COUNT(*) FROM worker_agents
               WHERE user_id = ? AND status != 'revoked') < 20`)
      .bind(id, input.userId, name, tokenSha256, input.maxConcurrency, timestamp, timestamp, input.userId),
    database()
      .prepare(`INSERT INTO worker_agent_events
        (id, worker_id, user_id, event_type, worker_version, note, created_at)
        SELECT ?, id, user_id, 'registered', version,
               'Worker registriert; Roh-Token wird nicht gespeichert.', ?
        FROM worker_agents WHERE id = ? AND user_id = ?`)
      .bind(eventId, timestamp, id, input.userId),
  ]);
  const changes = Number((results[0].meta as { changes?: number } | undefined)?.changes ?? 0);
  if (changes !== 1) throw new WorkerLimitError();
  return { worker: mapWorker(await workerRow(id, input.userId)), token };
}

export async function listWorkers(userId: string): Promise<{
  workers: WorkerRecord[];
  events: WorkerEventRecord[];
}> {
  const workers = await database()
    .prepare(`SELECT id, user_id, name, status, token_sha256, max_concurrency,
                     version, last_seen_at, created_at, updated_at, revoked_at
              FROM worker_agents WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`)
    .bind(userId)
    .all<WorkerRow>();
  const events = await database()
    .prepare(`SELECT id, worker_id, event_type, worker_version, note, created_at
              FROM worker_agent_events WHERE user_id = ?
              ORDER BY created_at DESC LIMIT 200`)
    .bind(userId)
    .all<WorkerEventRow>();
  return {
    workers: (workers.results ?? []).map(mapWorker),
    events: (events.results ?? []).map(mapEvent),
  };
}

export async function setWorkerStatus(input: {
  userId: string;
  workerId: string;
  expectedVersion: number;
  status: WorkerStatus;
}): Promise<WorkerRecord> {
  const existing = await workerRow(input.workerId, input.userId);
  if (Number(existing.version) !== input.expectedVersion || existing.status === "revoked") {
    throw new WorkerConflictError();
  }
  if (input.status === existing.status) return mapWorker(existing);
  const eventType: WorkerEventType = input.status === "active"
    ? "activated"
    : input.status === "draining"
      ? "draining"
      : "revoked";
  const note = input.status === "active"
    ? "Worker für neue Claims aktiviert."
    : input.status === "draining"
      ? "Worker nimmt keine neuen Claims an."
      : "Worker und Token dauerhaft widerrufen.";
  const timestamp = now();
  const nextVersion = input.expectedVersion + 1;
  const eventId = crypto.randomUUID();
  const results = await database().batch([
    database()
      .prepare(`UPDATE worker_agents
                SET status = ?, version = version + 1, updated_at = ?,
                    revoked_at = CASE WHEN ? = 'revoked' THEN ? ELSE NULL END
                WHERE id = ? AND user_id = ? AND version = ? AND status != 'revoked'`)
      .bind(input.status, timestamp, input.status, timestamp, input.workerId, input.userId, input.expectedVersion),
    database()
      .prepare(`INSERT INTO worker_agent_events
        (id, worker_id, user_id, event_type, worker_version, note, created_at)
        SELECT ?, id, user_id, ?, version, ?, ?
        FROM worker_agents WHERE id = ? AND user_id = ? AND version = ?`)
      .bind(eventId, eventType, note, timestamp, input.workerId, input.userId, nextVersion),
  ]);
  const changes = Number((results[0].meta as { changes?: number } | undefined)?.changes ?? 0);
  if (changes !== 1) throw new WorkerConflictError();
  return mapWorker(await workerRow(input.workerId, input.userId));
}

export async function authenticateWorker(authorization: string | null): Promise<WorkerIdentity> {
  const match = /^Bearer\s+(twk_[A-Za-z0-9_-]{40,80})$/u.exec(authorization ?? "");
  if (!match) throw new WorkerAuthenticationError();
  const tokenSha256 = await sha256(match[1]);
  const row = await database()
    .prepare(`SELECT id, user_id, name, status, token_sha256, max_concurrency,
                     version, last_seen_at, created_at, updated_at, revoked_at
              FROM worker_agents WHERE token_sha256 = ? AND status != 'revoked'`)
    .bind(tokenSha256)
    .first<WorkerRow>();
  if (!row) throw new WorkerAuthenticationError();
  return { ...mapWorker(row), userId: row.user_id };
}

export async function heartbeatWorker(worker: WorkerIdentity): Promise<WorkerRecord> {
  const timestamp = now();
  const result = await database()
    .prepare(`UPDATE worker_agents SET last_seen_at = ?, updated_at = ?
              WHERE id = ? AND user_id = ? AND status IN ('active', 'draining')`)
    .bind(timestamp, timestamp, worker.id, worker.userId)
    .run();
  if (Number((result.meta as { changes?: number } | undefined)?.changes ?? 0) !== 1) {
    throw new WorkerAuthenticationError();
  }
  return mapWorker(await workerRow(worker.id, worker.userId));
}

function retryDelayMs(attempt: number): number {
  return Math.min(60_000, 5_000 * (2 ** Math.max(0, attempt - 1)));
}

export async function recoverExpiredWorkerClaims(userId: string): Promise<{ requeued: number; deadLettered: number }> {
  const timestamp = now();
  const result = await database()
    .prepare(`SELECT id, version, attempt, max_attempts, worker_id
              FROM tool_jobs
              WHERE user_id = ? AND status = 'running' AND worker_id IS NOT NULL
                AND claim_expires_at IS NOT NULL AND claim_expires_at < ?
              ORDER BY claim_expires_at ASC LIMIT 50`)
    .bind(userId, timestamp)
    .all<{ id: string; version: number; attempt: number; max_attempts: number; worker_id: string }>();
  let requeued = 0;
  let deadLettered = 0;
  for (const row of result.results ?? []) {
    const canRetry = Number(row.attempt) < Number(row.max_attempts);
    const nextVersion = Number(row.version) + 1;
    const availableAt = addMilliseconds(timestamp, retryDelayMs(Number(row.attempt)));
    const eventId = crypto.randomUUID();
    const batch = await database().batch([
      database()
        .prepare(canRetry
          ? `UPDATE tool_jobs
             SET status = 'queued', progress_percent = 0, version = version + 1,
                 worker_id = NULL, claim_token = NULL, claim_expires_at = NULL,
                 heartbeat_at = NULL, available_at = ?, updated_at = ?,
                 error_code = 'WORKER_CLAIM_EXPIRED',
                 error_message = 'Worker-Claim abgelaufen; Auftrag mit Backoff neu eingereiht.'
             WHERE id = ? AND user_id = ? AND version = ? AND status = 'running'
               AND worker_id = ? AND claim_expires_at < ?`
          : `UPDATE tool_jobs
             SET status = 'dead_letter', progress_percent = 100, version = version + 1,
                 worker_id = NULL, claim_token = NULL, claim_expires_at = NULL,
                 heartbeat_at = ?, updated_at = ?, completed_at = ?,
                 error_code = 'WORKER_CLAIM_EXPIRED',
                 error_message = 'Worker-Claim abgelaufen; maximale Versuche ausgeschöpft.'
             WHERE id = ? AND user_id = ? AND version = ? AND status = 'running'
               AND worker_id = ? AND claim_expires_at < ?`)
        .bind(...(canRetry
          ? [availableAt, timestamp, row.id, userId, row.version, row.worker_id, timestamp]
          : [timestamp, timestamp, timestamp, row.id, userId, row.version, row.worker_id, timestamp])),
      database()
        .prepare(`INSERT INTO tool_job_events
          (id, job_id, user_id, worker_id, event_type, job_version, attempt,
           progress_percent, note, created_at)
          SELECT ?, id, user_id, ?, ?, version, attempt, progress_percent, ?, ?
          FROM tool_jobs WHERE id = ? AND user_id = ? AND version = ?`)
        .bind(
          eventId,
          row.worker_id,
          canRetry ? "recovered" : "dead_letter",
          canRetry ? "Abgelaufener Worker-Claim automatisch neu eingereiht." : "Abgelaufener Worker-Claim terminal in Dead Letter verschoben.",
          timestamp,
          row.id,
          userId,
          nextVersion,
        ),
    ]);
    const changes = Number((batch[0].meta as { changes?: number } | undefined)?.changes ?? 0);
    if (changes === 1) {
      if (canRetry) requeued += 1;
      else deadLettered += 1;
    }
  }
  return { requeued, deadLettered };
}

export async function claimNextWorkerJob(worker: WorkerIdentity): Promise<ClaimedWorkerJob | null> {
  if (worker.status !== "active") return null;
  await recoverExpiredWorkerClaims(worker.userId);
  const timestamp = now();
  const candidate = await database()
    .prepare(`SELECT id, version FROM tool_jobs
              WHERE user_id = ? AND status = 'queued' AND available_at <= ?
                AND attempt < max_attempts
              ORDER BY available_at ASC, created_at ASC LIMIT 1`)
    .bind(worker.userId, timestamp)
    .first<{ id: string; version: number }>();
  if (!candidate) return null;

  const claimToken = crypto.randomUUID();
  const claimExpiresAt = addMilliseconds(timestamp, 90_000);
  const nextVersion = Number(candidate.version) + 1;
  const results = await database().batch([
    database()
      .prepare(`UPDATE tool_jobs
                SET status = 'running', attempt = attempt + 1, progress_percent = 5,
                    version = version + 1, worker_id = ?, claim_token = ?,
                    heartbeat_at = ?, claim_expires_at = ?,
                    started_at = COALESCE(started_at, ?), updated_at = ?,
                    error_code = NULL, error_message = NULL
                WHERE id = ? AND user_id = ? AND version = ? AND status = 'queued'
                  AND available_at <= ? AND attempt < max_attempts
                  AND EXISTS (SELECT 1 FROM worker_agents
                              WHERE id = ? AND user_id = ? AND status = 'active')
                  AND (SELECT COUNT(*) FROM tool_jobs
                       WHERE worker_id = ? AND status = 'running'
                         AND claim_expires_at > ?) <
                      (SELECT max_concurrency FROM worker_agents
                       WHERE id = ? AND user_id = ?)`)
      .bind(
        worker.id, claimToken, timestamp, claimExpiresAt, timestamp, timestamp,
        candidate.id, worker.userId, candidate.version, timestamp,
        worker.id, worker.userId, worker.id, timestamp, worker.id, worker.userId,
      ),
    database()
      .prepare(`INSERT INTO tool_job_events
        (id, job_id, user_id, worker_id, event_type, job_version, attempt,
         progress_percent, note, created_at)
        SELECT ?, id, user_id, ?, 'claimed', version, attempt, progress_percent,
               'Auftrag durch registrierten Worker beansprucht.', ?
        FROM tool_jobs WHERE id = ? AND user_id = ? AND version = ?
          AND worker_id = ? AND claim_token = ?`)
      .bind(crypto.randomUUID(), worker.id, timestamp, candidate.id, worker.userId, nextVersion, worker.id, claimToken),
  ]);
  const changes = Number((results[0].meta as { changes?: number } | undefined)?.changes ?? 0);
  if (changes !== 1) return null;
  const row = await database()
    .prepare(`SELECT id, user_id, project_id, tool_name, status, input_json,
                     output_json, error_code, error_message, progress_percent,
                     attempt, max_attempts, version, worker_id, claim_token,
                     heartbeat_at, claim_expires_at, available_at, created_at,
                     updated_at, completed_at
              FROM tool_jobs WHERE id = ? AND user_id = ? AND worker_id = ?`)
    .bind(candidate.id, worker.userId, worker.id)
    .first<WorkerJobRow>();
  if (!row || !row.claim_token || !row.claim_expires_at) throw new WorkerConflictError();
  return {
    id: row.id,
    projectId: row.project_id,
    toolName: row.tool_name,
    input: parseRecord(row.input_json),
    progressPercent: Number(row.progress_percent),
    attempt: Number(row.attempt),
    maxAttempts: Number(row.max_attempts),
    version: Number(row.version),
    claimToken: row.claim_token,
    claimExpiresAt: row.claim_expires_at,
  };
}

export async function heartbeatWorkerJob(input: {
  worker: WorkerIdentity;
  jobId: string;
  claimToken: string;
  progressPercent: number;
  note?: string;
}): Promise<{ progressPercent: number; claimExpiresAt: string }> {
  if (!Number.isInteger(input.progressPercent) || input.progressPercent < 5 || input.progressPercent > 95) {
    throw new WorkerConflictError("Der Worker-Fortschritt muss zwischen 5 und 95 Prozent liegen.");
  }
  const existing = await database()
    .prepare(`SELECT progress_percent, version FROM tool_jobs
              WHERE id = ? AND user_id = ? AND worker_id = ? AND claim_token = ?
                AND status = 'running' AND claim_expires_at > ?`)
    .bind(input.jobId, input.worker.userId, input.worker.id, input.claimToken, now())
    .first<{ progress_percent: number; version: number }>();
  if (!existing || input.progressPercent < Number(existing.progress_percent)) {
    throw new WorkerConflictError("Der Worker-Claim ist abgelaufen oder der Fortschritt würde zurückgesetzt.");
  }
  const timestamp = now();
  const claimExpiresAt = addMilliseconds(timestamp, 90_000);
  const note = input.note?.trim().slice(0, 300) || null;
  const eventType = input.progressPercent > Number(existing.progress_percent) || note ? "progress" : "heartbeat";
  const results = await database().batch([
    database()
      .prepare(`UPDATE tool_jobs
                SET progress_percent = ?, heartbeat_at = ?, claim_expires_at = ?, updated_at = ?
                WHERE id = ? AND user_id = ? AND worker_id = ? AND claim_token = ?
                  AND status = 'running' AND claim_expires_at > ?
                  AND progress_percent <= ?`)
      .bind(input.progressPercent, timestamp, claimExpiresAt, timestamp, input.jobId, input.worker.userId, input.worker.id, input.claimToken, timestamp, input.progressPercent),
    database()
      .prepare(`INSERT INTO tool_job_events
        (id, job_id, user_id, worker_id, event_type, job_version, attempt,
         progress_percent, note, created_at)
        SELECT ?, id, user_id, ?, ?, version, attempt, progress_percent, ?, ?
        FROM tool_jobs WHERE id = ? AND user_id = ? AND worker_id = ?
          AND claim_token = ? AND status = 'running' AND claim_expires_at = ?`)
      .bind(crypto.randomUUID(), input.worker.id, eventType, note, timestamp, input.jobId, input.worker.userId, input.worker.id, input.claimToken, claimExpiresAt),
  ]);
  const changes = Number((results[0].meta as { changes?: number } | undefined)?.changes ?? 0);
  if (changes !== 1) throw new WorkerConflictError();
  return { progressPercent: input.progressPercent, claimExpiresAt };
}

export async function executeClaimedWorkerJob(input: {
  worker: WorkerIdentity;
  jobId: string;
  claimToken: string;
}): Promise<{ status: WorkerJobRow["status"]; version: number; output: Record<string, unknown> | null; errorCode: string | null; errorMessage: string | null; availableAt: string }> {
  const timestamp = now();
  const existing = await database()
    .prepare(`SELECT id, user_id, project_id, tool_name, status, input_json,
                     output_json, error_code, error_message, progress_percent,
                     attempt, max_attempts, version, worker_id, claim_token,
                     heartbeat_at, claim_expires_at, available_at, created_at,
                     updated_at, completed_at
              FROM tool_jobs WHERE id = ? AND user_id = ? AND worker_id = ?
                AND claim_token = ? AND status = 'running' AND claim_expires_at > ?`)
    .bind(input.jobId, input.worker.userId, input.worker.id, input.claimToken, timestamp)
    .first<WorkerJobRow>();
  if (!existing) throw new WorkerConflictError("Der Worker besitzt keinen gültigen Claim für diesen Auftrag.");

  const claimedVersion = Number(existing.version);
  try {
    const output = await executeTool({
      userId: input.worker.userId,
      ...(existing.project_id ? { projectId: existing.project_id } : {}),
      toolName: existing.tool_name,
      payload: parseRecord(existing.input_json),
    });
    const outputJson = JSON.stringify(output);
    const outputLimit = toolDefinition(existing.tool_name).maximumOutputBytes + 4_000;
    if (new TextEncoder().encode(outputJson).byteLength > Math.min(48_000, outputLimit)) {
      throw new ToolExecutionError("Die Werkzeugausgabe überschreitet das erlaubte Limit.", "TOOL_OUTPUT_TOO_LARGE");
    }
    const completedAt = now();
    const nextVersion = claimedVersion + 1;
    const results = await database().batch([
      database()
        .prepare(`UPDATE tool_jobs
                  SET status = 'succeeded', output_json = ?, progress_percent = 100,
                      version = version + 1, worker_id = NULL, claim_token = NULL,
                      claim_expires_at = NULL, heartbeat_at = ?, updated_at = ?,
                      completed_at = ?, error_code = NULL, error_message = NULL
                  WHERE id = ? AND user_id = ? AND status = 'running'
                    AND version = ? AND worker_id = ? AND claim_token = ?`)
        .bind(outputJson, completedAt, completedAt, completedAt, input.jobId, input.worker.userId, claimedVersion, input.worker.id, input.claimToken),
      database()
        .prepare(`INSERT INTO tool_job_events
          (id, job_id, user_id, worker_id, event_type, job_version, attempt,
           progress_percent, note, created_at)
          SELECT ?, id, user_id, ?, 'succeeded', version, attempt, progress_percent,
                 'Worker-Auftrag erfolgreich abgeschlossen.', ?
          FROM tool_jobs WHERE id = ? AND user_id = ? AND status = 'succeeded' AND version = ?`)
        .bind(crypto.randomUUID(), input.worker.id, completedAt, input.jobId, input.worker.userId, nextVersion),
    ]);
    if (Number((results[0].meta as { changes?: number } | undefined)?.changes ?? 0) !== 1) throw new WorkerConflictError();
  } catch (error) {
    if (error instanceof WorkerConflictError) throw error;
    const failedAt = now();
    const errorCode = error instanceof ToolExecutionError ? error.code : "TOOL_EXECUTION_FAILED";
    const errorMessage = error instanceof ToolExecutionError
      ? error.message.slice(0, 500)
      : "Das Werkzeug konnte den Worker-Auftrag nicht abschließen.";
    const canRetry = Number(existing.attempt) < Number(existing.max_attempts);
    const nextVersion = claimedVersion + 1;
    const availableAt = addMilliseconds(failedAt, retryDelayMs(Number(existing.attempt)));
    const results = await database().batch([
      database()
        .prepare(canRetry
          ? `UPDATE tool_jobs
             SET status = 'queued', progress_percent = 0, version = version + 1,
                 worker_id = NULL, claim_token = NULL, claim_expires_at = NULL,
                 heartbeat_at = NULL, available_at = ?, updated_at = ?,
                 error_code = ?, error_message = ?
             WHERE id = ? AND user_id = ? AND status = 'running'
               AND version = ? AND worker_id = ? AND claim_token = ?`
          : `UPDATE tool_jobs
             SET status = 'dead_letter', progress_percent = 100, version = version + 1,
                 worker_id = NULL, claim_token = NULL, claim_expires_at = NULL,
                 heartbeat_at = ?, updated_at = ?, completed_at = ?,
                 error_code = ?, error_message = ?
             WHERE id = ? AND user_id = ? AND status = 'running'
               AND version = ? AND worker_id = ? AND claim_token = ?`)
        .bind(...(canRetry
          ? [availableAt, failedAt, errorCode, errorMessage, input.jobId, input.worker.userId, claimedVersion, input.worker.id, input.claimToken]
          : [failedAt, failedAt, failedAt, errorCode, errorMessage, input.jobId, input.worker.userId, claimedVersion, input.worker.id, input.claimToken])),
      database()
        .prepare(`INSERT INTO tool_job_events
          (id, job_id, user_id, worker_id, event_type, job_version, attempt,
           progress_percent, note, created_at)
          SELECT ?, id, user_id, ?, ?, version, attempt, progress_percent, ?, ?
          FROM tool_jobs WHERE id = ? AND user_id = ? AND version = ?`)
        .bind(
          crypto.randomUUID(),
          input.worker.id,
          canRetry ? "retry_scheduled" : "dead_letter",
          canRetry ? `Fehler ${errorCode}; automatischer Retry mit Backoff geplant.` : `Fehler ${errorCode}; maximale Versuche ausgeschöpft.`,
          failedAt,
          input.jobId,
          input.worker.userId,
          nextVersion,
        ),
    ]);
    if (Number((results[0].meta as { changes?: number } | undefined)?.changes ?? 0) !== 1) throw new WorkerConflictError();
  }

  const final = await database()
    .prepare(`SELECT id, user_id, project_id, tool_name, status, input_json,
                     output_json, error_code, error_message, progress_percent,
                     attempt, max_attempts, version, worker_id, claim_token,
                     heartbeat_at, claim_expires_at, available_at, created_at,
                     updated_at, completed_at
              FROM tool_jobs WHERE id = ? AND user_id = ?`)
    .bind(input.jobId, input.worker.userId)
    .first<WorkerJobRow>();
  if (!final) throw new WorkerConflictError();
  return {
    status: final.status,
    version: Number(final.version),
    output: final.output_json ? parseRecord(final.output_json) : null,
    errorCode: final.error_code,
    errorMessage: final.error_message,
    availableAt: final.available_at,
  };
}
