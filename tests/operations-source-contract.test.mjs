import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const runtime = fs.readFileSync(new URL("../lib/operations-runtime.ts", import.meta.url), "utf8");
const deployment = fs.readFileSync(new URL("../lib/deployment-controller.ts", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../app/api/operations/route.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/operations/operations-client.tsx", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../drizzle/0015_reliability_operations.sql", import.meta.url), "utf8");

test("Admission control applies persistent rate and concurrency limits before provider routing", () => {
  assert.match(runtime, /deployment_admission_buckets/);
  assert.match(runtime, /deployment_inflight_leases/);
  assert.match(runtime, /DEPLOYMENT_RATE_LIMITED/);
  assert.match(runtime, /DEPLOYMENT_BACKPRESSURE/);
  assert.match(deployment, /acquireDeploymentAdmission/);
  assert.match(deployment, /releaseDeploymentAdmission/);
});

test("SLO snapshots produce deduplicated alerts and recovery receipts", () => {
  assert.match(runtime, /evaluateDeploymentSlo/);
  assert.match(runtime, /openOrUpdateAlert/);
  assert.match(runtime, /resolveAlert/);
  assert.match(migration, /deployment_slo_snapshots/);
  assert.match(migration, /deployment_alerts_active_dedupe_idx/);
});

test("Dead-letter replay is reauthorized and audit exports omit raw payloads", () => {
  assert.match(runtime, /replayDeadLetterToolJob/);
  assert.match(runtime, /tool_execution_leases/);
  assert.match(runtime, /tool_job_replays/);
  assert.match(runtime, /promptBodiesIncluded: false/);
  assert.match(runtime, /privacy: \{ promptBodiesIncluded: false, providerResponsesIncluded: false, toolInputsIncluded: false \}/);
});

test("Operations API and React control plane expose policy, alerts, replay and audit controls", () => {
  assert.match(route, /action === "configure"/);
  assert.match(route, /action === "replay_dead_letter"/);
  assert.match(route, /action === "acknowledge_alert"/);
  assert.match(route, /content-disposition/);
  assert.match(page, /setInterval/);
  assert.match(page, /DEAD LETTER QUEUE/);
  assert.match(page, /Audit exportieren/);
});
