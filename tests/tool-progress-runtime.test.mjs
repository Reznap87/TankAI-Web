import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const project = new URL("../", import.meta.url);

async function importTypeScript(path) {
  const source = await readFile(new URL(path, project), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("SSE frames are bounded, resumable and contain one JSON payload", async () => {
  const { serverEvent, serverComment } = await importTypeScript(
    "lib/server-sent-events.ts",
  );
  const decoder = new TextDecoder();
  const frame = decoder.decode(
    serverEvent({
      event: "progress\nforged",
      id: "4|123e4567-e89b-12d3-a456-426614174000\nforged",
      retry: 500_000,
      data: {
        executionStatusOnly: true,
        factsVerified: false,
        note: "Zeile\u2028getrennt",
      },
    }),
  );

  assert.match(frame, /^id: 4\|123e4567-e89b-12d3-a456-426614174000forged/m);
  assert.match(frame, /^retry: 30000$/m);
  assert.match(frame, /^event: progressforged$/m);
  assert.match(frame, /^data: \{"executionStatusOnly":true,"factsVerified":false/m);
  assert.doesNotMatch(frame, /\u2028/u);
  assert.equal(frame.endsWith("\n\n"), true);
  assert.equal(decoder.decode(serverComment("alive\nforged")), ": aliveforged\n\n");
});

test("tool progress cursors reject malformed or non-monotone values", async () => {
  const { encodeToolEventCursor, parseToolEventCursor } = await importTypeScript(
    "lib/tool-progress-cursor.ts",
  );
  const id = "123e4567-e89b-12d3-a456-426614174000";
  const cursor = encodeToolEventCursor({ jobVersion: 7, id });

  assert.equal(cursor, `7|${id}`);
  assert.deepEqual(parseToolEventCursor(cursor), { jobVersion: 7, id });
  assert.equal(parseToolEventCursor(`0|${id}`), null);
  assert.equal(parseToolEventCursor(`7|${id}|extra`), null);
  assert.equal(parseToolEventCursor("7|not-a-uuid"), null);
  assert.equal(parseToolEventCursor(""), null);
});
