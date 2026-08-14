import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const project = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, project), "utf8");

test("worker migration preserves jobs and adds bounded identities, claims and dead letter", async () => {
  const sql = await source("drizzle/0008_steady_worker_runtime.sql");
  assert.match(sql, /CREATE TABLE `worker_agents`/);
  assert.match(sql, /token_sha256/);
  assert.match(sql, /max_concurrency.*<= 4/s);
  assert.match(sql, /INSERT INTO `__new_tool_jobs`[\s\S]*FROM `tool_jobs`/);
  assert.match(sql, /claim_expires_at/);
  assert.match(sql, /dead_letter/);
  assert.match(sql, /worker_id.*REFERENCES `worker_agents`/s);
  assert.match(sql, /retry_scheduled/);
});

test("worker tokens are one-time, hashed and tenant bound", async () => {
  const runtime = await source("lib/worker-runtime.ts");
  assert.match(runtime, /crypto\.getRandomValues/);
  assert.match(runtime, /return `twk_\$\{base64\}`/);
  assert.match(runtime, /tokenSha256 = await sha256\(token\)/);
  assert.match(runtime, /Roh-Token wird nicht gespeichert/);
  assert.match(runtime, /WHERE token_sha256 = \? AND status != 'revoked'/);
  assert.match(runtime, /WHERE id = \? AND user_id = \?/);
});

test("worker status event uses the exact validated binding set", async () => {
  const runtime = await source("lib/worker-runtime.ts");
  assert.match(runtime, /SELECT \?, id, user_id, \?, version, \?, \?/);
  assert.match(runtime, /\.bind\(eventId, eventType, note, timestamp, input\.workerId, input\.userId, nextVersion\)/);
  assert.doesNotMatch(runtime, /\.bind\(crypto\.randomUUID\(\), eventId, eventType/);
});

test("claims enforce worker status, concurrency, expiry and claim token", async () => {
  const runtime = await source("lib/worker-runtime.ts");
  assert.match(runtime, /status = 'active'/);
  assert.match(runtime, /COUNT\(\*\) FROM tool_jobs[\s\S]*max_concurrency/s);
  assert.match(runtime, /claimExpiresAt = addMilliseconds\(timestamp, 90_000\)/);
  assert.match(runtime, /worker_id = \?.*claim_token = \?/s);
  assert.match(runtime, /claim_expires_at > \?/);
});

test("heartbeats are monotone and failures retry or dead-letter", async () => {
  const runtime = await source("lib/worker-runtime.ts");
  assert.match(runtime, /input\.progressPercent < Number\(existing\.progress_percent\)/);
  assert.match(runtime, /claim_expires_at = \?/);
  assert.match(runtime, /retryDelayMs/);
  assert.match(runtime, /status = 'dead_letter'/);
  assert.match(runtime, /retry_scheduled/);
  assert.match(runtime, /recoverExpiredWorkerClaims/);
});

test("worker APIs separate account management from bearer runtime", async () => {
  const management = await source("app/api/workers/route.ts");
  const runtime = await source("app/api/worker-runtime/route.ts");
  assert.match(management, /requireApiIdentity/);
  assert.match(management, /origin !== new URL\(request\.url\)\.origin/);
  assert.match(runtime, /authenticateWorker\(request\.headers\.get\("authorization"\)\)/);
  assert.match(runtime, /action === "claim"/);
  assert.match(runtime, /action === "jobHeartbeat"/);
  assert.match(runtime, /action === "execute"/);
});
