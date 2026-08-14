import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildPublicDeploymentReceipt,
  writePublicDeploymentReceipt,
} from "../scripts/write-public-deployment-receipt.mjs";

test("blocked deployment receipt contains requirement names but no values", () => {
  const receipt = buildPublicDeploymentReceipt({
    startedAt: "2026-07-29T00:00:00Z",
    completedAt: "2026-07-29T00:00:01Z",
    stage: "preflight",
    exitCode: 78,
    blockerCode: "missing_deployment_values",
    missingRequirements: "CLOUDFLARE_API_TOKEN,TANKAI_ID_SALT,CLOUDFLARE_API_TOKEN,not-safe",
  });
  assert.equal(receipt.status, "blocked");
  assert.deepEqual(receipt.missingRequirements, ["CLOUDFLARE_API_TOKEN", "TANKAI_ID_SALT"]);
  assert.equal(receipt.providerSecretsActivated, false);
  assert.equal(JSON.stringify(receipt).includes("secret-value"), false);
});

test("successful receipt requires an externally passed public verification", () => {
  const receipt = buildPublicDeploymentReceipt({
    startedAt: "2026-07-29T00:00:00Z",
    completedAt: "2026-07-29T00:01:00Z",
    stage: "complete",
    exitCode: 0,
    publicUrl: "https://tankai.example",
    deploymentExecuted: true,
    migrationsApplied: true,
    identitySaltInstalled: true,
    publicVerificationPassed: true,
    sourceTreeSha256: "a".repeat(64),
    publicVerificationSha256: "b".repeat(64),
  });
  assert.equal(receipt.status, "passed");
  assert.equal(receipt.factsVerified, true);
  assert.equal(receipt.publicUrl, "https://tankai.example");
});

test("receipt writer uses owner-only permissions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tankai-deploy-receipt-"));
  const path = join(directory, "receipt.json");
  await writePublicDeploymentReceipt(path, {
    stage: "preflight",
    exitCode: 78,
    blockerCode: "missing_deployment_values",
  });
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.equal(JSON.parse(await readFile(path, "utf8")).status, "blocked");
});
