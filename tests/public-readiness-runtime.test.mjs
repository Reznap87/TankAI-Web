import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluatePublicReadiness,
  PUBLIC_READINESS_CONTRACT,
  TANKAI_WEB_RELEASE,
} from "../lib/public-readiness.ts";

test("public readiness reports every missing runtime gate without inventing public reachability", () => {
  const snapshot = evaluatePublicReadiness({});

  assert.equal(snapshot.contractVersion, PUBLIC_READINESS_CONTRACT);
  assert.equal(snapshot.releaseVersion, TANKAI_WEB_RELEASE);
  assert.equal(snapshot.runtimeOnline, true);
  assert.equal(snapshot.applicationReady, false);
  assert.equal(snapshot.modelExecutionReady, false);
  assert.equal(snapshot.publicAudience.publiclyReachable, null);
  assert.deepEqual(snapshot.blockers, [
    "database_binding_missing",
    "identity_salt_missing",
    "provider_secret_missing",
  ]);
  assert.equal(snapshot.executionVerified, true);
  assert.equal(snapshot.factsVerified, false);
});

test("public readiness recognizes configured database, identity and provider without exposing secrets", () => {
  const secret = "do-not-expose-this-secret";
  const snapshot = evaluatePublicReadiness({
    DB: { prepare() {} },
    TANKAI_ID_SALT: "tenant-salt",
    OPENAI_API_KEY: secret,
    TANKAI_EGRESS_ALLOWED_HOSTS: "example.com",
  });

  assert.equal(snapshot.applicationReady, true);
  assert.equal(snapshot.modelExecutionReady, true);
  assert.equal(snapshot.services.databaseBinding, true);
  assert.equal(snapshot.services.identitySalt, true);
  assert.equal(snapshot.services.modelProvider, true);
  assert.equal(snapshot.services.egressAllowlist, true);
  assert.deepEqual(snapshot.blockers, []);
  assert.equal(JSON.stringify(snapshot).includes(secret), false);
});

test("blank provider values remain blocked", () => {
  const snapshot = evaluatePublicReadiness({
    DB: { prepare() {} },
    TANKAI_ID_SALT: "tenant-salt",
    OPENAI_API_KEY: "   ",
  });

  assert.equal(snapshot.applicationReady, true);
  assert.equal(snapshot.modelExecutionReady, false);
  assert.deepEqual(snapshot.blockers, ["provider_secret_missing"]);
});
