import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import ts from "../node_modules/typescript/lib/typescript.js";

const root = path.resolve(import.meta.dirname, "..");

function migrations(db) {
  const files = fs
    .readdirSync(path.join(root, "drizzle"))
    .filter((name) => /^\d{4}_.+\.sql$/u.test(name))
    .sort();
  let statements = 0;
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, "drizzle", file), "utf8");
    for (const statement of source
      .split("--> statement-breakpoint")
      .map((value) => value.trim())
      .filter(Boolean)) {
      db.exec(`${statement};`);
      statements += 1;
    }
  }
  return statements;
}

class D1Prepared {
  constructor(db, sql, args = []) {
    this.db = db;
    this.sql = sql;
    this.args = args;
  }
  bind(...args) {
    return new D1Prepared(this.db, this.sql, args);
  }
  async first() {
    return this.db.prepare(this.sql).get(...this.args) ?? null;
  }
  async all() {
    return { results: this.db.prepare(this.sql).all(...this.args) };
  }
  runSync() {
    const result = this.db.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}

class D1DatabaseMock {
  constructor(db) {
    this.db = db;
  }
  prepare(sql) {
    return new D1Prepared(this.db, sql);
  }
  async batch(statements) {
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

function mapJob(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    leaseId: row.lease_id,
    toolName: row.tool_name,
    status: row.status,
    input: JSON.parse(row.input_json),
    inputSha256: row.input_sha256,
    output: row.output_json ? JSON.parse(row.output_json) : null,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    progressPercent: Number(row.progress_percent),
    attempt: Number(row.attempt),
    maxAttempts: Number(row.max_attempts),
    version: Number(row.version),
    heartbeatAt: row.heartbeat_at,
    workerId: row.worker_id,
    claimExpiresAt: row.claim_expires_at,
    availableAt: row.available_at,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

function loadRuntime(db) {
  const source = fs.readFileSync(path.join(root, "lib/react-runtime.ts"), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const d1 = new D1DatabaseMock(db);
  const mockCreateToolJob = async (input) => {
    const existing = db
      .prepare("SELECT * FROM tool_jobs WHERE user_id = ? AND idempotency_key = ?")
      .get(input.userId, input.idempotencyKey);
    if (existing) return { job: mapJob(existing), created: false };
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const inputJson = JSON.stringify(input.payload);
    const inputSha256 = crypto.createHash("sha256").update(inputJson).digest("hex");
    db.prepare(
      `INSERT INTO tool_jobs
       (id,user_id,project_id,lease_id,tool_name,status,input_json,input_sha256,
        progress_percent,attempt,max_attempts,version,available_at,idempotency_key,
        created_at,updated_at)
       VALUES (?,?,?,?,?,'queued',?,?,0,0,?,1,?,?,?,?)`,
    ).run(
      id,
      input.userId,
      input.projectId ?? null,
      input.leaseId,
      input.toolName,
      inputJson,
      inputSha256,
      input.maxAttempts,
      timestamp,
      input.idempotencyKey,
      timestamp,
      timestamp,
    );
    return {
      job: mapJob(db.prepare("SELECT * FROM tool_jobs WHERE id = ?").get(id)),
      created: true,
    };
  };
  const module = { exports: {} };
  const customRequire = (specifier) => {
    if (specifier === "@/lib/request-context") {
      return { currentRuntimeBindings: () => ({ DB: d1 }) };
    }
    if (specifier === "@/lib/tool-jobs") {
      return { createToolJob: mockCreateToolJob };
    }
    throw new Error(`Unexpected runtime import: ${specifier}`);
  };
  new Function("require", "module", "exports", js)(
    customRequire,
    module,
    module.exports,
  );
  return module.exports;
}

function seed(db) {
  const timestamp = new Date().toISOString();
  const userId = "test-user";
  const projectId = "11111111-1111-4111-8111-111111111111";
  const leaseId = "22222222-2222-4222-8222-222222222222";
  db.prepare(
    `INSERT INTO projects
     (id,user_id,name,description,status,version,content_revision,created_at,updated_at)
     VALUES (?,?,?,'','active',1,0,?,?)`,
  ).run(projectId, userId, "ReAct Test", timestamp, timestamp);
  db.prepare(
    `INSERT INTO tool_execution_leases
     (id,user_id,project_id,scope_kind,tool_name,status,max_uses,remaining_uses,
      version,expires_at,last_event_id,created_at,updated_at)
     VALUES (?,?,?,'project','text.sha256','active',20,20,1,?,?,?,?)`,
  ).run(
    leaseId,
    userId,
    projectId,
    new Date(Date.now() + 3_600_000).toISOString(),
    crypto.randomUUID(),
    timestamp,
    timestamp,
  );
  return { userId, projectId, leaseId };
}

test("ReAct migration, tool observation, final answer and receipts work end-to-end", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  const statementCount = migrations(db);
  assert.equal(statementCount, 252);
  const ids = seed(db);
  const runtime = loadRuntime(db);

  const created = await runtime.createReActRun({
    ...ids,
    objective: "Berechne einen stabilen Hash und liefere ihn zurück.",
    definitionOfDone: "Der Hash wurde beobachtet und final ausgegeben.",
    maxSteps: 4,
    maxModelCalls: 4,
    maxToolActions: 2,
  });
  assert.equal(created.status, "ready");

  const dispatched = await runtime.submitReActDecision({
    userId: ids.userId,
    runId: created.id,
    expectedVersion: created.version,
    decisionSummary: "Für das Ziel ist eine deterministische SHA-256-Aktion erforderlich.",
    action: {
      type: "tool",
      leaseId: ids.leaseId,
      toolName: "text.sha256",
      payload: { text: "TankAI ReAct" },
      maxAttempts: 3,
    },
  });
  assert.equal(dispatched.run.status, "waiting_tool");
  assert.equal(dispatched.run.toolActionsUsed, 1);
  assert.equal(dispatched.step.actionType, "tool");

  const output = { algorithm: "SHA-256", digest: "abc123" };
  db.prepare(
    `UPDATE tool_jobs SET status='succeeded', output_json=?, progress_percent=100,
     version=version+1, completed_at=?, updated_at=? WHERE id=?`,
  ).run(
    JSON.stringify(output),
    new Date().toISOString(),
    new Date().toISOString(),
    dispatched.job.id,
  );

  const synchronized = await runtime.synchronizeReActRun({
    userId: ids.userId,
    runId: created.id,
    expectedVersion: dispatched.run.version,
  });
  assert.equal(synchronized.status, "running");

  const completed = await runtime.submitReActDecision({
    userId: ids.userId,
    runId: created.id,
    expectedVersion: synchronized.version,
    decisionSummary: "Die Werkzeugbeobachtung erfüllt die Definition of Done.",
    action: { type: "final", answer: "SHA-256: abc123" },
  });
  assert.equal(completed.run.status, "completed");
  assert.equal(completed.run.finalAnswer, "SHA-256: abc123");

  const listed = await runtime.listReActRuns({
    userId: ids.userId,
    runId: created.id,
  });
  assert.equal(listed.selected.steps.length, 2);
  assert.deepEqual(listed.selected.steps[0].observation, output);
  assert.match(listed.selected.steps[0].observationSha256, /^[0-9a-f]{64}$/u);
  assert.deepEqual(
    listed.selected.events.map((event) => event.type),
    ["created", "decision", "tool_dispatched", "observation", "decision", "completed"],
  );
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("ReAct terminates when the step budget is exhausted", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  migrations(db);
  const ids = seed(db);
  const runtime = loadRuntime(db);
  const created = await runtime.createReActRun({
    ...ids,
    objective: "Ein Schritt reicht nicht für Tool plus finale Antwort.",
    definitionOfDone: "Der Lauf muss kontrolliert stoppen.",
    maxSteps: 1,
    maxModelCalls: 2,
    maxToolActions: 1,
  });
  const dispatched = await runtime.submitReActDecision({
    userId: ids.userId,
    runId: created.id,
    expectedVersion: created.version,
    decisionSummary: "Eine Werkzeugaktion wird benötigt.",
    action: {
      type: "tool",
      leaseId: ids.leaseId,
      toolName: "text.sha256",
      payload: { text: "limit" },
      maxAttempts: 1,
    },
  });
  db.prepare(
    "UPDATE tool_jobs SET status='succeeded', output_json='{}', progress_percent=100 WHERE id=?",
  ).run(dispatched.job.id);
  const synchronized = await runtime.synchronizeReActRun({
    userId: ids.userId,
    runId: created.id,
    expectedVersion: dispatched.run.version,
  });
  const exhausted = await runtime.submitReActDecision({
    userId: ids.userId,
    runId: created.id,
    expectedVersion: synchronized.version,
    decisionSummary: "Finalisieren.",
    action: { type: "final", answer: "fertig" },
  });
  assert.equal(exhausted.budgetExhausted, true);
  assert.equal(exhausted.run.status, "budget_exhausted");
  assert.equal(exhausted.run.completedAt !== null, true);
});

test("ReAct source persists summaries, not private chain-of-thought", () => {
  const source = fs.readFileSync(path.join(root, "lib/react-runtime.ts"), "utf8");
  assert.match(source, /decisionSummary/u);
  assert.doesNotMatch(source, /chain[_ -]?of[_ -]?thought/iu);
  assert.doesNotMatch(source, /privateReasoning/iu);
});
