import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

test("fresh migration verifier applies every ordered migration and checks integrity", async () => {
  const source = await fs.readFile(
    new URL("../scripts/verify-fresh-migrations.mjs", import.meta.url),
    "utf8",
  );
  const packageJson = JSON.parse(await fs.readFile(
    new URL("../package.json", import.meta.url),
    "utf8",
  ));
  assert.equal(
    packageJson.scripts["db:verify:fresh"],
    "node scripts/verify-fresh-migrations.mjs",
  );
  assert.match(source, /\.sort\(\)/u);
  assert.match(source, /PRAGMA foreign_key_check/u);
  assert.match(source, /PRAGMA integrity_check/u);
  assert.match(source, /mode: 0o600/u);
});
