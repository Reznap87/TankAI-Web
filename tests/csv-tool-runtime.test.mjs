import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import ts from "../node_modules/typescript/lib/typescript.js";

const root = path.resolve(import.meta.dirname, "..");

function transpile(file) {
  return ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
}

function loadModule(file, dependencies = {}) {
  const module = { exports: {} };
  new Function("require", "module", "exports", transpile(file))(
    (specifier) => {
      if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
      throw new Error(`Unexpected import in ${file}: ${specifier}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}

class D1Prepared {
  constructor(db, sql, args = []) {
    this.db = db;
    this.sql = sql;
    this.args = args;
  }
  bind(...args) {
    return new D1Prepared(this.db, this.sql, args);
  }
  async first() {
    return this.db.prepare(this.sql).get(...this.args) ?? null;
  }
}

function runtime() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE project_documents (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      content TEXT NOT NULL,
      content_sha256 TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      version INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  const documentId = "11111111-1111-4111-8111-111111111111";
  const projectId = "22222222-2222-4222-8222-222222222222";
  const content = [
    "name;betrag;anzahl;aktiv",
    "Tank;12,5;1;true",
    "Zwei;;2;false",
    "Drei;-3;3;true",
  ].join("\n");
  sqlite.prepare(
    `INSERT INTO project_documents
     (id,project_id,user_id,name,kind,content,content_sha256,size_bytes,version,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,1,?,?)`,
  ).run(
    documentId,
    projectId,
    "owner",
    "werte.csv",
    "csv",
    content,
    crypto.createHash("sha256").update(content).digest("hex"),
    Buffer.byteLength(content),
    "2026-07-28T00:00:00.000Z",
    "2026-07-28T00:00:00.000Z",
  );

  const errors = loadModule("lib/tool-errors.ts");
  const csv = loadModule("lib/csv-document.ts");
  const document = loadModule("lib/tool-document.ts", {
    "@/lib/request-context": {
      currentRuntimeBindings: () => ({
        DB: { prepare: (sql) => new D1Prepared(sqlite, sql) },
      }),
    },
    "@/lib/csv-document": csv,
    "@/lib/tool-errors": errors,
  });
  const tools = loadModule("lib/tool-runtime.ts", {
    "@/lib/memory-store": { maintainMemoryRetention: async () => undefined },
    "@/lib/tool-document": document,
    "@/lib/csv-document": csv,
    "@/lib/tool-errors": errors,
    "@/lib/tool-network": {
      NETWORK_TOOL_POLICY: { timeoutMs: 10_000, maximumRedirects: 3 },
      normalizePublicHttpsUrl: (value) => String(value),
      safeFetchPublicText: async () => ({}),
    },
    "@/lib/tool-patch": {
      inspectUnifiedDiff: () => ({}),
      normalizePatch: (value) => String(value),
    },
  });
  return { sqlite, tools, documentId, projectId };
}

test("CSV project tool profiles, filters and sorts with an execution receipt", async () => {
  const { sqlite, tools, documentId, projectId } = runtime();
  try {
    const result = await tools.executeTool({
      userId: "owner",
      projectId,
      toolName: "project.document.inspect",
      payload: {
        documentId,
        csvQuery: {
          columns: ["name", "betrag"],
          filters: [{ column: "betrag", operator: "greater-than", value: "0" }],
          sort: [{ column: "betrag", direction: "desc" }],
          aggregates: [
            { column: "betrag", operation: "sum" },
            { column: "betrag", operation: "average" },
          ],
          groupBy: ["name"],
          limit: 10,
        },
      },
    });
    assert.equal(result.receipt.toolName, "project.document.inspect");
    assert.equal(result.receipt.deterministic, true);
    assert.equal(result.receipt.externalNetwork, false);
    assert.equal(result.receipt.outputBytes <= result.receipt.maximumOutputBytes, true);
    assert.equal(result.result.document.contentSha256.length, 64);
    assert.equal(result.result.csv.table.matchedRows, 1);
    assert.equal(result.result.csv.table.rows[0].values.name, "Tank");
    assert.equal(result.result.csv.table.profiles[1].inferredType, "number");
    assert.equal(result.result.csv.table.aggregates[0].value, 12.5);
    assert.equal(result.result.csv.table.aggregates[1].value, 12.5);
    assert.equal(result.result.csv.table.groups.length, 1);
    assert.equal(result.result.csv.table.groups[0].keys.name, "Tank");
    assert.equal(result.result.csv.table.groups[0].aggregates[0].value, 12.5);
    assert.equal(result.result.csv.table.executableContentRun, false);
    assert.equal(result.result.csv.table.factsVerified, false);
    const frequencies = await tools.executeTool({
      userId: "owner",
      projectId,
      toolName: "project.document.inspect",
      payload: { documentId, csvQuery: { frequencies: ["name", "betrag"] } },
    });
    assert.deepEqual(
      frequencies.result.csv.table.frequencies[0].buckets.find((bucket) => bucket.value === "Tank"),
      { value: "Tank", count: 1 },
    );
    assert.deepEqual(
      frequencies.result.csv.table.frequencies[1].buckets.find((bucket) => bucket.value === 12.5),
      { value: 12.5, count: 1 },
    );
    const histogram = await tools.executeTool({
      userId: "owner",
      projectId,
      toolName: "project.document.inspect",
      payload: { documentId, csvQuery: { histograms: [{ column: "betrag", buckets: 4 }] } },
    });
    assert.equal(histogram.result.csv.table.histograms[0].column, "betrag");
    assert.equal(histogram.result.csv.table.histograms[0].numericRows, 2);
    assert.equal(histogram.result.csv.table.histograms[0].buckets.reduce((sum, item) => sum + item.count, 0), 2);
    const quantiles = await tools.executeTool({
      userId: "owner",
      projectId,
      toolName: "project.document.inspect",
      payload: { documentId, csvQuery: {
        quantiles: [{ column: "betrag", probabilities: [0, 0.5, 1] }],
      } },
    });
    assert.equal(quantiles.result.csv.table.quantiles[0].method, "r7-linear");
    assert.deepEqual(
      quantiles.result.csv.table.quantiles[0].values.map(({ probability, value }) => ({ probability, value })),
      [{ probability: 0, value: -3 }, { probability: 0.5, value: 4.75 }, { probability: 1, value: 12.5 }],
    );
    const outliers = await tools.executeTool({
      userId: "owner",
      projectId,
      toolName: "project.document.inspect",
      payload: { documentId, csvQuery: { outliers: [{ column: "betrag" }] } },
    });
    assert.equal(outliers.result.csv.table.outliers[0].method, "tukey-iqr-r7");
    assert.equal(outliers.result.csv.table.outliers[0].fenceMultiplier, 1.5);
    assert.equal(outliers.result.csv.table.outliers[0].numericRows, 2);
    assert.equal(outliers.result.csv.table.outliers[0].totalOutliers, 0);
    const dispersion = await tools.executeTool({
      userId: "owner",
      projectId,
      toolName: "project.document.inspect",
      payload: { documentId, csvQuery: {
        dispersion: [{ column: "betrag", mode: "sample" }],
      } },
    });
    assert.equal(dispersion.result.csv.table.dispersion[0].method, "welford-one-pass");
    assert.equal(dispersion.result.csv.table.dispersion[0].mode, "sample");
    assert.equal(dispersion.result.csv.table.dispersion[0].denominator, 1);
    assert.equal(dispersion.result.csv.table.dispersion[0].variance, 120.125);
    const relationship = await tools.executeTool({
      userId: "owner",
      projectId,
      toolName: "project.document.inspect",
      payload: { documentId, csvQuery: {
        relationships: [{ xColumn: "betrag", yColumn: "anzahl", mode: "sample" }],
      } },
    });
    assert.equal(relationship.result.csv.table.relationships[0].method, "welford-bivariate-one-pass");
    assert.equal(relationship.result.csv.table.relationships[0].pairedRows, 2);
    assert.equal(relationship.result.csv.table.relationships[0].excludedNullRows, 1);
    assert.equal(relationship.result.csv.table.relationships[0].covariance, -15.5);
    assert.equal(relationship.result.csv.table.relationships[0].correlation, -1);
    const regression = await tools.executeTool({
      userId: "owner",
      projectId,
      toolName: "project.document.inspect",
      payload: { documentId, csvQuery: {
        regressions: [{ xColumn: "anzahl", yColumn: "betrag", predictionXValues: [1.5] }],
      } },
    });
    assert.equal(regression.result.csv.table.regressions[0].method, "ordinary-least-squares-welford");
    assert.equal(regression.result.csv.table.regressions[0].pairedRows, 2);
    assert.equal(regression.result.csv.table.regressions[0].slope, -7.75);
    assert.equal(regression.result.csv.table.regressions[0].intercept, 20.25);
    assert.equal(regression.result.csv.table.regressions[0].residualErrorDefined, false);
    assert.equal(regression.result.csv.table.regressions[0].predictions[0].predicted, 8.625);
    assert.equal(regression.result.csv.table.regressions[0].predictions[0].uncertaintyDefined, false);
  } finally {
    sqlite.close();
  }
});

test("CSV project tool rejects foreign ownership and over-broad queries", async () => {
  const { sqlite, tools, documentId, projectId } = runtime();
  try {
    await assert.rejects(
      () =>
        tools.executeTool({
          userId: "other",
          projectId,
          toolName: "project.document.inspect",
          payload: { documentId },
        }),
      /nicht gefunden/u,
    );
    await assert.rejects(
      () =>
        tools.executeTool({
          userId: "owner",
          projectId,
          toolName: "project.document.inspect",
          payload: {
            documentId,
            csvQuery: {
              filters: Array.from({ length: 6 }, () => ({
                column: "name",
                operator: "equals",
                value: "Tank",
              })),
            },
          },
        }),
      /höchstens 5 Filter/u,
    );
    await assert.rejects(
      () =>
        tools.executeTool({
          userId: "owner",
          projectId,
          toolName: "project.document.inspect",
          payload: {
            documentId,
            csvQuery: {
              aggregates: Array.from({ length: 9 }, () => ({
                column: "betrag",
                operation: "sum",
              })),
            },
          },
        }),
      /höchstens 8 Aggregationen/u,
    );
    await assert.rejects(
      () =>
        tools.executeTool({
          userId: "owner",
          projectId,
          toolName: "project.document.inspect",
          payload: {
            documentId,
            csvQuery: {
              aggregates: [
                { column: "betrag", operation: "sum" },
                { column: "BETRAG", operation: "sum" },
              ],
            },
          },
        }),
      /nicht doppelt/u,
    );
    await assert.rejects(
      () =>
        tools.executeTool({
          userId: "owner",
          projectId,
          toolName: "project.document.inspect",
          payload: {
            documentId,
            csvQuery: { groupBy: ["name", "NAME"], aggregates: [{ column: "betrag", operation: "sum" }] },
          },
        }),
      /Gruppenspalten dürfen nicht doppelt/u,
    );
    await assert.rejects(
      () =>
        tools.executeTool({
          userId: "owner",
          projectId,
          toolName: "project.document.inspect",
          payload: { documentId, csvQuery: { groupBy: ["name"] } },
        }),
      /mindestens eine Aggregation/u,
    );
    await assert.rejects(
      () =>
        tools.executeTool({
          userId: "owner",
          projectId,
          toolName: "project.document.inspect",
          payload: { documentId, csvQuery: { frequencies: ["name", "NAME"] } },
        }),
      /Häufigkeitsspalten dürfen nicht doppelt/u,
    );
    await assert.rejects(
      () =>
        tools.executeTool({
          userId: "owner",
          projectId,
          toolName: "project.document.inspect",
          payload: { documentId, csvQuery: { frequencies: ["name", "betrag", "name", "betrag"] } },
        }),
      /höchstens 3 Häufigkeitsspalten/u,
    );
    await assert.rejects(
      () =>
        tools.executeTool({
          userId: "owner",
          projectId,
          toolName: "project.document.inspect",
          payload: {
            documentId,
            csvQuery: {
              aggregates: [{ column: "betrag", operation: "sum" }],
              groupBy: ["name"],
              frequencies: ["name"],
            },
          },
        }),
      /müssen getrennt abgefragt/u,
    );
    await assert.rejects(
      () => tools.executeTool({
        userId: "owner", projectId, toolName: "project.document.inspect",
        payload: { documentId, csvQuery: {
          relationships: [{ xColumn: "betrag", yColumn: "anzahl", mode: "sample" }],
          regressions: [{ xColumn: "betrag", yColumn: "anzahl" }],
        } },
      }),
      /müssen getrennt abgefragt/u,
    );
    await assert.rejects(
      () => tools.executeTool({
        userId: "owner", projectId, toolName: "project.document.inspect",
        payload: { documentId, csvQuery: {
          dispersion: [{ column: "betrag", mode: "invalid" }],
        } },
      }),
      /population oder sample/u,
    );
    await assert.rejects(
      () => tools.executeTool({
        userId: "owner", projectId, toolName: "project.document.inspect",
        payload: { documentId, csvQuery: {
          relationships: [{ xColumn: "betrag", yColumn: "anzahl", mode: "invalid" }],
        } },
      }),
      /population oder sample/u,
    );
    await assert.rejects(
      () => tools.executeTool({
        userId: "owner", projectId, toolName: "project.document.inspect",
        payload: { documentId, csvQuery: {
          dispersion: [{ column: "betrag", mode: "population" }],
          relationships: [{ xColumn: "betrag", yColumn: "anzahl", mode: "population" }],
        } },
      }),
      /müssen getrennt abgefragt/u,
    );
    await assert.rejects(
      () => tools.executeTool({
        userId: "owner", projectId, toolName: "project.document.inspect",
        payload: { documentId, csvQuery: {
          outliers: [{ column: "betrag" }],
          dispersion: [{ column: "betrag", mode: "population" }],
        } },
      }),
      /müssen getrennt abgefragt/u,
    );
    await assert.rejects(
      () => tools.executeTool({
        userId: "owner", projectId, toolName: "project.document.inspect",
        payload: { documentId, csvQuery: {
          outliers: [{ column: "betrag" }, { column: "betrag" }],
        } },
      }),
      /nicht doppelt/u,
    );
    await assert.rejects(
      () => tools.executeTool({
        userId: "owner", projectId, toolName: "project.document.inspect",
        payload: { documentId, csvQuery: {
          quantiles: [{ column: "betrag", probabilities: [0.5] }],
          outliers: [{ column: "betrag" }],
        } },
      }),
      /müssen getrennt abgefragt/u,
    );
    await assert.rejects(
      () => tools.executeTool({
        userId: "owner", projectId, toolName: "project.document.inspect",
        payload: { documentId, csvQuery: { histograms: [{ column: "betrag", buckets: 13 }] } },
      }),
      /zwischen 2 und 12/u,
    );
    await assert.rejects(
      () => tools.executeTool({
        userId: "owner", projectId, toolName: "project.document.inspect",
        payload: { documentId, csvQuery: {
          frequencies: ["betrag"], histograms: [{ column: "betrag", buckets: 4 }],
        } },
      }),
      /müssen getrennt abgefragt/u,
    );
    await assert.rejects(
      () => tools.executeTool({
        userId: "owner", projectId, toolName: "project.document.inspect",
        payload: { documentId, csvQuery: {
          quantiles: [{ column: "betrag", probabilities: [0.5, 0.5] }],
        } },
      }),
      /nicht doppelt/u,
    );
    await assert.rejects(
      () => tools.executeTool({
        userId: "owner", projectId, toolName: "project.document.inspect",
        payload: { documentId, csvQuery: {
          histograms: [{ column: "betrag", buckets: 4 }],
          quantiles: [{ column: "betrag", probabilities: [0.5] }],
        } },
      }),
      /müssen getrennt abgefragt/u,
    );
    await assert.rejects(
      () =>
        tools.executeTool({
          userId: "owner",
          projectId,
          toolName: "project.document.inspect",
          payload: { documentId, unexpected: true },
        }),
      /unbekannte Felder/u,
    );
  } finally {
    sqlite.close();
  }
});
