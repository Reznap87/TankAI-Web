import { currentRuntimeBindings } from "@/lib/request-context";
import { configuredProviders, type CompletionRequest, type ModelProvider } from "@/lib/providers";
import { recordTankBenchCanaryObservation } from "@/lib/tankbench-runtime";
import { resolveTankBenchRelease } from "@/lib/tankbench-suite-runner";
import {
  acquireDeploymentAdmission,
  evaluateDeploymentSlo,
  OperationsRuntimeError,
  releaseDeploymentAdmission,
} from "@/lib/operations-runtime";

type ReleaseStatus = "candidate" | "canary" | "active" | "rejected" | "rolled_back" | "superseded";
type BreakerState = "closed" | "open" | "half_open";
type AttemptStatus = "succeeded" | "failed" | "skipped_open" | "unavailable";

type ReleaseRow = {
  id: string; user_id: string; project_id: string; label: string; status: ReleaseStatus;
  traffic_percent: number; version: number; updated_at: string;
};
type ConfigRow = {
  id: string; release_id: string; user_id: string; project_id: string; provider_id: string;
  fallback_provider_ids_json: string; max_output_tokens: number; failure_threshold: number;
  recovery_timeout_seconds: number; half_open_successes: number; config_sha256: string;
  version: number; created_at: string; updated_at: string;
};
type TrafficRow = {
  id: string; user_id: string; project_id: string; canary_release_id: string;
  traffic_percent: number; enabled: number; version: number; created_at: string; updated_at: string;
};
type BreakerRow = {
  id: string; user_id: string; project_id: string; release_id: string; provider_id: string;
  state: BreakerState; consecutive_failures: number; half_open_success_count: number;
  opened_at: string | null; next_probe_at: string | null; last_failure_at: string | null;
  version: number; created_at: string; updated_at: string;
};
type RequestRow = {
  id: string; release_id: string; provider_id: string; status: "succeeded" | "failed";
  source: "active" | "canary"; attempt_count: number; latency_ms: number;
  error_code: string | null; created_at: string;
};
type AttemptRow = {
  id: string; request_id: string; attempt_ordinal: number; provider_id: string;
  status: AttemptStatus; latency_ms: number; error_code: string | null; created_at: string;
};

type AttemptReceipt = {
  ordinal: number; providerId: string; status: AttemptStatus; latencyMs: number;
  errorCode: string | null; responseSha256: string | null; createdAt: string;
};

export interface DeploymentConfigRecord {
  id: string; releaseId: string; projectId: string; providerId: string; fallbackProviderIds: string[];
  maxOutputTokens: number; failureThreshold: number; recoveryTimeoutSeconds: number;
  halfOpenSuccesses: number; configSha256: string; version: number; createdAt: string; updatedAt: string;
}
export interface DeploymentTrafficRecord {
  id: string; projectId: string; canaryReleaseId: string; trafficPercent: number;
  enabled: boolean; version: number; createdAt: string; updatedAt: string;
}
export interface DeploymentCircuitRecord {
  id: string; projectId: string; releaseId: string; providerId: string; state: BreakerState;
  consecutiveFailures: number; halfOpenSuccessCount: number; nextProbeAt: string | null;
  lastFailureAt: string | null; version: number; updatedAt: string;
}
export interface DeploymentMetricWindow {
  minutes: number; requests: number; successes: number; failures: number; successRateBps: number;
  p50LatencyMs: number; p95LatencyMs: number; averageLatencyMs: number;
}
export interface DeploymentTraceRecord {
  id: string; releaseId: string; providerId: string; status: "succeeded" | "failed";
  source: "active" | "canary"; attemptCount: number; latencyMs: number;
  errorCode: string | null; createdAt: string; attempts: AttemptReceipt[];
}

export class DeploymentControllerError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message); this.name = code;
  }
}

