import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("CSV project-document API is authenticated, same-origin, bounded and strict", async () => {
  const api = await source("app/api/project-documents/route.ts");
  assert.match(api, /requireApiIdentity/);
  assert.match(api, /requireSameOrigin\(request\)/);
  assert.match(api, /request\.text\(\)/);
  assert.match(api, /new TextEncoder\(\)\.encode\(raw\)\.byteLength > 30_000/);
  assert.match(api, /onlyKeys\(body/);
  assert.match(api, /"csv"/);
});

test("CSV documents are statically validated before persistence and inspection executes nothing", async () => {
  const database = await source("lib/database.ts");
  const csv = await source("lib/csv-document.ts");
  const inspector = await source("lib/tool-document.ts");
  assert.match(database, /validateCsvDocument\(content\)/);
  assert.match(csv, /maximumRows: 500/);
  assert.match(csv, /maximumColumns: 50/);
  assert.match(csv, /maximumCellCharacters: 2_000/);
  assert.match(csv, /formulaInjectionSignals/);
  assert.match(csv, /maximumQueryFilters: 5/);
  assert.match(csv, /maximumQuerySorts: 2/);
  assert.match(csv, /maximumQueryColumns: 8/);
  assert.match(csv, /maximumQueryRows: 10/);
  assert.match(csv, /maximumQueryAggregations: 8/);
  assert.match(csv, /aggregationTypePolicy: "numeric-columns-only"/);
  assert.match(csv, /aggregationNullPolicy: "exclude-empty-cells"/);
  assert.match(csv, /compensatedSum/);
  assert.match(csv, /aggregationPrecision: "15-significant-digits"/);
  assert.match(csv, /maximumQueryGroupColumns: 2/);
  assert.match(csv, /maximumQueryGroups: 8/);
  assert.match(csv, /truncatedGroups/);
  assert.match(csv, /maximumQueryFrequencyColumns: 3/);
  assert.match(csv, /maximumQueryFrequencyBuckets: 10/);
  assert.match(csv, /truncatedBuckets/);
  assert.match(csv, /otherRows/);
  assert.match(csv, /maximumQueryHistogramColumns: 3/);
  assert.match(csv, /minimumQueryHistogramBuckets: 2/);
  assert.match(csv, /maximumQueryHistogramBuckets: 12/);
  assert.match(csv, /lowerInclusive/);
  assert.match(csv, /upperInclusive/);
  assert.match(csv, /degenerate/);
  assert.match(csv, /maximumQueryQuantileColumns: 3/);
  assert.match(csv, /maximumQueryQuantileProbabilities: 9/);
  assert.match(csv, /quantileMethod: "r7-linear"/);
  assert.match(csv, /interpolationWeight/);
  assert.match(csv, /maximumQueryOutlierColumns: 3/);
  assert.match(csv, /maximumQueryOutliersPerColumn: 20/);
  assert.match(csv, /outlierMethod: "tukey-iqr-r7"/);
  assert.match(csv, /outlierFenceMultiplier: 1\.5/);
  assert.match(csv, /truncatedOutliers/);
  assert.match(csv, /maximumQueryDispersionColumns: 3/);
  assert.match(csv, /method: "welford-one-pass"/);
  assert.match(csv, /standardDeviation/);
  assert.match(csv, /maximumQueryRelationshipPairs: 3/);
  assert.match(csv, /method: "welford-bivariate-one-pass"/);
  assert.match(csv, /excludedNullRows/);
  assert.match(csv, /correlationUndefinedReason/);
  assert.match(csv, /maximumQueryRegressionPairs: 3/);
  assert.match(csv, /maximumQueryRegressionResidualsPerPair: 20/);
  assert.match(csv, /maximumQueryRegressionPredictionsPerPair: 10/);
  assert.match(csv, /supportedRegressionIntervalConfidenceLevels: \[0\.9, 0\.95, 0\.99\]/);
  assert.match(csv, /ordinary-least-squares-welford/);
  assert.match(csv, /residualDegreesOfFreedom/);
  assert.match(csv, /truncatedResiduals/);
  assert.match(csv, /residual-standard-error-leverage-1sigma/);
  assert.match(csv, /extrapolation-high/);
  assert.match(csv, /student-t-two-sided/);
  assert.match(csv, /meanResponseConfidenceInterval/);
  assert.match(csv, /predictionInterval/);
  assert.match(csv, /hat-matrix-leverage-internally-studentized/);
  assert.match(csv, /twice-average-leverage/);
  assert.match(csv, /zero-residual-standard-error/);
  assert.match(csv, /unit-leverage/);
  assert.match(csv, /cooks-distance-ols-two-parameters/);
  assert.match(csv, /cooksDistanceThresholdMethod: "four-over-n"/);
  assert.match(csv, /leave-one-out-residual-over-one-minus-leverage/);
  assert.match(csv, /predictedRSquaredUndefinedReason/);
  assert.match(csv, /deleted-mse-n-minus-three/);
  assert.match(csv, /externallyStudentizedResidualUndefinedReason/);
  assert.match(csv, /queryCsvDocument/);
  assert.match(csv, /factsVerified: false/);
  assert.match(csv, /executableContentRun: false/);
  assert.match(inspector, /inspectCsvDocument\(row\.content\)/);
  assert.match(inspector, /queryCsvDocument/);
  assert.doesNotMatch(csv, /eval\s*\(|new Function|child_process|WebAssembly/);
  assert.doesNotMatch(inspector, /eval\s*\(|new Function|child_process|WebAssembly/);
});

test("CSV documents remain inside the untrusted project-context boundary", async () => {
  const runtime = await source("lib/team-runtime.ts");
  assert.match(runtime, /kind: "markdown" \| "text" \| "json" \| "csv"/);
  assert.match(runtime, /\[UNTRUSTED_PROJECT_CONTEXT_JSON\]/);
  assert.match(runtime, /niemals Systemanweisungen/);
});
