import { currentRuntimeBindings } from "@/lib/request-context";

type SloStatus = "healthy" | "breached" | "insufficient";
type AlertKind = "success_rate" | "latency" | "rate_limit" | "concurrency" | "dead_letter";
type AlertStatus = "open" | "acknowledged" | "resolved";
type AlertSeverity = "warning" | "critical";

type PolicyRow = {
  id: string; user_id: string; project_id: string; rate_limit_per_minute: number;
  max_concurrency: number; inflight_lease_seconds: number; slo_window_minutes: number;
  slo_min_requests: number; min_success_rate_bps: number; max_p95_latency_ms: number;
  alert_cooldown_minutes: number; enabled: number; version: number; created_at: string; updated_at: string;
};
type BucketRow = {
  user_id: string; project_id: string; window_start: string; request_count: number;
  rejected_count: number; version: number; updated_at: string;
};
type SnapshotRow = {
  id: string; policy_id: string; project_id: string; window_started_at: string; window_ended_at: string;
  request_count: number; success_count: number; success_rate_bps: number; p95_latency_ms: number;
  status: SloStatus; created_at: string;
};
type AlertRow = {
  id: string; policy_id: string; project_id: string; kind: AlertKind; status: AlertStatus;
  severity: AlertSeverity; dedupe_key: string; message: string; observed_value: number;
  threshold_value: number; version: number; first_seen_at: string; last_seen_at: string;
  acknowledged_at: string | null; resolved_at: string | null;
};
type DeadLetterRow = {
  id: string; project_id: string; lease_id: string; tool_name: string; input_sha256: string;
  error_code: string | null; error_message: string | null; attempt: number; max_attempts: number;
  version: number; created_at: string; completed_at: string | null;
};
type ReplayLeaseRow = {
  id: string; project_id: string | null; scope_kind: "account" | "project"; tool_name: string;
  remaining_uses: number; version: number; expires_at: string;
};
type SourceJobRow = DeadLetterRow & { input_json: string };

type RequestMetricRow = { status: "succeeded" | "failed"; latency_ms: number; created_at: string };

export interface OperationsPolicyRecord {
  id: string; projectId: string; rateLimitPerMinute: number; maxConcurrency: number;
  inflightLeaseSeconds: number; sloWindowMinutes: number; sloMinRequests: number;
  minSuccessRateBps: number; maxP95LatencyMs: number; alertCooldownMinutes: number;
  enabled: boolean; version: number; createdAt: string; updatedAt: string;
}
export interface OperationsAdmissionReceipt {
  id: string; projectId: string; expiresAt: string | null; managed: boolean;
}
export interface OperationsSnapshotRecord {
  id: string; projectId: string; windowStartedAt: string; windowEndedAt: string;
  requestCount: number; successCount: number; successRateBps: number; p95LatencyMs: number;
  status: SloStatus; createdAt: string;
}
export interface OperationsAlertRecord {
  id: string; projectId: string; kind: AlertKind; status: AlertStatus; severity: AlertSeverity;
  message: string; observedValue: number; thresholdValue: number; version: number;
  firstSeenAt: string; lastSeenAt: string; acknowledgedAt: string | null; resolvedAt: string | null;
}
export interface OperationsDeadLetterRecord {
  id: string; projectId: string; leaseId: string; toolName: string; inputSha256: string;
  errorCode: string | null; errorMessage: string | null; attempt: number; maxAttempts: number;
  version: number; createdAt: string; completedAt: string | null;
}
export interface OperationsReplayLeaseRecord {
  id: string; projectId: string | null; scope: "account" | "project"; toolName: string;
  remainingUses: number; version: number; expiresAt: string;
}

export class OperationsRuntimeError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message); this.name = code;
  }
}

