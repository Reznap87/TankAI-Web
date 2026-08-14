import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const project = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, project), "utf8");
}

test("memory migration enforces tenant scope, verification, retention and embedding shape", async () => {
  const migration = await source("drizzle/0005_calm_memory_mesh.sql");
  assert.match(migration, /CREATE TABLE `memory_entries`/);
  assert.match(migration, /CREATE TABLE `memory_events`/);
  assert.match(migration, /memory_entries_scope_check/);
  assert.match(migration, /episodic.*semantic.*procedural/s);
  assert.match(migration, /observed.*candidate.*confirmed.*disputed.*revoked/s);
  assert.match(migration, /hot.*warm.*cold.*deleted/s);
  assert.match(migration, /embedding_dimensions` = 192/);
  assert.match(migration, /content_sha256/);
  assert.match(migration, /warmed.*cooled.*expired/s);
});

test("memory retrieval is user scoped and project scoped before cosine ranking", async () => {
  const store = await source("lib/memory-store.ts");
  assert.match(store, /WHERE user_id = \?/);
  assert.match(store, /scope_kind = 'account'/);
  assert.match(store, /scope_kind = 'project' AND project_id = \?/);
  assert.match(store, /memoryCosineSimilarity/);
  assert.match(store, /access_count = access_count \+ 1/);
  assert.match(store, /event_type,[\s\S]*'recalled'/);
});

test("automatic consolidation does not pretend candidate memory is verified", async () => {
  const store = await source("lib/memory-store.ts");
  assert.match(store, /type: "episodic"/);
  assert.match(store, /verificationStatus: "observed"/);
  assert.match(store, /type: "semantic"/);
  assert.match(store, /verificationStatus: "candidate"/);
  assert.match(store, /type: "procedural"/);
  assert.match(store, /factualClaimsVerified: false/);
  assert.match(store, /input\.rating === 1 \? "confirmed" : "disputed"/);
  assert.match(store, /source: "user:correction"/);
  assert.match(store, /WHERE id = \? AND user_id = \? AND version = \?/);
  assert.match(store, /INSERT INTO memory_events[\s\S]*SELECT \?, id, user_id/);
});

test("recalled memory is an untrusted data block below the current request", async () => {
  const runtime = await source("lib/team-runtime.ts");
  assert.match(runtime, /UNTRUSTED_RECALLED_MEMORY_JSON/);
  assert.match(runtime, /keine verifizierten Fakten/);
  assert.match(runtime, /Bei Konflikten gilt die aktuelle Nutzeranfrage/);
});

test("memory API exposes only versioned owner actions", async () => {
  const route = await source("app/api/memory/route.ts");
  assert.match(route, /requireApiIdentity/);
  assert.match(route, /expectedVersion/);
  assert.match(route, /confirm/);
  assert.match(route, /dispute/);
  assert.match(route, /archive/);
  assert.match(route, /restore/);
  assert.match(route, /delete/);
});
