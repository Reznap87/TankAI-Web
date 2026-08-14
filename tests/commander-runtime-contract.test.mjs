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
  runSync() {
    const result = this.db.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
  async run() { return this.runSync(); }
}

class D1DatabaseMock {
  constructor(db) { this.db = db; }
  prepare(sql) { return new D1Prepared(this.db, sql); }
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

function transpile(file) {
  return ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
}

function loadRuntimes(db) {
  const d1 = new D1DatabaseMock(db);
  const createToolJob = async (input) => {
    const existing = db.prepare("SELECT * FROM tool_jobs WHERE user_id = ? AND idempotency_key = ?").get(input.userId, input.idempotencyKey);
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
    ).run(id, input.userId, input.projectId ?? null, input.leaseId, input.toolName, inputJson, inputSha256, input.maxAttempts, timestamp, input.idempotencyKey, timestamp, timestamp);
    return { job: mapJob(db.prepare("SELECT * FROM tool_jobs WHERE id = ?").get(id)), created: true };
  };

  const reactModule = { exports: {} };
  new Function("require", "module", "exports", transpile("lib/react-runtime.ts"))(
    (specifier) => {
      if (specifier === "@/lib/request-context") return { currentRuntimeBindings: () => ({ DB: d1 }) };
      if (specifier === "@/lib/tool-jobs") return { createToolJob };
      throw new Error(`Unexpected react import: ${specifier}`);
    },
    reactModule,
    reactModule.exports,
  );

  const toolNames = ["text.sha256", "text.analyze", "json.validate", "memory.retention", "web.fetch", "project.document.inspect", "code.patch.inspect"];
  const catalog = toolNames.map((name) => ({ name, description: `${name} test tool` }));
  const commanderModule = { exports: {} };
  new Function("require", "module", "exports", transpile("lib/commander-runtime.ts"))(
    (specifier) => {
      if (specifier === "@/lib/request-context") return { currentRuntimeBindings: () => ({ DB: d1 }) };
      if (specifier === "@/lib/react-runtime") return reactModule.exports;
      if (specifier === "@/lib/providers") return { configuredProviders: () => [] };
      if (specifier === "@/lib/database") return {
        requireCapabilityLeaseForRun: async ({ leaseId, userId, mode, projectId }) => {
          const row = db.prepare("SELECT * FROM capability_leases WHERE id = ? AND user_id = ?").get(leaseId, userId);
          const scopeMatches = row && (row.scope_kind === "account" || (row.scope_kind === "project" && row.project_id === projectId));
          if (!row || row.capability !== "model.run" || row.mode !== mode || row.status !== "active" || row.remaining_uses < 1 || !scopeMatches || Date.parse(row.expires_at) <= Date.now()) {
            throw new Error("Capability lease unavailable");
          }
          return { id: row.id, capability: row.capability, mode: row.mode, scope: row.scope_kind, projectId: row.project_id, projectName: null, status: row.status, maxUses: Number(row.max_uses), remainingUses: Number(row.remaining_uses), version: Number(row.version), expiresAt: row.expires_at, createdAt: row.created_at, updatedAt: row.updated_at, lastUsedAt: row.last_used_at, revokedAt: row.revoked_at };
        },
      };
      if (specifier === "@/lib/tankai-master-prompt") return { TANKAI_MASTER_PROMPT: "TANKAI TEST MASTER PROMPT" };
      if (specifier === "@/lib/tool-runtime") return { TOOL_CATALOG: catalog, isToolName: (value) => toolNames.includes(value) };
      throw new Error(`Unexpected commander import: ${specifier}`);
    },
    commanderModule,
    commanderModule.exports,
  );
  return commanderModule.exports;
}

