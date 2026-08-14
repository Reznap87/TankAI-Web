import assert from "node:assert/strict";
import test from "node:test";
import { verifyPublicDeployment } from "../scripts/verify-public-deployment.mjs";

function response(body, init = {}) {
  return new Response(body, init);
}

test("public deployment verifier proves DNS, landing page, readiness endpoint and protected workspace", async () => {
  const requested = [];
  const receipt = await verifyPublicDeployment("https://tankai.example/", {
    lookup: async () => [{ address: "203.0.113.10", family: 4 }],
    fetch: async (url, options) => {
      requested.push({ url, redirect: options.redirect });
      if (url.endsWith("/api/public-readiness")) {
        return response(
          JSON.stringify({
            contractVersion: "1.0.0",
            releaseVersion: "0.43.0",
            runtimeOnline: true,
            applicationReady: true,
            modelExecutionReady: false,
            blockers: ["provider_secret_missing"],
            publicAudience: { controlledExternally: true },
            executionVerified: true,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }
      if (url.endsWith("/app")) {
        return response(null, {
          status: 307,
          headers: { location: "/signin-with-chatgpt?return_to=%2Fapp" },
        });
      }
      return response("<!doctype html><title>TankAI</title><h1>TANKAI</h1>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    },
  });

  assert.equal(receipt.passed, true);
  assert.equal(receipt.target, "https://tankai.example");
  assert.equal(receipt.checks.length, 4);
  assert.deepEqual(
    requested.map(({ url }) => url),
    [
      "https://tankai.example/",
      "https://tankai.example/api/public-readiness",
      "https://tankai.example/app",
    ],
  );
});

test("public deployment verifier rejects non-HTTPS targets before network access", async () => {
  await assert.rejects(
    () => verifyPublicDeployment("http://tankai.example"),
    /muss HTTPS verwenden/,
  );
});

test("public deployment verifier rejects placeholder landing content", async () => {
  const receipt = await verifyPublicDeployment("https://tankai.example", {
    lookup: async () => [{ address: "203.0.113.10", family: 4 }],
    fetch: async (url) => {
      if (url.endsWith("/api/public-readiness")) {
        return response(
          JSON.stringify({
            runtimeOnline: true,
            publicAudience: { controlledExternally: true },
            executionVerified: true,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.endsWith("/app")) {
        return response(null, {
          status: 307,
          headers: { location: "/signin-with-chatgpt" },
        });
      }
      return response("<h1>TankAI – Platzhalter, demnächst verfügbar</h1>", { status: 200 });
    },
  });

  assert.equal(receipt.passed, false);
  assert.equal(
    receipt.checks.find(({ name }) => name === "landing_page")?.passed,
    false,
  );
});

test("public deployment verifier returns a durable DNS blocker receipt", async () => {
  const receipt = await verifyPublicDeployment("https://missing.example", {
    lookup: async () => {
      throw new Error("getaddrinfo ENOTFOUND missing.example");
    },
    fetch: async () => {
      throw new Error("fetch must not run after DNS failure");
    },
  });

  assert.equal(receipt.passed, false);
  assert.equal(receipt.blockedBy, "public_dns");
  assert.equal(receipt.checks.length, 1);
  assert.equal(receipt.checks[0].name, "public_dns");
  assert.match(receipt.checks[0].evidence.error, /ENOTFOUND/);
});
