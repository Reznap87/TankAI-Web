import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const runtime=fs.readFileSync(new URL("../lib/tankbench-suite-runner.ts",import.meta.url),"utf8");
const migration=fs.readFileSync(new URL("../drizzle/0012_automatic_suite_runner.sql",import.meta.url),"utf8");
const route=fs.readFileSync(new URL("../app/api/tankbench-runner/route.ts",import.meta.url),"utf8");

test("Suite Runner creates paired baseline/candidate Commander runs",()=>{
  assert.match(runtime,/for \(const testCase of suite\.cases\) for \(const variant of \["baseline","candidate"\]/);
  assert.match(runtime,/createCommanderRun/);
  assert.match(runtime,/attachCommanderResult/);
  assert.match(runtime,/evaluateTankBenchRun/);
});

test("Traffic router uses stable hash buckets and append-only receipts",()=>{
  assert.match(runtime,/sha256\(`\$\{input\.projectId\}:\$\{key\}`\)/);
  assert.match(runtime,/parseInt\(hash\.slice\(0,8\),16\)%100/);
  assert.match(runtime,/tankbench_route_events/);
  assert.match(migration,/routing_key_hash/);
});

test("Runner API exposes create, advance and route only",()=>{
  assert.match(route,/action==="create"/);
  assert.match(route,/action==="advance"/);
  assert.match(route,/action==="route"/);
  assert.match(route,/requireApiIdentity/);
});
