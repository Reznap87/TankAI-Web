import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

const root = path.resolve(import.meta.dirname, "..");

function applyMigration(db, file) {
  const source = fs.readFileSync(path.join(root, "drizzle", file), "utf8");
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

test("CSV migration preserves populated v0.24 documents and expands both kind constraints", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  const priorMigrations = fs
    .readdirSync(path.join(root, "drizzle"))
    .filter(
      (name) =>
        /^\d{4}_.+\.sql$/u.test(name) &&
        name !== "0017_lovely_hawkeye.sql",
    )
    .sort();
  let priorStatements = 0;
  for (const file of priorMigrations) {
    priorStatements += applyMigration(db, file);
  }
  assert.equal(priorStatements, 236);

  const now = "2026-07-28T08:00:00.000Z";
  const projectId = "11111111-1111-4111-8111-111111111111";
  const documentId = "22222222-2222-4222-8222-222222222222";
  const hash = "a".repeat(64);
  db.prepare(
    `INSERT INTO projects
     (id,user_id,name,description,status,version,content_revision,created_at,updated_at)
     VALUES (?,'owner-user','Bestehend','','active',1,1,?,?)`,
  ).run(projectId, now, now);
  db.prepare(
    `INSERT INTO project_documents
     (id,project_id,user_id,name,kind,content,content_sha256,size_bytes,version,created_at,updated_at)
     VALUES (?,?,'owner-user','notiz.md','markdown','bestehend',?,9,1,?,?)`,
  ).run(documentId, projectId, hash, now, now);
  db.prepare(
    `INSERT INTO project_document_versions
     (id,document_id,project_id,user_id,version,name,kind,content,content_sha256,size_bytes,change_note,created_at)
     VALUES ('33333333-3333-4333-8333-333333333333',?,?,'owner-user',1,'notiz.md','markdown','bestehend',?,9,'Seed',?)`,
  ).run(documentId, projectId, hash, now);

  assert.equal(applyMigration(db, "0017_lovely_hawkeye.sql"), 16);
  assert.equal(
    db.prepare("SELECT content FROM project_documents WHERE id=?").get(documentId).content,
    "bestehend",
  );
  assert.equal(
    db.prepare("SELECT change_note FROM project_document_versions WHERE document_id=?").get(documentId).change_note,
    "Seed",
  );

  const csvId = "44444444-4444-4444-8444-444444444444";
  const csvContent = "name,wert\nTank,42";
  db.prepare(
    `INSERT INTO project_documents
     (id,project_id,user_id,name,kind,content,content_sha256,size_bytes,version,created_at,updated_at)
     VALUES (?,?,?,'werte.csv','csv',?,?,?,1,?,?)`,
  ).run(
    csvId,
    projectId,
    "owner-user",
    csvContent,
    "b".repeat(64),
    Buffer.byteLength(csvContent),
    now,
    now,
  );
  db.prepare(
    `INSERT INTO project_document_versions
     (id,document_id,project_id,user_id,version,name,kind,content,content_sha256,size_bytes,change_note,created_at)
     VALUES ('55555555-5555-4555-8555-555555555555',?,?,?,1,'werte.csv','csv',?,?,?,'CSV',?)`,
  ).run(
    csvId,
    projectId,
    "owner-user",
    csvContent,
    "b".repeat(64),
    Buffer.byteLength(csvContent),
    now,
  );
  assert.equal(
    db.prepare("SELECT kind FROM project_documents WHERE id=?").get(csvId).kind,
    "csv",
  );
  assert.throws(
    () =>
      db.prepare(
        `INSERT INTO project_documents
         (id,project_id,user_id,name,kind,content,content_sha256,size_bytes,version,created_at,updated_at)
         VALUES ('bad',?,'owner-user','bad.bin','binary','x',?,1,1,?,?)`,
      ).run(projectId, "c".repeat(64), now, now),
    /CHECK constraint failed/u,
  );
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});
