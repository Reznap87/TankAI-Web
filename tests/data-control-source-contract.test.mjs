import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("data control API is authenticated, same-origin, bounded and rejects unknown fields", async () => {
  const api = await source("app/api/data-control/route.ts");
  assert.match(api, /requireApiIdentity/);
  assert.match(api, /allowFrozenAccount: true/);
  assert.match(api, /sameOrigin\(request\)/);
  assert.match(api, /MAXIMUM_REQUEST_BYTES = 4_096/);
  assert.match(api, /new TextEncoder\(\)\.encode\(raw\)\.byteLength/);
  assert.match(api, /onlyKeys\(body/);
  assert.match(api, /cache-control": "no-store/);
  assert.match(api, /x-content-type-options": "nosniff/);
});

test("active deletion freezes every ordinary authenticated API path centrally", async () => {
  const auth = await source("lib/auth.ts");
  const errors = await source("lib/api-response.ts");
  assert.match(auth, /class AccountDataFrozenError/);
  assert.match(auth, /request_type='deletion'/);
  assert.match(auth, /status IN \('requested','scheduled','executing'\)/);
  assert.match(auth, /if \(!options\.allowFrozenAccount\)/);
  assert.match(errors, /error instanceof AccountDataFrozenError/);
});

test("data control UI separates application deletion proof from external systems", async () => {
  const ui = await source("app/data/data-control-client.tsx");
  assert.match(ui, /Vollständiger Nutzerexport/);
  assert.match(ui, /2 SCHRITTE \+ 24 H/);
  assert.match(ui, /Ehrliche Beweisgrenze/);
  assert.match(ui, /Nicht vom D1-Löschbeleg abgedeckt/);
  assert.match(ui, /KEINE NUTZERKENNUNG GESPEICHERT/);
});
