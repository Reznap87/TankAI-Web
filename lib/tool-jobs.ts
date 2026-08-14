import { currentRuntimeBindings } from "@/lib/request-context";
import { recoverExpiredWorkerClaims } from "@/lib/worker-runtime";
import {
  executeTool,
  normalizeToolInput,
  ToolExecutionError,
  ToolInputError,
  toolDefinition,
  type ToolName,
  type ToolScope,
} from "@/lib/tool-runtime";
import {
  encodeToolEventCursor,
  parseToolEventCursor,
} from "@/lib/tool-progress-cursor";

export {
  encodeToolEventCursor,
  parseToolEventCursor,
} from "@/lib/tool-progress-cursor";

export type ToolLeaseStatus = "active" | "revoked" | "depleted" | "expired";
export type ToolJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "dead_letter";

interface ToolLeaseRow {
  id: string;
  project_id: string | null;
  project_name: string | null;
  scope_kind: ToolScope;
  tool_name: ToolName;
  status: Exclude<ToolLeaseStatus, "expired">;
  max_uses: number;
  remaining_uses: number;
  version: number;
  expires_at: string;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

interface ToolJobRow {
  id: string;
  project_id: string | null;
  lease_id: string;
  tool_name: ToolName;
  status: ToolJobStatus;
  input_json: string;
  input_sha256: string;
  output_json: string | null;
  error_code: string | null;
  error_message: string | null;
  progress_percent: number;
  attempt: number;
  max_attempts: number;
  version: number;
  heartbeat_at: string | null;
  worker_id: string | null;
  claim_expires_at: string | null;
  available_at: string;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface ToolJobEventRow {
  id: string;
  job_id: string;
  worker_id: string | null;
  event_type:
    | "created"
    | "claimed"
    | "heartbeat"
    | "progress"
    | "succeeded"
    | "failed"
    | "requeued"
    | "retry_scheduled"
    | "cancelled"
    | "recovered"
    | "dead_letter";
  job_version: number;
  attempt: number;
  progress_percent: number;
  note: string | null;
  created_at: string;
}

export interface ToolLeaseRecord {
  id: string;
  projectId: string | null;
  projectName: string | null;
  scope: ToolScope;
  toolName: ToolName;
  status: ToolLeaseStatus;
  maxUses: number;
  remainingUses: number;
  version: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface ToolJobRecord {
  id: string;
  projectId: string | null;
  leaseId: string;
  toolName: ToolName;
  status: ToolJobStatus;
  input: Record<string, unknown>;
  inputSha256: string;
  output: Record<string, unknown> | null;
  errorCode: string | null;
  errorMessage: string | null;
  progressPercent: number;
  attempt: number;
  maxAttempts: number;
  version: number;
  heartbeatAt: string | null;
  workerId: string | null;
  claimExpiresAt: string | null;
  availableAt: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ToolJobEventRecord {
  id: string;
  jobId: string;
  workerId: string | null;
  type: ToolJobEventRow["event_type"];
  jobVersion: number;
  attempt: number;
  progressPercent: number;
  note: string | null;
  createdAt: string;
}

export interface ToolJobProgressRecord {
  id: string;
  status: ToolJobStatus;
  progressPercent: number;
  attempt: number;
  maxAttempts: number;
  version: number;
  errorCode: string | null;
  errorMessage: string | null;
  updatedAt: string;
  completedAt: string | null;
}

export interface ToolJobProgressSnapshot {
  job: ToolJobProgressRecord;
  events: ToolJobEventRecord[];
  terminal: boolean;
  cursor: string | null;
}

class ToolJobApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = code;
  }
}

export class ToolLeaseUnavailableError extends ToolJobApiError {
  constructor() {
    super(
      "Für dieses Werkzeug fehlt eine aktive, passende Tool-Freigabe.",
      409,
      "TOOL_LEASE_UNAVAILABLE",
    );
  }
}

export class ToolLeaseNotFoundError extends ToolJobApiError {
  constructor() {
    super("Die Tool-Freigabe wurde nicht gefunden.", 404, "TOOL_LEASE_NOT_FOUND");
  }
}

export class ToolLeaseVersionConflictError extends ToolJobApiError {
  constructor() {
    super(
      "Die Tool-Freigabe wurde zwischenzeitlich geändert.",
      409,
      "TOOL_LEASE_VERSION_CONFLICT",
    );
  }
}

export class ToolLeaseLimitError extends ToolJobApiError {
  constructor() {
    super(
      "Es können höchstens 20 aktive Tool-Freigaben bestehen.",
      409,
      "TOOL_LEASE_LIMIT_REACHED",
    );
  }
}

export class ToolJobNotFoundError extends ToolJobApiError {
  constructor() {
    super("Der Werkzeugauftrag wurde nicht gefunden.", 404, "TOOL_JOB_NOT_FOUND");
  }
}

export class ToolJobConflictError extends ToolJobApiError {
  constructor(message = "Der Werkzeugauftrag wurde zwischenzeitlich verändert.") {
    super(message, 409, "TOOL_JOB_CONFLICT");
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

function parseJsonRecord(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : { value: parsed };
  } catch {
    return null;
  }
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function effectiveLeaseStatus(
  row: ToolLeaseRow,
  timestamp = now(),
): ToolLeaseStatus {
  return row.status === "active" && row.expires_at <= timestamp
    ? "expired"
    : row.status;
}

function mapLease(row: ToolLeaseRow, timestamp = now()): ToolLeaseRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    scope: row.scope_kind,
    toolName: row.tool_name,
    status: effectiveLeaseStatus(row, timestamp),
    maxUses: Number(row.max_uses),
    remainingUses: Number(row.remaining_uses),
    version: Number(row.version),
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  };
}

function mapJob(row: ToolJobRow): ToolJobRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    leaseId: row.lease_id,
    toolName: row.tool_name,
    status: row.status,
    input: parseJsonRecord(row.input_json) ?? {},
    inputSha256: row.input_sha256,
    output: parseJsonRecord(row.output_json),
    errorCode: row.error_code,
    errorMessage: row.error_message,
    progressPercent: Number(row.progress_percent),
    attempt: Number(row.attempt),
    maxAttempts: Number(row.max_attempts),
    version: Number(row.version),
    heartbeatAt: row.heartbeat_at,
    workerId: row.worker_id,
    claimExpiresAt: row.claim_expires_at,
    availableAt: row.available_at,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

function mapJobEvent(row: ToolJobEventRow): ToolJobEventRecord {
  return {
    id: row.id,
    jobId: row.job_id,
    workerId: row.worker_id,
    type: row.event_type,
    jobVersion: Number(row.job_version),
    attempt: Number(row.attempt),
    progressPercent: Number(row.progress_percent),
    note: row.note,
    createdAt: row.created_at,
  };
}

const TERMINAL_TOOL_JOB_STATUSES = new Set<ToolJobStatus>([
  "succeeded",
  "failed",
  "cancelled",
  "dead_letter",
]);

export async function readToolJobProgress(input: {
  userId: string;
  jobId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<ToolJobProgressSnapshot> {
  const row = await jobRow(input.jobId, input.userId);
  const cursor = parseToolEventCursor(input.cursor);
  const limit = Math.max(1, Math.min(input.limit ?? 50, 100));
  const result = cursor
    ? await database()
        .prepare(
          `SELECT id, job_id, worker_id, event_type, job_version, attempt,
                  progress_percent, note, created_at
           FROM tool_job_events
           WHERE job_id = ? AND user_id = ?
             AND (job_version > ? OR (job_version = ? AND id > ?))
           ORDER BY job_version ASC, id ASC
           LIMIT ?`,
        )
        .bind(
          input.jobId,
          input.userId,
          cursor.jobVersion,
          cursor.jobVersion,
          cursor.id,
          limit,
        )
        .all<ToolJobEventRow>()
    : await database()
        .prepare(
          `SELECT id, job_id, worker_id, event_type, job_version, attempt,
                  progress_percent, note, created_at
           FROM tool_job_events
           WHERE job_id = ? AND user_id = ?
           ORDER BY job_version ASC, id ASC
           LIMIT ?`,
        )
        .bind(input.jobId, input.userId, limit)
        .all<ToolJobEventRow>();
  const events = (result.results ?? []).map(mapJobEvent);
  return {
    job: {
      id: row.id,
      status: row.status,
      progressPercent: Number(row.progress_percent),
      attempt: Number(row.attempt),
      maxAttempts: Number(row.max_attempts),
      version: Number(row.version),
      errorCode: row.error_code,
      errorMessage: row.error_message,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    },
    events,
    terminal: TERMINAL_TOOL_JOB_STATUSES.has(row.status),
    cursor: events.length > 0
      ? encodeToolEventCursor(events[events.length - 1])
      : input.cursor ?? null,
  };
}

async function leaseRow(leaseId: string, userId: string): Promise<ToolLeaseRow> {
  const row = await database()
    .prepare(
      `SELECT tool_execution_leases.id, tool_execution_leases.project_id,
              projects.name AS project_name, tool_execution_leases.scope_kind,
              tool_execution_leases.tool_name, tool_execution_leases.status,
              tool_execution_leases.max_uses, tool_execution_leases.remaining_uses,
              tool_execution_leases.version, tool_execution_leases.expires_at,
              tool_execution_leases.created_at, tool_execution_leases.updated_at,
              tool_execution_leases.last_used_at, tool_execution_leases.revoked_at
       FROM tool_execution_leases
       LEFT JOIN projects
         ON projects.id = tool_execution_leases.project_id
        AND projects.user_id = tool_execution_leases.user_id
       WHERE tool_execution_leases.id = ?
         AND tool_execution_leases.user_id = ?`,
    )
    .bind(leaseId, userId)
    .first<ToolLeaseRow>();
  if (!row) throw new ToolLeaseNotFoundError();
  return row;
}

async function jobRow(jobId: string, userId: string): Promise<ToolJobRow> {
  const row = await database()
    .prepare(
      `SELECT id, project_id, lease_id, tool_name, status, input_json,
              input_sha256, output_json, error_code, error_message,
              progress_percent, attempt, max_attempts, version, heartbeat_at, worker_id, claim_expires_at,
              available_at, idempotency_key, created_at, updated_at,
              started_at, completed_at
       FROM tool_jobs
       WHERE id = ? AND user_id = ?`,
    )
    .bind(jobId, userId)
    .first<ToolJobRow>();
  if (!row) throw new ToolJobNotFoundError();
  return row;
}

export async function createToolLease(input: {
  userId: string;
  toolName: ToolName;
  scope: ToolScope;
  projectId?: string;
  maxUses: number;
  durationMinutes: number;
}): Promise<ToolLeaseRecord> {
  const definition = toolDefinition(input.toolName);
  if (
    !Number.isInteger(input.maxUses) ||
    input.maxUses < 1 ||
    input.maxUses > 20 ||
    !Number.isInteger(input.durationMinutes) ||
    input.durationMinutes < 15 ||
    input.durationMinutes > 1_440 ||
    (input.scope === "account" && input.projectId) ||
    (input.scope === "project" && !input.projectId) ||
    !definition.scopes.includes(input.scope)
  ) {
    throw new ToolLeaseUnavailableError();
  }
  const timestamp = now();
  const active = await database()
    .prepare(
      `SELECT COUNT(*) AS total FROM tool_execution_leases
       WHERE user_id = ? AND status = 'active' AND remaining_uses > 0
         AND expires_at > ?`,
    )
    .bind(input.userId, timestamp)
    .first<{ total: number }>();
  if (Number(active?.total ?? 0) >= 20) throw new ToolLeaseLimitError();

  const id = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + input.durationMinutes * 60_000,
  ).toISOString();
  const results = await database().batch([
    database()
      .prepare(
        `INSERT INTO tool_execution_leases
          (id, user_id, project_id, scope_kind, tool_name, status, max_uses,
           remaining_uses, version, expires_at, last_event_id, created_at, updated_at)
         SELECT ?, ?, ?, ?, ?, 'active', ?, ?, 1, ?, ?, ?, ?
         WHERE (SELECT COUNT(*) FROM tool_execution_leases
                WHERE user_id = ? AND status = 'active'
                  AND remaining_uses > 0 AND expires_at > ?) < 20`,
      )
      .bind(
        id,
        input.userId,
        input.projectId ?? null,
        input.scope,
        input.toolName,
        input.maxUses,
        input.maxUses,
        expiresAt,
        eventId,
        timestamp,
        timestamp,
        input.userId,
        timestamp,
      ),
    database()
      .prepare(
        `INSERT INTO tool_execution_lease_events
          (id, lease_id, job_id, user_id, event_type, lease_version,
           remaining_uses, created_at)
         SELECT ?, id, NULL, user_id, 'created', version, remaining_uses, ?
         FROM tool_execution_leases
         WHERE id = ? AND user_id = ? AND last_event_id = ?`,
      )
      .bind(eventId, timestamp, id, input.userId, eventId),
  ]);
  const changes = Number(
    (results[0].meta as { changes?: number } | undefined)?.changes ?? 0,
  );
  if (changes !== 1) throw new ToolLeaseLimitError();
  return mapLease(await leaseRow(id, input.userId), timestamp);
}

export async function revokeToolLease(input: {
  leaseId: string;
  userId: string;
  expectedVersion: number;
}): Promise<ToolLeaseRecord> {
  const existing = await leaseRow(input.leaseId, input.userId);
  const timestamp = now();
  if (
    Number(existing.version) !== input.expectedVersion ||
    effectiveLeaseStatus(existing, timestamp) !== "active"
  ) {
    throw new ToolLeaseVersionConflictError();
  }
  const eventId = crypto.randomUUID();
  const results = await database().batch([
    database()
      .prepare(
        `UPDATE tool_execution_leases
         SET status = 'revoked', version = version + 1, last_event_id = ?,
             updated_at = ?, revoked_at = ?
         WHERE id = ? AND user_id = ? AND version = ? AND status = 'active'
           AND remaining_uses > 0 AND expires_at > ?`,
      )
      .bind(
        eventId,
        timestamp,
        timestamp,
        input.leaseId,
        input.userId,
        input.expectedVersion,
        timestamp,
      ),
    database()
      .prepare(
        `INSERT INTO tool_execution_lease_events
          (id, lease_id, job_id, user_id, event_type, lease_version,
           remaining_uses, created_at)
         SELECT ?, id, NULL, user_id, 'revoked', version, remaining_uses, ?
         FROM tool_execution_leases
         WHERE id = ? AND user_id = ? AND last_event_id = ?`,
      )
      .bind(eventId, timestamp, input.leaseId, input.userId, eventId),
  ]);
  const changes = Number(
    (results[0].meta as { changes?: number } | undefined)?.changes ?? 0,
  );
  if (changes !== 1) throw new ToolLeaseVersionConflictError();
  return mapLease(await leaseRow(input.leaseId, input.userId), timestamp);
}

export async function listToolLeases(userId: string): Promise<{
  leases: ToolLeaseRecord[];
}> {
  const timestamp = now();
  const result = await database()
    .prepare(
      `SELECT tool_execution_leases.id, tool_execution_leases.project_id,
              projects.name AS project_name, tool_execution_leases.scope_kind,
              tool_execution_leases.tool_name, tool_execution_leases.status,
              tool_execution_leases.max_uses, tool_execution_leases.remaining_uses,
              tool_execution_leases.version, tool_execution_leases.expires_at,
              tool_execution_leases.created_at, tool_execution_leases.updated_at,
              tool_execution_leases.last_used_at, tool_execution_leases.revoked_at
       FROM tool_execution_leases
       LEFT JOIN projects
         ON projects.id = tool_execution_leases.project_id
        AND projects.user_id = tool_execution_leases.user_id
       WHERE tool_execution_leases.user_id = ?
       ORDER BY tool_execution_leases.created_at DESC
       LIMIT 100`,
    )
    .bind(userId)
    .all<ToolLeaseRow>();
  return {
    leases: (result.results ?? []).map((row) => mapLease(row, timestamp)),
  };
}

export async function createToolJob(input: {
  userId: string;
  leaseId: string;
  toolName: ToolName;
  projectId?: string;
  payload: unknown;
  idempotencyKey: string;
  maxAttempts: number;
}): Promise<{ job: ToolJobRecord; created: boolean }> {
  const definition = toolDefinition(input.toolName);
  const normalized = normalizeToolInput(input.toolName, input.payload);
  const inputJson = JSON.stringify(normalized);
  const inputBytes = new TextEncoder().encode(inputJson).byteLength;
  if (inputBytes > definition.maximumInputBytes || inputBytes > 24_000) {
    throw new ToolInputError("Die normalisierte Werkzeugeingabe überschreitet das Werkzeuglimit.");
  }
  const inputSha256 = await sha256(inputJson);
  const existing = await database()
    .prepare(
      `SELECT id, project_id, lease_id, tool_name, status, input_json,
              input_sha256, output_json, error_code, error_message,
              progress_percent, attempt, max_attempts, version, heartbeat_at, worker_id, claim_expires_at,
              available_at, idempotency_key, created_at, updated_at,
              started_at, completed_at
       FROM tool_jobs WHERE user_id = ? AND idempotency_key = ?`,
    )
    .bind(input.userId, input.idempotencyKey)
    .first<ToolJobRow>();
  if (existing) {
    if (
      existing.lease_id !== input.leaseId ||
      existing.tool_name !== input.toolName ||
      existing.project_id !== (input.projectId ?? null) ||
      existing.input_sha256 !== inputSha256
    ) {
      throw new ToolJobConflictError(
        "Der Idempotenzschlüssel wurde bereits für einen anderen Werkzeugauftrag verwendet.",
      );
    }
    return { job: mapJob(existing), created: false };
  }

  const lease = mapLease(await leaseRow(input.leaseId, input.userId));
  const scopeMatches =
    (lease.scope === "account" && !input.projectId) ||
    (lease.scope === "project" &&
      Boolean(input.projectId) &&
      lease.projectId === input.projectId);
  if (
    lease.toolName !== input.toolName ||
    lease.status !== "active" ||
    lease.remainingUses < 1 ||
    !scopeMatches
  ) {
    throw new ToolLeaseUnavailableError();
  }
  const timestamp = now();
  const jobId = crypto.randomUUID();
  const leaseEventId = crypto.randomUUID();
  const jobEventId = crypto.randomUUID();

  const results = await database().batch([
    database()
      .prepare(
        `UPDATE tool_execution_leases
         SET remaining_uses = remaining_uses - 1,
             status = CASE WHEN remaining_uses = 1 THEN 'depleted' ELSE 'active' END,
             version = version + 1, last_event_id = ?, last_used_at = ?, updated_at = ?
         WHERE id = ? AND user_id = ? AND tool_name = ?
           AND status = 'active' AND remaining_uses > 0 AND expires_at > ?
           AND NOT EXISTS (
             SELECT 1 FROM tool_jobs
             WHERE user_id = ? AND idempotency_key = ?
           )
           AND (
             (scope_kind = 'account' AND project_id IS NULL)
             OR
             (scope_kind = 'project' AND project_id = ? AND ? IS NOT NULL)
           )`,
      )
      .bind(
        leaseEventId,
        timestamp,
        timestamp,
        input.leaseId,
        input.userId,
        input.toolName,
        timestamp,
        input.userId,
        input.idempotencyKey,
        input.projectId ?? null,
        input.projectId ?? null,
      ),
    database()
      .prepare(
        `INSERT INTO tool_jobs
          (id, user_id, project_id, lease_id, tool_name, status, input_json,
           input_sha256, progress_percent, attempt, max_attempts, version,
           available_at, idempotency_key, created_at, updated_at)
         SELECT ?, user_id, ?, id, tool_name, 'queued', ?, ?, 0, 0, ?, 1,
                ?, ?, ?, ?
         FROM tool_execution_leases
         WHERE id = ? AND user_id = ? AND last_event_id = ?`,
      )
      .bind(
        jobId,
        input.projectId ?? null,
        inputJson,
        inputSha256,
        input.maxAttempts,
        timestamp,
        input.idempotencyKey,
        timestamp,
        timestamp,
        input.leaseId,
        input.userId,
        leaseEventId,
      ),
    database()
      .prepare(
        `INSERT INTO tool_execution_lease_events
          (id, lease_id, job_id, user_id, event_type, lease_version,
           remaining_uses, created_at)
         SELECT ?, tool_execution_leases.id, tool_jobs.id,
                tool_execution_leases.user_id, 'consumed',
                tool_execution_leases.version,
                tool_execution_leases.remaining_uses, ?
         FROM tool_execution_leases
         INNER JOIN tool_jobs ON tool_jobs.lease_id = tool_execution_leases.id
         WHERE tool_execution_leases.id = ?
           AND tool_execution_leases.user_id = ?
           AND tool_execution_leases.last_event_id = ?
           AND tool_jobs.id = ?`,
      )
      .bind(
        leaseEventId,
        timestamp,
        input.leaseId,
        input.userId,
        leaseEventId,
        jobId,
      ),
    database()
      .prepare(
        `INSERT INTO tool_job_events
          (id, job_id, user_id, event_type, job_version, attempt,
           progress_percent, note, created_at)
         SELECT ?, id, user_id, 'created', version, attempt,
                progress_percent, 'Tool-Auftrag angelegt.', ?
         FROM tool_jobs WHERE id = ? AND user_id = ?`,
      )
      .bind(jobEventId, timestamp, jobId, input.userId),
  ]);
  const changes = Number(
    (results[0].meta as { changes?: number } | undefined)?.changes ?? 0,
  );
  if (changes !== 1) {
    const raced = await database()
      .prepare(
        `SELECT id, project_id, lease_id, tool_name, status, input_json,
                input_sha256, output_json, error_code, error_message,
                progress_percent, attempt, max_attempts, version, heartbeat_at, worker_id, claim_expires_at,
                available_at, idempotency_key, created_at, updated_at,
                started_at, completed_at
         FROM tool_jobs WHERE user_id = ? AND idempotency_key = ?`,
      )
      .bind(input.userId, input.idempotencyKey)
      .first<ToolJobRow>();
    if (raced) {
      if (
        raced.lease_id !== input.leaseId ||
        raced.tool_name !== input.toolName ||
        raced.project_id !== (input.projectId ?? null) ||
        raced.input_sha256 !== inputSha256
      ) {
        throw new ToolJobConflictError(
          "Der Idempotenzschlüssel wurde parallel für einen anderen Werkzeugauftrag verwendet.",
        );
      }
      return { job: mapJob(raced), created: false };
    }
    throw new ToolLeaseUnavailableError();
  }
  return { job: mapJob(await jobRow(jobId, input.userId)), created: true };
}

export async function executeToolJob(input: {
  userId: string;
  jobId: string;
  expectedVersion: number;
}): Promise<ToolJobRecord> {
  const existing = await jobRow(input.jobId, input.userId);
  if (existing.status === "succeeded") return mapJob(existing);
  if (
    existing.status !== "queued" ||
    Number(existing.version) !== input.expectedVersion ||
    existing.available_at > now() ||
    Number(existing.attempt) >= Number(existing.max_attempts)
  ) {
    throw new ToolJobConflictError("Der Werkzeugauftrag kann in diesem Zustand nicht ausgeführt werden.");
  }
  const timestamp = now();
  const claimToken = crypto.randomUUID();
  const claimedVersion = input.expectedVersion + 1;
  const claimResults = await database().batch([
    database()
      .prepare(
        `UPDATE tool_jobs
         SET status = 'running', attempt = attempt + 1, progress_percent = 5,
             version = version + 1, worker_id = NULL, claim_token = ?, heartbeat_at = ?,
             claim_expires_at = NULL, started_at = COALESCE(started_at, ?), updated_at = ?,
             error_code = NULL, error_message = NULL
         WHERE id = ? AND user_id = ? AND version = ? AND status = 'queued'
           AND available_at <= ? AND attempt < max_attempts`,
      )
      .bind(
        claimToken,
        timestamp,
        timestamp,
        timestamp,
        input.jobId,
        input.userId,
        input.expectedVersion,
        timestamp,
      ),
    database()
      .prepare(
        `INSERT INTO tool_job_events
          (id, job_id, user_id, event_type, job_version, attempt,
           progress_percent, note, created_at)
         SELECT ?, id, user_id, 'claimed', version, attempt,
                progress_percent, 'Tool-Auftrag exklusiv beansprucht.', ?
         FROM tool_jobs
         WHERE id = ? AND user_id = ? AND version = ? AND claim_token = ?`,
      )
      .bind(
        crypto.randomUUID(),
        timestamp,
        input.jobId,
        input.userId,
        claimedVersion,
        claimToken,
      ),
  ]);
  const claimChanges = Number(
    (claimResults[0].meta as { changes?: number } | undefined)?.changes ?? 0,
  );
  if (claimChanges !== 1) throw new ToolJobConflictError();

  try {
    const payload = parseJsonRecord(existing.input_json) ?? {};
    const output = await executeTool({
      userId: input.userId,
      ...(existing.project_id ? { projectId: existing.project_id } : {}),
      toolName: existing.tool_name,
      payload,
    });
    const outputJson = JSON.stringify(output);
    const outputLimit = toolDefinition(existing.tool_name).maximumOutputBytes + 4_000;
    if (new TextEncoder().encode(outputJson).byteLength > Math.min(48_000, outputLimit)) {
      throw new ToolExecutionError(
        "Die Werkzeugausgabe überschreitet das erlaubte Limit.",
        "TOOL_OUTPUT_TOO_LARGE",
      );
    }
    const completedAt = now();
    const results = await database().batch([
      database()
        .prepare(
          `UPDATE tool_jobs
           SET status = 'succeeded', output_json = ?, progress_percent = 100,
               version = version + 1, claim_token = NULL, heartbeat_at = ?,
               updated_at = ?, completed_at = ?, error_code = NULL,
               error_message = NULL
           WHERE id = ? AND user_id = ? AND status = 'running'
             AND version = ? AND claim_token = ?`,
        )
        .bind(
          outputJson,
          completedAt,
          completedAt,
          completedAt,
          input.jobId,
          input.userId,
          claimedVersion,
          claimToken,
        ),
      database()
        .prepare(
          `INSERT INTO tool_job_events
            (id, job_id, user_id, event_type, job_version, attempt,
             progress_percent, note, created_at)
           SELECT ?, id, user_id, 'succeeded', version, attempt,
                  progress_percent, 'Tool-Auftrag erfolgreich abgeschlossen.', ?
           FROM tool_jobs
           WHERE id = ? AND user_id = ? AND status = 'succeeded'
             AND version = ?`,
        )
        .bind(
          crypto.randomUUID(),
          completedAt,
          input.jobId,
          input.userId,
          claimedVersion + 1,
        ),
    ]);
    const changes = Number(
      (results[0].meta as { changes?: number } | undefined)?.changes ?? 0,
    );
    if (changes !== 1) throw new ToolJobConflictError();
  } catch (error) {
    if (error instanceof ToolJobConflictError) throw error;
    const failedAt = now();
    const errorCode =
      error instanceof ToolExecutionError
        ? error.code
        : "TOOL_EXECUTION_FAILED";
    const errorMessage =
      error instanceof ToolExecutionError
        ? error.message.slice(0, 500)
        : "Das Werkzeug konnte den Auftrag nicht abschließen.";
    const failureResults = await database().batch([
      database()
        .prepare(
          `UPDATE tool_jobs
           SET status = 'failed', progress_percent = 100, version = version + 1,
               claim_token = NULL, heartbeat_at = ?, updated_at = ?,
               completed_at = ?, error_code = ?, error_message = ?
           WHERE id = ? AND user_id = ? AND status = 'running'
             AND version = ? AND claim_token = ?`,
        )
        .bind(
          failedAt,
          failedAt,
          failedAt,
          errorCode,
          errorMessage,
          input.jobId,
          input.userId,
          claimedVersion,
          claimToken,
        ),
      database()
        .prepare(
          `INSERT INTO tool_job_events
            (id, job_id, user_id, event_type, job_version, attempt,
             progress_percent, note, created_at)
           SELECT ?, id, user_id, 'failed', version, attempt,
                  progress_percent, ?, ?
           FROM tool_jobs
           WHERE id = ? AND user_id = ? AND status = 'failed'
             AND version = ?`,
        )
        .bind(
          crypto.randomUUID(),
          errorMessage,
          failedAt,
          input.jobId,
          input.userId,
          claimedVersion + 1,
        ),
    ]);
    const failureChanges = Number(
      (failureResults[0].meta as { changes?: number } | undefined)?.changes ?? 0,
    );
    if (failureChanges !== 1) throw new ToolJobConflictError();
  }
  return mapJob(await jobRow(input.jobId, input.userId));
}

export async function transitionToolJob(input: {
  userId: string;
  jobId: string;
  expectedVersion: number;
  action: "retry" | "cancel";
}): Promise<ToolJobRecord> {
  const existing = await jobRow(input.jobId, input.userId);
  if (Number(existing.version) !== input.expectedVersion) {
    throw new ToolJobConflictError();
  }
  const timestamp = now();
  if (input.action === "retry") {
    if (
      existing.status !== "failed" ||
      Number(existing.attempt) >= Number(existing.max_attempts)
    ) {
      throw new ToolJobConflictError("Der Werkzeugauftrag kann nicht erneut eingereiht werden.");
    }
    const nextVersion = input.expectedVersion + 1;
    const results = await database().batch([
      database()
        .prepare(
          `UPDATE tool_jobs
           SET status = 'queued', progress_percent = 0, version = version + 1,
               available_at = ?, updated_at = ?, completed_at = NULL,
               error_code = NULL, error_message = NULL
           WHERE id = ? AND user_id = ? AND version = ? AND status = 'failed'
             AND attempt < max_attempts`,
        )
        .bind(
          timestamp,
          timestamp,
          input.jobId,
          input.userId,
          input.expectedVersion,
        ),
      database()
        .prepare(
          `INSERT INTO tool_job_events
            (id, job_id, user_id, event_type, job_version, attempt,
             progress_percent, note, created_at)
           SELECT ?, id, user_id, 'requeued', version, attempt,
                  progress_percent, 'Tool-Auftrag erneut eingereiht.', ?
           FROM tool_jobs WHERE id = ? AND user_id = ? AND version = ?`,
        )
        .bind(
          crypto.randomUUID(),
          timestamp,
          input.jobId,
          input.userId,
          nextVersion,
        ),
    ]);
    const changes = Number(
      (results[0].meta as { changes?: number } | undefined)?.changes ?? 0,
    );
    if (changes !== 1) throw new ToolJobConflictError();
  } else {
    if (existing.status !== "queued" && existing.status !== "failed") {
      throw new ToolJobConflictError("Nur wartende oder fehlgeschlagene Werkzeugaufträge können abgebrochen werden.");
    }
    const nextVersion = input.expectedVersion + 1;
    const results = await database().batch([
      database()
        .prepare(
          `UPDATE tool_jobs
           SET status = 'cancelled', progress_percent = 100,
               version = version + 1, updated_at = ?, completed_at = ?
           WHERE id = ? AND user_id = ? AND version = ?
             AND status IN ('queued', 'failed')`,
        )
        .bind(
          timestamp,
          timestamp,
          input.jobId,
          input.userId,
          input.expectedVersion,
        ),
      database()
        .prepare(
          `INSERT INTO tool_job_events
            (id, job_id, user_id, event_type, job_version, attempt,
             progress_percent, note, created_at)
           SELECT ?, id, user_id, 'cancelled', version, attempt,
                  progress_percent, 'Tool-Auftrag abgebrochen.', ?
           FROM tool_jobs WHERE id = ? AND user_id = ? AND version = ?`,
        )
        .bind(
          crypto.randomUUID(),
          timestamp,
          input.jobId,
          input.userId,
          nextVersion,
        ),
    ]);
    const changes = Number(
      (results[0].meta as { changes?: number } | undefined)?.changes ?? 0,
    );
    if (changes !== 1) throw new ToolJobConflictError();
  }
  return mapJob(await jobRow(input.jobId, input.userId));
}

export async function recoverStaleToolJobs(userId: string): Promise<number> {
  const staleBefore = new Date(Date.now() - 5 * 60_000).toISOString();
  const timestamp = now();
  const result = await database()
    .prepare(
      `SELECT id, version FROM tool_jobs
       WHERE user_id = ? AND status = 'running' AND worker_id IS NULL
         AND heartbeat_at IS NOT NULL AND heartbeat_at < ?
         AND attempt < max_attempts
       ORDER BY heartbeat_at ASC LIMIT 20`,
    )
    .bind(userId, staleBefore)
    .all<{ id: string; version: number }>();
  let recovered = 0;
  for (const row of result.results ?? []) {
    const nextVersion = Number(row.version) + 1;
    const results = await database().batch([
      database()
        .prepare(
          `UPDATE tool_jobs
           SET status = 'queued', progress_percent = 0, version = version + 1,
               claim_token = NULL, heartbeat_at = NULL, available_at = ?,
               updated_at = ?, error_code = 'STALE_CLAIM_RECOVERED',
               error_message = 'Verwaister Claim wurde automatisch zurückgesetzt.'
           WHERE id = ? AND user_id = ? AND version = ? AND status = 'running'
             AND heartbeat_at < ? AND attempt < max_attempts`,
        )
        .bind(
          timestamp,
          timestamp,
          row.id,
          userId,
          row.version,
          staleBefore,
        ),
      database()
        .prepare(
          `INSERT INTO tool_job_events
            (id, job_id, user_id, event_type, job_version, attempt,
             progress_percent, note, created_at)
           SELECT ?, id, user_id, 'recovered', version, attempt,
                  progress_percent, 'Verwaister Claim automatisch wieder eingereiht.', ?
           FROM tool_jobs WHERE id = ? AND user_id = ? AND version = ?`,
        )
        .bind(crypto.randomUUID(), timestamp, row.id, userId, nextVersion),
    ]);
    recovered += Number(
      (results[0].meta as { changes?: number } | undefined)?.changes ?? 0,
    );
  }
  return recovered;
}

export async function listToolJobs(input: {
  userId: string;
  projectId?: string;
  limit?: number;
}): Promise<{
  jobs: ToolJobRecord[];
  events: ToolJobEventRecord[];
  recovered: number;
}> {
  const recoveredManualClaims = await recoverStaleToolJobs(input.userId);
  const workerRecovery = await recoverExpiredWorkerClaims(input.userId);
  const recovered = recoveredManualClaims + workerRecovery.requeued + workerRecovery.deadLettered;
  const limit = Math.max(1, Math.min(input.limit ?? 50, 100));
  const jobsResult = input.projectId
    ? await database()
        .prepare(
          `SELECT id, project_id, lease_id, tool_name, status, input_json,
                  input_sha256, output_json, error_code, error_message,
                  progress_percent, attempt, max_attempts, version, heartbeat_at, worker_id, claim_expires_at,
                  available_at, idempotency_key, created_at, updated_at,
                  started_at, completed_at
           FROM tool_jobs WHERE user_id = ? AND project_id = ?
           ORDER BY created_at DESC LIMIT ?`,
        )
        .bind(input.userId, input.projectId, limit)
        .all<ToolJobRow>()
    : await database()
        .prepare(
          `SELECT id, project_id, lease_id, tool_name, status, input_json,
                  input_sha256, output_json, error_code, error_message,
                  progress_percent, attempt, max_attempts, version, heartbeat_at, worker_id, claim_expires_at,
                  available_at, idempotency_key, created_at, updated_at,
                  started_at, completed_at
           FROM tool_jobs WHERE user_id = ?
           ORDER BY created_at DESC LIMIT ?`,
        )
        .bind(input.userId, limit)
        .all<ToolJobRow>();
  const eventsResult = await database()
    .prepare(
      `SELECT id, job_id, worker_id, event_type, job_version, attempt,
              progress_percent, note, created_at
       FROM tool_job_events WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 200`,
    )
    .bind(input.userId)
    .all<ToolJobEventRow>();
  return {
    jobs: (jobsResult.results ?? []).map(mapJob),
    events: (eventsResult.results ?? []).map(mapJobEvent),
    recovered,
  };
}
