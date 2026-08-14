import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public landing does not claim unverified system publication", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.equal(source.includes("SYSTEM ONLINE"), false);
  assert.equal(source.includes("CORE ONLINE"), false);
  assert.match(source, /WEB RUNTIME ONLINE/);
  assert.match(source, /ÖFFENTLICHE ERREICHBARKEIT NICHT RUNTIME-VERIFIZIERBAR/);
  assert.match(source, /\/api\/public-readiness/);
  assert.match(source, /WEB RUNTIME · V0\.43/);
  assert.equal(source.includes("WEB RUNTIME · V0.37"), false);
  assert.equal(source.includes("WEB RUNTIME · V0.27"), false);
});

test("protected app reports authenticated session instead of an unverified core claim", async () => {
  const pageSource = await readFile(
    new URL("../app/app/page.tsx", import.meta.url),
    "utf8",
  );
  const clientSource = await readFile(
    new URL("../app/app/chat-client.tsx", import.meta.url),
    "utf8",
  );
  const source = `${pageSource}\n${clientSource}`;

  assert.equal(source.includes("CORE ONLINE"), false);
  assert.match(source, /SESSION ACTIVE/);
  assert.match(source, /MODELLZUGANG FEHLT/);
});
test("status API derives readiness instead of hardcoding an online core", async () => {
  const source = await readFile(
    new URL("../app/api/status/route.ts", import.meta.url),
    "utf8",
  );

  assert.equal(source.includes('core: "online"'), false);
  assert.match(source, /evaluatePublicReadiness/);
  assert.match(source, /TANKAI_WEB_RELEASE/);
});