function seed(db) {
  const timestamp = new Date().toISOString();
  const userId = "commander-user";
  const projectId = "11111111-1111-4111-8111-111111111111";
  const toolLeaseId = "22222222-2222-4222-8222-222222222222";
  const capabilityLeaseId = "33333333-3333-4333-8333-333333333333";
  db.prepare(
    `INSERT INTO projects
     (id,user_id,name,description,status,version,content_revision,created_at,updated_at)
     VALUES (?,?,?,'','active',1,0,?,?)`,
  ).run(projectId, userId, "Commander Test", timestamp, timestamp);
  db.prepare(
    `INSERT INTO tool_execution_leases
     (id,user_id,project_id,scope_kind,tool_name,status,max_uses,remaining_uses,
      version,expires_at,last_event_id,created_at,updated_at)
     VALUES (?,?,?,'project','text.sha256','active',20,20,1,?,?,?,?)`,
  ).run(toolLeaseId, userId, projectId, new Date(Date.now() + 3_600_000).toISOString(), crypto.randomUUID(), timestamp, timestamp);
  db.prepare(
    `INSERT INTO capability_leases
     (id,user_id,capability,mode,scope_kind,project_id,status,max_uses,remaining_uses,
      version,expires_at,last_event_id,created_at,updated_at,last_used_at,revoked_at)
     VALUES (?,?,'model.run','team','project',?,'active',20,20,1,?,?,?,?,NULL,NULL)`,
  ).run(capabilityLeaseId, userId, projectId, new Date(Date.now() + 3_600_000).toISOString(), crypto.randomUUID(), timestamp, timestamp);
  return { userId, projectId, toolLeaseId, capabilityLeaseId };
}

function provider({ id, family, roles, outputs }) {
  let index = 0;
  return {
    id,
    family,
    name: id,
    model: `${id}-model`,
    priority: 100,
    roles,
    async complete() {
      const text = outputs[index++];
      if (text === undefined) throw new Error(`No output left for ${id}`);
      return { text, latencyMs: 12 };
    },
  };
}

test("Commander dispatches a lease-protected tool, observes it, obtains critic approval and completes", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  assert.equal(migrations(db), 252);
  const ids = seed(db);
  const runtime = loadRuntimes(db);
  const planner = provider({
    id: "planner",
    family: "alpha",
    roles: ["planner", "general"],
    outputs: [
      JSON.stringify({ decisionSummary: "Ein Hash ist zur Zielerfüllung erforderlich.", action: { type: "tool", toolName: "text.sha256", payload: { text: "TankAI Commander" }, maxAttempts: 2 } }),
      JSON.stringify({ decisionSummary: "Die beobachtete Ausgabe erfüllt die Definition of Done.", action: { type: "final", answer: "Geprüfter Hash: abc123" } }),
    ],
  });
  const critic = provider({
    id: "critic",
    family: "beta",
    roles: ["critic"],
    outputs: [JSON.stringify({ approved: true, summary: "Die Antwort folgt der Werkzeugbeobachtung." })],
  });

  const created = await runtime.createCommanderRun({
    ...ids,
    objective: "Berechne einen Hash.",
    definitionOfDone: "Ein beobachteter Hash wird nach Critic-Prüfung ausgegeben.",
    maxCycles: 6,
    maxModelCalls: 10,
    maxReviewCalls: 3,
    maxToolActions: 2,
  });
  const waiting = await runtime.advanceCommanderRun({ userId: ids.userId, runId: created.id, expectedVersion: created.version, providers: [planner, critic] });
  assert.equal(waiting.run.status, "waiting_tool");
  const job = db.prepare("SELECT * FROM tool_jobs").get();
  assert.equal(job.tool_name, "text.sha256");
  db.prepare("UPDATE tool_jobs SET status='succeeded', output_json=?, progress_percent=100, version=version+1, completed_at=?, updated_at=? WHERE id=?")
    .run(JSON.stringify({ digest: "abc123" }), new Date().toISOString(), new Date().toISOString(), job.id);

  const completed = await runtime.advanceCommanderRun({ userId: ids.userId, runId: created.id, expectedVersion: waiting.run.version, providers: [planner, critic] });
  assert.equal(completed.run.status, "completed");
  assert.equal(completed.run.finalAnswer, "Geprüfter Hash: abc123");
  assert.equal(completed.decisions.length, 3);
  assert.equal(completed.modelLeaseEvents.length, 3);
  assert.deepEqual(completed.modelLeaseEvents.map((item) => item.phase), ["decision", "decision", "review"]);
  assert.equal(db.prepare("SELECT remaining_uses FROM capability_leases WHERE id = ?").get(ids.capabilityLeaseId).remaining_uses, 17);
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM capability_lease_events WHERE lease_id = ? AND event_type = 'consumed'").get(ids.capabilityLeaseId).total, 3);
  assert.deepEqual(completed.decisions.map((item) => item.phase), ["decision", "decision", "review"]);
  assert.ok(completed.decisions.every((item) => /^[0-9a-f]{64}$/u.test(item.rawResponseSha256)));
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("Commander rejects an unleased tool and repairs the plan in the next cycle", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  migrations(db);
  const ids = seed(db);
  const runtime = loadRuntimes(db);
  const planner = provider({
    id: "planner",
    family: "alpha",
    roles: ["planner"],
    outputs: [
      JSON.stringify({ decisionSummary: "Versuche Webzugriff.", action: { type: "tool", toolName: "web.fetch", payload: { url: "https://example.com" }, maxAttempts: 1 } }),
      JSON.stringify({ decisionSummary: "Ohne Webfreigabe wird transparent abgeschlossen.", action: { type: "final", answer: "Kein Webzugriff autorisiert." } }),
    ],
  });
  const critic = provider({ id: "critic", family: "beta", roles: ["critic"], outputs: [JSON.stringify({ approved: true, summary: "Die Einschränkung wird korrekt offengelegt." })] });
  const created = await runtime.createCommanderRun({
    ...ids,
    objective: "Nutze nur freigegebene Werkzeuge.",
    definitionOfDone: "Nicht autorisierte Aktionen werden nicht ausgeführt.",
    maxCycles: 4,
    maxModelCalls: 8,
    maxReviewCalls: 2,
    maxToolActions: 2,
  });
  const result = await runtime.advanceCommanderRun({ userId: ids.userId, runId: created.id, expectedVersion: created.version, providers: [planner, critic], maxTransitions: 4 });
  assert.equal(result.run.status, "completed");
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM tool_jobs").get().total, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM commander_decisions WHERE status='rejected'").get().total, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM commander_events WHERE event_type='decision_rejected'").get().total, 1);
});

