import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const deploy = await readFile(new URL("../scripts/deploy-public-cloudflare.sh", import.meta.url), "utf8");
const workflow = await readFile(new URL("../.github/workflows/deploy-public.yml", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("public deploy pipeline runs lint, build, tests, migrations, secret install, deploy and external verification", () => {
  for (const required of [
    "npm run lint",
    "npm run build",
    "node --test tests/*.test.mjs",
    "d1 migrations apply DB --remote",
    "secret put TANKAI_ID_SALT",
    "${wrangler}\" deploy",
    "verify-public-deployment.mjs",
    "PUBLIC_DEPLOYMENT_RECEIPT",
  ]) {
    assert.match(deploy, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("public deploy pipeline never auto-activates provider secrets", () => {
  assert.match(deploy, /Provider-Schlüssel werden absichtlich nicht automatisch aktiviert/);
  assert.doesNotMatch(deploy, /secret put (OPENAI|XAI|ANTHROPIC|GEMINI|CUSTOM_AI)_API_KEY/);
});

test("GitHub production workflow uses protected secret and variable contexts", () => {
  assert.match(workflow, /environment: production/);
  assert.match(workflow, /secrets\.CLOUDFLARE_API_TOKEN/);
  assert.match(workflow, /secrets\.TANKAI_D1_DATABASE_ID/);
  assert.match(workflow, /secrets\.TANKAI_ID_SALT/);
  assert.match(workflow, /vars\.TANKAI_PUBLIC_URL/);
  assert.doesNotMatch(workflow, /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
});

test("package exposes the real public deployment command", () => {
  assert.equal(packageJson.scripts["deploy:public"], "bash scripts/deploy-public-cloudflare.sh");
  assert.equal(packageJson.scripts["deploy:config"], "node scripts/render-cloudflare-deploy-config.mjs");
});
