import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const project = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, project), "utf8");
}

test("tool fabric migration preserves v0.11 rows while expanding exact tool names", async () => {
  const migration = await source("drizzle/0007_brisk_tool_fabric.sql");
  assert.match(migration, /CREATE TABLE `__new_tool_execution_leases`/);
  assert.match(migration, /INSERT INTO `__new_tool_execution_leases`[\s\S]*FROM `tool_execution_leases`/);
  assert.match(migration, /CREATE TABLE `__new_tool_jobs`/);
  assert.match(migration, /INSERT INTO `__new_tool_jobs`[\s\S]*FROM `tool_jobs`/);
  assert.match(migration, /web\.fetch/);
  assert.match(migration, /project\.document\.inspect/);
  assert.match(migration, /code\.patch\.inspect/);
  assert.match(migration, /PRAGMA foreign_keys=OFF/);
  assert.match(migration, /PRAGMA foreign_keys=ON/);
});

test("network tool enforces URL, redirect, response and untrusted-data boundaries", async () => {
  const network = await source("lib/tool-network.ts");
  assert.match(network, /url\.protocol !== "https:"/);
  assert.match(network, /url\.username/);
  assert.match(network, /url\.password/);
  assert.match(network, /isIPv4Literal/);
  assert.match(network, /normalized\.includes\(":"\)/);
  assert.match(network, /redirect: "manual"/);
  assert.match(network, /credentials: "omit"/);
  assert.match(network, /MAX_REDIRECTS = 3/);
  assert.match(network, /MAX_RESPONSE_BYTES = 28_000/);
  assert.match(network, /FETCH_TIMEOUT_MS = 10_000/);
  assert.match(network, /ALLOWED_CONTENT_TYPES/);
  assert.match(network, /sha256/);
  assert.match(network, /untrusted: true/);
  assert.match(network, /promptInjectionSignals/);
  assert.match(network, /enforceEgressPolicy\(requestedUrl\)/);
  assert.match(network, /enforceEgressPolicy\(next\)/);
  assert.match(network, /policySha256/);
  assert.doesNotMatch(network, /authorization/iu);
  assert.doesNotMatch(network, /cookie/iu);
});

test("project document inspection is bound to owner and project and executes nothing", async () => {
  const document = await source("lib/tool-document.ts");
  assert.match(document, /WHERE id = \? AND project_id = \? AND user_id = \?/);
  assert.match(document, /\.bind\(documentId, input\.projectId, input\.userId\)/);
  assert.match(document, /untrusted: true/);
  assert.match(document, /executableContentRun: false/);
  assert.match(document, /promptInjectionSignals/);
  assert.match(document, /queryCsvDocument/);
  assert.match(document, /csvQuery/);
  assert.doesNotMatch(document, /eval\s*\(/);
  assert.doesNotMatch(document, /new Function/);
});

test("CSV tool query has strict input and output budgets", async () => {
  const runtime = await source("lib/tool-runtime.ts");
  assert.match(runtime, /maximumQueryFilters/);
  assert.match(runtime, /maximumQuerySorts/);
  assert.match(runtime, /maximumQueryColumns/);
  assert.match(runtime, /maximumQueryRows/);
  assert.match(runtime, /requireOnlyKeys\(record, \["documentId", "csvQuery"\]\)/);
  assert.match(runtime, /maximumOutputBytes: 40_000/);
});

test("patch inspection rejects traversal semantics and never applies code", async () => {
  const patch = await source("lib/tool-patch.ts");
  assert.match(patch, /normalized\.split\("\/"\)\.includes\("\.\."\)/);
  assert.match(patch, /Binary files/);
  assert.match(patch, /GIT binary patch/);
  assert.match(patch, /validUnifiedDiff/);
  assert.match(patch, /applied: false/);
  assert.match(patch, /codeExecuted: false/);
  assert.doesNotMatch(patch, /execSync|spawn|child_process/);
});

test("tool execution returns explicit observed budget receipt", async () => {
  const runtime = await source("lib/tool-runtime.ts");
  assert.match(runtime, /interface ToolExecutionEnvelope/);
  assert.match(runtime, /durationMs/);
  assert.match(runtime, /inputBytes/);
  assert.match(runtime, /outputBytes/);
  assert.match(runtime, /maximumOutputBytes/);
  assert.match(runtime, /maximumNetworkRequests/);
  assert.match(runtime, /TOOL_DURATION_BUDGET_EXCEEDED/);
  assert.match(runtime, /TOOL_OUTPUT_TOO_LARGE/);
});

test("tool job scope is exact and controlled errors keep stable codes", async () => {
  const jobs = await source("lib/tool-jobs.ts");
  assert.match(jobs, /lease\.scope === "account" && !input\.projectId/);
  assert.match(jobs, /lease\.projectId === input\.projectId/);
  assert.match(jobs, /existing\.project_id \? \{ projectId: existing\.project_id \}/);
  assert.match(jobs, /error instanceof ToolExecutionError/);
  assert.match(jobs, /error\.code/);
  assert.match(jobs, /error\.message\.slice\(0, 500\)/);
  assert.doesNotMatch(jobs, /const db = currentRuntimeBindings\(\)\.DB;\s*const db =/);
});