function database(): D1Database {
  const value = currentRuntimeBindings().DB;
  if (!value) throw new Error("TankAI D1 ist nicht gebunden.");
  return value;
}
function now(): string { return new Date().toISOString(); }
function minuteWindow(value = new Date()): string {
  const normalized = new Date(value); normalized.setUTCSeconds(0, 0); return normalized.toISOString();
}
function plusSeconds(value: string, seconds: number): string {
  return new Date(Date.parse(value) + seconds * 1000).toISOString();
}
function boundedInteger(value: number, label: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new OperationsRuntimeError(`${label} ist ungültig.`, 400, "INVALID_OPERATIONS_POLICY");
  }
  return value;
}
function changes(result: D1Result<unknown>): number {
  return Number((result.meta as { changes?: number } | undefined)?.changes ?? 0);
}
async function requireProject(userId: string, projectId: string): Promise<void> {
  const row = await database().prepare(
    "SELECT id FROM projects WHERE id=? AND user_id=? AND status='active'",
  ).bind(projectId, userId).first<{ id: string }>();
  if (!row) throw new OperationsRuntimeError("Aktives Projekt nicht gefunden.", 404, "OPERATIONS_PROJECT_NOT_FOUND");
}
function mapPolicy(row: PolicyRow): OperationsPolicyRecord {
  return { id: row.id, projectId: row.project_id, rateLimitPerMinute: Number(row.rate_limit_per_minute),
    maxConcurrency: Number(row.max_concurrency), inflightLeaseSeconds: Number(row.inflight_lease_seconds),
    sloWindowMinutes: Number(row.slo_window_minutes), sloMinRequests: Number(row.slo_min_requests),
    minSuccessRateBps: Number(row.min_success_rate_bps), maxP95LatencyMs: Number(row.max_p95_latency_ms),
    alertCooldownMinutes: Number(row.alert_cooldown_minutes), enabled: Boolean(row.enabled),
    version: Number(row.version), createdAt: row.created_at, updatedAt: row.updated_at };
}
function mapSnapshot(row: SnapshotRow): OperationsSnapshotRecord {
  return { id: row.id, projectId: row.project_id, windowStartedAt: row.window_started_at,
    windowEndedAt: row.window_ended_at, requestCount: Number(row.request_count), successCount: Number(row.success_count),
    successRateBps: Number(row.success_rate_bps), p95LatencyMs: Number(row.p95_latency_ms),
    status: row.status, createdAt: row.created_at };
}
function mapAlert(row: AlertRow): OperationsAlertRecord {
  return { id: row.id, projectId: row.project_id, kind: row.kind, status: row.status, severity: row.severity,
    message: row.message, observedValue: Number(row.observed_value), thresholdValue: Number(row.threshold_value),
    version: Number(row.version), firstSeenAt: row.first_seen_at, lastSeenAt: row.last_seen_at,
    acknowledgedAt: row.acknowledged_at, resolvedAt: row.resolved_at };
}
function mapDeadLetter(row: DeadLetterRow): OperationsDeadLetterRecord {
  return { id: row.id, projectId: row.project_id, leaseId: row.lease_id, toolName: row.tool_name,
    inputSha256: row.input_sha256, errorCode: row.error_code, errorMessage: row.error_message,
    attempt: Number(row.attempt), maxAttempts: Number(row.max_attempts), version: Number(row.version),
    createdAt: row.created_at, completedAt: row.completed_at };
}
function mapReplayLease(row: ReplayLeaseRow): OperationsReplayLeaseRecord {
  return { id: row.id, projectId: row.project_id, scope: row.scope_kind, toolName: row.tool_name,
    remainingUses: Number(row.remaining_uses), version: Number(row.version), expiresAt: row.expires_at };
}
async function policyRow(userId: string, projectId: string): Promise<PolicyRow> {
  await requireProject(userId, projectId);
  const existing = await database().prepare(
    "SELECT * FROM deployment_operations_policies WHERE user_id=? AND project_id=?",
  ).bind(userId, projectId).first<PolicyRow>();
  if (existing) return existing;
  const id = crypto.randomUUID(); const createdAt = now();
  await database().prepare(`INSERT OR IGNORE INTO deployment_operations_policies
    (id,user_id,project_id,rate_limit_per_minute,max_concurrency,inflight_lease_seconds,slo_window_minutes,
     slo_min_requests,min_success_rate_bps,max_p95_latency_ms,alert_cooldown_minutes,enabled,version,created_at,updated_at)
    VALUES (?,?,?,60,4,180,60,20,9900,5000,15,1,1,?,?)`).bind(
      id, userId, projectId, createdAt, createdAt,
    ).run();
  return (await database().prepare(
    "SELECT * FROM deployment_operations_policies WHERE user_id=? AND project_id=?",
  ).bind(userId, projectId).first<PolicyRow>())!;
}
async function insertEvent(input: {
  userId: string; projectId: string; eventType: string; entityId?: string | null;
  entityVersion: number; note: string;
}): Promise<void> {
  await database().prepare(`INSERT INTO deployment_operations_events
    (id,user_id,project_id,event_type,entity_id,entity_version,note,created_at)
    VALUES (?,?,?,?,?,?,?,?)`).bind(
      crypto.randomUUID(), input.userId, input.projectId, input.eventType, input.entityId ?? null,
      input.entityVersion, input.note.slice(0, 500), now(),
    ).run();
}