test("Commander stops honestly when no model provider is configured", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  migrations(db);
  const ids = seed(db);
  const runtime = loadRuntimes(db);
  const created = await runtime.createCommanderRun({
    ...ids,
    objective: "Nicht simulieren.",
    definitionOfDone: "Ohne Provider kontrolliert stoppen.",
    maxCycles: 2,
    maxModelCalls: 4,
    maxReviewCalls: 1,
    maxToolActions: 0,
  });
  const result = await runtime.advanceCommanderRun({ userId: ids.userId, runId: created.id, expectedVersion: created.version, providers: [] });
  assert.equal(result.run.status, "model_unavailable");
  assert.equal(result.run.errorCode, "MODEL_NOT_CONFIGURED");
});

test("Commander consumes no model budget when the model.run lease becomes unavailable", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  migrations(db);
  const ids = seed(db);
  const runtime = loadRuntimes(db);
  const created = await runtime.createCommanderRun({
    ...ids,
    objective: "Nutze ausschließlich eine aktive Modellfreigabe.",
    definitionOfDone: "Ohne Freigabe wird kein Provider aufgerufen.",
    maxCycles: 2,
    maxModelCalls: 4,
    maxReviewCalls: 1,
    maxToolActions: 0,
  });
  db.prepare("UPDATE capability_leases SET status='depleted', remaining_uses=0, version=version+1 WHERE id=?")
    .run(ids.capabilityLeaseId);
  const planner = provider({
    id: "planner",
    family: "alpha",
    roles: ["planner"],
    outputs: [JSON.stringify({ decisionSummary: "Darf nicht laufen.", action: { type: "final", answer: "unzulässig" } })],
  });
  await assert.rejects(
    runtime.advanceCommanderRun({ userId: ids.userId, runId: created.id, expectedVersion: created.version, providers: [planner] }),
    (error) => error?.code === "COMMANDER_MODEL_LEASE_UNAVAILABLE",
  );
  const run = db.prepare("SELECT model_calls_used, cycle_count, version FROM commander_runs WHERE id=?").get(created.id);
  assert.deepEqual({ ...run }, { model_calls_used: 0, cycle_count: 0, version: 1 });
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM commander_capability_events").get().total, 0);
});
