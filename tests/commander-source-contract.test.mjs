import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("Commander resolves tool leases server-side and never accepts model-selected lease ids", async () => {
  const runtime = await source("lib/commander-runtime.ts");
  assert.match(runtime, /activeLeases\(/);
  assert.match(runtime, /leases\.find\(\(candidate\) => candidate\.tool_name === toolAction\.toolName\)/);
  assert.doesNotMatch(runtime, /decision\.action\.leaseId/);
  assert.match(runtime, /decision_rejected/);
});

test("Commander requires critic approval before final ReAct completion", async () => {
  const runtime = await source("lib/commander-runtime.ts");
  const review = runtime.indexOf("parseReview");
  const finalSubmit = runtime.lastIndexOf("submitReActDecision");
  assert.ok(review >= 0 && finalSubmit > review);
  assert.match(runtime, /if \(!review\.approved\)/);
  assert.match(runtime, /COMMANDER_REVIEW_BUDGET_EXHAUSTED/);
  assert.match(runtime, /raw_response_sha256/);
});

test("Commander API is authenticated, same-origin and versioned", async () => {
  const api = await source("app/api/commander/route.ts");
  assert.match(api, /requireApiIdentity/);
  assert.match(api, /sameOrigin/);
  assert.match(api, /expectedVersion/);
  assert.match(api, /maxTransitions/);
});

test("Commander UI exposes autonomous advance and audit records", async () => {
  const ui = await source("app/commander/commander-client.tsx");
  assert.match(ui, /Autonom fortsetzen/);
  assert.match(ui, /Commander-Entscheidungen/);
  assert.match(ui, /Commander-Receipts/);
  assert.match(ui, /Private Gedankengänge/i);
});

test("Commander consumes a model.run capability lease for every decision and review", async () => {
  const runtime = await source("lib/commander-runtime.ts");
  const migration = await source("drizzle/0010_vigilant_commander.sql");
  const api = await source("app/api/commander/route.ts");
  assert.match(runtime, /requireCapabilityLeaseForRun/);
  assert.match(runtime, /UPDATE capability_leases/);
  assert.match(runtime, /mode = 'team'/);
  assert.match(runtime, /commander_capability_events/);
  assert.match(runtime, /COMMANDER_MODEL_LEASE_UNAVAILABLE/);
  assert.match(migration, /capability_lease_id/);
  assert.match(migration, /commander_capability_events/);
  assert.match(api, /capabilityLeaseId/);
});
