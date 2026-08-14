import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const project = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, project), "utf8");
}

test("tool job migration enforces owner scope, exact tools and bounded state", async () => {
  const migration = await source("drizzle/0006_patient_tool_jobs.sql");
  assert.match(migration, /CREATE TABLE `tool_execution_leases`/);
  assert.match(migration, /CREATE TABLE `tool_jobs`/);
  assert.match(migration, /CREATE TABLE `tool_execution_lease_events`/);
  assert.match(migration, /CREATE TABLE `tool_job_events`/);
  assert.match(migration, /tool_execution_leases_scope_check/);
  assert.match(migration, /text\.sha256.*text\.analyze.*json\.validate.*memory\.retention/s);
  assert.match(migration, /queued.*running.*succeeded.*failed.*cancelled/s);
  assert.match(migration, /tool_jobs_user_idempotency_idx/);
  assert.match(migration, /input_sha256/);
  assert.match(migration, /length\(CAST\(`input_json` AS BLOB\)\) <= 24000/);
  assert.match(migration, /length\(CAST\(`output_json` AS BLOB\)\) <= 48000/);
});

test("tool runtime publishes bounded deterministic and network tools", async () => {
  const runtime = await source("lib/tool-runtime.ts");
  assert.match(runtime, /deterministic: true/);
  assert.match(runtime, /externalNetwork: false/);
  assert.match(runtime, /name: "web\.fetch"[\s\S]*externalNetwork: true/);
  assert.match(runtime, /name: "project\.document\.inspect"/);
  assert.match(runtime, /name: "code\.patch\.inspect"/);
  assert.match(runtime, /maximumDurationMs/);
  assert.match(runtime, /maximumNetworkRequests/);
  assert.match(runtime, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(runtime, /JSON\.parse/);
  assert.match(runtime, /maintainMemoryRetention/);
  assert.doesNotMatch(runtime, /eval\s*\(/);
  assert.doesNotMatch(runtime, /new Function/);
});

test("tool lease is consumed atomically before a job can exist", async () => {
  const jobs = await source("lib/tool-jobs.ts");
  assert.match(jobs, /UPDATE tool_execution_leases[\s\S]*remaining_uses = remaining_uses - 1/);
  assert.match(jobs, /NOT EXISTS \([\s\S]*FROM tool_jobs[\s\S]*idempotency_key = \?/);
  assert.match(jobs, /INSERT INTO tool_jobs[\s\S]*FROM tool_execution_leases/);
  assert.match(jobs, /INSERT INTO tool_execution_lease_events[\s\S]*'consumed'/);
  assert.match(jobs, /INSERT INTO tool_job_events[\s\S]*'created'/);
  assert.match(jobs, /input_sha256 !== inputSha256/);
});

test("job execution uses optimistic claim tokens, receipts and bounded retries", async () => {
  const jobs = await source("lib/tool-jobs.ts");
  assert.match(jobs, /status = 'running'.*claim_token = \?/s);
  assert.match(jobs, /WHERE id = \? AND user_id = \? AND version = \? AND status = 'queued'/);
  assert.match(jobs, /'claimed'/);
  assert.match(jobs, /status = 'succeeded'.*output_json = \?/s);
  assert.match(jobs, /'succeeded'/);
  assert.match(jobs, /status = 'failed'/);
  assert.match(jobs, /failureChanges !== 1/);
  assert.match(jobs, /attempt < max_attempts/);
  assert.match(jobs, /'requeued'/);
  assert.match(jobs, /'cancelled'/);
});

test("stale running jobs are recovered only for their owner", async () => {
  const jobs = await source("lib/tool-jobs.ts");
  assert.match(jobs, /WHERE user_id = \? AND status = 'running'/);
  assert.match(jobs, /heartbeat_at < \?/);
  assert.match(jobs, /claim_token = NULL/);
  assert.match(jobs, /'recovered'/);
  assert.match(jobs, /Verwaister Claim/);
});

test("tool APIs require authenticated identity, same origin and versioned actions", async () => {
  const leases = await source("app/api/tool-leases/route.ts");
  const jobs = await source("app/api/tool-jobs/route.ts");
  assert.match(leases, /requireApiIdentity/);
  assert.match(leases, /origin !== new URL\(request\.url\)\.origin/);
  assert.match(leases, /expectedVersion/);
  assert.match(jobs, /requireApiIdentity/);
  assert.match(jobs, /IDEMPOTENCY_PATTERN/);
  assert.match(jobs, /expectedVersion/);
  assert.match(jobs, /action === "execute"/);
  assert.match(jobs, /action === "retry" \|\| action === "cancel"/);
  assert.match(jobs, /action === "recover"/);
});


test("protected tools page exposes lease, queue and recovery controls", async () => {
  const page = await source("app/tools/tools-client.tsx");
  assert.match(page, /TANKAI TOOL FABRIC · V0\.15/);
  assert.match(page, /1 Nutzung für 60 Minuten freigeben/);
  assert.match(page, /Auftrag anlegen und ausführen/);
  assert.match(page, /action: "execute"/);
  assert.match(page, /updateJob\(job, "retry"\)/);
  assert.match(page, /updateJob\(job, "cancel"\)/);
  assert.match(page, /action: "recover"/);
  assert.match(page, /JSON.stringify\(job.output, null, 2\)/);
  assert.match(page, /project\.document\.inspect/);
  assert.match(page, /code\.patch\.inspect/);
  assert.match(page, /web\.fetch/);
  assert.match(page, /Werkzeugbudget/);

  const status = await source("app/api/status/route.ts");
  assert.match(status, /release: TANKAI_WEB_RELEASE/);
  assert.match(status, /restricted-https-fetch/);
  assert.match(status, /codeExecution: false/);
  assert.match(status, /transport: "authenticated-sse"/);
  assert.match(status, /staleClaimRecoveryMinutes: 5/);
});

test("multi-source research keeps source observations untrusted and individually receipted", async () => {
  const orchestrator = await source("lib/research-orchestrator.ts");
  const route = await source("app/api/research/route.ts");
  const page = await source("app/tools/tools-client.tsx");
  const status = await source("app/api/status/route.ts");

  assert.match(orchestrator, /value\.length < 2 \|\| value\.length > MAX_SOURCES/);
  assert.match(orchestrator, /hosts\.size < 2/);
  assert.match(orchestrator, /normalizePublicHttpsUrl/);
  assert.match(orchestrator, /createToolJob/);
  assert.match(orchestrator, /executeToolJob/);
  assert.match(orchestrator, /toolName: "web\.fetch"/);
  assert.match(orchestrator, /idempotencyKey: `\$\{input\.idempotencyKey\}:\$\{index \+ 1\}`/);
  assert.match(orchestrator, /verificationStatus: "unverified-source-observations"/);
  assert.match(orchestrator, /untrusted: true/);
  assert.doesNotMatch(orchestrator, /verified-facts/);

  assert.match(route, /requireApiIdentity/);
  assert.match(route, /origin !== new URL\(request\.url\)\.origin/);
  assert.match(route, /requireActiveProjectContext/);
  assert.match(route, /IDEMPOTENCY_PATTERN/);
  assert.match(page, /MEHRQUELLEN-RECHERCHE · V0\.22/);
  assert.match(page, /nicht verifizierte Quellenbeobachtungen/);
  assert.match(status, /explicitSourceUrlsRequired: true/);
  assert.match(status, /durablePerSourceReceipts: true/);
});

test("tool progress stream is owner-scoped, resumable and excludes payloads", async () => {
  const jobs = await source("lib/tool-jobs.ts");
  const route = await source("app/api/tool-jobs/stream/route.ts");
  const page = await source("app/tools/tools-client.tsx");
  const status = await source("app/api/status/route.ts");

  assert.match(jobs, /readToolJobProgress/);
  assert.match(jobs, /const row = await jobRow\(input\.jobId, input\.userId\)/);
  assert.match(jobs, /FROM tool_job_events[\s\S]*job_id = \? AND user_id = \?/);
  assert.match(jobs, /job_version > \? OR \(job_version = \? AND id > \?\)/);
  assert.doesNotMatch(
    route,
    /input_json|output_json|inputSha256|idempotencyKey/,
  );
  assert.match(route, /requireApiIdentity/);
  assert.match(route, /last-event-id/);
  assert.match(route, /text\/event-stream/);
  assert.match(route, /no-store, no-transform/);
  assert.match(route, /STREAM_WINDOW_MS = 15_000/);
  assert.match(route, /executionStatusOnly: true/);
  assert.match(route, /factsVerified: false/);
  assert.match(page, /new EventSource/);
  assert.match(page, /Live-Fortschritt aktiv/);
  assert.match(status, /inputAndOutputIncluded: false/);
});
