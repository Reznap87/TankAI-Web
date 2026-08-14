import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

const root = path.resolve(import.meta.dirname, "..");

function applyMigration(db, file) {
  const source = fs.readFileSync(path.join(root, "drizzle", file), "utf8");
  let statements = 0;
  for (const statement of source.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) {
    db.exec(`${statement};`);
    statements += 1;
  }
  return statements;
}

test("React Control Plane upgrades populated v0.18 deployment rows without data loss", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  const legacyMigrations = fs.readdirSync(path.join(root, "drizzle"))
    .filter((name) => /^00(?:0\d|1[0-3])_.+\.sql$/u.test(name))
    .sort();
  let legacyStatements = 0;
  for (const file of legacyMigrations) legacyStatements += applyMigration(db, file);
  assert.equal(legacyStatements, 192);

  const now = "2026-07-28T00:00:00.000Z";
  const userId = "upgrade-user";
  const projectId = "11111111-1111-4111-8111-111111111111";
  const suiteId = "22222222-2222-4222-8222-222222222222";
  const runId = "33333333-3333-4333-8333-333333333333";
  const releaseId = "44444444-4444-4444-8444-444444444444";
  const configId = "55555555-5555-4555-8555-555555555555";
  const requestId = "66666666-6666-4666-8666-666666666666";
  const hash = "a".repeat(64);

  db.prepare(`INSERT INTO projects (id,user_id,name,description,status,version,content_revision,created_at,updated_at)
    VALUES (?,?,?,'Upgrade fixture','active',1,0,?,?)`).run(projectId, userId, "Existing Project", now, now);
  db.prepare(`INSERT INTO tankbench_suites
    (id,user_id,project_id,name,description,status,case_count,suite_sha256,version,created_at,updated_at,frozen_at)
    VALUES (?,?,?,'Existing suite','Upgrade fixture','frozen',1,?,1,?,?,?)`)
    .run(suiteId, userId, projectId, hash, now, now, now);
  db.prepare(`INSERT INTO tankbench_runs
    (id,suite_id,user_id,project_id,baseline_label,candidate_label,status,min_score_delta_bps,max_regressions,
     baseline_score_bps,candidate_score_bps,delta_bps,regression_count,required_failure_count,safety_failure_count,
     version,created_at,updated_at,evaluated_at,completed_at)
    VALUES (?,?,?,?,? ,?,'passed',0,0,9000,9100,100,0,0,0,1,?,?,?,?)`)
    .run(runId, suiteId, userId, projectId, "v0.17", "v0.18", now, now, now, now);
  db.prepare(`INSERT INTO tankbench_releases
    (id,source_run_id,user_id,project_id,label,status,traffic_percent,max_error_rate_bps,max_p95_latency_ms,
     min_stage_observations,stage_observation_offset,observation_count,error_count,rollback_release_id,version,
     created_at,updated_at,promoted_at,rolled_back_at)
    VALUES (?,?,?,?,?,'active',100,500,5000,3,0,3,0,NULL,1,?,?,?,NULL)`)
    .run(releaseId, runId, userId, projectId, "v0.18", now, now, now);
  db.prepare(`INSERT INTO deployment_release_configs
    (id,release_id,user_id,project_id,provider_id,max_output_tokens,config_sha256,version,created_at,updated_at)
    VALUES (?,?,?,?,?,2048,?,1,?,?)`)
    .run(configId, releaseId, userId, projectId, "provider-primary", hash, now, now);
  db.prepare(`INSERT INTO deployment_requests
    (id,user_id,project_id,release_id,config_id,provider_id,routing_key_hash,request_sha256,response_sha256,
     status,latency_ms,error_code,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,'succeeded',42,NULL,?)`)
    .run(requestId, userId, projectId, releaseId, configId, "provider-primary", hash, hash, hash, now);
  db.prepare(`INSERT INTO deployment_events
    (id,user_id,project_id,release_id,event_type,entity_version,note,created_at)
    VALUES (?,?,?,?, 'request_succeeded',1,'Existing receipt',?)`)
    .run("77777777-7777-4777-8777-777777777777", userId, projectId, releaseId, now);

  assert.equal(applyMigration(db, "0014_react_control_plane.sql"), 18);

  const config = db.prepare(`SELECT provider_id,fallback_provider_ids_json,failure_threshold,
    recovery_timeout_seconds,half_open_successes,max_output_tokens,config_sha256
    FROM deployment_release_configs WHERE id=?`).get(configId);
  assert.deepEqual({ ...config }, {
    provider_id: "provider-primary",
    fallback_provider_ids_json: "[]",
    failure_threshold: 3,
    recovery_timeout_seconds: 60,
    half_open_successes: 1,
    max_output_tokens: 2048,
    config_sha256: hash,
  });
  const request = db.prepare(`SELECT status,source,attempt_count,provider_id,latency_ms
    FROM deployment_requests WHERE id=?`).get(requestId);
  assert.deepEqual({ ...request }, {
    status: "succeeded",
    source: "active",
    attempt_count: 1,
    provider_id: "provider-primary",
    latency_ms: 42,
  });
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM deployment_events WHERE release_id=?").get(releaseId).total, 1);

  for (const table of [
    "deployment_traffic_overrides",
    "deployment_circuit_breakers",
    "deployment_request_attempts",
    "deployment_control_events",
  ]) {
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type='table' AND name=?").get(table).total, 1);
  }
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});
