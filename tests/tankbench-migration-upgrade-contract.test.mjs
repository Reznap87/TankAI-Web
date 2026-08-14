import assert from "node:assert/strict";
import crypto from "node:crypto";
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

test("TankBench migration upgrades a populated v0.15 database without losing Commander data", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  const legacyMigrations = fs.readdirSync(path.join(root, "drizzle"))
    .filter((name) => /^00(?:0\d|10)_.+\.sql$/u.test(name))
    .sort();
  let legacyStatements = 0;
  for (const file of legacyMigrations) legacyStatements += applyMigration(db, file);
  assert.equal(legacyStatements, 147);

  const now = new Date().toISOString();
  const userId = "upgrade-user";
  const projectId = "11111111-1111-4111-8111-111111111111";
  const capabilityLeaseId = "22222222-2222-4222-8222-222222222222";
  const reactRunId = "33333333-3333-4333-8333-333333333333";
  const commanderRunId = "44444444-4444-4444-8444-444444444444";

  db.prepare(`INSERT INTO projects (id,user_id,name,description,status,version,content_revision,created_at,updated_at)
    VALUES (?,?,?,'Upgrade fixture','active',1,0,?,?)`).run(projectId, userId, "Existing Project", now, now);
  db.prepare(`INSERT INTO capability_leases
    (id,user_id,capability,mode,scope_kind,project_id,status,max_uses,remaining_uses,version,expires_at,last_event_id,created_at,updated_at,last_used_at,revoked_at)
    VALUES (?,?,'model.run','team','project',?,'active',20,20,1,?,?,?,?,NULL,NULL)`)
    .run(capabilityLeaseId, userId, projectId, new Date(Date.now() + 86_400_000).toISOString(), crypto.randomUUID(), now, now);
  db.prepare(`INSERT INTO react_runs
    (id,user_id,project_id,objective,definition_of_done,status,current_step,max_steps,model_calls_used,max_model_calls,tool_actions_used,max_tool_actions,version,final_answer,created_at,updated_at,completed_at)
    VALUES (?,?,?,'Existing objective','Existing done','completed',2,8,2,20,1,8,3,'Existing answer',?,?,?)`)
    .run(reactRunId, userId, projectId, now, now, now);
  db.prepare(`INSERT INTO commander_runs
    (id,react_run_id,user_id,project_id,capability_lease_id,status,cycle_count,max_cycles,model_calls_used,max_model_calls,review_calls_used,max_review_calls,version,final_answer,created_at,updated_at,completed_at)
    VALUES (?,?,?,?,?,'completed',2,24,2,20,1,16,3,'Existing answer',?,?,?)`)
    .run(commanderRunId, reactRunId, userId, projectId, capabilityLeaseId, now, now, now);

  assert.equal(applyMigration(db, "0011_measured_tankbench.sql"), 29);
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM projects WHERE id=?").get(projectId).total, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM capability_leases WHERE id=?").get(capabilityLeaseId).total, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM react_runs WHERE id=?").get(reactRunId).total, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM commander_runs WHERE id=?").get(commanderRunId).total, 1);

  const newTables = [
    "tankbench_suites",
    "tankbench_cases",
    "tankbench_runs",
    "tankbench_results",
    "tankbench_releases",
    "tankbench_canary_observations",
    "tankbench_events",
  ];
  for (const table of newTables) {
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type='table' AND name=?").get(table).total, 1);
  }
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});
