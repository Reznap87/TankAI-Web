import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

const root = path.resolve(import.meta.dirname, "..");
function applyMigration(db, file) {
  const source = fs.readFileSync(path.join(root, "drizzle", file), "utf8"); let count = 0;
  for (const statement of source.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) {
    db.exec(`${statement};`); count += 1;
  }
  return count;
}

test("Reliability Operations upgrades populated v0.19 control-plane data without loss", () => {
  const db = new DatabaseSync(":memory:"); db.exec("PRAGMA foreign_keys=ON");
  const legacy = fs.readdirSync(path.join(root, "drizzle")).filter((name) => /^00(?:0\d|1[0-4])_.+\.sql$/u.test(name)).sort();
  let count = 0; for (const file of legacy) count += applyMigration(db, file); assert.equal(count, 210);
  const now = "2026-07-28T01:00:00.000Z"; const userId = "ops-upgrade-user";
  const projectId = "11111111-1111-4111-8111-111111111111"; const suiteId = "22222222-2222-4222-8222-222222222222";
  const runId = "33333333-3333-4333-8333-333333333333"; const releaseId = "44444444-4444-4444-8444-444444444444";
  const configId = "55555555-5555-4555-8555-555555555555"; const requestId = "66666666-6666-4666-8666-666666666666";
  const hash = "a".repeat(64);
  db.prepare("INSERT INTO projects (id,user_id,name,description,status,version,content_revision,created_at,updated_at) VALUES (?,?,?,'','active',1,0,?,?)").run(projectId,userId,"Existing",now,now);
  db.prepare("INSERT INTO tankbench_suites (id,user_id,project_id,name,description,status,case_count,suite_sha256,version,created_at,updated_at,frozen_at) VALUES (?,?,?,'Suite','','frozen',1,?,1,?,?,?)").run(suiteId,userId,projectId,hash,now,now,now);
  db.prepare("INSERT INTO tankbench_runs (id,suite_id,user_id,project_id,baseline_label,candidate_label,status,min_score_delta_bps,max_regressions,baseline_score_bps,candidate_score_bps,delta_bps,regression_count,required_failure_count,safety_failure_count,version,created_at,updated_at,evaluated_at,completed_at) VALUES (?,?,?,?,'v0.18','v0.19','passed',0,0,9000,9100,100,0,0,0,1,?,?,?,?)").run(runId,suiteId,userId,projectId,now,now,now,now);
  db.prepare("INSERT INTO tankbench_releases (id,source_run_id,user_id,project_id,label,status,traffic_percent,max_error_rate_bps,max_p95_latency_ms,min_stage_observations,stage_observation_offset,observation_count,error_count,rollback_release_id,version,created_at,updated_at,promoted_at,rolled_back_at) VALUES (?,?,?,?,?,'active',100,500,5000,3,0,3,0,NULL,1,?,?,?,NULL)").run(releaseId,runId,userId,projectId,"v0.19",now,now,now);
  db.prepare("INSERT INTO deployment_release_configs (id,release_id,user_id,project_id,provider_id,fallback_provider_ids_json,max_output_tokens,failure_threshold,recovery_timeout_seconds,half_open_successes,config_sha256,version,created_at,updated_at) VALUES (?,?,?,?,?,'[]',2048,3,60,1,?,1,?,?)").run(configId,releaseId,userId,projectId,"provider",hash,now,now);
  db.prepare("INSERT INTO deployment_requests (id,user_id,project_id,release_id,config_id,provider_id,routing_key_hash,request_sha256,response_sha256,status,source,attempt_count,latency_ms,error_code,created_at) VALUES (?,?,?,?,?,'provider',?,?,?,'succeeded','active',1,42,NULL,?)").run(requestId,userId,projectId,releaseId,configId,hash,hash,hash,now);
  db.prepare("INSERT INTO deployment_request_attempts (id,request_id,user_id,project_id,release_id,attempt_ordinal,provider_id,status,latency_ms,error_code,response_sha256,created_at) VALUES ('attempt',?,?,?,?,1,'provider','succeeded',42,NULL,?,?)").run(requestId,userId,projectId,releaseId,hash,now);

  assert.equal(applyMigration(db, "0015_reliability_operations.sql"), 17);
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM deployment_requests WHERE id=?").get(requestId).total, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM deployment_request_attempts WHERE request_id=?").get(requestId).total, 1);
  for (const table of ["deployment_operations_policies","deployment_admission_buckets","deployment_inflight_leases","deployment_slo_snapshots","deployment_alerts","tool_job_replays","deployment_operations_events"]) {
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type='table' AND name=?").get(table).total, 1);
  }
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});
