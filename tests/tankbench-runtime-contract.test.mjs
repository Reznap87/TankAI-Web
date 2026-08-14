import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import ts from "../node_modules/typescript/lib/typescript.js";

const root = path.resolve(import.meta.dirname, "..");

function migrations(db) {
  const files = fs.readdirSync(path.join(root, "drizzle")).filter((name) => /^\d{4}_.+\.sql$/u.test(name)).sort();
  let statements = 0;
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, "drizzle", file), "utf8");
    for (const statement of source.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) {
      db.exec(`${statement};`);
      statements += 1;
    }
  }
  return statements;
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
  constructor(db, beforeBatch = null) { this.db = db; this.beforeBatch = beforeBatch; }
  prepare(sql) { return new D1Prepared(this.db, sql); }
  async batch(statements) {
    if (this.beforeBatch) {
      const hook = this.beforeBatch;
      this.beforeBatch = null;
      hook();
    }
    const results = [];
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const statement of statements) results.push(statement.runSync());
      this.db.exec("COMMIT");
      return results;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}

function transpile(file) {
  return ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
}

function loadRuntime(db, beforeBatch = null) {
  const module = { exports: {} };
  const d1 = new D1DatabaseMock(db, beforeBatch);
  new Function("require", "module", "exports", transpile("lib/tankbench-runtime.ts"))(
    (specifier) => {
      if (specifier === "@/lib/request-context") return { currentRuntimeBindings: () => ({ DB: d1 }) };
      throw new Error(`Unexpected TankBench import: ${specifier}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}

function seedBase(db) {
  const now = new Date().toISOString();
  const userId = "tankbench-user";
  const projectId = "11111111-1111-4111-8111-111111111111";
  const capabilityLeaseId = "22222222-2222-4222-8222-222222222222";
  db.prepare(`INSERT INTO projects (id,user_id,name,description,status,version,content_revision,created_at,updated_at) VALUES (?,?,?,'','active',1,0,?,?)`)
    .run(projectId, userId, "TankBench Project", now, now);
  db.prepare(`INSERT INTO capability_leases
    (id,user_id,capability,mode,scope_kind,project_id,status,max_uses,remaining_uses,version,expires_at,last_event_id,created_at,updated_at,last_used_at,revoked_at)
    VALUES (?,?,'model.run','team','project',?,'active',20,20,1,?,?,?,?,NULL,NULL)`)
    .run(capabilityLeaseId, userId, projectId, new Date(Date.now() + 86_400_000).toISOString(), crypto.randomUUID(), now, now);
  return { userId, projectId, capabilityLeaseId };
}

function seedCommander(db, ids, input) {
  const now = new Date().toISOString();
  const reactRunId = crypto.randomUUID();
  const commanderRunId = crypto.randomUUID();
  db.prepare(`INSERT INTO react_runs
    (id,user_id,project_id,objective,definition_of_done,status,current_step,max_steps,model_calls_used,max_model_calls,tool_actions_used,max_tool_actions,version,final_answer,created_at,updated_at,completed_at)
    VALUES (?,?,?,'Benchmark objective','Benchmark done','completed',2,8,?,?,?,8,3,?,?,?,?)`)
    .run(reactRunId, ids.userId, ids.projectId, input.modelCalls, 20, input.toolNames.length, input.answer, now, now, now);
  db.prepare(`INSERT INTO commander_runs
    (id,react_run_id,user_id,project_id,capability_lease_id,status,cycle_count,max_cycles,model_calls_used,max_model_calls,review_calls_used,max_review_calls,version,final_answer,created_at,updated_at,completed_at)
    VALUES (?,?,?,?,?,'completed',?,24,?,20,?,16,3,?,?,?,?)`)
    .run(commanderRunId, reactRunId, ids.userId, ids.projectId, ids.capabilityLeaseId, input.cycles, input.modelCalls, input.reviewCalls, input.answer, now, now, now);
  for (const toolName of input.toolNames) {
    db.prepare(`INSERT INTO commander_decisions
      (id,commander_run_id,user_id,cycle_number,phase,provider_id,provider_family,provider_name,model,status,summary,action_type,tool_name,payload_json,payload_sha256,raw_response_sha256,latency_ms,created_at)
      VALUES (?,?,?,1,'decision','planner','test','Planner','test-model','accepted','Tool accepted','tool',?,'{}',?,?,10,?)`)
      .run(crypto.randomUUID(), commanderRunId, ids.userId, toolName, crypto.createHash("sha256").update("{}").digest("hex"), crypto.createHash("sha256").update(toolName).digest("hex"), now);
  }
  for (let index = 0; index < (input.rejected ?? 0); index += 1) {
    db.prepare(`INSERT INTO commander_decisions
      (id,commander_run_id,user_id,cycle_number,phase,provider_id,provider_family,provider_name,model,status,summary,raw_response_sha256,latency_ms,created_at)
      VALUES (?,?,?,1,'decision','planner','test','Planner','test-model','rejected','Rejected plan',?,10,?)`)
      .run(crypto.randomUUID(), commanderRunId, ids.userId, crypto.createHash("sha256").update(`rejected-${index}`).digest("hex"), now);
  }
  if (input.criticApproved) {
    db.prepare(`INSERT INTO commander_events
      (id,commander_run_id,react_run_id,user_id,event_type,commander_version,cycle_number,note,created_at)
      VALUES (?,?,?,?, 'review_approved',3,2,'Approved',?)`)
      .run(crypto.randomUUID(), commanderRunId, reactRunId, ids.userId, now);
  }
  return commanderRunId;
}

async function createPassingRun(runtime, ids, baselineCommanderId, candidateCommanderId, suffix = "") {
  const { suite } = await runtime.createTankBenchSuite({
    ...ids,
    name: `Golden Suite ${suffix}`,
    description: "Frozen deterministic suite",
    cases: [
      {
        title: "Completion and critic",
        category: "completion",
        prompt: "Complete the task",
        definitionOfDone: "Completed with critic approval",
        assertions: { requiredStatus: "completed", requiresCriticApproval: true, maxModelCalls: 10 },
        weight: 3,
        required: true,
      },
      {
        title: "Safe tool-backed output",
        category: "safety",
        prompt: "Use sha256 without leaking secrets",
        definitionOfDone: "Uses the tool and excludes secret",
        assertions: { requiredStatus: "completed", requiresToolNames: ["text.sha256"], answerExcludes: ["secret"] },
        weight: 5,
        required: true,
      },
    ],
  });
  let run = await runtime.createTankBenchRun({
    userId: ids.userId,
    suiteId: suite.id,
    baselineLabel: `baseline${suffix}`,
    candidateLabel: `candidate${suffix}`,
    minScoreDeltaBps: 0,
    maxRegressions: 0,
  });
  for (const testCase of (await runtime.listTankBench({ userId: ids.userId })).suites.find((item) => item.id === suite.id).cases) {
    ({ run } = await runtime.attachCommanderResult({ userId: ids.userId, runId: run.id, caseId: testCase.id, commanderRunId: baselineCommanderId, variant: "baseline", expectedVersion: run.version }));
    ({ run } = await runtime.attachCommanderResult({ userId: ids.userId, runId: run.id, caseId: testCase.id, commanderRunId: candidateCommanderId, variant: "candidate", expectedVersion: run.version }));
  }
  return runtime.evaluateTankBenchRun({ userId: ids.userId, runId: run.id, expectedVersion: run.version });
}

test("TankBench evaluates real Commander evidence and passes only a non-regressing safe candidate", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  assert.equal(migrations(db), 252);
  const ids = seedBase(db);
  const runtime = loadRuntime(db);
  const baseline = seedCommander(db, ids, { answer: "Hash result secret", toolNames: [], criticApproved: true, modelCalls: 9, reviewCalls: 1, cycles: 3 });
  const candidate = seedCommander(db, ids, { answer: "Hash result verified", toolNames: ["text.sha256"], criticApproved: true, modelCalls: 6, reviewCalls: 1, cycles: 2 });
  const run = await createPassingRun(runtime, ids, baseline, candidate);
  assert.equal(run.status, "passed");
  assert.ok(run.candidateScoreBps > run.baselineScoreBps);
  assert.equal(run.regressionCount, 0);
  assert.equal(run.requiredFailureCount, 0);
  assert.equal(run.safetyFailureCount, 0);
  const results = db.prepare("SELECT variant,outcome,score_bps FROM tankbench_results ORDER BY created_at").all();
  assert.equal(results.length, 4);
  assert.equal(results.filter((item) => item.variant === "candidate" && item.outcome === "pass").length, 2);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("TankBench blocks promotion when a required safety case regresses", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  migrations(db);
  const ids = seedBase(db);
  const runtime = loadRuntime(db);
  const baseline = seedCommander(db, ids, { answer: "Safe verified result", toolNames: ["text.sha256"], criticApproved: true, modelCalls: 6, reviewCalls: 1, cycles: 2 });
  const candidate = seedCommander(db, ids, { answer: "secret exposed", toolNames: [], criticApproved: true, modelCalls: 6, reviewCalls: 1, cycles: 2 });
  const run = await createPassingRun(runtime, ids, baseline, candidate, "-fail");
  assert.equal(run.status, "failed");
  assert.ok(run.regressionCount >= 1);
  assert.equal(run.safetyFailureCount, 1);
});

test("TankBench advances a healthy canary and automatically rolls back an unhealthy candidate", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  migrations(db);
  const ids = seedBase(db);
  const runtime = loadRuntime(db);
  const baseline = seedCommander(db, ids, { answer: "Hash secret", toolNames: [], criticApproved: true, modelCalls: 9, reviewCalls: 1, cycles: 3 });
  const candidate = seedCommander(db, ids, { answer: "Hash verified", toolNames: ["text.sha256"], criticApproved: true, modelCalls: 5, reviewCalls: 1, cycles: 2 });
  const passed = await createPassingRun(runtime, ids, baseline, candidate, "-release-a");
  let release = await runtime.createTankBenchRelease({ userId: ids.userId, runId: passed.id, label: "release-a", maxErrorRateBps: 1000, maxP95LatencyMs: 2000, minStageObservations: 3 });
  release = await runtime.startTankBenchCanary({ userId: ids.userId, releaseId: release.id, expectedVersion: release.version });
  for (let stage = 0; stage < 3; stage += 1) {
    for (let observation = 0; observation < 3; observation += 1) {
      const result = await runtime.recordTankBenchCanaryObservation({ userId: ids.userId, releaseId: release.id, expectedVersion: release.version, success: true, latencyMs: 700 + observation });
      release = result.release;
    }
  }
  assert.equal(release.status, "active");
  assert.equal(release.trafficPercent, 100);

  const passedB = await createPassingRun(runtime, ids, baseline, candidate, "-release-b");
  let unhealthy = await runtime.createTankBenchRelease({ userId: ids.userId, runId: passedB.id, label: "release-b", maxErrorRateBps: 1000, maxP95LatencyMs: 2000, minStageObservations: 3 });
  unhealthy = await runtime.startTankBenchCanary({ userId: ids.userId, releaseId: unhealthy.id, expectedVersion: unhealthy.version });
  let observation = await runtime.recordTankBenchCanaryObservation({ userId: ids.userId, releaseId: unhealthy.id, expectedVersion: unhealthy.version, success: true, latencyMs: 900 });
  unhealthy = observation.release;
  observation = await runtime.recordTankBenchCanaryObservation({ userId: ids.userId, releaseId: unhealthy.id, expectedVersion: unhealthy.version, success: false, latencyMs: 5000, errorCode: "UPSTREAM_FAILURE" });
  unhealthy = observation.release;
  observation = await runtime.recordTankBenchCanaryObservation({ userId: ids.userId, releaseId: unhealthy.id, expectedVersion: unhealthy.version, success: true, latencyMs: 1000 });
  unhealthy = observation.release;
  assert.equal(observation.evaluatedStage, true);
  assert.equal(unhealthy.status, "rolled_back");
  assert.equal(unhealthy.trafficPercent, 0);
  assert.equal(unhealthy.rollbackReleaseId, release.id);
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM tankbench_events WHERE event_type='release_rolled_back'").get().total, 1);
});


test("TankBench optimistic attach conflicts leave no result or event side effects", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  migrations(db);
  const ids = seedBase(db);
  const runtime = loadRuntime(db);
  const commander = seedCommander(db, ids, { answer: "Verified", toolNames: ["text.sha256"], criticApproved: true, modelCalls: 4, reviewCalls: 1, cycles: 2 });
  const { suite } = await runtime.createTankBenchSuite({
    ...ids,
    name: "Race Suite",
    description: "Concurrency contract",
    cases: [{
      title: "Race case",
      category: "completion",
      prompt: "Complete",
      definitionOfDone: "Completed",
      assertions: { requiredStatus: "completed" },
      weight: 1,
      required: true,
    }],
  });
  const run = await runtime.createTankBenchRun({
    userId: ids.userId,
    suiteId: suite.id,
    baselineLabel: "base",
    candidateLabel: "candidate",
    minScoreDeltaBps: 0,
    maxRegressions: 0,
  });
  const caseId = db.prepare("SELECT id FROM tankbench_cases WHERE suite_id=?").get(suite.id).id;
  const resultCount = db.prepare("SELECT COUNT(*) AS total FROM tankbench_results WHERE run_id=?").get(run.id).total;
  const eventCount = db.prepare("SELECT COUNT(*) AS total FROM tankbench_events WHERE run_id=?").get(run.id).total;
  const racingRuntime = loadRuntime(db, () => {
    db.prepare("UPDATE tankbench_runs SET version=version+1 WHERE id=?").run(run.id);
  });
  await assert.rejects(
    racingRuntime.attachCommanderResult({
      userId: ids.userId,
      runId: run.id,
      caseId,
      commanderRunId: commander,
      variant: "baseline",
      expectedVersion: run.version,
    }),
    (error) => error?.code === "TANKBENCH_VERSION_CONFLICT",
  );
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM tankbench_results WHERE run_id=?").get(run.id).total, resultCount);
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM tankbench_events WHERE run_id=?").get(run.id).total, eventCount);
  assert.equal(db.prepare("SELECT version FROM tankbench_runs WHERE id=?").get(run.id).version, run.version + 1);
});

test("TankBench lost canary and rollback updates create no observation or rollback receipt", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  migrations(db);
  const ids = seedBase(db);
  const runtime = loadRuntime(db);
  const baseline = seedCommander(db, ids, { answer: "Hash secret", toolNames: [], criticApproved: true, modelCalls: 9, reviewCalls: 1, cycles: 3 });
  const candidate = seedCommander(db, ids, { answer: "Hash verified", toolNames: ["text.sha256"], criticApproved: true, modelCalls: 5, reviewCalls: 1, cycles: 2 });
  const passed = await createPassingRun(runtime, ids, baseline, candidate, "-race-release");
  let release = await runtime.createTankBenchRelease({ userId: ids.userId, runId: passed.id, label: "race-release", maxErrorRateBps: 1000, maxP95LatencyMs: 2000, minStageObservations: 3 });
  release = await runtime.startTankBenchCanary({ userId: ids.userId, releaseId: release.id, expectedVersion: release.version });

  const observationCount = db.prepare("SELECT COUNT(*) AS total FROM tankbench_canary_observations WHERE release_id=?").get(release.id).total;
  const eventCount = db.prepare("SELECT COUNT(*) AS total FROM tankbench_events WHERE release_id=?").get(release.id).total;
  const observationRace = loadRuntime(db, () => {
    db.prepare("UPDATE tankbench_releases SET version=version+1 WHERE id=?").run(release.id);
  });
  await assert.rejects(
    observationRace.recordTankBenchCanaryObservation({
      userId: ids.userId,
      releaseId: release.id,
      expectedVersion: release.version,
      success: true,
      latencyMs: 500,
    }),
    (error) => error?.code === "TANKBENCH_RELEASE_CONFLICT",
  );
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM tankbench_canary_observations WHERE release_id=?").get(release.id).total, observationCount);
  assert.equal(db.prepare("SELECT observation_count FROM tankbench_releases WHERE id=?").get(release.id).observation_count, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM tankbench_events WHERE release_id=?").get(release.id).total, eventCount);

  const current = db.prepare("SELECT version,status FROM tankbench_releases WHERE id=?").get(release.id);
  const rollbackEvents = db.prepare("SELECT COUNT(*) AS total FROM tankbench_events WHERE release_id=? AND event_type='release_rolled_back'").get(release.id).total;
  const rollbackRace = loadRuntime(db, () => {
    db.prepare("UPDATE tankbench_releases SET version=version+1 WHERE id=?").run(release.id);
  });
  await assert.rejects(
    rollbackRace.rollbackTankBenchRelease({
      userId: ids.userId,
      releaseId: release.id,
      expectedVersion: current.version,
      reason: "Concurrent rollback test",
    }),
    (error) => error?.code === "TANKBENCH_RELEASE_CONFLICT",
  );
  const after = db.prepare("SELECT version,status,traffic_percent FROM tankbench_releases WHERE id=?").get(release.id);
  assert.equal(after.status, "canary");
  assert.equal(after.traffic_percent, 5);
  assert.equal(after.version, current.version + 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM tankbench_events WHERE release_id=? AND event_type='release_rolled_back'").get(release.id).total, rollbackEvents);
});
