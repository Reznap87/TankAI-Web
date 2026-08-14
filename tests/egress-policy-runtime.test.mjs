import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "../node_modules/typescript/lib/typescript.js";

const root = path.resolve(import.meta.dirname, "..");

function loadPolicy(environment) {
  const source = fs.readFileSync(path.join(root, "lib/egress-policy.ts"), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  class ToolExecutionError extends Error {
    constructor(message, code) {
      super(message);
      this.code = code;
    }
  }
  const module = { exports: {} };
  new Function("require", "module", "exports", output)((specifier) => {
    if (specifier === "@/lib/runtime-env") {
      return { readRuntimeString: (name) => environment[name] };
    }
    if (specifier === "@/lib/tool-errors") return { ToolExecutionError };
    throw new Error(`Unexpected import: ${specifier}`);
  }, module, module.exports);
  return module.exports;
}

test("egress is denied by default without a configured allowlist", async () => {
  const policy = loadPolicy({});
  await assert.rejects(
    policy.enforceEgressPolicy("https://example.com/source"),
    (error) => error.code === "NETWORK_EGRESS_NOT_ALLOWED",
  );
});

test("exact and wildcard allow rules are enforced without matching the apex", async () => {
  const policy = loadPolicy({
    TANKAI_EGRESS_ALLOWED_HOSTS: "example.com,*.wikipedia.org",
  });
  assert.equal(
    (await policy.enforceEgressPolicy("https://example.com/source")).matchedAllowRule,
    "example.com",
  );
  assert.equal(
    (await policy.enforceEgressPolicy("https://de.wikipedia.org/wiki/Tank")).matchedAllowRule,
    "*.wikipedia.org",
  );
  await assert.rejects(
    policy.enforceEgressPolicy("https://wikipedia.org/"),
    (error) => error.code === "NETWORK_EGRESS_NOT_ALLOWED",
  );
});

test("deny rules take precedence over an allow wildcard", async () => {
  const policy = loadPolicy({
    TANKAI_EGRESS_ALLOWED_HOSTS: "*.example.com",
    TANKAI_EGRESS_DENIED_HOSTS: "private.example.com",
  });
  await assert.rejects(
    policy.enforceEgressPolicy("https://private.example.com/"),
    (error) => error.code === "NETWORK_EGRESS_DENIED",
  );
  const decision = await policy.enforceEgressPolicy("https://public.example.com/");
  assert.equal(decision.mode, "deny-by-default");
  assert.match(decision.policySha256, /^[a-f0-9]{64}$/u);
});
