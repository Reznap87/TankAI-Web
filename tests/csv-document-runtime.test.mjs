import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "../node_modules/typescript/lib/typescript.js";

const root = path.resolve(import.meta.dirname, "..");

function loadCsvRuntime() {
  const source = fs.readFileSync(path.join(root, "lib/csv-document.ts"), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", output)(module, module.exports);
  return module.exports;
}

test("CSV inspection parses comma, quoted and multiline data without executing content", () => {
  const runtime = loadCsvRuntime();
  const result = runtime.validateCsvDocument(
    'name,notiz,wert\r\nTank,"Text, mit Komma",42\r\nZwei,"mehrere\nZeilen",-12.5',
  );
  assert.deepEqual(result.header, ["name", "notiz", "wert"]);
  assert.equal(result.delimiter, ",");
  assert.equal(result.columns, 3);
  assert.equal(result.dataRows, 2);
  assert.equal(result.quotedCells, 2);
  assert.equal(result.multilineCells, 1);
  assert.equal(result.executableContentRun, false);
  assert.deepEqual(result.formulaInjectionSignals, []);
});

test("CSV inspection accepts German semicolon data and signed numeric literals", () => {
  const runtime = loadCsvRuntime();
  const result = runtime.validateCsvDocument(
    "titel;betrag;quote\nA;-42,5;+7\nB;12;0,25",
  );
  assert.equal(result.delimiter, ";");
  assert.equal(result.columns, 3);
  assert.equal(result.dataRows, 2);
  assert.deepEqual(result.formulaInjectionSignals, []);
});

test("CSV validation blocks spreadsheet formula injection including hidden whitespace", () => {
  const runtime = loadCsvRuntime();
  for (const payload of [
    "name,wert\nA,=1+1",
    "name,wert\nA,@SUM(A1:A2)",
    "name,wert\nA,\t+cmd|' /C calc'!A0",
    "name,wert\nA,-HYPERLINK(A1)",
  ]) {
    assert.throws(
      () => runtime.validateCsvDocument(payload),
      /CSV-Formel-Injection ist nicht erlaubt/u,
    );
  }
});

test("CSV validation rejects malformed shape, duplicate headers and control characters", () => {
  const runtime = loadCsvRuntime();
  assert.throws(
    () => runtime.validateCsvDocument("a,b\n1\n"),
    /enthält 1 statt 2 Spalten/u,
  );
  assert.throws(
    () => runtime.validateCsvDocument("Name,name\nA,B"),
    /Spaltennamen müssen eindeutig/u,
  );
  assert.throws(
    () => runtime.validateCsvDocument("a,b\nA,\u0000B"),
    /Steuerzeichen/u,
  );
  assert.throws(
    () => runtime.validateCsvDocument("a,b"),
    /Kopfzeile und mindestens eine Datenzeile/u,
  );
  assert.throws(
    () => runtime.validateCsvDocument('a,b\n"x,y'),
    /nicht geschlossenes Anführungszeichen/u,
  );
});

test("CSV policy enforces row, column and cell limits deterministically", () => {
  const runtime = loadCsvRuntime();
  const tooManyColumns = `${Array.from({ length: 51 }, (_, index) => `c${index}`).join(",")}\n${Array.from({ length: 51 }, () => "1").join(",")}`;
  assert.throws(
    () => runtime.validateCsvDocument(tooManyColumns),
    /höchstens 50 Spalten/u,
  );
  assert.throws(
    () => runtime.validateCsvDocument(`a\n${"x".repeat(2_001)}`),
    /höchstens 2.000 Zeichen/u,
  );
  const tooManyRows = `a\n${Array.from({ length: 501 }, () => "1").join("\n")}`;
  assert.throws(
    () => runtime.validateCsvDocument(tooManyRows),
    /höchstens 500 Datenzeilen/u,
  );
});

test("CSV profiles classify null, boolean, numeric, ISO date and mixed columns", () => {
  const runtime = loadCsvRuntime();
  const result = runtime.queryCsvDocument(
    [
      "name;aktiv;anzahl;betrag;datum;gemischt",
      "Tank;true;2;12,5;2026-07-28;eins",
      "Zwei;false;3;-1,25;2026-07-29;9",
      "Leer;;4;;;",
    ].join("\n"),
    { columns: [], filters: [], sort: [], offset: 0, limit: 10 },
  );
  const profiles = Object.fromEntries(
    result.profiles.map((profile) => [profile.column, profile]),
  );
  assert.equal(profiles.aktiv.nullCount, 1);
  assert.equal(profiles.aktiv.inferredType, "boolean");
  assert.equal(profiles.anzahl.inferredType, "integer");
  assert.equal(profiles.betrag.inferredType, "number");
  assert.equal(profiles.datum.inferredType, "iso-date");
  assert.equal(profiles.gemischt.inferredType, "mixed");
  assert.equal(result.policy.emptyCellsAreNull, true);
  assert.equal(result.executableContentRun, false);
  assert.equal(result.factsVerified, false);
});

test("CSV query filters numerically, sorts stably and keeps null values last", () => {
  const runtime = loadCsvRuntime();
  const content = [
    "name;betrag;gruppe",
    "A;12,5;rot",
    "B;;rot",
    "C;-2;blau",
    "D;12,5;ROT",
    "E;4;rot",
  ].join("\n");
  const result = runtime.queryCsvDocument(content, {
    columns: ["name", "betrag"],
    filters: [
      { column: "gruppe", operator: "equals", value: " rot " },
      { column: "betrag", operator: "greater-than", value: "0" },
    ],
    sort: [{ column: "betrag", direction: "desc" }],
    offset: 0,
    limit: 10,
  });
  assert.equal(result.sourceRows, 5);
  assert.equal(result.matchedRows, 3);
  assert.deepEqual(
    result.rows.map((row) => row.values.name),
    ["A", "D", "E"],
  );
  assert.deepEqual(
    result.rows.map((row) => row.sourceRow),
    [2, 5, 6],
  );

  const nullsLast = runtime.queryCsvDocument(content, {
    columns: ["name", "betrag"],
    filters: [],
    sort: [{ column: "betrag", direction: "desc" }],
    offset: 0,
    limit: 10,
  });
  assert.equal(nullsLast.rows.at(-1).values.name, "B");
});

test("CSV query bounds output cells and refuses formulas or unknown columns", () => {
  const runtime = loadCsvRuntime();
  const longValue = "x".repeat(400);
  const bounded = runtime.queryCsvDocument(
    `name,notiz\nTank,${longValue}`,
    {
      columns: ["name", "notiz"],
      filters: [],
      sort: [],
      offset: 0,
      limit: 10,
    },
  );
  assert.equal(bounded.rows[0].values.notiz.length, 160);
  assert.equal(bounded.truncatedCellCount, 1);
  assert.throws(
    () =>
      runtime.queryCsvDocument("name,wert\nTank,=1+1", {
        columns: [],
        filters: [],
        sort: [],
        offset: 0,
        limit: 10,
      }),
    /Formel-Injection/u,
  );
  assert.throws(
    () =>
      runtime.queryCsvDocument("name,wert\nTank,1", {
        columns: ["fehlt"],
        filters: [],
        sort: [],
        offset: 0,
        limit: 10,
      }),
    /wurde nicht gefunden/u,
  );
});

test("CSV query output remains below the tool budget at document policy limits", () => {
  const runtime = loadCsvRuntime();
  const header = Array.from(
    { length: 50 },
    (_, index) => `spalte-${String(index).padStart(2, "0")}-${"h".repeat(80)}`,
  );
  const row = Array.from({ length: 50 }, () => "x".repeat(160));
  const result = runtime.queryCsvDocument(
    `${header.join(";")}\n${row.join(";")}`,
    {
      columns: header.slice(0, 8),
      filters: [],
      sort: [],
      offset: 0,
      limit: 10,
    },
  );
  assert.equal(new TextEncoder().encode(JSON.stringify(result)).byteLength < 40_000, true);
});

test("CSV grouped aggregate output remains below the tool budget at policy limits", () => {
  const runtime = loadCsvRuntime();
  const headers = [
    `gruppe-a-${"a".repeat(80)}`,
    `gruppe-b-${"b".repeat(80)}`,
    ...Array.from({ length: 8 }, (_, index) => `wert-${index}-${"w".repeat(80)}`),
    ...Array.from({ length: 40 }, (_, index) => `extra-${index}-${"e".repeat(80)}`),
  ];
  const rows = Array.from({ length: 8 }, (_, rowIndex) => [
    `region-${rowIndex}`,
    `typ-${rowIndex}`,
    ...Array.from({ length: 8 }, (_, valueIndex) => String(rowIndex + valueIndex + 1)),
    ...Array.from({ length: 40 }, () => "x"),
  ].join(";"));
  const result = runtime.queryCsvDocument([headers.join(";"), ...rows].join("\n"), {
    columns: headers.slice(0, 8),
    filters: [],
    sort: [],
    aggregates: headers.slice(2, 10).map((column) => ({ column, operation: "sum" })),
    groupBy: headers.slice(0, 2),
    offset: 0,
    limit: 10,
  });
  assert.equal(result.groups.length, 8);
  assert.equal(new TextEncoder().encode(JSON.stringify(result)).byteLength < 40_000, true);
});

test("CSV frequencies are filtered, typed, deterministic and explicitly truncated", () => {
  const runtime = loadCsvRuntime();
  const content = [
    "status;anzahl;aktiv;datum;gemischt",
    "Offen;1;true;2026-08-01;A",
    "offen;1,0;TRUE;2026-08-01;2",
    "Geschlossen;2;false;2026-08-02;B",
    ";;false;2026-08-03;3",
    ...Array.from({ length: 9 }, (_, index) => `Wert-${index};${index + 3};true;2026-08-${String(index + 4).padStart(2, "0")};X`),
  ].join("\n");
  const result = runtime.queryCsvDocument(content, {
    columns: ["status"],
    filters: [{ column: "anzahl", operator: "greater-than", value: "0" }],
    sort: [],
    aggregates: [],
    groupBy: [],
    frequencies: ["status", "anzahl", "aktiv"],
    offset: 0,
    limit: 10,
  });
  const [status, anzahl, aktiv] = result.frequencies;
  assert.equal(status.sourceType, "text");
  assert.deepEqual(status.buckets[0], { value: "Offen", count: 2 });
  assert.equal(status.distinctValues, 11);
  assert.equal(status.returnedBuckets, 10);
  assert.equal(status.truncatedBuckets, 1);
  assert.equal(status.returnedRows + status.otherRows, status.matchedRows);
  assert.equal(anzahl.sourceType, "number");
  assert.deepEqual(anzahl.buckets[0], { value: 1, count: 2 });
  assert.equal(aktiv.sourceType, "boolean");
  assert.deepEqual(aktiv.buckets[0], { value: true, count: 11 });
  assert.equal(result.policy.maximumFrequencyColumns, 3);
  assert.equal(result.policy.maximumFrequencyBuckets, 10);
  assert.equal(result.executableContentRun, false);
  assert.equal(result.factsVerified, false);
});

test("CSV frequencies reject mixed columns, duplicate requests and oversized values", () => {
  const runtime = loadCsvRuntime();
  assert.throws(
    () => runtime.queryCsvDocument("wert\n1\nText", {
      columns: [], filters: [], sort: [], aggregates: [], groupBy: [],
      frequencies: ["wert"], offset: 0, limit: 10,
    }),
    /gemischte Typen/u,
  );
  assert.throws(
    () => runtime.queryCsvDocument("name\nA", {
      columns: [], filters: [], sort: [], aggregates: [], groupBy: [],
      frequencies: ["name", "NAME"], offset: 0, limit: 10,
    }),
    /Häufigkeitsspalten dürfen nicht doppelt/u,
  );
  assert.throws(
    () => runtime.queryCsvDocument(`name\n${"x".repeat(161)}`, {
      columns: [], filters: [], sort: [], aggregates: [], groupBy: [],
      frequencies: ["name"], offset: 0, limit: 10,
    }),
    /sichere Ausgabelänge/u,
  );
});

test("CSV frequency output remains below the tool budget at policy limits", () => {
  const runtime = loadCsvRuntime();
  const headers = [
    ...Array.from({ length: 3 }, (_, index) => `frequenz-${index}-${"f".repeat(80)}`),
    ...Array.from({ length: 47 }, (_, index) => `extra-${index}-${"e".repeat(80)}`),
  ];
  const rows = Array.from({ length: 30 }, (_, rowIndex) => [
    ...Array.from({ length: 3 }, (_, columnIndex) => `wert-${columnIndex}-${rowIndex}-${"x".repeat(120)}`),
    ...Array.from({ length: 47 }, () => "1"),
  ].join(";"));
  const result = runtime.queryCsvDocument([headers.join(";"), ...rows].join("\n"), {
    columns: headers.slice(0, 8), filters: [], sort: [], aggregates: [], groupBy: [],
    frequencies: headers.slice(0, 3), offset: 0, limit: 10,
  });
  assert.equal(result.frequencies.every((item) => item.returnedBuckets === 10), true);
  assert.equal(new TextEncoder().encode(JSON.stringify(result)).byteLength < 40_000, true);
});

test("CSV rejects combined grouped and frequency output before it can exceed the tool budget", () => {
  const runtime = loadCsvRuntime();
  const headers = [
    `gruppe-a-${"a".repeat(80)}`,
    `gruppe-b-${"b".repeat(80)}`,
    ...Array.from({ length: 8 }, (_, index) => `wert-${index}-${"w".repeat(80)}`),
    ...Array.from({ length: 3 }, (_, index) => `frequenz-${index}-${"f".repeat(80)}`),
    ...Array.from({ length: 37 }, (_, index) => `extra-${index}-${"e".repeat(80)}`),
  ];
  const rows = Array.from({ length: 80 }, (_, rowIndex) => [
    `region-${rowIndex % 8}`,
    `typ-${rowIndex % 8}`,
    ...Array.from({ length: 8 }, (_, valueIndex) => String(rowIndex + valueIndex + 1)),
    ...Array.from({ length: 3 }, (_, frequencyIndex) => `klasse-${frequencyIndex}-${rowIndex % 20}`),
    ...Array.from({ length: 37 }, () => "x"),
  ].join(";"));
  assert.throws(
    () => runtime.queryCsvDocument([headers.join(";"), ...rows].join("\n"), {
      columns: headers.slice(0, 8), filters: [], sort: [],
      aggregates: headers.slice(2, 10).map((column) => ({ column, operation: "sum" })),
      groupBy: headers.slice(0, 2), frequencies: headers.slice(10, 13), offset: 0, limit: 10,
    }),
    /müssen getrennt abgefragt/u,
  );
});

test("CSV histograms are filtered, numeric, interval-explicit and null-aware", () => {
  const runtime = loadCsvRuntime();
  const result = runtime.queryCsvDocument([
    "gruppe;wert", "A;0", "A;2", "A;4", "A;6", "A;8", "A;10", "A;", "B;100",
  ].join("\n"), {
    columns: ["gruppe"],
    filters: [{ column: "gruppe", operator: "equals", value: "A" }],
    sort: [], aggregates: [], groupBy: [], frequencies: [],
    histograms: [{ column: "wert", buckets: 5 }], offset: 0, limit: 10,
  });
  const histogram = result.histograms[0];
  assert.equal(histogram.sourceType, "integer");
  assert.equal(histogram.matchedRows, 7);
  assert.equal(histogram.numericRows, 6);
  assert.equal(histogram.nullRows, 1);
  assert.equal(histogram.requestedBuckets, 5);
  assert.equal(histogram.returnedBuckets, 5);
  assert.equal(histogram.minimum, 0);
  assert.equal(histogram.maximum, 10);
  assert.equal(histogram.intervalWidth, 2);
  assert.deepEqual(histogram.buckets.map(({ lowerBound, upperBound, upperInclusive, count }) => ({
    lowerBound, upperBound, upperInclusive, count,
  })), [
    { lowerBound: 0, upperBound: 2, upperInclusive: false, count: 1 },
    { lowerBound: 2, upperBound: 4, upperInclusive: false, count: 1 },
    { lowerBound: 4, upperBound: 6, upperInclusive: false, count: 1 },
    { lowerBound: 6, upperBound: 8, upperInclusive: false, count: 1 },
    { lowerBound: 8, upperBound: 10, upperInclusive: true, count: 2 },
  ]);
  assert.deepEqual(result.query.histograms, [{ column: "wert", buckets: 5 }]);
  assert.equal(result.policy.maximumHistogramColumns, 3);
  assert.equal(result.policy.minimumHistogramBuckets, 2);
  assert.equal(result.policy.maximumHistogramBuckets, 12);
  assert.equal(result.executableContentRun, false);
  assert.equal(result.factsVerified, false);
});

test("CSV histograms handle constant ranges without inventing intervals", () => {
  const runtime = loadCsvRuntime();
  const result = runtime.queryCsvDocument("wert\n5\n5\n5", {
    columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [],
    histograms: [{ column: "wert", buckets: 4 }], offset: 0, limit: 10,
  });
  assert.equal(result.histograms[0].degenerate, true);
  assert.equal(result.histograms[0].requestedBuckets, 4);
  assert.equal(result.histograms[0].returnedBuckets, 1);
  assert.deepEqual(result.histograms[0].buckets[0], {
    index: 0, lowerBound: 5, upperBound: 5,
    lowerInclusive: true, upperInclusive: true, count: 3,
  });
});

test("CSV histograms reject unsafe types, shapes and combined distribution output", () => {
  const runtime = loadCsvRuntime();
  assert.throws(() => runtime.queryCsvDocument("wert\nA\nB", {
    columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [],
    histograms: [{ column: "wert", buckets: 4 }], offset: 0, limit: 10,
  }), /nicht global numerisch/u);
  assert.throws(() => runtime.queryCsvDocument("wert\n1\n2", {
    columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [],
    histograms: [{ column: "wert", buckets: 13 }], offset: 0, limit: 10,
  }), /zwischen 2 und 12/u);
  assert.throws(() => runtime.queryCsvDocument("wert\n1\n2", {
    columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: ["wert"],
    histograms: [{ column: "wert", buckets: 4 }], offset: 0, limit: 10,
  }), /müssen getrennt abgefragt/u);
  assert.throws(() => runtime.queryCsvDocument("wert\n1\n2", {
    columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [],
    histograms: [{ column: "wert", buckets: 4 }, { column: "WERT", buckets: 5 }], offset: 0, limit: 10,
  }), /Histogrammspalten dürfen nicht doppelt/u);
  assert.throws(() => runtime.queryCsvDocument("wert\n-1e308\n1e308", {
    columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [],
    histograms: [{ column: "wert", buckets: 4 }], offset: 0, limit: 10,
  }), /nicht endlich/u);
  assert.throws(() => runtime.queryCsvDocument("gruppe;wert\nA;1\nA;2", {
    columns: [], filters: [{ column: "gruppe", operator: "equals", value: "B" }],
    sort: [], aggregates: [], groupBy: [], frequencies: [],
    histograms: [{ column: "wert", buckets: 4 }], offset: 0, limit: 10,
  }), /nach den Filtern keine numerischen/u);
});

test("CSV histogram output remains below the tool budget at policy limits", () => {
  const runtime = loadCsvRuntime();
  const headers = [
    ...Array.from({ length: 3 }, (_, index) => `histogramm-${index}-${"h".repeat(80)}`),
    ...Array.from({ length: 47 }, (_, index) => `extra-${index}-${"e".repeat(80)}`),
  ];
  const rows = Array.from({ length: 500 }, (_, rowIndex) => [
    rowIndex, rowIndex * 2, rowIndex * 3, ...Array.from({ length: 47 }, () => "1"),
  ].join(";"));
  const result = runtime.queryCsvDocument([headers.join(";"), ...rows].join("\n"), {
    columns: headers.slice(0, 8), filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [],
    histograms: headers.slice(0, 3).map((column) => ({ column, buckets: 12 })), offset: 0, limit: 10,
  });
  assert.equal(result.histograms.every((item) => item.returnedBuckets === 12), true);
  assert.equal(new TextEncoder().encode(JSON.stringify(result)).byteLength < 40_000, true);
});

test("CSV quantiles are filtered, null-aware and use explicit R7 linear interpolation", () => {
  const runtime = loadCsvRuntime();
  const result = runtime.queryCsvDocument([
    "gruppe;wert", "A;0", "A;10", "A;20", "A;30", "A;40", "A;", "B;100",
  ].join("\n"), {
    columns: ["gruppe"], filters: [{ column: "gruppe", operator: "equals", value: "A" }],
    sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [],
    quantiles: [{ column: "wert", probabilities: [1, 0.9, 0.5, 0.25, 0] }], offset: 0, limit: 10,
  });
  const quantiles = result.quantiles[0];
  assert.equal(quantiles.sourceType, "integer");
  assert.equal(quantiles.matchedRows, 6);
  assert.equal(quantiles.numericRows, 5);
  assert.equal(quantiles.nullRows, 1);
  assert.equal(quantiles.method, "r7-linear");
  assert.deepEqual(quantiles.values.map(({ probability, rank, lowerIndex, upperIndex, interpolationWeight, value }) => ({
    probability, rank, lowerIndex, upperIndex, interpolationWeight, value,
  })), [
    { probability: 0, rank: 0, lowerIndex: 0, upperIndex: 0, interpolationWeight: 0, value: 0 },
    { probability: 0.25, rank: 1, lowerIndex: 1, upperIndex: 1, interpolationWeight: 0, value: 10 },
    { probability: 0.5, rank: 2, lowerIndex: 2, upperIndex: 2, interpolationWeight: 0, value: 20 },
    { probability: 0.9, rank: 3.6, lowerIndex: 3, upperIndex: 4, interpolationWeight: 0.6, value: 36 },
    { probability: 1, rank: 4, lowerIndex: 4, upperIndex: 4, interpolationWeight: 0, value: 40 },
  ]);
  assert.deepEqual(result.query.quantiles, [{ column: "wert", probabilities: [0, 0.25, 0.5, 0.9, 1] }]);
  assert.equal(result.policy.maximumQuantileColumns, 3);
  assert.equal(result.policy.maximumQuantileProbabilities, 9);
  assert.equal(result.policy.quantileMethod, "r7-linear");
  assert.equal(result.executableContentRun, false);
  assert.equal(result.factsVerified, false);
});

test("CSV quantiles interpolate even-sized and extreme finite ranges safely", () => {
  const runtime = loadCsvRuntime();
  const even = runtime.queryCsvDocument("wert\n0\n10\n20\n30", {
    columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [],
    quantiles: [{ column: "wert", probabilities: [0.5] }], offset: 0, limit: 10,
  });
  assert.equal(even.quantiles[0].values[0].value, 15);
  const extreme = runtime.queryCsvDocument("wert\n-1e308\n1e308", {
    columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [],
    quantiles: [{ column: "wert", probabilities: [0.5] }], offset: 0, limit: 10,
  });
  assert.equal(extreme.quantiles[0].values[0].value, 0);
});

test("CSV quantiles reject unsafe types, probability shapes and combined distribution output", () => {
  const runtime = loadCsvRuntime();
  assert.throws(() => runtime.queryCsvDocument("wert\nA\nB", {
    columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [],
    quantiles: [{ column: "wert", probabilities: [0.5] }], offset: 0, limit: 10,
  }), /nicht global numerisch/u);
  assert.throws(() => runtime.queryCsvDocument("wert\n1\n2", {
    columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [],
    quantiles: [{ column: "wert", probabilities: [-0.1] }], offset: 0, limit: 10,
  }), /zwischen 0 und 1/u);
  assert.throws(() => runtime.queryCsvDocument("wert\n1\n2", {
    columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [],
    quantiles: [{ column: "wert", probabilities: [0.5, 0.5] }], offset: 0, limit: 10,
  }), /nicht doppelt/u);
  assert.throws(() => runtime.queryCsvDocument("wert\n1\n2", {
    columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [],
    histograms: [{ column: "wert", buckets: 4 }],
    quantiles: [{ column: "wert", probabilities: [0.5] }], offset: 0, limit: 10,
  }), /müssen getrennt abgefragt/u);
  assert.throws(() => runtime.queryCsvDocument("gruppe;wert\nA;1\nA;2", {
    columns: [], filters: [{ column: "gruppe", operator: "equals", value: "B" }],
    sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [],
    quantiles: [{ column: "wert", probabilities: [0.5] }], offset: 0, limit: 10,
  }), /nach den Filtern keine numerischen/u);
});

test("CSV quantile output remains below the tool budget at policy limits", () => {
  const runtime = loadCsvRuntime();
  const headers = [
    ...Array.from({ length: 3 }, (_, index) => `quantil-${index}-${"q".repeat(80)}`),
    ...Array.from({ length: 47 }, (_, index) => `extra-${index}-${"e".repeat(80)}`),
  ];
  const rows = Array.from({ length: 500 }, (_, rowIndex) => [
    rowIndex, rowIndex * 2, rowIndex * 3, ...Array.from({ length: 47 }, () => "1"),
  ].join(";"));
  const probabilities = [0, 0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99, 1];
  const result = runtime.queryCsvDocument([headers.join(";"), ...rows].join("\n"), {
    columns: headers.slice(0, 8), filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [],
    quantiles: headers.slice(0, 3).map((column) => ({ column, probabilities })), offset: 0, limit: 10,
  });
  assert.equal(result.quantiles.every((item) => item.values.length === 9), true);
  assert.equal(new TextEncoder().encode(JSON.stringify(result)).byteLength < 40_000, true);
});

test("CSV outliers use explicit Tukey IQR fences with R7 quartiles", () => {
  const runtime = loadCsvRuntime();
  const result = runtime.queryCsvDocument([
    "gruppe;wert", "A;1", "A;2", "A;3", "A;4", "A;5", "A;6", "A;7", "A;8", "A;100", "A;", "B;999",
  ].join("\n"), {
    columns: ["gruppe"], filters: [{ column: "gruppe", operator: "equals", value: "A" }],
    sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [], quantiles: [],
    outliers: [{ column: "wert" }], offset: 0, limit: 10,
  });
  const outliers = result.outliers[0];
  assert.deepEqual({
    sourceType: outliers.sourceType,
    matchedRows: outliers.matchedRows,
    numericRows: outliers.numericRows,
    nullRows: outliers.nullRows,
    method: outliers.method,
    fenceMultiplier: outliers.fenceMultiplier,
    firstQuartile: outliers.firstQuartile,
    thirdQuartile: outliers.thirdQuartile,
    interquartileRange: outliers.interquartileRange,
    lowerFence: outliers.lowerFence,
    upperFence: outliers.upperFence,
    totalOutliers: outliers.totalOutliers,
    returnedOutliers: outliers.returnedOutliers,
    truncatedOutliers: outliers.truncatedOutliers,
  }, {
    sourceType: "integer", matchedRows: 10, numericRows: 9, nullRows: 1,
    method: "tukey-iqr-r7", fenceMultiplier: 1.5, firstQuartile: 3, thirdQuartile: 7,
    interquartileRange: 4, lowerFence: -3, upperFence: 13,
    totalOutliers: 1, returnedOutliers: 1, truncatedOutliers: 0,
  });
  assert.deepEqual(outliers.values, [{ sourceRow: 10, value: 100, direction: "upper" }]);
  assert.deepEqual(result.query.outliers, [{ column: "wert" }]);
  assert.equal(result.policy.maximumOutlierColumns, 3);
  assert.equal(result.policy.maximumOutliersPerColumn, 20);
  assert.equal(result.policy.outlierMethod, "tukey-iqr-r7");
  assert.equal(result.policy.outlierFenceMultiplier, 1.5);
  assert.equal(result.executableContentRun, false);
  assert.equal(result.factsVerified, false);
});

test("CSV outliers are bounded, deterministic and report truncation", () => {
  const runtime = loadCsvRuntime();
  const rows = [
    ...Array.from({ length: 475 }, () => "0"),
    ...Array.from({ length: 25 }, (_, index) => String(100 + index)),
  ];
  const result = runtime.queryCsvDocument(["wert", ...rows].join("\n"), {
    columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [], quantiles: [],
    outliers: [{ column: "wert" }], offset: 0, limit: 10,
  });
  assert.equal(result.outliers[0].totalOutliers, 25);
  assert.equal(result.outliers[0].returnedOutliers, 20);
  assert.equal(result.outliers[0].truncatedOutliers, 5);
  assert.deepEqual(result.outliers[0].values.map(({ value }) => value), Array.from({ length: 20 }, (_, index) => 100 + index));
  assert.equal(new TextEncoder().encode(JSON.stringify(result)).byteLength < 40_000, true);
});

test("CSV outliers reject unsafe types, duplicate columns, combinations and non-finite fences", () => {
  const runtime = loadCsvRuntime();
  assert.throws(() => runtime.queryCsvDocument("wert\nA\nB", {
    columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [], quantiles: [],
    outliers: [{ column: "wert" }], offset: 0, limit: 10,
  }), /nicht global numerisch/u);
  assert.throws(() => runtime.queryCsvDocument("wert\n1\n2", {
    columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [], quantiles: [],
    outliers: [{ column: "wert" }, { column: "wert" }], offset: 0, limit: 10,
  }), /nicht doppelt/u);
  assert.throws(() => runtime.queryCsvDocument("wert\n1\n2", {
    columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [],
    quantiles: [{ column: "wert", probabilities: [0.5] }], outliers: [{ column: "wert" }], offset: 0, limit: 10,
  }), /müssen getrennt abgefragt/u);
  assert.throws(() => runtime.queryCsvDocument("wert\n-1e308\n1e308", {
    columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [], quantiles: [],
    outliers: [{ column: "wert" }], offset: 0, limit: 10,
  }), /nicht endlich/u);
});

test("CSV dispersion reports explicit population and sample variance rules", () => {
  const runtime = loadCsvRuntime();
  const content = [
    "gruppe;wert", "A;2", "A;4", "A;4", "A;4", "A;5", "A;5", "A;7", "A;9", "A;", "B;100",
  ].join("\n");
  const population = runtime.queryCsvDocument(content, {
    columns: ["gruppe"], filters: [{ column: "gruppe", operator: "equals", value: "A" }],
    sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [], quantiles: [], outliers: [],
    dispersion: [{ column: "wert", mode: "population" }], offset: 0, limit: 10,
  });
  assert.deepEqual(population.dispersion[0], {
    column: "wert", sourceType: "integer", matchedRows: 9, numericRows: 8, nullRows: 1,
    method: "welford-one-pass", mode: "population", denominator: 8,
    mean: 5, variance: 4, standardDeviation: 2, minimum: 2, maximum: 9, range: 7,
  });
  assert.deepEqual(population.query.dispersion, [{ column: "wert", mode: "population" }]);
  assert.equal(population.policy.maximumDispersionColumns, 3);
  const sample = runtime.queryCsvDocument(content, {
    columns: [], filters: [{ column: "gruppe", operator: "equals", value: "A" }],
    sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [], quantiles: [], outliers: [],
    dispersion: [{ column: "wert", mode: "sample" }], offset: 0, limit: 10,
  }).dispersion[0];
  assert.equal(sample.denominator, 7);
  assert.equal(sample.variance, 4.57142857142857);
  assert.equal(sample.standardDeviation, 2.1380899352994);
});

test("CSV dispersion is stable for shifted and constant data", () => {
  const runtime = loadCsvRuntime();
  const shifted = runtime.queryCsvDocument("wert\n1000000000001\n1000000000002\n1000000000003", {
    columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [], quantiles: [], outliers: [],
    dispersion: [{ column: "wert", mode: "population" }], offset: 0, limit: 10,
  }).dispersion[0];
  assert.equal(shifted.mean, 1000000000002);
  assert.equal(shifted.variance, 0.666666666666667);
  const constant = runtime.queryCsvDocument("wert\n7", {
    columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [], quantiles: [], outliers: [],
    dispersion: [{ column: "wert", mode: "population" }], offset: 0, limit: 10,
  }).dispersion[0];
  assert.equal(constant.variance, 0);
  assert.equal(constant.standardDeviation, 0);
  assert.equal(constant.range, 0);
});

test("CSV dispersion rejects unsafe types, samples, duplicates, combinations and overflow", () => {
  const runtime = loadCsvRuntime();
  const base = { columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [], quantiles: [], outliers: [], offset: 0, limit: 10 };
  assert.throws(() => runtime.queryCsvDocument("wert\nA\nB", {
    ...base, dispersion: [{ column: "wert", mode: "population" }],
  }), /nicht global numerisch/u);
  assert.throws(() => runtime.queryCsvDocument("wert\n1", {
    ...base, dispersion: [{ column: "wert", mode: "sample" }],
  }), /mindestens zwei/u);
  assert.throws(() => runtime.queryCsvDocument("wert\n1\n2", {
    ...base, dispersion: [{ column: "wert", mode: "population" }, { column: "wert", mode: "sample" }],
  }), /nicht doppelt/u);
  assert.throws(() => runtime.queryCsvDocument("wert\n1\n2", {
    ...base, outliers: [{ column: "wert" }], dispersion: [{ column: "wert", mode: "population" }],
  }), /müssen getrennt abgefragt/u);
  assert.throws(() => runtime.queryCsvDocument("wert\n-1e308\n1e308", {
    ...base, dispersion: [{ column: "wert", mode: "population" }],
  }), /sicheren Zahlenbereich/u);
});

test("CSV dispersion output remains below the tool budget at policy limits", () => {
  const runtime = loadCsvRuntime();
  const headers = [
    ...Array.from({ length: 3 }, (_, index) => `streuung-${index}-${"s".repeat(80)}`),
    ...Array.from({ length: 47 }, (_, index) => `extra-${index}-${"e".repeat(80)}`),
  ];
  const rows = Array.from({ length: 500 }, (_, rowIndex) => [
    rowIndex, rowIndex * 2, rowIndex * 3, ...Array.from({ length: 47 }, () => "1"),
  ].join(";"));
  const result = runtime.queryCsvDocument([headers.join(";"), ...rows].join("\n"), {
    columns: headers.slice(0, 8), filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [], quantiles: [], outliers: [],
    dispersion: headers.slice(0, 3).map((column) => ({ column, mode: "sample" })), offset: 0, limit: 10,
  });
  assert.equal(result.dispersion.length, 3);
  assert.equal(new TextEncoder().encode(JSON.stringify(result)).byteLength < 40_000, true);
});

test("CSV relationships use pairwise-complete population and sample rules", () => {
  const runtime = loadCsvRuntime();
  const content = ["x;y", "1;2", "2;4", "3;6", ";8", "5;"].join("\n");
  const base = { columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [], quantiles: [], outliers: [], dispersion: [], offset: 0, limit: 10 };
  const population = runtime.queryCsvDocument(content, {
    ...base, relationships: [{ xColumn: "x", yColumn: "y", mode: "population" }],
  });
  assert.deepEqual(population.relationships[0], {
    xColumn: "x", yColumn: "y", xSourceType: "integer", ySourceType: "integer",
    matchedRows: 5, pairedRows: 3, excludedNullRows: 2, xNullRows: 1, yNullRows: 1,
    method: "welford-bivariate-one-pass", mode: "population", denominator: 3,
    xMean: 2, yMean: 4, covariance: 1.33333333333333, correlation: 1,
    correlationDefined: true, correlationUndefinedReason: null,
  });
  assert.deepEqual(population.query.relationships, [{ xColumn: "x", yColumn: "y", mode: "population" }]);
  const sample = runtime.queryCsvDocument(content, {
    ...base, relationships: [{ xColumn: "x", yColumn: "y", mode: "sample" }],
  }).relationships[0];
  assert.equal(sample.denominator, 2);
  assert.equal(sample.covariance, 2);
  assert.equal(sample.correlation, 1);
});

test("CSV relationships report undefined zero-variance correlation and reject unsafe requests", () => {
  const runtime = loadCsvRuntime();
  const base = { columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [], quantiles: [], outliers: [], dispersion: [], offset: 0, limit: 10 };
  const constant = runtime.queryCsvDocument("x;y\n7;1\n7;2\n7;3", {
    ...base, relationships: [{ xColumn: "x", yColumn: "y", mode: "sample" }],
  }).relationships[0];
  assert.equal(constant.covariance, 0);
  assert.equal(constant.correlation, null);
  assert.equal(constant.correlationDefined, false);
  assert.equal(constant.correlationUndefinedReason, "zero-variance");
  assert.throws(() => runtime.queryCsvDocument("x;y\n1;2", {
    ...base, relationships: [{ xColumn: "x", yColumn: "y", mode: "sample" }],
  }), /mindestens zwei/u);
  assert.throws(() => runtime.queryCsvDocument("x;y\n1;A\n2;B", {
    ...base, relationships: [{ xColumn: "x", yColumn: "y", mode: "population" }],
  }), /nicht global numerisch/u);
  assert.throws(() => runtime.queryCsvDocument("x;y\n1;2\n2;3", {
    ...base, relationships: [{ xColumn: "x", yColumn: "x", mode: "population" }],
  }), /verschiedenen Spalten/u);
  assert.throws(() => runtime.queryCsvDocument("x;y\n1;2\n2;3", {
    ...base, dispersion: [{ column: "x", mode: "population" }],
    relationships: [{ xColumn: "x", yColumn: "y", mode: "population" }],
  }), /müssen getrennt/u);
  assert.throws(() => runtime.queryCsvDocument("x;y\n-1e308;1e308\n1e308;-1e308", {
    ...base, relationships: [{ xColumn: "x", yColumn: "y", mode: "population" }],
  }), /sicheren Zahlenbereich/u);
});

test("CSV relationship output remains below the tool budget at policy limits", () => {
  const runtime = loadCsvRuntime();
  const headers = Array.from({ length: 50 }, (_, index) => `paar-${index}-${"p".repeat(80)}`);
  const rows = Array.from({ length: 500 }, (_, rowIndex) =>
    headers.map((_, index) => rowIndex * (index + 1)).join(";"),
  );
  const result = runtime.queryCsvDocument([headers.join(";"), ...rows].join("\n"), {
    columns: headers.slice(0, 8), filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [], quantiles: [], outliers: [], dispersion: [],
    relationships: [0, 2, 4].map((index) => ({ xColumn: headers[index], yColumn: headers[index + 1], mode: "sample" })),
    offset: 0, limit: 10,
  });
  assert.equal(result.relationships.length, 3);
  assert.equal(new TextEncoder().encode(JSON.stringify(result)).byteLength < 40_000, true);
});

test("CSV regression fits OLS and applies explicit residual degrees of freedom", () => {
  const runtime = loadCsvRuntime();
  const base = { columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [], quantiles: [], outliers: [], dispersion: [], relationships: [], offset: 0, limit: 10 };
  const result = runtime.queryCsvDocument("x;y\n1;3\n2;5\n3;7\n;9\n5;", {
    ...base, regressions: [{ xColumn: "x", yColumn: "y" }],
  });
  assert.deepEqual(result.regressions[0], {
    xColumn: "x", yColumn: "y", xSourceType: "integer", ySourceType: "integer",
    matchedRows: 5, pairedRows: 3, excludedNullRows: 2, xNullRows: 1, yNullRows: 1,
    method: "ordinary-least-squares-welford", equation: "y=intercept+slope*x",
    slope: 2, intercept: 1, xMean: 2, yMean: 5,
    rSquared: 1, rSquaredDefined: true, rSquaredUndefinedReason: null,
    residualSumSquares: 0, residualDegreesOfFreedom: 1, residualMeanSquare: 0,
    residualStandardError: 0, residualErrorDefined: true, residualErrorUndefinedReason: null,
    observedXMinimum: 1, observedXMaximum: 3,
    predictionUncertaintyMethod: "residual-standard-error-leverage-1sigma",
    residualDiagnosticMethod: "hat-matrix-leverage-internally-studentized",
    leverageThresholdMethod: "twice-average-leverage", leverageThreshold: 1.33333333333333,
    studentizedResidualThreshold: 2,
    influenceDiagnosticMethod: "cooks-distance-ols-two-parameters",
    cooksDistanceThresholdMethod: "four-over-n", cooksDistanceThreshold: 1.33333333333333,
    pressMethod: "leave-one-out-residual-over-one-minus-leverage",
    pressSumSquares: 0, pressDefined: true, pressUndefinedReason: null,
    predictedRSquared: 1, predictedRSquaredDefined: true, predictedRSquaredUndefinedReason: null,
    externallyStudentizedResidualMethod: "deleted-mse-n-minus-three",
    externallyStudentizedResidualThreshold: 2,
    intervalMethod: "student-t-two-sided", intervalConfidenceLevel: null, intervalCriticalValue: null,
    predictions: [],
    totalResiduals: 3, returnedResiduals: 3, truncatedResiduals: 0,
    residuals: [
      { sourceRow: 2, observed: 3, predicted: 3, residual: 0, leverage: 0.833333333333333, studentizedResidual: null, studentizedResidualUndefinedReason: "zero-residual-standard-error", cooksDistance: null, pressResidual: 0, externallyStudentizedResidual: null, externallyStudentizedResidualUndefinedReason: "insufficient-deleted-degrees-of-freedom" },
      { sourceRow: 3, observed: 5, predicted: 5, residual: 0, leverage: 0.333333333333333, studentizedResidual: null, studentizedResidualUndefinedReason: "zero-residual-standard-error", cooksDistance: null, pressResidual: 0, externallyStudentizedResidual: null, externallyStudentizedResidualUndefinedReason: "insufficient-deleted-degrees-of-freedom" },
      { sourceRow: 4, observed: 7, predicted: 7, residual: 0, leverage: 0.833333333333333, studentizedResidual: null, studentizedResidualUndefinedReason: "zero-residual-standard-error", cooksDistance: null, pressResidual: 0, externallyStudentizedResidual: null, externallyStudentizedResidualUndefinedReason: "insufficient-deleted-degrees-of-freedom" },
    ],
  });
  assert.deepEqual(result.query.regressions, [{ xColumn: "x", yColumn: "y", predictionXValues: [], intervalConfidenceLevel: null }]);
});

test("CSV regression diagnostics expose bounded leverage and internally studentized residuals", () => {
  const runtime = loadCsvRuntime();
  const base = { columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [], quantiles: [], outliers: [], dispersion: [], relationships: [], offset: 0, limit: 10 };
  const regression = runtime.queryCsvDocument("x;y\n0;0\n1;1\n2;2\n3;3\n10;20", {
    ...base, regressions: [{ xColumn: "x", yColumn: "y" }],
  }).regressions[0];
  assert.equal(regression.residualDiagnosticMethod, "hat-matrix-leverage-internally-studentized");
  assert.equal(regression.leverageThresholdMethod, "twice-average-leverage");
  assert.equal(regression.leverageThreshold, 0.8);
  assert.equal(regression.studentizedResidualThreshold, 2);
  assert.equal(regression.influenceDiagnosticMethod, "cooks-distance-ols-two-parameters");
  assert.equal(regression.cooksDistanceThresholdMethod, "four-over-n");
  assert.equal(regression.cooksDistanceThreshold, 0.8);
  assert.equal(regression.residuals.every(({ leverage }) => leverage >= 0 && leverage <= 1), true);
  assert.equal(regression.residuals.every(({ studentizedResidual }) => studentizedResidual !== null), true);
  assert.equal(regression.residuals.every(({ studentizedResidualUndefinedReason }) => studentizedResidualUndefinedReason === undefined), true);
  assert.equal(regression.residuals.at(-1).leverage > regression.leverageThreshold, true);
  assert.equal(regression.residuals.some(({ studentizedResidual }) => Math.abs(studentizedResidual) > regression.studentizedResidualThreshold), false);
  assert.equal(regression.residuals.every(({ cooksDistance }) => cooksDistance !== null && cooksDistance >= 0), true);
  assert.equal(regression.residuals.at(-1).cooksDistance > regression.cooksDistanceThreshold, true);
  assert.equal(regression.pressMethod, "leave-one-out-residual-over-one-minus-leverage");
  assert.equal(regression.pressDefined, true);
  assert.equal(regression.pressSumSquares > regression.residualSumSquares, true);
  assert.equal(regression.predictedRSquaredDefined, true);
  assert.equal(regression.predictedRSquared < regression.rSquared, true);
  assert.equal(regression.externallyStudentizedResidualMethod, "deleted-mse-n-minus-three");
  assert.equal(regression.externallyStudentizedResidualThreshold, 2);
  assert.equal(regression.residuals.at(-1).externallyStudentizedResidual, null);
  assert.equal(regression.residuals.at(-1).externallyStudentizedResidualUndefinedReason, "zero-deleted-residual-standard-error");
});

test("CSV regression externally studentizes residuals with deleted variance", () => {
  const runtime = loadCsvRuntime();
  const base = { columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [], quantiles: [], outliers: [], dispersion: [], relationships: [], offset: 0, limit: 10 };
  const regression = runtime.queryCsvDocument("x;y\n0;0\n1;1\n2;3\n3;2\n4;5", {
    ...base, regressions: [{ xColumn: "x", yColumn: "y" }],
  }).regressions[0];
  const deletedDegreesOfFreedom = regression.residualDegreesOfFreedom - 1;
  assert.equal(regression.residuals.every(({ externallyStudentizedResidual }) => Number.isFinite(externallyStudentizedResidual)), true);
  for (const residual of regression.residuals) {
    const expected = residual.studentizedResidual * Math.sqrt(
      deletedDegreesOfFreedom /
      (regression.residualDegreesOfFreedom - residual.studentizedResidual ** 2),
    );
    assert.equal(Math.abs(residual.externallyStudentizedResidual - expected) < 1e-12, true);
    assert.equal(residual.externallyStudentizedResidualUndefinedReason, undefined);
  }
});

test("CSV regression predictions distinguish interpolation, extrapolation and uncertainty", () => {
  const runtime = loadCsvRuntime();
  const base = { columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [], quantiles: [], outliers: [], dispersion: [], relationships: [], offset: 0, limit: 10 };
  const regression = runtime.queryCsvDocument("x;y\n1;2\n2;5\n3;6\n4;9", {
    ...base, regressions: [{ xColumn: "x", yColumn: "y", predictionXValues: [2.5, 0, 5] }],
  }).regressions[0];
  assert.equal(regression.observedXMinimum, 1);
  assert.equal(regression.observedXMaximum, 4);
  assert.deepEqual(regression.predictions.map(({ range }) => range), [
    "interpolation", "extrapolation-low", "extrapolation-high",
  ]);
  assert.equal(regression.predictions.every(({ uncertaintyDefined }) => uncertaintyDefined), true);
  assert.equal(regression.predictions.every(({ meanResponseStandardError }) => meanResponseStandardError > 0), true);
  assert.equal(regression.predictions.every(({ predictionStandardError, meanResponseStandardError }) => predictionStandardError > meanResponseStandardError), true);
  assert.equal(regression.predictions.every(({ intervalDefined }) => !intervalDefined), true);
  assert.equal(regression.predictions.every(({ intervalUndefinedReason }) => intervalUndefinedReason === "not-requested"), true);
});

test("CSV regression intervals use the requested confidence and two-sided Student-t rule", () => {
  const runtime = loadCsvRuntime();
  const base = { columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [], quantiles: [], outliers: [], dispersion: [], relationships: [], offset: 0, limit: 10 };
  const regression = runtime.queryCsvDocument("x;y\n1;2\n2;5\n3;6\n4;9", {
    ...base,
    regressions: [{ xColumn: "x", yColumn: "y", predictionXValues: [2.5], intervalConfidenceLevel: 0.95 }],
  }).regressions[0];
  assert.equal(regression.intervalMethod, "student-t-two-sided");
  assert.equal(regression.intervalConfidenceLevel, 0.95);
  assert.ok(Math.abs(regression.intervalCriticalValue - 4.30265272974946) < 1e-12);
  const prediction = regression.predictions[0];
  assert.equal(prediction.intervalDefined, true);
  assert.equal(prediction.intervalUndefinedReason, null);
  assert.ok(prediction.meanResponseConfidenceInterval.lower < prediction.predicted);
  assert.ok(prediction.meanResponseConfidenceInterval.upper > prediction.predicted);
  assert.ok(prediction.predictionInterval.lower < prediction.meanResponseConfidenceInterval.lower);
  assert.ok(prediction.predictionInterval.upper > prediction.meanResponseConfidenceInterval.upper);
});

test("CSV regression prediction uncertainty stays undefined without residual degrees of freedom", () => {
  const runtime = loadCsvRuntime();
  const base = { columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [], quantiles: [], outliers: [], dispersion: [], relationships: [], offset: 0, limit: 10 };
  const prediction = runtime.queryCsvDocument("x;y\n1;2\n2;4", {
    ...base, regressions: [{ xColumn: "x", yColumn: "y", predictionXValues: [1.5] }],
  }).regressions[0].predictions[0];
  assert.equal(prediction.uncertaintyDefined, false);
  assert.equal(prediction.uncertaintyUndefinedReason, "insufficient-degrees-of-freedom");
  assert.equal(prediction.meanResponseStandardError, null);
  assert.equal(prediction.predictionStandardError, null);
  assert.equal(prediction.intervalDefined, false);
  assert.equal(prediction.intervalUndefinedReason, "not-requested");
  assert.equal(prediction.meanResponseConfidenceInterval, null);
  assert.equal(prediction.predictionInterval, null);
});

test("CSV regression intervals stay undefined without residual degrees of freedom", () => {
  const runtime = loadCsvRuntime();
  const base = { columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [], quantiles: [], outliers: [], dispersion: [], relationships: [], offset: 0, limit: 10 };
  const regression = runtime.queryCsvDocument("x;y\n1;2\n2;4", {
    ...base,
    regressions: [{ xColumn: "x", yColumn: "y", predictionXValues: [1.5], intervalConfidenceLevel: 0.99 }],
  }).regressions[0];
  assert.equal(regression.intervalCriticalValue, null);
  assert.equal(regression.predictions[0].intervalDefined, false);
  assert.equal(regression.predictions[0].intervalUndefinedReason, "insufficient-degrees-of-freedom");
});

test("CSV regression exposes undefined residual error and response degeneracy", () => {
  const runtime = loadCsvRuntime();
  const base = { columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [], quantiles: [], outliers: [], dispersion: [], relationships: [], offset: 0, limit: 10 };
  const two = runtime.queryCsvDocument("x;y\n1;2\n2;4", {
    ...base, regressions: [{ xColumn: "x", yColumn: "y" }],
  }).regressions[0];
  assert.equal(two.residualDegreesOfFreedom, 0);
  assert.equal(two.residualMeanSquare, null);
  assert.equal(two.residualStandardError, null);
  assert.equal(two.residualErrorDefined, false);
  assert.equal(two.residualErrorUndefinedReason, "insufficient-degrees-of-freedom");
  assert.equal(two.pressDefined, false);
  assert.equal(two.pressUndefinedReason, "unit-leverage");
  assert.equal(two.pressSumSquares, null);
  assert.equal(two.predictedRSquaredDefined, false);
  assert.equal(two.predictedRSquaredUndefinedReason, "unit-leverage");
  assert.equal(two.residuals.every(({ externallyStudentizedResidual }) => externallyStudentizedResidual === null), true);
  assert.equal(two.residuals.every(({ externallyStudentizedResidualUndefinedReason }) => externallyStudentizedResidualUndefinedReason === "unit-leverage"), true);
  assert.equal(two.residuals.every(({ studentizedResidual }) => studentizedResidual === null), true);
  assert.equal(two.residuals.every(({ studentizedResidualUndefinedReason }) => studentizedResidualUndefinedReason === "insufficient-degrees-of-freedom"), true);
  const constantY = runtime.queryCsvDocument("x;y\n1;7\n2;7\n3;7", {
    ...base, regressions: [{ xColumn: "x", yColumn: "y" }],
  }).regressions[0];
  assert.equal(constantY.slope, 0);
  assert.equal(constantY.intercept, 7);
  assert.equal(constantY.rSquared, null);
  assert.equal(constantY.rSquaredDefined, false);
  assert.equal(constantY.rSquaredUndefinedReason, "zero-response-variance");
  assert.equal(constantY.pressDefined, true);
  assert.equal(constantY.predictedRSquared, null);
  assert.equal(constantY.predictedRSquaredUndefinedReason, "zero-response-variance");
  assert.equal(constantY.residuals.every(({ externallyStudentizedResidualUndefinedReason }) => externallyStudentizedResidualUndefinedReason === "insufficient-deleted-degrees-of-freedom"), true);
});

test("CSV regression rejects degenerate, unsafe, duplicate and combined requests", () => {
  const runtime = loadCsvRuntime();
  const base = { columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [], quantiles: [], outliers: [], dispersion: [], relationships: [], offset: 0, limit: 10 };
  assert.throws(() => runtime.queryCsvDocument("x;y\n1;2", {
    ...base, regressions: [{ xColumn: "x", yColumn: "y" }],
  }), /mindestens zwei/u);
  assert.throws(() => runtime.queryCsvDocument("x;y\n1;2\n1;3", {
    ...base, regressions: [{ xColumn: "x", yColumn: "y" }],
  }), /Nullvarianz der x-Spalte/u);
  assert.throws(() => runtime.queryCsvDocument("x;y\nA;2\nB;3", {
    ...base, regressions: [{ xColumn: "x", yColumn: "y" }],
  }), /nicht global numerisch/u);
  assert.throws(() => runtime.queryCsvDocument("x;y\n1;2\n2;3", {
    ...base, regressions: [{ xColumn: "x", yColumn: "x" }],
  }), /verschiedenen Spalten/u);
  assert.throws(() => runtime.queryCsvDocument("x;y\n1;2\n2;3", {
    ...base, regressions: [{ xColumn: "x", yColumn: "y" }, { xColumn: "x", yColumn: "y" }],
  }), /nicht doppelt/u);
  assert.throws(() => runtime.queryCsvDocument("x;y\n1;2\n2;3", {
    ...base, relationships: [{ xColumn: "x", yColumn: "y", mode: "sample" }], regressions: [{ xColumn: "x", yColumn: "y" }],
  }), /müssen getrennt/u);
  assert.throws(() => runtime.queryCsvDocument("x;y\n-1e308;1e308\n1e308;-1e308", {
    ...base, regressions: [{ xColumn: "x", yColumn: "y" }],
  }), /sicheren Zahlenbereich/u);
  assert.throws(() => runtime.queryCsvDocument("x;y\n1;2\n2;3", {
    ...base, regressions: [{ xColumn: "x", yColumn: "y", predictionXValues: [1, 1] }],
  }), /keine doppelten/u);
  assert.throws(() => runtime.queryCsvDocument("x;y\n1;2\n2;3", {
    ...base, regressions: [{ xColumn: "x", yColumn: "y", predictionXValues: Array.from({ length: 11 }, (_, index) => index) }],
  }), /höchstens 10/u);
  assert.throws(() => runtime.queryCsvDocument("x;y\n1;2\n2;3\n3;5", {
    ...base, regressions: [{ xColumn: "x", yColumn: "y", predictionXValues: [2], intervalConfidenceLevel: 0.8 }],
  }), /0,9, 0,95 oder 0,99/u);
  assert.throws(() => runtime.queryCsvDocument("x;y\n1;2\n2;3\n3;5", {
    ...base, regressions: [{ xColumn: "x", yColumn: "y", intervalConfidenceLevel: 0.95 }],
  }), /mindestens einen Vorhersagewert/u);
});

test("CSV regression residual output is bounded and reports truncation", () => {
  const runtime = loadCsvRuntime();
  const rows = Array.from({ length: 30 }, (_, index) => `${index};${index * 2 + (index % 2)}`).join("\n");
  const result = runtime.queryCsvDocument(`x;y\n${rows}`, {
    columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [], quantiles: [], outliers: [], dispersion: [], relationships: [],
    regressions: [{ xColumn: "x", yColumn: "y" }], offset: 0, limit: 10,
  });
  assert.equal(result.regressions[0].totalResiduals, 30);
  assert.equal(result.regressions[0].returnedResiduals, 20);
  assert.equal(result.regressions[0].truncatedResiduals, 10);
  assert.equal(new TextEncoder().encode(JSON.stringify(result)).byteLength < 40_000, true);
});

test("CSV regression output remains below the tool budget at pair limits", () => {
  const runtime = loadCsvRuntime();
  const headers = Array.from({ length: 6 }, (_, index) => `regression-${index}-${"r".repeat(80)}`);
  const rows = Array.from({ length: 500 }, (_, row) =>
    headers.map((_, index) => row * (index + 1) + (row % 3)).join(";"),
  );
  const result = runtime.queryCsvDocument([headers.join(";"), ...rows].join("\n"), {
    columns: headers, filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [], quantiles: [], outliers: [], dispersion: [], relationships: [],
    regressions: [0, 2, 4].map((index) => ({
      xColumn: headers[index], yColumn: headers[index + 1],
      predictionXValues: Array.from({ length: 10 }, (_, prediction) => prediction - 5),
      intervalConfidenceLevel: 0.99,
    })),
    offset: 0, limit: 10,
  });
  assert.equal(result.regressions.length, 3);
  assert.equal(result.regressions.every((item) => item.returnedResiduals === 20), true);
  assert.equal(result.regressions.every((item) => item.predictions.length === 10), true);
  assert.equal(result.policy.maximumReturnedRows, 0);
  assert.equal(result.returnedRows, 0);
  const outputByteLength = new TextEncoder().encode(JSON.stringify(result)).byteLength;
  assert.equal(outputByteLength < 40_000, true, `regression output uses ${outputByteLength} bytes`);
});

test("CSV aggregations are filtered, numeric-only, null-aware and deterministic", () => {
  const runtime = loadCsvRuntime();
  const content = [
    "gruppe;betrag;anzahl;leer",
    "rot;0.1;2;",
    "rot;0.2;3;",
    "rot;;4;",
    "blau;100;5;",
  ].join("\n");
  const result = runtime.queryCsvDocument(content, {
    columns: ["gruppe"],
    filters: [{ column: "gruppe", operator: "equals", value: "rot" }],
    sort: [],
    aggregates: [
      { column: "betrag", operation: "sum" },
      { column: "betrag", operation: "average" },
      { column: "anzahl", operation: "minimum" },
      { column: "anzahl", operation: "maximum" },
      { column: "leer", operation: "sum" },
    ],
    offset: 0,
    limit: 10,
  });
  assert.deepEqual(
    result.aggregates.map(({ column, operation, numericRows, nullRows, value }) => ({
      column,
      operation,
      numericRows,
      nullRows,
      value,
    })),
    [
      { column: "betrag", operation: "sum", numericRows: 2, nullRows: 1, value: 0.3 },
      { column: "betrag", operation: "average", numericRows: 2, nullRows: 1, value: 0.15 },
      { column: "anzahl", operation: "minimum", numericRows: 3, nullRows: 0, value: 2 },
      { column: "anzahl", operation: "maximum", numericRows: 3, nullRows: 0, value: 4 },
      { column: "leer", operation: "sum", numericRows: 0, nullRows: 3, value: null },
    ],
  );
  assert.equal(result.policy.aggregationNullPolicy, "exclude-empty-cells");
  assert.equal(result.policy.aggregationTypePolicy, "numeric-columns-only");
  assert.equal(result.executableContentRun, false);
  assert.equal(result.factsVerified, false);
});

test("CSV aggregations reject mixed columns and unsafe or duplicate input", () => {
  const runtime = loadCsvRuntime();
  assert.throws(
    () => runtime.queryCsvDocument("name,wert\nA,1\nB,text", {
      columns: [],
      filters: [],
      sort: [],
      aggregates: [{ column: "wert", operation: "sum" }],
      offset: 0,
      limit: 10,
    }),
    /nicht rein numerisch/u,
  );
  assert.throws(
    () => runtime.queryCsvDocument("name,wert\nA,1e308\nB,1e308", {
      columns: [],
      filters: [],
      sort: [],
      aggregates: [{ column: "wert", operation: "sum" }],
      offset: 0,
      limit: 10,
    }),
    /sicheren Zahlenbereich/u,
  );
});

test("CSV grouped aggregations are filtered, deterministic and output-bounded", () => {
  const runtime = loadCsvRuntime();
  const rows = [
    "region;typ;betrag",
    "West;A;2",
    "west;A;3",
    "Ost;A;4",
    "Ost;B;6",
    ";B;8",
    ...Array.from({ length: 8 }, (_, index) => `Z${index};C;${index + 1}`),
  ];
  const result = runtime.queryCsvDocument(rows.join("\n"), {
    columns: ["region", "typ"],
    filters: [{ column: "betrag", operator: "greater-than", value: "1" }],
    sort: [],
    aggregates: [
      { column: "betrag", operation: "sum" },
      { column: "betrag", operation: "average" },
    ],
    groupBy: ["region", "typ"],
    offset: 0,
    limit: 10,
  });
  const west = result.groups.find((group) => group.keys.region === "West");
  assert.equal(west.matchedRows, 2);
  assert.equal(west.aggregates[0].value, 5);
  assert.equal(west.aggregates[1].value, 2.5);
  assert.equal(result.totalGroups, 11);
  assert.equal(result.returnedGroups, 8);
  assert.equal(result.truncatedGroups, 3);
  assert.equal(result.policy.maximumGroupColumns, 2);
  assert.equal(result.policy.maximumGroups, 8);
  assert.equal(result.executableContentRun, false);
  assert.equal(result.factsVerified, false);
});

test("CSV grouped aggregations reject unsafe shapes and oversized keys", () => {
  const runtime = loadCsvRuntime();
  assert.throws(
    () => runtime.queryCsvDocument("a,b,c,wert\n1,2,3,4", {
      columns: [], filters: [], sort: [], aggregates: [{ column: "wert", operation: "sum" }],
      groupBy: ["a", "b", "c"], offset: 0, limit: 10,
    }),
    /höchstens 2 Gruppenspalten/u,
  );
  assert.throws(
    () => runtime.queryCsvDocument(`gruppe,wert\n${"x".repeat(161)},1`, {
      columns: [], filters: [], sort: [], aggregates: [{ column: "wert", operation: "sum" }],
      groupBy: ["gruppe"], offset: 0, limit: 10,
    }),
    /sichere Ausgabelänge/u,
  );
});