export async function configureOperationsPolicy(input: {
  userId: string; projectId: string; rateLimitPerMinute: number; maxConcurrency: number;
  inflightLeaseSeconds: number; sloWindowMinutes: number; sloMinRequests: number;
  minSuccessRateBps: number; maxP95LatencyMs: number; alertCooldownMinutes: number;
  enabled: boolean; expectedVersion?: number;
}): Promise<OperationsPolicyRecord> {
  const existing = await policyRow(input.userId, input.projectId);
  if (input.expectedVersion !== existing.version) throw new OperationsRuntimeError(
    "Die Operations-Richtlinie wurde parallel verändert.", 409, "OPERATIONS_POLICY_CONFLICT",
  );
  const values = {
    rate: boundedInteger(input.rateLimitPerMinute, "rateLimitPerMinute", 1, 10000),
    concurrency: boundedInteger(input.maxConcurrency, "maxConcurrency", 1, 100),
    lease: boundedInteger(input.inflightLeaseSeconds, "inflightLeaseSeconds", 5, 600),
    window: boundedInteger(input.sloWindowMinutes, "sloWindowMinutes", 5, 1440),
    minimum: boundedInteger(input.sloMinRequests, "sloMinRequests", 1, 10000),
    success: boundedInteger(input.minSuccessRateBps, "minSuccessRateBps", 0, 10000),
    latency: boundedInteger(input.maxP95LatencyMs, "maxP95LatencyMs", 1, 120000),
    cooldown: boundedInteger(input.alertCooldownMinutes, "alertCooldownMinutes", 1, 1440),
  };
  const updatedAt = now(); const nextVersion = existing.version + 1;
  const batch = await database().batch([
    database().prepare(`UPDATE deployment_operations_policies SET rate_limit_per_minute=?,max_concurrency=?,
      inflight_lease_seconds=?,slo_window_minutes=?,slo_min_requests=?,min_success_rate_bps=?,
      max_p95_latency_ms=?,alert_cooldown_minutes=?,enabled=?,version=version+1,updated_at=?
      WHERE id=? AND user_id=? AND version=?`).bind(
        values.rate, values.concurrency, values.lease, values.window, values.minimum, values.success,
        values.latency, values.cooldown, input.enabled ? 1 : 0, updatedAt, existing.id, input.userId, existing.version,
      ),
    database().prepare(`INSERT INTO deployment_operations_events
      (id,user_id,project_id,event_type,entity_id,entity_version,note,created_at)
      SELECT ?,?,?,'policy_reconfigured',?,?,?,? WHERE changes()=1`).bind(
        crypto.randomUUID(), input.userId, input.projectId, existing.id, nextVersion,
        `Admission ${values.rate}/min, concurrency ${values.concurrency}; SLO ${values.success} bps / ${values.latency} ms.`, updatedAt,
      ),
  ]);
  if (changes(batch[0]) !== 1) throw new OperationsRuntimeError(
    "Die Operations-Richtlinie wurde parallel verändert.", 409, "OPERATIONS_POLICY_CONFLICT",
  );
  return mapPolicy((await database().prepare("SELECT * FROM deployment_operations_policies WHERE id=?")
    .bind(existing.id).first<PolicyRow>())!);
}

async function reconcileExpiredInflight(userId: string, projectId: string, timestamp: string): Promise<number> {
  const result = await database().prepare(
    "DELETE FROM deployment_inflight_leases WHERE user_id=? AND project_id=? AND expires_at<=?",
  ).bind(userId, projectId, timestamp).run();
  const recovered = changes(result);
  if (recovered > 0) await insertEvent({ userId, projectId, eventType: "inflight_recovered",
    entityVersion: 1, note: `${recovered} verwaiste In-flight-Lease(s) entfernt.` });
  return recovered;
}

async function openOrUpdateAlert(input: {
  policy: PolicyRow; kind: AlertKind; severity: AlertSeverity; observedValue: number;
  thresholdValue: number; message: string;
}): Promise<OperationsAlertRecord> {
  const dedupeKey = `${input.policy.id}:${input.kind}`; const timestamp = now();
  const existing = await database().prepare(`SELECT * FROM deployment_alerts
    WHERE user_id=? AND project_id=? AND dedupe_key=? AND status IN ('open','acknowledged')`)
    .bind(input.policy.user_id, input.policy.project_id, dedupeKey).first<AlertRow>();
  if (existing) {
    const cooldownMs = input.policy.alert_cooldown_minutes * 60_000;
    if (Date.parse(timestamp) - Date.parse(existing.last_seen_at) < cooldownMs
      && existing.observed_value === input.observedValue
      && existing.threshold_value === input.thresholdValue
      && existing.severity === input.severity
      && existing.message === input.message.slice(0, 500)) {
      return mapAlert(existing);
    }
    const nextVersion = existing.version + 1;
    const batch = await database().batch([
      database().prepare(`UPDATE deployment_alerts SET severity=?,message=?,observed_value=?,threshold_value=?,
        last_seen_at=?,version=version+1 WHERE id=? AND user_id=? AND version=?`).bind(
          input.severity, input.message.slice(0, 500), input.observedValue, input.thresholdValue,
          timestamp, existing.id, input.policy.user_id, existing.version,
        ),
      database().prepare(`INSERT INTO deployment_operations_events
        (id,user_id,project_id,event_type,entity_id,entity_version,note,created_at)
        SELECT ?,?,?,'alert_updated',?,?,?,? WHERE changes()=1`).bind(
          crypto.randomUUID(), input.policy.user_id, input.policy.project_id, existing.id, nextVersion,
          input.message.slice(0, 500), timestamp,
        ),
    ]);
    if (changes(batch[0]) === 1) return mapAlert((await database().prepare(
      "SELECT * FROM deployment_alerts WHERE id=?",
    ).bind(existing.id).first<AlertRow>())!);
    return openOrUpdateAlert(input);
  }
  const id = crypto.randomUUID();
  try {
    await database().batch([
      database().prepare(`INSERT INTO deployment_alerts
        (id,policy_id,user_id,project_id,kind,status,severity,dedupe_key,message,observed_value,threshold_value,
         version,first_seen_at,last_seen_at,acknowledged_at,resolved_at)
        VALUES (?,?,?,?,?,'open',?,?,?,?,?,1,?,?,NULL,NULL)`).bind(
          id, input.policy.id, input.policy.user_id, input.policy.project_id, input.kind, input.severity,
          dedupeKey, input.message.slice(0, 500), input.observedValue, input.thresholdValue, timestamp, timestamp,
        ),
      database().prepare(`INSERT INTO deployment_operations_events
        (id,user_id,project_id,event_type,entity_id,entity_version,note,created_at)
        VALUES (?,?,?,'alert_opened',?,1,?,?)`).bind(
          crypto.randomUUID(), input.policy.user_id, input.policy.project_id, id, input.message.slice(0, 500), timestamp,
        ),
    ]);
  } catch {
    return openOrUpdateAlert(input);
  }
  return mapAlert((await database().prepare("SELECT * FROM deployment_alerts WHERE id=?").bind(id).first<AlertRow>())!);
}

