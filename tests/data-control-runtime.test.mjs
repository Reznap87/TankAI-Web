import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import ts from "../node_modules/typescript/lib/typescript.js";

const root = path.resolve(import.meta.dirname, "..");

function applyMigrationSource(db, source) {
  let statements = 0;
  for (const statement of source
    .split("--> statement-breakpoint")
    .map((value) => value.trim())
    .filter(Boolean)) {
    db.exec(`${statement};`);
    statements += 1;
  }
  return statements;
}

function applyMigrations(db) {
  const files = fs
    .readdirSync(path.join(root, "drizzle"))
    .filter((name) => /^\d{4}_.+\.sql$/u.test(name))
    .sort();
  let statements = 0;
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, "drizzle", file), "utf8");
    statements += applyMigrationSource(db, source);
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
    if (/^\s*(?:SELECT|PRAGMA|WITH)\b/iu.test(this.sql)) {
      return {
        success: true,
        results: this.db.prepare(this.sql).all(...this.args),
        meta: { changes: 0 },
      };
    }
    const result = this.db.prepare(this.sql).run(...this.args);
    return {
      success: true,
      results: [],
      meta: { changes: Number(result.changes) },
    };
  }

  async run() {
    return this.runSync();
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

function loadRuntime(db) {
  const source = fs.readFileSync(
    path.join(root, "lib/data-control-runtime.ts"),
    "utf8",
  );
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  const d1 = new D1DatabaseMock(db);
  new Function("require", "module", "exports", js)(
    (specifier) => {
      if (specifier === "@/lib/request-context") {
        return { currentRuntimeBindings: () => ({ DB: d1 }) };
      }
      throw new Error(`Unexpected import ${specifier}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  }
  return value;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function seedUserData(db) {
  const timestamp = "2026-07-28T07:00:00.000Z";
  const future = "2027-07-28T07:00:00.000Z";
  for (const [userId, suffix] of [
    ["owner-user", "owner"],
    ["other-user", "other"],
  ]) {
    db.prepare(
      `INSERT INTO conversations (id,user_id,title,created_at,updated_at)
       VALUES (?,?,?,?,?)`,
    ).run(`conversation-${suffix}`, userId, `Titel ${suffix}`, timestamp, timestamp);
    db.prepare(
      `INSERT INTO messages
       (id,conversation_id,user_id,role,content,run_id,created_at)
       VALUES (?,?,?,'user',?,NULL,?)`,
    ).run(
      `message-${suffix}`,
      `conversation-${suffix}`,
      userId,
      `Privater Inhalt ${suffix}`,
      timestamp,
    );
    db.prepare(
      `INSERT INTO usage_buckets (user_id,day,requests,model_calls,updated_at)
       VALUES (?, '2026-07-28', 2, 0, ?)`,
    ).run(userId, timestamp);
  }

  db.prepare(
    `INSERT INTO worker_agents
     (id,user_id,name,status,token_sha256,max_concurrency,version,last_seen_at,
      created_at,updated_at,revoked_at)
     VALUES ('worker-owner','owner-user','Owner Worker','active',?,1,1,NULL,?,?,NULL)`,
  ).run("a".repeat(64), timestamp, timestamp);
  db.prepare(
    `INSERT INTO tool_execution_leases
     (id,user_id,project_id,scope_kind,tool_name,status,max_uses,remaining_uses,
      version,expires_at,last_event_id,created_at,updated_at,last_used_at,revoked_at)
     VALUES ('lease-owner','owner-user',NULL,'account','text.sha256','active',
             1,1,1,?,'lease-event-owner',?,?,NULL,NULL)`,
  ).run(future, timestamp, timestamp);
  db.prepare(
    `INSERT INTO tool_jobs
     (id,user_id,project_id,lease_id,tool_name,status,input_json,input_sha256,
      output_json,error_code,error_message,progress_percent,attempt,max_attempts,
      version,worker_id,claim_token,heartbeat_at,claim_expires_at,available_at,
      idempotency_key,created_at,updated_at,started_at,completed_at)
     VALUES ('job-owner','owner-user',NULL,'lease-owner','text.sha256','succeeded',
             ?,?, ?,NULL,NULL,100,1,1,2,NULL,'DO_NOT_EXPORT',NULL,NULL,?,
             'job-owner-key',?,?,?,?)`,
  ).run(
    JSON.stringify({ text: "owner secret input" }),
    "b".repeat(64),
    JSON.stringify({ sha256: "c".repeat(64) }),
    timestamp,
    timestamp,
    timestamp,
    timestamp,
    timestamp,
  );
}

test("data registry covers every user-scoped table and the deletion proof has no user identifier", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  assert.equal(applyMigrations(db), 252);
  const runtime = loadRuntime(db);

  const userScopedTables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all()
    .map(({ name }) => String(name))
    .filter((name) =>
      db
        .prepare(`PRAGMA table_info("${name}")`)
        .all()
        .some((column) => column.name === "user_id"),
    );
  const expected = [...userScopedTables, "tankbench_suite_execution_items"].sort();
  assert.deepEqual([...runtime.USER_DATASET_NAMES].sort(), expected);
  assert.equal(new Set(runtime.USER_DATASET_NAMES).size, 55);

  const receiptColumns = db
    .prepare("PRAGMA table_info(data_deletion_receipts)")
    .all()
    .map(({ name }) => String(name));
  assert.equal(receiptColumns.includes("user_id"), false);
  assert.equal(receiptColumns.includes("email"), false);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("v0.24 migration upgrades populated v0.23 data without loss and enforces one active deletion", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  const files = fs
    .readdirSync(path.join(root, "drizzle"))
    .filter(
      (name) =>
        /^\d{4}_.+\.sql$/u.test(name) &&
        name !== "0016_cultured_next_avengers.sql" &&
        name !== "0017_lovely_hawkeye.sql",
    )
    .sort();
  let priorStatements = 0;
  for (const file of files) {
    priorStatements += applyMigrationSource(
      db,
      fs.readFileSync(path.join(root, "drizzle", file), "utf8"),
    );
  }
  assert.equal(priorStatements, 227);
  db.prepare(
    `INSERT INTO conversations (id,user_id,title,created_at,updated_at)
     VALUES ('existing','owner-user','Bestehend','2026-07-28T07:00:00.000Z','2026-07-28T07:00:00.000Z')`,
  ).run();

  const migration = fs.readFileSync(
    path.join(root, "drizzle/0016_cultured_next_avengers.sql"),
    "utf8",
  );
  assert.equal(applyMigrationSource(db, migration), 9);
  assert.equal(
    db.prepare("SELECT title FROM conversations WHERE id='existing'").get()
      .title,
    "Bestehend",
  );
  const timestamp = "2026-07-28T07:00:00.000Z";
  for (const id of ["request-one", "request-two"]) {
    const insert = () =>
      db.prepare(
        `INSERT INTO data_subject_requests
         (id,user_id,request_type,status,confirmation_sha256,confirmation_hint,
          confirm_by,version,created_at,updated_at)
         VALUES (?,'owner-user','deletion','requested',?,'ABCD1234',
                 '2026-07-28T07:30:00.000Z',1,?,?)`,
      ).run(id, "d".repeat(64), timestamp, timestamp);
    if (id === "request-one") insert();
    else assert.throws(insert, /UNIQUE constraint failed/u);
  }
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("full export hashes registered data, redacts credentials and excludes other tenants", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  applyMigrations(db);
  seedUserData(db);
  const runtime = loadRuntime(db);

  const result = await runtime.createUserDataExport({
    userId: "owner-user",
    email: "owner@example.test",
  });
  const payload = result.payload;
  assert.equal(payload.format, "tankai-user-data-export");
  assert.equal(payload.productRelease, "0.43.0");
  assert.equal(payload.manifest.datasetCount, 55);
  assert.equal(payload.manifest.datasets.length, 55);
  assert.equal(payload.scope.externalSystemsCovered, false);
  assert.equal(payload.datasets.conversations.length, 1);
  assert.equal(payload.datasets.messages[0].content, "Privater Inhalt owner");
  assert.equal(
    payload.datasets.tool_jobs[0].claim_token,
    "[REDACTED_EPHEMERAL_CREDENTIAL]",
  );
  assert.equal(
    payload.datasets.worker_agents[0].token_sha256,
    "[REDACTED_EPHEMERAL_CREDENTIAL]",
  );
  assert.doesNotMatch(JSON.stringify(payload), /other-user|Privater Inhalt other/u);
  assert.doesNotMatch(JSON.stringify(payload), /DO_NOT_EXPORT/u);
  assert.doesNotMatch(JSON.stringify(payload), new RegExp("a".repeat(64), "u"));

  for (const entry of payload.manifest.datasets) {
    assert.equal(
      entry.sha256,
      sha256(JSON.stringify(canonical(payload.datasets[entry.name]))),
    );
  }
  const { sha256: manifestHash, ...manifestCore } = payload.manifest;
  assert.equal(manifestHash, sha256(JSON.stringify(canonical(manifestCore))));
  const { receipt, ...payloadCore } = payload;
  assert.equal(
    receipt.payloadSha256,
    sha256(JSON.stringify(canonical(payloadCore))),
  );
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) AS total FROM data_subject_requests WHERE user_id='owner-user' AND request_type='export'",
      )
      .get().total,
    1,
  );
});

test("two-step deletion enforces grace, deletes all registered data and leaves a verifiable anonymous proof", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  applyMigrations(db);
  seedUserData(db);
  const runtime = loadRuntime(db);
  await runtime.createUserDataExport({
    userId: "owner-user",
    email: "owner@example.test",
  });

  const requested = await runtime.createDeletionRequest("owner-user");
  assert.equal(requested.status, "requested");
  assert.match(requested.confirmationPhrase, /^TANKAI LÖSCHEN [0-9A-F]{8}$/u);
  await assert.rejects(
    runtime.confirmDeletionRequest({
      userId: "owner-user",
      requestId: requested.id,
      confirmationPhrase: "TANKAI LÖSCHEN FALSCH",
      expectedVersion: requested.version,
    }),
    (error) => error.code === "DELETION_CONFIRMATION_MISMATCH",
  );

  const scheduled = await runtime.confirmDeletionRequest({
    userId: "owner-user",
    requestId: requested.id,
    confirmationPhrase: requested.confirmationPhrase,
    expectedVersion: requested.version,
  });
  assert.equal(scheduled.status, "scheduled");
  assert.equal(scheduled.version, 2);
  await assert.rejects(
    runtime.executeDeletionRequest({
      userId: "owner-user",
      requestId: scheduled.id,
      expectedVersion: scheduled.version,
    }),
    (error) => error.code === "DELETION_GRACE_PERIOD_ACTIVE",
  );

  db.prepare(
    "UPDATE data_subject_requests SET execute_after='2000-01-01T00:00:00.000Z' WHERE id=?",
  ).run(scheduled.id);
  const deleted = await runtime.executeDeletionRequest({
    userId: "owner-user",
    requestId: scheduled.id,
    expectedVersion: scheduled.version,
  });
  assert.equal(deleted.report.result.status, "application-data-deleted");
  assert.equal(deleted.report.result.datasetCount, 55);
  assert.ok(deleted.report.result.deletedRowCount >= 11);
  assert.equal(deleted.report.externalBoundaries.length, 3);
  assert.equal(
    deleted.report.externalBoundaries.every(
      (boundary) => boundary.coveredByReceipt === false,
    ),
    true,
  );

  for (const dataset of runtime.USER_DATASET_NAMES) {
    if (dataset === "tankbench_suite_execution_items") continue;
    assert.equal(
      db.prepare(`SELECT COUNT(*) AS total FROM "${dataset}" WHERE user_id=?`).get(
        "owner-user",
      ).total,
      0,
      dataset,
    );
  }
  assert.equal(
    db
      .prepare(
        `SELECT COUNT(*) AS total FROM tankbench_suite_execution_items item
         JOIN tankbench_suite_executions execution ON execution.id=item.execution_id
         WHERE execution.user_id=?`,
      )
      .get("owner-user").total,
    0,
  );
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) AS total FROM conversations WHERE user_id='other-user'",
      )
      .get().total,
    1,
  );
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) AS total FROM data_deletion_receipts WHERE id=?",
      )
      .get(deleted.report.receiptId).total,
    1,
  );

  const verification = await runtime.verifyDeletionReceipt({
    receiptId: deleted.report.receiptId,
    reportSha256: deleted.report.integrity.reportSha256,
  });
  assert.equal(verification.valid, true);
  assert.equal(verification.externalSystemsCovered, false);
  assert.equal(verification.softwareRelease, "0.43.0");
  const mismatched = await runtime.verifyDeletionReceipt({
    receiptId: deleted.report.receiptId,
    reportSha256: "0".repeat(64),
  });
  assert.equal(mismatched.valid, false);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});
