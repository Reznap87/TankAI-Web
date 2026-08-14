import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import ts from "../node_modules/typescript/lib/typescript.js";

const root = path.resolve(import.meta.dirname, "..");
function migrations(db) {
  let count = 0;
  for (const file of fs.readdirSync(path.join(root, "drizzle")).filter((name) => /^\d{4}_.+\.sql$/u.test(name)).sort()) {
    const source = fs.readFileSync(path.join(root, "drizzle", file), "utf8");
    for (const statement of source.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) {
      db.exec(`${statement};`); count += 1;
    }
  }
  return count;
}
class D1Prepared {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new D1Prepared(this.db, this.sql, args); }
  async first() { return this.db.prepare(this.sql).get(...this.args) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args) }; }
  runSync() { const result = this.db.prepare(this.sql).run(...this.args); return { success: true, meta: { changes: Number(result.changes) } }; }
  async run() { return this.runSync(); }
}
class D1DatabaseMock {
  constructor(db) { this.db = db; }
  prepare(sql) { return new D1Prepared(this.db, sql); }
  async batch(statements) {
    const results = []; this.db.exec("BEGIN IMMEDIATE");
    try { for (const statement of statements) results.push(statement.runSync()); this.db.exec("COMMIT"); return results; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
}
function transpile(file) {
  return ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
}
function loadRuntime(db) {
  const module = { exports: {} }; const d1 = new D1DatabaseMock(db);
  new Function("require", "module", "exports", transpile("lib/operations-runtime.ts"))((specifier) => {
    if (specifier === "@/lib/request-context") return { currentRuntimeBindings: () => ({ DB: d1 }) };
    throw new Error(`Unexpected import ${specifier}`);
  }, module, module.exports);
  return module.exports;
}
function seedProject(db) {
  const now = new Date().toISOString(); const userId = "ops-user";
  const projectId = "22222222-2222-4222-8222-222222222222";
  db.prepare("INSERT INTO projects (id,user_id,name,description,status,version,content_revision,created_at,updated_at) VALUES (?,?,?,'','active',1,0,?,?)")
    .run(projectId, userId, "Operations", now, now);
  return { userId, projectId, now };
}
function insertDeploymentRequest(db, ids, id, status, latencyMs, createdAt = new Date().toISOString()) {
  const releaseId = "ops-release"; const configId = "ops-config";
  if (!db.prepare("SELECT 1 FROM tankbench_releases WHERE id=?").get(releaseId)) {
    db.prepare("INSERT INTO tankbench_suites (id,user_id,project_id,name,description,status,case_count,suite_sha256,version,created_at,updated_at,frozen_at) VALUES ('ops-suite',?,?,?,'','frozen',1,?,1,?,?,?)")
      .run(ids.userId, ids.projectId, "Ops Suite", "a".repeat(64), ids.now, ids.now, ids.now);
    db.prepare("INSERT INTO tankbench_runs (id,suite_id,user_id,project_id,baseline_label,candidate_label,status,min_score_delta_bps,max_regressions,baseline_score_bps,candidate_score_bps,delta_bps,regression_count,required_failure_count,safety_failure_count,version,created_at,updated_at,evaluated_at,completed_at) VALUES ('ops-run','ops-suite',?,?, 'base','candidate','passed',0,0,9000,9500,500,0,0,0,1,?,?,?,?)")
      .run(ids.userId, ids.projectId, ids.now, ids.now, ids.now, ids.now);
    db.prepare("INSERT INTO tankbench_releases (id,source_run_id,user_id,project_id,label,status,traffic_percent,max_error_rate_bps,max_p95_latency_ms,min_stage_observations,stage_observation_offset,observation_count,error_count,version,created_at,updated_at,promoted_at) VALUES (?,'ops-run',?,?,?,'active',100,1000,5000,20,0,0,0,1,?,?,?)")
      .run(releaseId, ids.userId, ids.projectId, "ops", ids.now, ids.now, ids.now);
    db.prepare("INSERT INTO deployment_release_configs (id,release_id,user_id,project_id,provider_id,fallback_provider_ids_json,max_output_tokens,failure_threshold,recovery_timeout_seconds,half_open_successes,config_sha256,version,created_at,updated_at) VALUES (?, ?, ?, ?, 'provider','[]',1024,3,60,1,?,1,?,?)")
      .run(configId, releaseId, ids.userId, ids.projectId, "b".repeat(64), ids.now, ids.now);
  }
  db.prepare("INSERT INTO deployment_requests (id,user_id,project_id,release_id,config_id,provider_id,routing_key_hash,request_sha256,response_sha256,status,source,attempt_count,latency_ms,error_code,created_at) VALUES (?,?,?,?,?,'provider',?,?,? ,?,'active',1,?,?,?)")
    .run(id, ids.userId, ids.projectId, releaseId, configId, "c".repeat(64), "d".repeat(64), status === "succeeded" ? "e".repeat(64) : null, status, latencyMs, status === "failed" ? "FAIL" : null, createdAt);
}

test("Reliability admission enforces concurrency, rate limits and recovers stale leases", async () => {
  const db = new DatabaseSync(":memory:"); db.exec("PRAGMA foreign_keys=ON"); assert.equal(migrations(db), 252);
  const ids = seedProject(db); const runtime = loadRuntime(db);
  let policy = (await runtime.listOperationsState(ids)).policy;
  policy = await runtime.configureOperationsPolicy({ ...ids, rateLimitPerMinute: 2, maxConcurrency: 1,
    inflightLeaseSeconds: 30, sloWindowMinutes: 60, sloMinRequests: 2, minSuccessRateBps: 9000,
    maxP95LatencyMs: 5000, alertCooldownMinutes: 15, enabled: true, expectedVersion: policy.version });
  const first = await runtime.acquireDeploymentAdmission({ ...ids, requestId: "request-one" });
  assert.equal(first.managed, true);
  await assert.rejects(runtime.acquireDeploymentAdmission({ ...ids, requestId: "request-two" }), (error) => error.code === "DEPLOYMENT_BACKPRESSURE");
  await runtime.releaseDeploymentAdmission({ ...ids, requestId: "request-one" });
  await assert.rejects(runtime.acquireDeploymentAdmission({ ...ids, requestId: "request-three" }), (error) => error.code === "DEPLOYMENT_RATE_LIMITED");
  const old = new Date(Date.now() - 60_000).toISOString();
  db.prepare("INSERT INTO deployment_inflight_leases (id,user_id,project_id,acquired_at,expires_at) VALUES ('stale',?,?,?,?)")
    .run(ids.userId, ids.projectId, new Date(Date.now() - 120_000).toISOString(), old);
  db.prepare("DELETE FROM deployment_admission_buckets").run();
  const recovered = await runtime.acquireDeploymentAdmission({ ...ids, requestId: "request-four" });
  assert.equal(recovered.managed, true);
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM deployment_inflight_leases WHERE id='stale'").get().total, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM deployment_operations_events WHERE event_type='inflight_recovered'").get().total, 1);
  await runtime.releaseDeploymentAdmission({ ...ids, requestId: "request-four" });
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("SLO evaluation opens, acknowledges and resolves deduplicated alerts", async () => {
  const db = new DatabaseSync(":memory:"); db.exec("PRAGMA foreign_keys=ON"); migrations(db);
  const ids = seedProject(db); const runtime = loadRuntime(db);
  let policy = (await runtime.listOperationsState(ids)).policy;
  policy = await runtime.configureOperationsPolicy({ ...ids, rateLimitPerMinute: 100, maxConcurrency: 4,
    inflightLeaseSeconds: 60, sloWindowMinutes: 60, sloMinRequests: 2, minSuccessRateBps: 9000,
    maxP95LatencyMs: 100000, alertCooldownMinutes: 15, enabled: true, expectedVersion: policy.version });
  insertDeploymentRequest(db, ids, "request-success", "succeeded", 20);
  insertDeploymentRequest(db, ids, "request-failure", "failed", 30);
  const snapshot = await runtime.evaluateDeploymentSlo(ids);
  assert.equal(snapshot.status, "breached"); assert.equal(snapshot.successRateBps, 5000);
  let state = await runtime.listOperationsState(ids);
  const alert = state.alerts.find((entry) => entry.kind === "success_rate");
  assert.equal(alert.status, "open");
  const acknowledged = await runtime.acknowledgeOperationsAlert({ ...ids, alertId: alert.id, expectedVersion: alert.version });
  assert.equal(acknowledged.status, "acknowledged");
  policy = await runtime.configureOperationsPolicy({ ...ids, rateLimitPerMinute: 100, maxConcurrency: 4,
    inflightLeaseSeconds: 60, sloWindowMinutes: 60, sloMinRequests: 2, minSuccessRateBps: 4000,
    maxP95LatencyMs: 100000, alertCooldownMinutes: 15, enabled: true, expectedVersion: policy.version });
  const healthy = await runtime.evaluateDeploymentSlo(ids); assert.equal(healthy.status, "healthy");
  state = await runtime.listOperationsState(ids);
  assert.equal(state.alerts.find((entry) => entry.id === alert.id).status, "resolved");
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM deployment_alerts WHERE kind='success_rate'").get().total, 1);
});

test("Dead-letter replay requires a fresh matching lease and audit export redacts tool input", async () => {
  const db = new DatabaseSync(":memory:"); db.exec("PRAGMA foreign_keys=ON"); migrations(db);
  const ids = seedProject(db); const runtime = loadRuntime(db); await runtime.listOperationsState(ids);
  const expires = new Date(Date.now() + 3600_000).toISOString(); const secret = "PRIVATE_TOOL_INPUT";
  db.prepare("INSERT INTO tool_execution_leases (id,user_id,project_id,scope_kind,tool_name,status,max_uses,remaining_uses,version,expires_at,last_event_id,created_at,updated_at,last_used_at,revoked_at) VALUES ('replay-lease',?,?,'project','text.sha256','active',2,2,1,?,'lease-event',?,?,NULL,NULL)")
    .run(ids.userId, ids.projectId, expires, ids.now, ids.now);
  db.prepare("INSERT INTO tool_jobs (id,user_id,project_id,lease_id,tool_name,status,input_json,input_sha256,output_json,error_code,error_message,progress_percent,attempt,max_attempts,version,worker_id,claim_token,heartbeat_at,claim_expires_at,available_at,idempotency_key,created_at,updated_at,started_at,completed_at) VALUES ('dead-job',?,?,'replay-lease','text.sha256','dead_letter',?,?,NULL,'MAX_ATTEMPTS','failed permanently',100,3,3,4,NULL,NULL,NULL,NULL,?,'dead-key',?,?,?,?)")
    .run(ids.userId, ids.projectId, JSON.stringify({ text: secret }), "f".repeat(64), ids.now, ids.now, ids.now, ids.now, ids.now);
  const replay = await runtime.replayDeadLetterToolJob({ ...ids, sourceJobId: "dead-job", leaseId: "replay-lease", expectedVersion: 4 });
  assert.notEqual(replay.replayJobId, "dead-job");
  const newJob = db.prepare("SELECT status,attempt,input_json FROM tool_jobs WHERE id=?").get(replay.replayJobId);
  assert.equal(newJob.status, "queued"); assert.equal(newJob.attempt, 0); assert.match(newJob.input_json, /PRIVATE_TOOL_INPUT/u);
  assert.equal(db.prepare("SELECT remaining_uses FROM tool_execution_leases WHERE id='replay-lease'").get().remaining_uses, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM tool_job_replays").get().total, 1);
  const audit = await runtime.exportOperationsAudit(ids); const serialized = JSON.stringify(audit);
  assert.doesNotMatch(serialized, /PRIVATE_TOOL_INPUT/u); assert.match(serialized, /promptBodiesIncluded/u);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});