async function resolveAlert(policy: PolicyRow, kind: AlertKind, message: string): Promise<void> {
  const row = await database().prepare(`SELECT * FROM deployment_alerts
    WHERE user_id=? AND project_id=? AND dedupe_key=? AND status IN ('open','acknowledged')`)
    .bind(policy.user_id, policy.project_id, `${policy.id}:${kind}`).first<AlertRow>();
  if (!row) return;
  const timestamp = now(); const nextVersion = row.version + 1;
  const batch = await database().batch([
    database().prepare(`UPDATE deployment_alerts SET status='resolved',resolved_at=?,last_seen_at=?,
      version=version+1 WHERE id=? AND user_id=? AND version=?`).bind(
        timestamp, timestamp, row.id, policy.user_id, row.version,
      ),
    database().prepare(`INSERT INTO deployment_operations_events
      (id,user_id,project_id,event_type,entity_id,entity_version,note,created_at)
      SELECT ?,?,?,'alert_resolved',?,?,?,? WHERE changes()=1`).bind(
        crypto.randomUUID(), policy.user_id, policy.project_id, row.id, nextVersion, message.slice(0, 500), timestamp,
      ),
  ]);
  if (changes(batch[0]) !== 1) await resolveAlert(policy, kind, message);
}

export async function acquireDeploymentAdmission(input: {
  userId: string; projectId: string; requestId: string;
}): Promise<OperationsAdmissionReceipt> {
  const policy = await policyRow(input.userId, input.projectId);
  if (!policy.enabled) return { id: input.requestId, projectId: input.projectId, expiresAt: null, managed: false };
  const timestamp = now(); await reconcileExpiredInflight(input.userId, input.projectId, timestamp);
  const windowStart = minuteWindow(new Date(timestamp));
  const rateResult = await database().prepare(`INSERT INTO deployment_admission_buckets
    (user_id,project_id,window_start,request_count,rejected_count,version,updated_at)
    VALUES (?,?,?,1,0,1,?)
    ON CONFLICT(user_id,project_id,window_start) DO UPDATE SET
      request_count=request_count+1,version=version+1,updated_at=excluded.updated_at
    WHERE request_count<?`).bind(
      input.userId, input.projectId, windowStart, timestamp, policy.rate_limit_per_minute,
    ).run();
  if (changes(rateResult) !== 1) {
    await database().prepare(`UPDATE deployment_admission_buckets SET rejected_count=rejected_count+1,
      version=version+1,updated_at=? WHERE user_id=? AND project_id=? AND window_start=?`).bind(
        timestamp, input.userId, input.projectId, windowStart,
      ).run();
    const bucket = await database().prepare(`SELECT * FROM deployment_admission_buckets
      WHERE user_id=? AND project_id=? AND window_start=?`).bind(
        input.userId, input.projectId, windowStart,
      ).first<BucketRow>();
    await insertEvent({ userId: input.userId, projectId: input.projectId, eventType: "rate_limited",
      entityId: policy.id, entityVersion: policy.version, note: `Minutenlimit ${policy.rate_limit_per_minute} erreicht.` });
    await openOrUpdateAlert({ policy, kind: "rate_limit", severity: "warning",
      observedValue: Number(bucket?.request_count ?? policy.rate_limit_per_minute), thresholdValue: policy.rate_limit_per_minute,
      message: `Admission-Rate-Limit von ${policy.rate_limit_per_minute} Requests pro Minute erreicht.` });
    throw new OperationsRuntimeError("Zu viele produktive Requests in dieser Minute.", 429, "DEPLOYMENT_RATE_LIMITED");
  }
  const expiresAt = plusSeconds(timestamp, policy.inflight_lease_seconds);
  const concurrencyResult = await database().prepare(`INSERT INTO deployment_inflight_leases
    (id,user_id,project_id,acquired_at,expires_at)
    SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM deployment_inflight_leases
      WHERE user_id=? AND project_id=? AND expires_at>?)<?`).bind(
        input.requestId, input.userId, input.projectId, timestamp, expiresAt,
        input.userId, input.projectId, timestamp, policy.max_concurrency,
      ).run();
  if (changes(concurrencyResult) !== 1) {
    const current = await database().prepare(`SELECT COUNT(*) AS total FROM deployment_inflight_leases
      WHERE user_id=? AND project_id=? AND expires_at>?`).bind(
        input.userId, input.projectId, timestamp,
      ).first<{ total: number }>();
    await insertEvent({ userId: input.userId, projectId: input.projectId, eventType: "concurrency_limited",
      entityId: policy.id, entityVersion: policy.version, note: `Concurrency-Limit ${policy.max_concurrency} erreicht.` });
    await openOrUpdateAlert({ policy, kind: "concurrency", severity: "warning",
      observedValue: Number(current?.total ?? policy.max_concurrency), thresholdValue: policy.max_concurrency,
      message: `Maximal ${policy.max_concurrency} gleichzeitige produktive Requests erlaubt.` });
    throw new OperationsRuntimeError("Zu viele gleichzeitige produktive Requests.", 503, "DEPLOYMENT_BACKPRESSURE");
  }
  await insertEvent({ userId: input.userId, projectId: input.projectId, eventType: "admission_granted",
    entityId: input.requestId, entityVersion: 1, note: `Admission bis ${expiresAt}.` });
  return { id: input.requestId, projectId: input.projectId, expiresAt, managed: true };
}

