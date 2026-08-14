import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildCloudflareDeployConfig,
  writeCloudflareDeployConfig,
} from "../scripts/render-cloudflare-deploy-config.mjs";

const databaseId = "3d3d6f7d-2b8a-4f2b-8ba4-7cb6fc9a21b0";

test("production deploy config requires a real D1 UUID", () => {
  assert.throws(
    () => buildCloudflareDeployConfig({}),
    /TANKAI_D1_DATABASE_ID/,
  );
  assert.throws(
    () => buildCloudflareDeployConfig({ TANKAI_D1_DATABASE_ID: "later" }),
    /D1-UUID/,
  );
});

test("production deploy config binds the built Worker, assets and D1 migrations", () => {
  const result = buildCloudflareDeployConfig({
    TANKAI_D1_DATABASE_ID: databaseId,
    TANKAI_CUSTOM_DOMAIN: "ai.tankonthatrack.de",
    TANKAI_EGRESS_ALLOWED_HOSTS: "api.openai.com, api.anthropic.com,api.openai.com",
  });

  assert.equal(result.releaseVersion, "0.43.0");
  assert.equal(result.expectedPublicUrl, "https://ai.tankonthatrack.de");
  assert.equal(result.config.main, "dist/server/index.js");
  assert.deepEqual(result.config.assets, {
    directory: "./dist/client",
    binding: "ASSETS",
    run_worker_first: true,
  });
  assert.deepEqual(result.config.d1_databases, [{
    binding: "DB",
    database_name: "tankai-web-production",
    database_id: databaseId,
    migrations_dir: "drizzle",
  }]);
  assert.equal(
    result.config.vars.TANKAI_EGRESS_ALLOWED_HOSTS,
    "api.openai.com,api.anthropic.com",
  );
  assert.deepEqual(result.config.routes, [
    { pattern: "ai.tankonthatrack.de", custom_domain: true },
  ]);
  assert.equal(JSON.stringify(result.config).includes("TANKAI_ID_SALT"), false);
  assert.equal(JSON.stringify(result.config).includes("API_KEY"), false);
});

test("production deploy config rejects URL-shaped custom-domain input", () => {
  assert.throws(
    () => buildCloudflareDeployConfig({
      TANKAI_D1_DATABASE_ID: databaseId,
      TANKAI_CUSTOM_DOMAIN: "https://ai.tankonthatrack.de/path",
    }),
    /reiner öffentlicher Hostname/,
  );
});

test("generated production config is written with owner-only permissions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tankai-deploy-config-"));
  const output = join(directory, "production.jsonc");
  await writeCloudflareDeployConfig(output, { TANKAI_D1_DATABASE_ID: databaseId });
  const parsed = JSON.parse(await readFile(output, "utf8"));
  const mode = (await stat(output)).mode & 0o777;
  assert.equal(parsed.name, "tankai-web");
  assert.equal(mode, 0o600);
});
