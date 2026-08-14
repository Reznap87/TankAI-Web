import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationDirectory = path.join(root, "drizzle");
const files = fs.readdirSync(migrationDirectory)
  .filter((name) => /^\d{4}_.+\.sql$/u.test(name))
  .sort();
const db = new DatabaseSync(":memory:");
let statementsApplied = 0;
try {
  db.exec("PRAGMA foreign_keys=ON");
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationDirectory, file), "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) {
      db.exec(`${statement};`);
      statementsApplied += 1;
    }
  }
  db.exec("PRAGMA foreign_keys=ON");
  const foreignKeyViolations = db.prepare("PRAGMA foreign_key_check").all();
  const integrity = db.prepare("PRAGMA integrity_check").get();
  const tableCount = Number(db.prepare(
    "SELECT COUNT(*) AS total FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  ).get().total);
  const receipt = {
    product: "TankAI Web",
    release: "0.43.0",
    database: "fresh-in-memory-sqlite-d1-compatible",
    migrationFiles: files.length,
    firstMigration: files[0] ?? null,
    lastMigration: files.at(-1) ?? null,
    statementsApplied,
    tableCount,
    foreignKeyViolations: foreignKeyViolations.length,
    integrity: integrity?.integrity_check ?? null,
    passed: foreignKeyViolations.length === 0 && integrity?.integrity_check === "ok",
  };
  const output = `${JSON.stringify(receipt, null, 2)}\n`;
  const destination = process.argv[2];
  if (destination) {
    fs.writeFileSync(destination, output, { mode: 0o600 });
  }
  process.stdout.write(output);
  if (!receipt.passed) process.exitCode = 1;
} finally {
  db.close();
}