export async function releaseDeploymentAdmission(input: {
  userId: string; projectId: string; requestId: string;
}): Promise<void> {
  await database().prepare(
    "DELETE FROM deployment_inflight_leases WHERE id=? AND user_id=? AND project_id=?",
  ).bind(input.requestId, input.userId, input.projectId).run();
}

function percentile(values: number[], fraction: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
}

export async function evaluateDeploymentSlo(input: {
  userId: string; projectId: string; force?: boolean;
}): Promise<OperationsSnapshotRecord> {
  const policy = await policyRow(input.userId, input.projectId);
  const windowEndedAt = now();
  if (input.force === false) {
    const latest = await database().prepare(`SELECT * FROM deployment_slo_snapshots
      WHERE user_id=? AND project_id=? ORDER BY created_at DESC LIMIT 1`).bind(
        input.userId, input.projectId,
      ).first<SnapshotRow>();
    const minimumIntervalMs = Math.min(60, policy.alert_cooldown_minutes * 60) * 1000;
    if (latest && Date.parse(windowEndedAt) - Date.parse(latest.created_at) < minimumIntervalMs) return mapSnapshot(latest);
  }
  const windowStartedAt = new Date(Date.parse(windowEndedAt) - policy.slo_window_minutes * 60_000).toISOString();
  const rows = (await database().prepare(`SELECT status,latency_ms,created_at FROM deployment_requests
    WHERE user_id=? AND project_id=? AND created_at>=? ORDER BY created_at DESC LIMIT 10000`).bind(
      input.userId, input.projectId, windowStartedAt,
    ).all<RequestMetricRow>()).results;
  const successCount = rows.filter((row) => row.status === "succeeded").length;
  const requestCount = rows.length;
  const successRateBps = requestCount ? Math.round(successCount / requestCount * 10000) : 0;
  const p95LatencyMs = percentile(rows.map((row) => Number(row.latency_ms)), 0.95);
  const enough = requestCount >= policy.slo_min_requests;
  const breached = enough && (successRateBps < policy.min_success_rate_bps || p95LatencyMs > policy.max_p95_latency_ms);
  const status: SloStatus = !enough ? "insufficient" : breached ? "breached" : "healthy";
  const id = crypto.randomUUID();
  await database().batch([
    database().prepare(`INSERT INTO deployment_slo_snapshots
      (id,policy_id,user_id,project_id,window_started_at,window_ended_at,request_count,success_count,
       success_rate_bps,p95_latency_ms,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
        id, policy.id, input.userId, input.projectId, windowStartedAt, windowEndedAt, requestCount,
        successCount, successRateBps, p95LatencyMs, status, windowEndedAt,
      ),
    database().prepare(`INSERT INTO deployment_operations_events
      (id,user_id,project_id,event_type,entity_id,entity_version,note,created_at)
      VALUES (?,?,?,'slo_evaluated',?,1,?,?)`).bind(
        crypto.randomUUID(), input.userId, input.projectId, id,
        `${status}; ${successRateBps} bps; p95 ${p95LatencyMs} ms; n=${requestCount}.`, windowEndedAt,
      ),
  ]);
  if (enough && successRateBps < policy.min_success_rate_bps) await openOrUpdateAlert({
    policy, kind: "success_rate", severity: successRateBps < policy.min_success_rate_bps - 500 ? "critical" : "warning",
    observedValue: successRateBps, thresholdValue: policy.min_success_rate_bps,
    message: `Erfolgsrate ${successRateBps} bps liegt unter dem SLO von ${policy.min_success_rate_bps} bps.`,
  }); else await resolveAlert(policy, "success_rate", "Die Erfolgsrate liegt wieder im SLO.");
  if (enough && p95LatencyMs > policy.max_p95_latency_ms) await openOrUpdateAlert({
    policy, kind: "latency", severity: p95LatencyMs > policy.max_p95_latency_ms * 2 ? "critical" : "warning",
    observedValue: p95LatencyMs, thresholdValue: policy.max_p95_latency_ms,
    message: `P95-Latenz ${p95LatencyMs} ms überschreitet das SLO von ${policy.max_p95_latency_ms} ms.`,
  }); else await resolveAlert(policy, "latency", "Die P95-Latenz liegt wieder im SLO.");
  return mapSnapshot((await database().prepare("SELECT * FROM deployment_slo_snapshots WHERE id=?")
    .bind(id).first<SnapshotRow>())!);
}

async function reconcileDeadLetterAlert(policy: PolicyRow, count: number): Promise<void> {
  if (count > 0) await openOrUpdateAlert({ policy, kind: "dead_letter", severity: count >= 5 ? "critical" : "warning",
    observedValue: count, thresholdValue: 0, message: `${count} Werkzeugauftrag/-aufträge befinden sich im Dead-Letter-Status.` });
  else await resolveAlert(policy, "dead_letter", "Keine Dead-Letter-Aufträge mehr vorhanden.");
}

export async function acknowledgeOperationsAlert(input: {
  userId: string; projectId: string; alertId: string; expectedVersion: number;
}): Promise<OperationsAlertRecord> {
  const row = await database().prepare(`SELECT * FROM deployment_alerts
    WHERE id=? AND user_id=? AND project_id=?`).bind(input.alertId, input.userId, input.projectId).first<AlertRow>();
  if (!row) throw new OperationsRuntimeError("Alert nicht gefunden.", 404, "OPERATIONS_ALERT_NOT_FOUND");
  if (row.status !== "open" || row.version !== input.expectedVersion) throw new OperationsRuntimeError(
    "Der Alert wurde parallel verändert oder kann nicht bestätigt werden.", 409, "OPERATIONS_ALERT_CONFLICT",
  );
  const timestamp = now(); const nextVersion = row.version + 1;
  const batch = await database().batch([
    database().prepare(`UPDATE deployment_alerts SET status='acknowledged',acknowledged_at=?,last_seen_at=?,
      version=version+1 WHERE id=? AND user_id=? AND version=? AND status='open'`).bind(
        timestamp, timestamp, row.id, input.userId, row.version,
      ),
    database().prepare(`INSERT INTO deployment_operations_events
      (id,user_id,project_id,event_type,entity_id,entity_version,note,created_at)
      SELECT ?,?,?,'alert_acknowledged',?,?,'Alert bestätigt.',? WHERE changes()=1`).bind(
        crypto.randomUUID(), input.userId, input.projectId, row.id, nextVersion, timestamp,
      ),
  ]);
  if (changes(batch[0]) !== 1) throw new OperationsRuntimeError(
    "Der Alert wurde parallel verändert.", 409, "OPERATIONS_ALERT_CONFLICT",
  );
  return mapAlert((await database().prepare("SELECT * FROM deployment_alerts WHERE id=?").bind(row.id).first<AlertRow>())!);
}

export async function replayDeadLetterToolJob(input: {
  userId: string; projectId: string; sourceJobId: string; leaseId: string; expectedVersion: number;
}): Promise<{ sourceJobId: string; replayJobId: string; leaseId: string; createdAt: string }> {
  const source = await database().prepare(`SELECT id,project_id,lease_id,tool_name,input_json,input_sha256,error_code,
    error_message,attempt,max_attempts,version,created_at,completed_at FROM tool_jobs
    WHERE id=? AND user_id=? AND project_id=? AND status='dead_letter'`).bind(
      input.sourceJobId, input.userId, input.projectId,
    ).first<SourceJobRow>();
  if (!source) throw new OperationsRuntimeError("Dead-Letter-Auftrag nicht gefunden.", 404, "DEAD_LETTER_NOT_FOUND");
  if (source.version !== input.expectedVersion) throw new OperationsRuntimeError(
    "Der Dead-Letter-Auftrag wurde parallel verändert.", 409, "DEAD_LETTER_CONFLICT",
  );
  const timestamp = now();
  const lease = await database().prepare(`SELECT id,project_id,scope_kind,tool_name,remaining_uses,version,expires_at
    FROM tool_execution_leases WHERE id=? AND user_id=? AND status='active' AND remaining_uses>0 AND expires_at>?
      AND tool_name=? AND ((scope_kind='account' AND project_id IS NULL) OR (scope_kind='project' AND project_id=?))`).bind(
        input.leaseId, input.userId, timestamp, source.tool_name, input.projectId,
      ).first<ReplayLeaseRow>();
  if (!lease) throw new OperationsRuntimeError(
    "Für den Replay fehlt eine aktive, passende Tool-Freigabe.", 409, "DEAD_LETTER_LEASE_UNAVAILABLE",
  );
  const replayJobId = crypto.randomUUID(); const replayId = crypto.randomUUID();
  const leaseNextVersion = lease.version + 1; const remaining = lease.remaining_uses - 1;
  const batch = await database().batch([
    database().prepare(`UPDATE tool_execution_leases SET remaining_uses=remaining_uses-1,
      status=CASE WHEN remaining_uses-1=0 THEN 'depleted' ELSE 'active' END,version=version+1,
      last_event_id=?,last_used_at=?,updated_at=? WHERE id=? AND user_id=? AND version=?
      AND status='active' AND remaining_uses>0 AND expires_at>?`).bind(
        crypto.randomUUID(), timestamp, timestamp, lease.id, input.userId, lease.version, timestamp,
      ),
    database().prepare(`INSERT INTO tool_jobs
      (id,user_id,project_id,lease_id,tool_name,status,input_json,input_sha256,output_json,error_code,error_message,
       progress_percent,attempt,max_attempts,version,worker_id,claim_token,heartbeat_at,claim_expires_at,available_at,
       idempotency_key,created_at,updated_at,started_at,completed_at)
      SELECT ?,?,?,?,?, 'queued',?,?,NULL,NULL,NULL,0,0,?,1,NULL,NULL,NULL,NULL,?,?,?, ?,NULL,NULL WHERE changes()=1`).bind(
        replayJobId, input.userId, input.projectId, lease.id, source.tool_name, source.input_json, source.input_sha256,
        source.max_attempts, timestamp, `replay:${source.id}:${replayJobId}`, timestamp, timestamp,
      ),
    database().prepare(`INSERT INTO tool_execution_lease_events
      (id,lease_id,job_id,user_id,event_type,lease_version,remaining_uses,created_at)
      SELECT ?,?,?,?,'consumed',?,?,? WHERE changes()=1`).bind(
        crypto.randomUUID(), lease.id, replayJobId, input.userId, leaseNextVersion, remaining, timestamp,
      ),
    database().prepare(`INSERT INTO tool_job_events
      (id,job_id,user_id,worker_id,event_type,job_version,attempt,progress_percent,note,created_at)
      SELECT ?,?,?,NULL,'created',1,0,0,?,? WHERE changes()=1`).bind(
        crypto.randomUUID(), replayJobId, input.userId, `Replay von Dead Letter ${source.id}.`, timestamp,
      ),
    database().prepare(`INSERT INTO tool_job_replays
      (id,source_job_id,replay_job_id,lease_id,user_id,project_id,source_job_version,created_at)
      SELECT ?,?,?,?,?,?,?,? WHERE changes()=1`).bind(
        replayId, source.id, replayJobId, lease.id, input.userId, input.projectId, source.version, timestamp,
      ),
    database().prepare(`INSERT INTO deployment_operations_events
      (id,user_id,project_id,event_type,entity_id,entity_version,note,created_at)
      SELECT ?,?,?,'dead_letter_replayed',?,1,?,? WHERE changes()=1`).bind(
        crypto.randomUUID(), input.userId, input.projectId, replayJobId,
        `Dead Letter ${source.id} als ${replayJobId} neu autorisiert.`, timestamp,
      ),
  ]);
  if (changes(batch[0]) !== 1 || changes(batch[1]) !== 1) throw new OperationsRuntimeError(
    "Die Replay-Freigabe wurde parallel verändert.", 409, "DEAD_LETTER_REPLAY_CONFLICT",
  );
  const policy = await policyRow(input.userId, input.projectId);
  const count = await database().prepare(`SELECT COUNT(*) AS total FROM tool_jobs
    WHERE user_id=? AND project_id=? AND status='dead_letter'`).bind(
      input.userId, input.projectId,
    ).first<{ total: number }>();
  await reconcileDeadLetterAlert(policy, Number(count?.total ?? 0));
  return { sourceJobId: source.id, replayJobId, leaseId: lease.id, createdAt: timestamp };
}

export async function exportOperationsAudit(input: {
  userId: string; projectId: string;
}): Promise<Record<string, unknown>> {
  const state = await listOperationsState(input);
  const [requests, controls, replays] = await Promise.all([
    database().prepare(`SELECT id,release_id,config_id,provider_id,routing_key_hash,request_sha256,response_sha256,
      status,source,attempt_count,latency_ms,error_code,created_at FROM deployment_requests
      WHERE user_id=? AND project_id=? ORDER BY created_at DESC LIMIT 1000`).bind(
        input.userId, input.projectId,
      ).all<Record<string, unknown>>(),
    database().prepare(`SELECT event_type,release_id,provider_id,entity_version,note,created_at
      FROM deployment_control_events WHERE user_id=? AND project_id=? ORDER BY created_at DESC LIMIT 1000`).bind(
        input.userId, input.projectId,
      ).all<Record<string, unknown>>(),
    database().prepare(`SELECT source_job_id,replay_job_id,lease_id,source_job_version,created_at FROM tool_job_replays
      WHERE user_id=? AND project_id=? ORDER BY created_at DESC LIMIT 1000`).bind(
        input.userId, input.projectId,
      ).all<Record<string, unknown>>(),
  ]);
  await insertEvent({ userId: input.userId, projectId: input.projectId, eventType: "audit_exported",
    entityVersion: state.policy.version, note: "Redigierter Operations-Audit-Export erzeugt." });
  return {
    schema: "tankai.operations.audit.v1", exportedAt: now(), projectId: input.projectId,
    policy: state.policy, admission: state.admission, latestSnapshot: state.latestSnapshot,
    alerts: state.alerts, deadLetters: state.deadLetters.map(({ errorMessage: _omitted, ...record }) => record),
    deploymentRequests: requests.results, deploymentControlEvents: controls.results,
    deadLetterReplays: replays.results, operationsEvents: state.recentEvents,
    privacy: { promptBodiesIncluded: false, providerResponsesIncluded: false, toolInputsIncluded: false },
  };
}

export async function listOperationsState(input: { userId: string; projectId: string }): Promise<{
  policy: OperationsPolicyRecord;
  admission: { windowStart: string; requestCount: number; rejectedCount: number; inFlight: number };
  latestSnapshot: OperationsSnapshotRecord | null;
  alerts: OperationsAlertRecord[];
  deadLetters: OperationsDeadLetterRecord[];
  replayLeases: OperationsReplayLeaseRecord[];
  recentEvents: Array<Record<string, unknown>>;
}> {
  const policy = await policyRow(input.userId, input.projectId); const timestamp = now();
  await reconcileExpiredInflight(input.userId, input.projectId, timestamp);
  const windowStart = minuteWindow(new Date(timestamp));
  const [bucket, inFlight, snapshot, alertRows, deadLetterRows, leaseRows, eventRows] = await Promise.all([
    database().prepare(`SELECT * FROM deployment_admission_buckets WHERE user_id=? AND project_id=? AND window_start=?`)
      .bind(input.userId, input.projectId, windowStart).first<BucketRow>(),
    database().prepare(`SELECT COUNT(*) AS total FROM deployment_inflight_leases
      WHERE user_id=? AND project_id=? AND expires_at>?`).bind(input.userId, input.projectId, timestamp).first<{ total: number }>(),
    database().prepare(`SELECT * FROM deployment_slo_snapshots WHERE user_id=? AND project_id=?
      ORDER BY created_at DESC LIMIT 1`).bind(input.userId, input.projectId).first<SnapshotRow>(),
    database().prepare(`SELECT * FROM deployment_alerts WHERE user_id=? AND project_id=?
      ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1 ELSE 2 END,last_seen_at DESC LIMIT 100`)
      .bind(input.userId, input.projectId).all<AlertRow>(),
    database().prepare(`SELECT id,project_id,lease_id,tool_name,input_sha256,error_code,error_message,attempt,
      max_attempts,version,created_at,completed_at FROM tool_jobs WHERE user_id=? AND project_id=?
      AND status='dead_letter' ORDER BY updated_at DESC LIMIT 100`).bind(input.userId, input.projectId).all<DeadLetterRow>(),
    database().prepare(`SELECT id,project_id,scope_kind,tool_name,remaining_uses,version,expires_at
      FROM tool_execution_leases WHERE user_id=? AND status='active' AND remaining_uses>0 AND expires_at>?
      AND (scope_kind='account' OR project_id=?) ORDER BY expires_at ASC LIMIT 100`).bind(
        input.userId, timestamp, input.projectId,
      ).all<ReplayLeaseRow>(),
    database().prepare(`SELECT event_type,entity_id,entity_version,note,created_at FROM deployment_operations_events
      WHERE user_id=? AND project_id=? ORDER BY created_at DESC LIMIT 100`).bind(
        input.userId, input.projectId,
      ).all<Record<string, unknown>>(),
  ]);
  await reconcileDeadLetterAlert(policy, deadLetterRows.results.length);
  const refreshedAlerts = await database().prepare(`SELECT * FROM deployment_alerts WHERE user_id=? AND project_id=?
    ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1 ELSE 2 END,last_seen_at DESC LIMIT 100`)
    .bind(input.userId, input.projectId).all<AlertRow>();
  return {
    policy: mapPolicy(policy),
    admission: { windowStart, requestCount: Number(bucket?.request_count ?? 0),
      rejectedCount: Number(bucket?.rejected_count ?? 0), inFlight: Number(inFlight?.total ?? 0) },
    latestSnapshot: snapshot ? mapSnapshot(snapshot) : null,
    alerts: refreshedAlerts.results.map(mapAlert), deadLetters: deadLetterRows.results.map(mapDeadLetter),
    replayLeases: leaseRows.results.map(mapReplayLease), recentEvents: eventRows.results,
  };
}
