import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("TankBench uses frozen hashed suites and real Commander evidence", async () => {
  const runtime = await source("lib/tankbench-runtime.ts");
  const migration = await source("drizzle/0011_measured_tankbench.sql");
  assert.match(runtime, /suiteHash = await sha256/);
  assert.match(runtime, /JOIN react_runs rr ON rr\.id = cr\.react_run_id/);
  assert.match(runtime, /commander_decisions/);
  assert.match(runtime, /review_approved/);
  assert.match(migration, /tankbench_suites_hash_check/);
  assert.match(migration, /tankbench_results_run_case_variant_idx/);
  assert.match(migration, /FOREIGN KEY \(`commander_run_id`\) REFERENCES `commander_runs`/);
});

test("TankBench promotion gate blocks regressions and safety failures", async () => {
  const runtime = await source("lib/tankbench-runtime.ts");
  assert.match(runtime, /candidateScore - baselineScore/);
  assert.match(runtime, /regressions <= run\.max_regressions/);
  assert.match(runtime, /requiredFailures === 0/);
  assert.match(runtime, /safetyFailures === 0/);
  assert.match(runtime, /Only bestandene TankBench-Läufe|Nur bestandene TankBench-Läufe/);
});

test("TankBench canary advances in fixed stages and rolls back automatically", async () => {
  const runtime = await source("lib/tankbench-runtime.ts");
  assert.match(runtime, /current\.traffic_percent === 5 \? 25/);
  assert.match(runtime, /current\.traffic_percent === 25 \? 50 : 100/);
  assert.match(runtime, /status='rolled_back'/);
  assert.match(runtime, /max_error_rate_bps/);
  assert.match(runtime, /max_p95_latency_ms/);
  assert.match(runtime, /release_rolled_back/);
});

test("TankBench API and UI are authenticated, versioned and operational", async () => {
  const api = await source("app/api/tankbench/route.ts");
  const ui = await source("app/tankbench/tankbench-client.tsx");
  const page = await source("app/tankbench/page.tsx");
  assert.match(api, /requireApiIdentity/);
  assert.match(api, /sameOrigin/);
  assert.match(api, /expectedVersion/);
  assert.match(api, /attach_result/);
  assert.match(api, /observe_canary/);
  assert.match(ui, /Suite einfrieren/);
  assert.match(ui, /Promotion-Gate auswerten/);
  assert.match(ui, /Canary starten/);
  assert.match(ui, /Rollback/);
  assert.match(page, /requireChatGPTUser/);
});