function database(): D1Database {
  const value = currentRuntimeBindings().DB;
  if (!value) throw new Error("TankAI D1 ist nicht gebunden.");
  return value;
}
function timestamp(): string { return new Date().toISOString(); }
function boundedInteger(value: number, label: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new DeploymentControllerError(`${label} ist ungültig.`, 400, "INVALID_DEPLOYMENT_CONFIG");
  }
  return value;
}
async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join("");
}
function parseProviderIds(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch { return []; }
}
function mapConfig(row: ConfigRow): DeploymentConfigRecord {
  return {
    id: row.id, releaseId: row.release_id, projectId: row.project_id, providerId: row.provider_id,
    fallbackProviderIds: parseProviderIds(row.fallback_provider_ids_json), maxOutputTokens: Number(row.max_output_tokens),
    failureThreshold: Number(row.failure_threshold), recoveryTimeoutSeconds: Number(row.recovery_timeout_seconds),
    halfOpenSuccesses: Number(row.half_open_successes), configSha256: row.config_sha256,
    version: Number(row.version), createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
function mapTraffic(row: TrafficRow): DeploymentTrafficRecord {
  return { id: row.id, projectId: row.project_id, canaryReleaseId: row.canary_release_id,
    trafficPercent: Number(row.traffic_percent), enabled: Boolean(row.enabled), version: Number(row.version),
    createdAt: row.created_at, updatedAt: row.updated_at };
}
function mapCircuit(row: BreakerRow): DeploymentCircuitRecord {
  return { id: row.id, projectId: row.project_id, releaseId: row.release_id, providerId: row.provider_id,
    state: row.state, consecutiveFailures: Number(row.consecutive_failures),
    halfOpenSuccessCount: Number(row.half_open_success_count), nextProbeAt: row.next_probe_at,
    lastFailureAt: row.last_failure_at, version: Number(row.version), updatedAt: row.updated_at };
}
async function releaseRow(id: string, userId: string): Promise<ReleaseRow> {
  const row = await database().prepare(
    "SELECT id,user_id,project_id,label,status,traffic_percent,version,updated_at FROM tankbench_releases WHERE id=? AND user_id=?",
  ).bind(id, userId).first<ReleaseRow>();
  if (!row) throw new DeploymentControllerError("Release nicht gefunden.", 404, "DEPLOYMENT_RELEASE_NOT_FOUND");
  return row;
}
async function configRow(releaseId: string, userId: string): Promise<ConfigRow> {
  const row = await database().prepare(
    "SELECT * FROM deployment_release_configs WHERE release_id=? AND user_id=?",
  ).bind(releaseId, userId).first<ConfigRow>();
  if (!row) throw new DeploymentControllerError(
    "Für den Release fehlt eine Deployment-Konfiguration.", 409, "DEPLOYMENT_CONFIG_MISSING",
  );
  return row;
}
function providerMap(): Map<string, ModelProvider> {
  return new Map(configuredProviders().map((provider) => [provider.id, provider]));
}
function providerChain(primary: string, fallbacks: string[], providers: Map<string, ModelProvider>): string[] {
  const normalized = [primary, ...fallbacks].map((value) => value.trim()).filter(Boolean);
  if (normalized.length < 1 || normalized.length > 4 || new Set(normalized).size !== normalized.length) {
    throw new DeploymentControllerError("Die Provider-Kette ist ungültig.", 400, "INVALID_PROVIDER_CHAIN");
  }
  for (const providerId of normalized) {
    if (!providers.has(providerId)) throw new DeploymentControllerError(
      `Provider ${providerId} ist nicht konfiguriert.`, 409, "DEPLOYMENT_PROVIDER_NOT_READY",
    );
  }
  return normalized;
}
async function insertControlEvent(input: {
  userId: string; projectId: string; releaseId?: string | null; providerId?: string | null;
  eventType: "traffic_shifted" | "traffic_automatic" | "breaker_opened" | "breaker_half_opened" | "breaker_closed" | "breaker_reset" | "fallback_used";
  entityVersion: number; note: string;
}): Promise<void> {
  await database().prepare(`INSERT INTO deployment_control_events
    (id,user_id,project_id,release_id,provider_id,event_type,entity_version,note,created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).bind(
      crypto.randomUUID(), input.userId, input.projectId, input.releaseId ?? null,
      input.providerId ?? null, input.eventType, input.entityVersion, input.note.slice(0, 500), timestamp(),
    ).run();
}

export async function configureDeploymentRelease(input: {
  userId: string; releaseId: string; providerId: string; fallbackProviderIds?: string[];
  maxOutputTokens: number; failureThreshold?: number; recoveryTimeoutSeconds?: number;
  halfOpenSuccesses?: number; expectedVersion?: number;
}): Promise<DeploymentConfigRecord> {
  const release = await releaseRow(input.releaseId, input.userId);
  if (!["candidate", "canary", "active"].includes(release.status)) throw new DeploymentControllerError(
    "Dieser Release ist nicht konfigurierbar.", 409, "DEPLOYMENT_RELEASE_NOT_CONFIGURABLE",
  );
  const providers = providerMap();
  const chain = providerChain(input.providerId, input.fallbackProviderIds ?? [], providers);
  const maxOutputTokens = boundedInteger(input.maxOutputTokens, "maxOutputTokens", 64, 32768);
  const failureThreshold = boundedInteger(input.failureThreshold ?? 3, "failureThreshold", 1, 20);
  const recoveryTimeoutSeconds = boundedInteger(input.recoveryTimeoutSeconds ?? 60, "recoveryTimeoutSeconds", 5, 3600);
  const halfOpenSuccesses = boundedInteger(input.halfOpenSuccesses ?? 1, "halfOpenSuccesses", 1, 10);
  const fallbackJson = JSON.stringify(chain.slice(1));
  const hash = await sha256(JSON.stringify({ releaseId: release.id, providerIds: chain, maxOutputTokens,
    failureThreshold, recoveryTimeoutSeconds, halfOpenSuccesses }));
  const now = timestamp();
  const existing = await database().prepare(
    "SELECT * FROM deployment_release_configs WHERE release_id=? AND user_id=?",
  ).bind(release.id, input.userId).first<ConfigRow>();
  if (existing) {
    if (input.expectedVersion !== existing.version) throw new DeploymentControllerError(
      "Die Deployment-Konfiguration wurde parallel verändert.", 409, "DEPLOYMENT_CONFIG_CONFLICT",
    );
    const nextVersion = existing.version + 1;
    const batch = await database().batch([
      database().prepare(`UPDATE deployment_release_configs SET provider_id=?,fallback_provider_ids_json=?,
        max_output_tokens=?,failure_threshold=?,recovery_timeout_seconds=?,half_open_successes=?,
        config_sha256=?,version=version+1,updated_at=? WHERE id=? AND user_id=? AND version=?`).bind(
          chain[0], fallbackJson, maxOutputTokens, failureThreshold, recoveryTimeoutSeconds,
          halfOpenSuccesses, hash, now, existing.id, input.userId, existing.version,
        ),
      database().prepare(`INSERT INTO deployment_events
        (id,user_id,project_id,release_id,event_type,entity_version,note,created_at)
        SELECT ?,?,?,?,'reconfigured',?,?,? WHERE changes()=1`).bind(
          crypto.randomUUID(), input.userId, release.project_id, release.id, nextVersion,
          `Provider-Kette ${chain.join(" → ")}`, now,
        ),
    ]);
    if (Number((batch[0].meta as { changes?: number } | undefined)?.changes ?? 0) !== 1) {
      throw new DeploymentControllerError("Die Deployment-Konfiguration wurde parallel verändert.", 409, "DEPLOYMENT_CONFIG_CONFLICT");
    }
    return mapConfig(await configRow(release.id, input.userId));
  }
  const id = crypto.randomUUID();
  await database().batch([
    database().prepare(`INSERT INTO deployment_release_configs
      (id,release_id,user_id,project_id,provider_id,fallback_provider_ids_json,max_output_tokens,
       failure_threshold,recovery_timeout_seconds,half_open_successes,config_sha256,version,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,?)`).bind(
        id, release.id, input.userId, release.project_id, chain[0], fallbackJson, maxOutputTokens,
        failureThreshold, recoveryTimeoutSeconds, halfOpenSuccesses, hash, now, now,
      ),
    database().prepare(`INSERT INTO deployment_events
      (id,user_id,project_id,release_id,event_type,entity_version,note,created_at)
      VALUES (?,?,?,?, 'configured',1,?,?)`).bind(
        crypto.randomUUID(), input.userId, release.project_id, release.id, `Provider-Kette ${chain.join(" → ")}`, now,
      ),
  ]);
  return mapConfig(await configRow(release.id, input.userId));
}

export async function setDeploymentTraffic(input: {
  userId: string; projectId: string; releaseId: string; trafficPercent: number; expectedVersion?: number;
}): Promise<DeploymentTrafficRecord> {
  const release = await releaseRow(input.releaseId, input.userId);
  if (release.project_id !== input.projectId || release.status !== "canary") throw new DeploymentControllerError(
    "Manuelles Traffic-Shifting ist nur für den aktiven Canary dieses Projekts erlaubt.", 409, "DEPLOYMENT_TRAFFIC_NOT_CANARY",
  );
  const percent = boundedInteger(input.trafficPercent, "trafficPercent", 0, 100);
  const existing = await database().prepare(
    "SELECT * FROM deployment_traffic_overrides WHERE user_id=? AND project_id=?",
  ).bind(input.userId, input.projectId).first<TrafficRow>();
  const now = timestamp();
  if (existing) {
    if (input.expectedVersion !== existing.version) throw new DeploymentControllerError(
      "Die Traffic-Steuerung wurde parallel verändert.", 409, "DEPLOYMENT_TRAFFIC_CONFLICT",
    );
    const next = existing.version + 1;
    const batch = await database().batch([
      database().prepare(`UPDATE deployment_traffic_overrides SET canary_release_id=?,traffic_percent=?,enabled=1,
        version=version+1,updated_at=? WHERE id=? AND user_id=? AND version=?`).bind(
          release.id, percent, now, existing.id, input.userId, existing.version,
        ),
      database().prepare(`INSERT INTO deployment_control_events
        (id,user_id,project_id,release_id,event_type,entity_version,note,created_at)
        SELECT ?,?,?,?,'traffic_shifted',?,?,? WHERE changes()=1`).bind(
          crypto.randomUUID(), input.userId, input.projectId, release.id, next, `Manuell auf ${percent} % gesetzt.`, now,
        ),
    ]);
    if (Number((batch[0].meta as { changes?: number } | undefined)?.changes ?? 0) !== 1) {
      throw new DeploymentControllerError("Die Traffic-Steuerung wurde parallel verändert.", 409, "DEPLOYMENT_TRAFFIC_CONFLICT");
    }
  } else {
    const id = crypto.randomUUID();
    await database().batch([
      database().prepare(`INSERT INTO deployment_traffic_overrides
        (id,user_id,project_id,canary_release_id,traffic_percent,enabled,version,created_at,updated_at)
        VALUES (?,?,?,?,?,1,1,?,?)`).bind(id, input.userId, input.projectId, release.id, percent, now, now),
      database().prepare(`INSERT INTO deployment_control_events
        (id,user_id,project_id,release_id,event_type,entity_version,note,created_at)
        VALUES (?,?,?,?, 'traffic_shifted',1,?,?)`).bind(
          crypto.randomUUID(), input.userId, input.projectId, release.id, `Manuell auf ${percent} % gesetzt.`, now,
        ),
    ]);
  }
  const row = await database().prepare(
    "SELECT * FROM deployment_traffic_overrides WHERE user_id=? AND project_id=?",
  ).bind(input.userId, input.projectId).first<TrafficRow>();
  return mapTraffic(row!);
}

export async function clearDeploymentTraffic(input: {
  userId: string; projectId: string; expectedVersion: number;
}): Promise<DeploymentTrafficRecord> {
  const existing = await database().prepare(
    "SELECT * FROM deployment_traffic_overrides WHERE user_id=? AND project_id=?",
  ).bind(input.userId, input.projectId).first<TrafficRow>();
  if (!existing || existing.version !== input.expectedVersion) throw new DeploymentControllerError(
    "Die Traffic-Steuerung wurde parallel verändert oder fehlt.", 409, "DEPLOYMENT_TRAFFIC_CONFLICT",
  );
  const now = timestamp(); const next = existing.version + 1;
  const batch = await database().batch([
    database().prepare(`UPDATE deployment_traffic_overrides SET enabled=0,version=version+1,updated_at=?
      WHERE id=? AND user_id=? AND version=?`).bind(now, existing.id, input.userId, existing.version),
    database().prepare(`INSERT INTO deployment_control_events
      (id,user_id,project_id,release_id,event_type,entity_version,note,created_at)
      SELECT ?,?,?,?,'traffic_automatic',?,'TankBench-Automatik wieder aktiviert.',? WHERE changes()=1`).bind(
        crypto.randomUUID(), input.userId, input.projectId, existing.canary_release_id, next, now,
      ),
  ]);
  if (Number((batch[0].meta as { changes?: number } | undefined)?.changes ?? 0) !== 1) {
    throw new DeploymentControllerError("Die Traffic-Steuerung wurde parallel verändert.", 409, "DEPLOYMENT_TRAFFIC_CONFLICT");
  }
  const row = await database().prepare("SELECT * FROM deployment_traffic_overrides WHERE id=?").bind(existing.id).first<TrafficRow>();
  return mapTraffic(row!);
}

async function ensureBreaker(input: { userId: string; projectId: string; releaseId: string; providerId: string }): Promise<BreakerRow> {
  const now = timestamp();
  await database().prepare(`INSERT OR IGNORE INTO deployment_circuit_breakers
    (id,user_id,project_id,release_id,provider_id,state,consecutive_failures,half_open_success_count,version,created_at,updated_at)
    VALUES (?,?,?,?,?,'closed',0,0,1,?,?)`).bind(
      crypto.randomUUID(), input.userId, input.projectId, input.releaseId, input.providerId, now, now,
    ).run();
  const row = await database().prepare(
    "SELECT * FROM deployment_circuit_breakers WHERE release_id=? AND provider_id=? AND user_id=?",
  ).bind(input.releaseId, input.providerId, input.userId).first<BreakerRow>();
  if (!row) throw new Error("Circuit Breaker konnte nicht angelegt werden.");
  return row;
}
async function acquireBreaker(input: { userId: string; projectId: string; releaseId: string; providerId: string }): Promise<{ allowed: boolean; state: BreakerState }> {
  let row = await ensureBreaker(input);
  if (row.state === "closed") return { allowed: true, state: "closed" };
  if (row.state === "half_open") return { allowed: false, state: "half_open" };
  if (row.next_probe_at && Date.parse(row.next_probe_at) > Date.now()) return { allowed: false, state: "open" };
  const now = timestamp(); const next = row.version + 1;
  const batch = await database().batch([
    database().prepare(`UPDATE deployment_circuit_breakers SET state='half_open',version=version+1,updated_at=?
      WHERE id=? AND user_id=? AND version=? AND state='open'`).bind(now, row.id, input.userId, row.version),
    database().prepare(`INSERT INTO deployment_control_events
      (id,user_id,project_id,release_id,provider_id,event_type,entity_version,note,created_at)
      SELECT ?,?,?,?,?, 'breaker_half_opened',?,'Ein einzelner Wiederherstellungsversuch wurde freigegeben.',?
      WHERE changes()=1`).bind(
        crypto.randomUUID(), input.userId, input.projectId, input.releaseId, input.providerId, next, now,
      ),
  ]);
  if (Number((batch[0].meta as { changes?: number } | undefined)?.changes ?? 0) === 1) {
    return { allowed: true, state: "half_open" };
  }
  row = await ensureBreaker(input);
  return { allowed: row.state === "closed", state: row.state };
}
async function breakerAfterSuccess(input: {
  userId: string; projectId: string; releaseId: string; providerId: string;
  recoveryTimeoutSeconds: number; halfOpenSuccesses: number;
}): Promise<void> {
  for (let retry = 0; retry < 3; retry += 1) {
    const row = await ensureBreaker(input);
    if (row.state === "closed" && row.consecutive_failures === 0 && row.half_open_success_count === 0) return;
    const now = timestamp(); const nextVersion = row.version + 1;
    let state: BreakerState = "closed"; let successes = 0; let nextProbe: string | null = null;
    let event = false;
    if (row.state === "half_open") {
      successes = row.half_open_success_count + 1;
      if (successes < input.halfOpenSuccesses) {
        state = "open";
        nextProbe = new Date(Date.now() + Math.min(1000, input.recoveryTimeoutSeconds * 1000)).toISOString();
      } else { successes = 0; event = true; }
    } else if (row.state === "open") {
      return;
    } else { event = row.consecutive_failures > 0; }
    const statements: D1PreparedStatement[] = [database().prepare(`UPDATE deployment_circuit_breakers SET
      state=?,consecutive_failures=0,half_open_success_count=?,opened_at=?,next_probe_at=?,version=version+1,updated_at=?
      WHERE id=? AND user_id=? AND version=?`).bind(
        state, successes, state === "open" ? row.opened_at : null, nextProbe, now, row.id, input.userId, row.version,
      )];
    if (event) statements.push(database().prepare(`INSERT INTO deployment_control_events
      (id,user_id,project_id,release_id,provider_id,event_type,entity_version,note,created_at)
      SELECT ?,?,?,?,?, 'breaker_closed',?,'Provider ist wieder gesund.',? WHERE changes()=1`).bind(
        crypto.randomUUID(), input.userId, input.projectId, input.releaseId, input.providerId, nextVersion, now,
      ));
    const results = await database().batch(statements);
    if (Number((results[0].meta as { changes?: number } | undefined)?.changes ?? 0) === 1) return;
  }
}
async function breakerAfterFailure(input: {
  userId: string; projectId: string; releaseId: string; providerId: string;
  failureThreshold: number; recoveryTimeoutSeconds: number;
}): Promise<void> {
  for (let retry = 0; retry < 3; retry += 1) {
    const row = await ensureBreaker(input);
    if (row.state === "open") return;
    const failures = row.consecutive_failures + 1;
    const shouldOpen = row.state === "half_open" || failures >= input.failureThreshold;
    const now = timestamp(); const nextVersion = row.version + 1;
    const nextProbe = shouldOpen ? new Date(Date.now() + input.recoveryTimeoutSeconds * 1000).toISOString() : null;
    const statements: D1PreparedStatement[] = [database().prepare(`UPDATE deployment_circuit_breakers SET
      state=?,consecutive_failures=?,half_open_success_count=0,opened_at=?,next_probe_at=?,last_failure_at=?,
      version=version+1,updated_at=? WHERE id=? AND user_id=? AND version=?`).bind(
        shouldOpen ? "open" : "closed", failures, shouldOpen ? now : null, nextProbe, now, now,
        row.id, input.userId, row.version,
      )];
    if (shouldOpen) statements.push(database().prepare(`INSERT INTO deployment_control_events
      (id,user_id,project_id,release_id,provider_id,event_type,entity_version,note,created_at)
      SELECT ?,?,?,?,?, 'breaker_opened',?,?,? WHERE changes()=1`).bind(
        crypto.randomUUID(), input.userId, input.projectId, input.releaseId, input.providerId, nextVersion,
        `Circuit geöffnet; nächster Probeversuch ${nextProbe}.`, now,
      ));
    const results = await database().batch(statements);
    if (Number((results[0].meta as { changes?: number } | undefined)?.changes ?? 0) === 1) return;
  }
}

export async function resetDeploymentCircuit(input: {
  userId: string; releaseId: string; providerId: string; expectedVersion: number;
}): Promise<DeploymentCircuitRecord> {
  const release = await releaseRow(input.releaseId, input.userId);
  const row = await ensureBreaker({ userId: input.userId, projectId: release.project_id, releaseId: release.id, providerId: input.providerId });
  if (row.version !== input.expectedVersion) throw new DeploymentControllerError(
    "Der Circuit Breaker wurde parallel verändert.", 409, "DEPLOYMENT_BREAKER_CONFLICT",
  );
  const now = timestamp(); const next = row.version + 1;
  const batch = await database().batch([
    database().prepare(`UPDATE deployment_circuit_breakers SET state='closed',consecutive_failures=0,
      half_open_success_count=0,opened_at=NULL,next_probe_at=NULL,last_failure_at=NULL,version=version+1,updated_at=?
      WHERE id=? AND user_id=? AND version=?`).bind(now, row.id, input.userId, row.version),
    database().prepare(`INSERT INTO deployment_control_events
      (id,user_id,project_id,release_id,provider_id,event_type,entity_version,note,created_at)
      SELECT ?,?,?,?,?, 'breaker_reset',?,'Circuit Breaker manuell zurückgesetzt.',? WHERE changes()=1`).bind(
        crypto.randomUUID(), input.userId, release.project_id, release.id, input.providerId, next, now,
      ),
  ]);
  if (Number((batch[0].meta as { changes?: number } | undefined)?.changes ?? 0) !== 1) {
    throw new DeploymentControllerError("Der Circuit Breaker wurde parallel verändert.", 409, "DEPLOYMENT_BREAKER_CONFLICT");
  }
  return mapCircuit((await database().prepare("SELECT * FROM deployment_circuit_breakers WHERE id=?").bind(row.id).first<BreakerRow>())!);
}

async function trafficOverride(userId: string, projectId: string): Promise<TrafficRow | null> {
  return database().prepare(
    "SELECT * FROM deployment_traffic_overrides WHERE user_id=? AND project_id=? AND enabled=1",
  ).bind(userId, projectId).first<TrafficRow>();
}
async function recordCanaryObservation(input: {
  userId: string; releaseId: string; success: boolean; latencyMs: number; errorCode?: string;
}): Promise<void> {
  for (let retry = 0; retry < 3; retry += 1) {
    const release = await releaseRow(input.releaseId, input.userId);
    if (release.status !== "canary") return;
    try {
      await recordTankBenchCanaryObservation({ ...input, expectedVersion: release.version });
      return;
    } catch (error) {
      if (!(error instanceof Error) || error.name !== "TANKBENCH_RELEASE_CONFLICT" || retry === 2) return;
    }
  }
}
function safeErrorCode(error: unknown): string {
  const value = error instanceof Error ? error.name || "PROVIDER_ERROR" : "PROVIDER_ERROR";
  return value.replace(/[^A-Z0-9_.-]/giu, "_").slice(0, 120) || "PROVIDER_ERROR";
}
async function persistRequest(input: {
  requestId: string; userId: string; projectId: string; release: ReleaseRow; config: ConfigRow;
  providerId: string; source: "active" | "canary"; routingHash: string; requestHash: string;
  responseHash: string | null; status: "succeeded" | "failed"; latencyMs: number;
  errorCode: string | null; attempts: AttemptReceipt[];
}): Promise<void> {
  const statements: D1PreparedStatement[] = [database().prepare(`INSERT INTO deployment_requests
    (id,user_id,project_id,release_id,config_id,provider_id,routing_key_hash,request_sha256,response_sha256,
     status,source,attempt_count,latency_ms,error_code,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      input.requestId, input.userId, input.projectId, input.release.id, input.config.id, input.providerId,
      input.routingHash, input.requestHash, input.responseHash, input.status, input.source, input.attempts.length,
      input.latencyMs, input.errorCode, timestamp(),
    )];
  for (const attempt of input.attempts) statements.push(database().prepare(`INSERT INTO deployment_request_attempts
    (id,request_id,user_id,project_id,release_id,attempt_ordinal,provider_id,status,latency_ms,error_code,response_sha256,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      crypto.randomUUID(), input.requestId, input.userId, input.projectId, input.release.id, attempt.ordinal,
      attempt.providerId, attempt.status, attempt.latencyMs, attempt.errorCode, attempt.responseSha256, attempt.createdAt,
    ));
  statements.push(database().prepare(`INSERT INTO deployment_events
    (id,user_id,project_id,release_id,event_type,entity_version,note,created_at)
    VALUES (?,?,?,?,?,?,?,?)`).bind(
      crypto.randomUUID(), input.userId, input.projectId, input.release.id,
      input.status === "succeeded" ? "request_succeeded" : "request_failed", input.release.version,
      `${input.providerId}; ${input.attempts.length} Versuch(e); ${input.latencyMs} ms`, timestamp(),
    ));
  await database().batch(statements);
}

export async function executeDeploymentRequest(input: {
  userId: string; projectId: string; routingKey: string; request: CompletionRequest;
}): Promise<{ releaseId: string; providerId: string; text: string; latencyMs: number; source: "active" | "canary"; attemptCount: number }> {
  const requestId = crypto.randomUUID();
  try {
    await acquireDeploymentAdmission({ userId: input.userId, projectId: input.projectId, requestId });
  } catch (error) {
    if (error instanceof OperationsRuntimeError) {
      throw new DeploymentControllerError(error.message, error.status, error.code);
    }
    throw error;
  }
  try {
    const override = await trafficOverride(input.userId, input.projectId);
    const route = await resolveTankBenchRelease({
      userId: input.userId, projectId: input.projectId, routingKey: input.routingKey,
      ...(override ? { canaryPercentOverride: override.traffic_percent } : {}),
    });
    const release = await releaseRow(route.selectedReleaseId, input.userId);
    const config = await configRow(release.id, input.userId);
    const providers = providerMap();
    const chain = [config.provider_id, ...parseProviderIds(config.fallback_provider_ids_json)].slice(0, 4);
    const routingHash = await sha256(`${input.projectId}:${input.routingKey.trim()}`);
    const maxOutputTokens = Math.min(input.request.maxOutputTokens, config.max_output_tokens);
    const requestHash = await sha256(JSON.stringify({ instructions: input.request.instructions,
      messages: input.request.messages, maxOutputTokens, responseFormat: input.request.responseFormat ?? "text" }));
    const started = Date.now(); const attempts: AttemptReceipt[] = [];
    let output: { providerId: string; text: string; responseHash: string } | null = null;
    let lastErrorCode = "DEPLOYMENT_PROVIDER_CHAIN_EXHAUSTED";
    for (let index = 0; index < chain.length; index += 1) {
      const providerId = chain[index]; const provider = providers.get(providerId); const attemptTime = timestamp();
      if (!provider) {
        attempts.push({ ordinal: index + 1, providerId, status: "unavailable", latencyMs: 0,
          errorCode: "PROVIDER_NOT_CONFIGURED", responseSha256: null, createdAt: attemptTime });
        lastErrorCode = "PROVIDER_NOT_CONFIGURED"; continue;
      }
      const gate = await acquireBreaker({ userId: input.userId, projectId: input.projectId, releaseId: release.id, providerId });
      if (!gate.allowed) {
        attempts.push({ ordinal: index + 1, providerId, status: "skipped_open", latencyMs: 0,
          errorCode: `CIRCUIT_${gate.state.toUpperCase()}`, responseSha256: null, createdAt: attemptTime });
        lastErrorCode = `CIRCUIT_${gate.state.toUpperCase()}`; continue;
      }
      const providerStarted = Date.now();
      try {
        const result = await provider.complete({ ...input.request, maxOutputTokens });
        const latency = Math.min(120000, Math.max(0, result.latencyMs || Date.now() - providerStarted));
        const responseHash = await sha256(result.text);
        attempts.push({ ordinal: index + 1, providerId, status: "succeeded", latencyMs: latency,
          errorCode: null, responseSha256: responseHash, createdAt: attemptTime });
        await breakerAfterSuccess({ userId: input.userId, projectId: input.projectId, releaseId: release.id,
          providerId, recoveryTimeoutSeconds: config.recovery_timeout_seconds, halfOpenSuccesses: config.half_open_successes });
        output = { providerId, text: result.text, responseHash };
        if (index > 0) await insertControlEvent({ userId: input.userId, projectId: input.projectId, releaseId: release.id,
          providerId, eventType: "fallback_used", entityVersion: release.version,
          note: `Fallback ${index + 1}/${chain.length} hat den Request übernommen.` });
        break;
      } catch (error) {
        const latency = Math.min(120000, Math.max(0, Date.now() - providerStarted));
        const errorCode = safeErrorCode(error); lastErrorCode = errorCode;
        attempts.push({ ordinal: index + 1, providerId, status: "failed", latencyMs: latency,
          errorCode, responseSha256: null, createdAt: attemptTime });
        await breakerAfterFailure({ userId: input.userId, projectId: input.projectId, releaseId: release.id,
          providerId, failureThreshold: config.failure_threshold, recoveryTimeoutSeconds: config.recovery_timeout_seconds });
      }
    }
    const totalLatency = Math.min(120000, Math.max(0, Date.now() - started));
    if (output) {
      await persistRequest({ requestId, userId: input.userId, projectId: input.projectId, release, config,
        providerId: output.providerId, source: route.source, routingHash, requestHash, responseHash: output.responseHash,
        status: "succeeded", latencyMs: totalLatency, errorCode: null, attempts });
      if (release.status === "canary") await recordCanaryObservation({ userId: input.userId, releaseId: release.id,
        success: true, latencyMs: totalLatency });
      try { await evaluateDeploymentSlo({ userId: input.userId, projectId: input.projectId, force: false }); } catch { /* request success remains authoritative */ }
      return { releaseId: release.id, providerId: output.providerId, text: output.text,
        latencyMs: totalLatency, source: route.source, attemptCount: attempts.length };
    }
    const providerId = attempts.at(-1)?.providerId ?? config.provider_id;
    await persistRequest({ requestId, userId: input.userId, projectId: input.projectId, release, config,
      providerId, source: route.source, routingHash, requestHash, responseHash: null, status: "failed",
      latencyMs: totalLatency, errorCode: lastErrorCode, attempts });
    if (release.status === "canary") await recordCanaryObservation({ userId: input.userId, releaseId: release.id,
      success: false, latencyMs: totalLatency, errorCode: lastErrorCode });
    try { await evaluateDeploymentSlo({ userId: input.userId, projectId: input.projectId, force: false }); } catch { /* failure receipt remains authoritative */ }
    throw new DeploymentControllerError("Alle freigegebenen Provider sind fehlgeschlagen oder durch Circuit Breaker gesperrt.",
      503, "DEPLOYMENT_PROVIDER_CHAIN_EXHAUSTED");
  } finally {
    try { await releaseDeploymentAdmission({ userId: input.userId, projectId: input.projectId, requestId }); } catch { /* lease expires safely */ }
  }
}

function percentile(values: number[], fraction: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
}
function metricWindow(rows: RequestRow[], minutes: number): DeploymentMetricWindow {
  const cutoff = Date.now() - minutes * 60_000;
  const selected = rows.filter((row) => Date.parse(row.created_at) >= cutoff);
  const successes = selected.filter((row) => row.status === "succeeded").length;
  const latencies = selected.map((row) => Number(row.latency_ms));
  return { minutes, requests: selected.length, successes, failures: selected.length - successes,
    successRateBps: selected.length ? Math.round((successes / selected.length) * 10000) : 0,
    p50LatencyMs: percentile(latencies, 0.5), p95LatencyMs: percentile(latencies, 0.95),
    averageLatencyMs: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : 0 };
}

export async function listDeploymentState(input: { userId: string; projectId: string }): Promise<{
  providers: Array<{ id: string; family: string; name: string; model: string }>;
  releases: Array<{ id: string; label: string; status: ReleaseStatus; trafficPercent: number; version: number }>;
  configs: DeploymentConfigRecord[]; traffic: DeploymentTrafficRecord | null;
  circuits: DeploymentCircuitRecord[]; metrics: DeploymentMetricWindow[];
  recentRequests: DeploymentTraceRecord[]; recentEvents: Array<Record<string, unknown>>;
}> {
  const [configRows, releaseRows, traffic, circuitRows, requestRows, eventRows] = await Promise.all([
    database().prepare("SELECT * FROM deployment_release_configs WHERE user_id=? AND project_id=? ORDER BY updated_at DESC")
      .bind(input.userId, input.projectId).all<ConfigRow>(),
    database().prepare(`SELECT id,user_id,project_id,label,status,traffic_percent,version,updated_at
      FROM tankbench_releases WHERE user_id=? AND project_id=? ORDER BY updated_at DESC LIMIT 50`)
      .bind(input.userId, input.projectId).all<ReleaseRow>(),
    database().prepare("SELECT * FROM deployment_traffic_overrides WHERE user_id=? AND project_id=?")
      .bind(input.userId, input.projectId).first<TrafficRow>(),
    database().prepare("SELECT * FROM deployment_circuit_breakers WHERE user_id=? AND project_id=? ORDER BY updated_at DESC")
      .bind(input.userId, input.projectId).all<BreakerRow>(),
    database().prepare(`SELECT id,release_id,provider_id,status,source,attempt_count,latency_ms,error_code,created_at
      FROM deployment_requests WHERE user_id=? AND project_id=? ORDER BY created_at DESC LIMIT 500`)
      .bind(input.userId, input.projectId).all<RequestRow>(),
    database().prepare(`SELECT event_type,release_id,provider_id,entity_version,note,created_at
      FROM deployment_control_events WHERE user_id=? AND project_id=? ORDER BY created_at DESC LIMIT 100`)
      .bind(input.userId, input.projectId).all<Record<string, unknown>>(),
  ]);
  const visibleRequests = requestRows.results.slice(0, 100);
  let attemptRows: AttemptRow[] = [];
  if (visibleRequests.length) {
    const placeholders = visibleRequests.map(() => "?").join(",");
    attemptRows = (await database().prepare(`SELECT id,request_id,attempt_ordinal,provider_id,status,latency_ms,error_code,created_at
      FROM deployment_request_attempts WHERE request_id IN (${placeholders}) ORDER BY request_id,attempt_ordinal`)
      .bind(...visibleRequests.map((row) => row.id)).all<AttemptRow>()).results;
  }
  const attemptsByRequest = new Map<string, AttemptReceipt[]>();
  for (const attempt of attemptRows) {
    const entries = attemptsByRequest.get(attempt.request_id) ?? [];
    entries.push({ ordinal: Number(attempt.attempt_ordinal), providerId: attempt.provider_id, status: attempt.status,
      latencyMs: Number(attempt.latency_ms), errorCode: attempt.error_code, responseSha256: null, createdAt: attempt.created_at });
    attemptsByRequest.set(attempt.request_id, entries);
  }
  return {
    providers: configuredProviders().map((provider) => ({ id: provider.id, family: provider.family,
      name: provider.name, model: provider.model })),
    releases: releaseRows.results.map((row) => ({ id: row.id, label: row.label, status: row.status,
      trafficPercent: Number(row.traffic_percent), version: Number(row.version) })),
    configs: configRows.results.map(mapConfig), traffic: traffic ? mapTraffic(traffic) : null,
    circuits: circuitRows.results.map(mapCircuit), metrics: [15, 60, 1440].map((minutes) => metricWindow(requestRows.results, minutes)),
    recentRequests: visibleRequests.map((row) => ({ id: row.id, releaseId: row.release_id, providerId: row.provider_id,
      status: row.status, source: row.source, attemptCount: Number(row.attempt_count), latencyMs: Number(row.latency_ms),
      errorCode: row.error_code, createdAt: row.created_at, attempts: attemptsByRequest.get(row.id) ?? [] })),
    recentEvents: eventRows.results,
  };
}
