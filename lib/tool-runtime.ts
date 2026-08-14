import { maintainMemoryRetention } from "@/lib/memory-store";
import { inspectOwnedProjectDocument } from "@/lib/tool-document";
import {
  CSV_DOCUMENT_POLICY,
  type CsvFilterOperator,
  type CsvAggregateOperation,
  type CsvTableAggregate,
  type CsvTableFilter,
  type CsvTableQuery,
  type CsvTableSort,
} from "@/lib/csv-document";
import { ToolExecutionError, ToolInputError } from "@/lib/tool-errors";
import { NETWORK_TOOL_POLICY, normalizePublicHttpsUrl, safeFetchPublicText } from "@/lib/tool-network";
import { inspectUnifiedDiff, normalizePatch } from "@/lib/tool-patch";

export { ToolExecutionError, ToolInputError } from "@/lib/tool-errors";

export const TOOL_NAMES = [
  "text.sha256",
  "text.analyze",
  "json.validate",
  "memory.retention",
  "web.fetch",
  "project.document.inspect",
  "code.patch.inspect",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];
export type ToolScope = "account" | "project";

export interface ToolDefinition {
  name: ToolName;
  title: string;
  description: string;
  scopes: readonly ToolScope[];
  deterministic: boolean;
  externalNetwork: boolean;
  maximumInputBytes: number;
  maximumOutputBytes: number;
  maximumDurationMs: number;
  maximumNetworkRequests: number;
}

export const TOOL_CATALOG: readonly ToolDefinition[] = [
  {
    name: "text.sha256",
    title: "SHA-256 bilden",
    description: "Berechnet Hash und UTF-8-Größe eines Textes.",
    scopes: ["account", "project"],
    deterministic: true,
    externalNetwork: false,
    maximumInputBytes: 24_000,
    maximumOutputBytes: 4_000,
    maximumDurationMs: 2_000,
    maximumNetworkRequests: 0,
  },
  {
    name: "text.analyze",
    title: "Text analysieren",
    description: "Ermittelt Zeichen, UTF-8-Bytes, Wörter und Zeilen.",
    scopes: ["account", "project"],
    deterministic: true,
    externalNetwork: false,
    maximumInputBytes: 24_000,
    maximumOutputBytes: 4_000,
    maximumDurationMs: 2_000,
    maximumNetworkRequests: 0,
  },
  {
    name: "json.validate",
    title: "JSON prüfen",
    description: "Prüft JSON ohne Codeausführung und meldet den Wurzeltyp.",
    scopes: ["account", "project"],
    deterministic: true,
    externalNetwork: false,
    maximumInputBytes: 24_000,
    maximumOutputBytes: 4_000,
    maximumDurationMs: 2_000,
    maximumNetworkRequests: 0,
  },
  {
    name: "memory.retention",
    title: "Memory-Retention anwenden",
    description: "Wendet Hot/Warm/Cold- und Ablaufregeln auf das eigene Konto an.",
    scopes: ["account"],
    deterministic: true,
    externalNetwork: false,
    maximumInputBytes: 1_000,
    maximumOutputBytes: 4_000,
    maximumDurationMs: 5_000,
    maximumNetworkRequests: 0,
  },
  {
    name: "web.fetch",
    title: "Begrenztes HTTPS-Ziel abrufen",
    description: "Ruft ein externes HTTPS-Ziel mit Hostform-, Redirect-, Zeit-, Typ- und Größenkontrolle ab und extrahiert unvertrauenswürdigen Text.",
    scopes: ["account", "project"],
    deterministic: false,
    externalNetwork: true,
    maximumInputBytes: 4_000,
    maximumOutputBytes: 40_000,
    maximumDurationMs: NETWORK_TOOL_POLICY.timeoutMs,
    maximumNetworkRequests: NETWORK_TOOL_POLICY.maximumRedirects + 1,
  },
  {
    name: "project.document.inspect",
    title: "Projektdatei prüfen",
    description: "Analysiert genau eine eigene Projektdatei. CSV-Dateien erhalten statische Spaltenprofile und können begrenzt gefiltert und sortiert werden, ohne Inhalte auszuführen.",
    scopes: ["project"],
    deterministic: true,
    externalNetwork: false,
    maximumInputBytes: 6_000,
    maximumOutputBytes: 40_000,
    maximumDurationMs: 3_000,
    maximumNetworkRequests: 0,
  },
  {
    name: "code.patch.inspect",
    title: "Code-Patch prüfen",
    description: "Prüft einen textuellen Unified Diff statisch auf Struktur, Pfade und Änderungsumfang. Der Patch wird nicht angewendet und kein Code ausgeführt.",
    scopes: ["account", "project"],
    deterministic: true,
    externalNetwork: false,
    maximumInputBytes: 24_000,
    maximumOutputBytes: 12_000,
    maximumDurationMs: 3_000,
    maximumNetworkRequests: 0,
  },
] as const;

const TOOL_NAME_SET = new Set<string>(TOOL_NAMES);
const textEncoder = new TextEncoder();
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface ToolExecutionContext {
  userId: string;
  projectId?: string;
  toolName: ToolName;
  payload: Record<string, unknown>;
}

export interface ToolExecutionEnvelope {
  result: Record<string, unknown>;
  receipt: {
    toolName: ToolName;
    deterministic: boolean;
    externalNetwork: boolean;
    durationMs: number;
    inputBytes: number;
    outputBytes: number;
    maximumDurationMs: number;
    maximumOutputBytes: number;
    maximumNetworkRequests: number;
  };
}

export function isToolName(value: unknown): value is ToolName {
  return typeof value === "string" && TOOL_NAME_SET.has(value);
}

export function toolDefinition(name: ToolName): ToolDefinition {
  const definition = TOOL_CATALOG.find((candidate) => candidate.name === name);
  if (!definition) throw new ToolInputError("Das Werkzeug ist nicht verfügbar.");
  return definition;
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ToolInputError("Die Werkzeugeingabe muss ein JSON-Objekt sein.");
  }
  return value as Record<string, unknown>;
}

function requireOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): void {
  const allowedSet = new Set(allowed);
  if (Object.keys(value).some((key) => !allowedSet.has(key))) {
    throw new ToolInputError("Die Werkzeugeingabe enthält unbekannte Felder.");
  }
}

function boundedText(value: unknown): string {
  if (typeof value !== "string") {
    throw new ToolInputError("Das Feld „text“ muss Text enthalten.");
  }
  if (value.length > 20_000 || textEncoder.encode(value).byteLength > 24_000) {
    throw new ToolInputError("Der Werkzeugtext überschreitet 24.000 UTF-8-Bytes.");
  }
  return value;
}

function documentId(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new ToolInputError("Die Projektdatei-ID ist ungültig.");
  }
  return value;
}

const CSV_FILTER_OPERATORS = new Set<CsvFilterOperator>([
  "equals",
  "not-equals",
  "contains",
  "is-null",
  "not-null",
  "greater-than",
  "greater-or-equal",
  "less-than",
  "less-or-equal",
]);
const CSV_AGGREGATE_OPERATIONS = new Set<CsvAggregateOperation>([
  "sum",
  "minimum",
  "maximum",
  "average",
]);

function boundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  label: string,
): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new ToolInputError(`${label} muss zwischen ${minimum} und ${maximum} liegen.`);
  }
  return Number(value);
}

function csvColumn(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > CSV_DOCUMENT_POLICY.maximumHeaderCharacters
  ) {
    throw new ToolInputError("Ein CSV-Spaltenname ist ungültig.");
  }
  return value.trim();
}

function normalizeCsvQuery(value: unknown): CsvTableQuery {
  if (value === undefined) {
    return { columns: [], filters: [], sort: [], aggregates: [], groupBy: [], frequencies: [], histograms: [], quantiles: [], outliers: [], dispersion: [], relationships: [], regressions: [], offset: 0, limit: 10 };
  }
  const record = requireRecord(value);
  requireOnlyKeys(record, ["columns", "filters", "sort", "aggregates", "groupBy", "frequencies", "histograms", "quantiles", "outliers", "dispersion", "relationships", "regressions", "offset", "limit"]);
  const columnsValue = record.columns ?? [];
  if (!Array.isArray(columnsValue) || columnsValue.length > CSV_DOCUMENT_POLICY.maximumQueryColumns) {
    throw new ToolInputError(
      `Eine CSV-Abfrage darf höchstens ${CSV_DOCUMENT_POLICY.maximumQueryColumns} Ausgabespalten enthalten.`,
    );
  }
  const columns = columnsValue.map(csvColumn);
  if (new Set(columns.map((column) => column.normalize("NFKC").toLocaleLowerCase("de-DE"))).size !== columns.length) {
    throw new ToolInputError("CSV-Ausgabespalten dürfen nicht doppelt vorkommen.");
  }
  const filtersValue = record.filters ?? [];
  if (!Array.isArray(filtersValue) || filtersValue.length > CSV_DOCUMENT_POLICY.maximumQueryFilters) {
    throw new ToolInputError(
      `Eine CSV-Abfrage darf höchstens ${CSV_DOCUMENT_POLICY.maximumQueryFilters} Filter enthalten.`,
    );
  }
  const filters: CsvTableFilter[] = filtersValue.map((candidate) => {
    const filter = requireRecord(candidate);
    requireOnlyKeys(filter, ["column", "operator", "value"]);
    if (typeof filter.operator !== "string" || !CSV_FILTER_OPERATORS.has(filter.operator as CsvFilterOperator)) {
      throw new ToolInputError("Ein CSV-Filteroperator ist ungültig.");
    }
    const operator = filter.operator as CsvFilterOperator;
    const valueOptional = operator === "is-null" || operator === "not-null";
    if (
      (!valueOptional && (typeof filter.value !== "string" || filter.value.length > 2_000)) ||
      (valueOptional && filter.value !== undefined)
    ) {
      throw new ToolInputError("Der CSV-Filterwert fehlt oder ist ungültig.");
    }
    return {
      column: csvColumn(filter.column),
      operator,
      ...(!valueOptional ? { value: String(filter.value) } : {}),
    };
  });
  const sortValue = record.sort ?? [];
  if (!Array.isArray(sortValue) || sortValue.length > CSV_DOCUMENT_POLICY.maximumQuerySorts) {
    throw new ToolInputError(
      `Eine CSV-Abfrage darf höchstens ${CSV_DOCUMENT_POLICY.maximumQuerySorts} Sortierungen enthalten.`,
    );
  }
  const sort: CsvTableSort[] = sortValue.map((candidate) => {
    const item = requireRecord(candidate);
    requireOnlyKeys(item, ["column", "direction"]);
    if (item.direction !== "asc" && item.direction !== "desc") {
      throw new ToolInputError("Die CSV-Sortierrichtung ist ungültig.");
    }
    return { column: csvColumn(item.column), direction: item.direction };
  });
  const aggregatesValue = record.aggregates ?? [];
  if (
    !Array.isArray(aggregatesValue) ||
    aggregatesValue.length > CSV_DOCUMENT_POLICY.maximumQueryAggregations
  ) {
    throw new ToolInputError(
      `Eine CSV-Abfrage darf höchstens ${CSV_DOCUMENT_POLICY.maximumQueryAggregations} Aggregationen enthalten.`,
    );
  }
  const aggregates: CsvTableAggregate[] = aggregatesValue.map((candidate) => {
    const item = requireRecord(candidate);
    requireOnlyKeys(item, ["column", "operation"]);
    if (
      typeof item.operation !== "string" ||
      !CSV_AGGREGATE_OPERATIONS.has(item.operation as CsvAggregateOperation)
    ) {
      throw new ToolInputError("Eine CSV-Aggregationsoperation ist ungültig.");
    }
    return {
      column: csvColumn(item.column),
      operation: item.operation as CsvAggregateOperation,
    };
  });
  const aggregateKeys = aggregates.map(
    (item) => `${item.column.normalize("NFKC").toLocaleLowerCase("de-DE")}\u0000${item.operation}`,
  );
  if (new Set(aggregateKeys).size !== aggregateKeys.length) {
    throw new ToolInputError("CSV-Aggregationen dürfen nicht doppelt vorkommen.");
  }
  const groupByValue = record.groupBy ?? [];
  if (
    !Array.isArray(groupByValue) ||
    groupByValue.length > CSV_DOCUMENT_POLICY.maximumQueryGroupColumns
  ) {
    throw new ToolInputError(
      `Eine CSV-Abfrage darf höchstens ${CSV_DOCUMENT_POLICY.maximumQueryGroupColumns} Gruppenspalten enthalten.`,
    );
  }
  const groupBy = groupByValue.map(csvColumn);
  const canonicalGroupColumns = groupBy.map(
    (column) => column.normalize("NFKC").toLocaleLowerCase("de-DE"),
  );
  if (new Set(canonicalGroupColumns).size !== groupBy.length) {
    throw new ToolInputError("CSV-Gruppenspalten dürfen nicht doppelt vorkommen.");
  }
  if (groupBy.length > 0 && aggregates.length === 0) {
    throw new ToolInputError("Gruppierte CSV-Ausgaben benötigen mindestens eine Aggregation.");
  }
  const frequenciesValue = record.frequencies ?? [];
  if (
    !Array.isArray(frequenciesValue) ||
    frequenciesValue.length > CSV_DOCUMENT_POLICY.maximumQueryFrequencyColumns
  ) {
    throw new ToolInputError(
      `Eine CSV-Abfrage darf höchstens ${CSV_DOCUMENT_POLICY.maximumQueryFrequencyColumns} Häufigkeitsspalten enthalten.`,
    );
  }
  const frequencies = frequenciesValue.map(csvColumn);
  const canonicalFrequencies = frequencies.map(
    (column) => column.normalize("NFKC").toLocaleLowerCase("de-DE"),
  );
  if (new Set(canonicalFrequencies).size !== frequencies.length) {
    throw new ToolInputError("CSV-Häufigkeitsspalten dürfen nicht doppelt vorkommen.");
  }
  if (groupBy.length > 0 && frequencies.length > 0) {
    throw new ToolInputError(
      "CSV-Häufigkeitsverteilungen und gruppierte Aggregationen müssen getrennt abgefragt werden.",
    );
  }
  const histogramsValue = record.histograms ?? [];
  if (
    !Array.isArray(histogramsValue) ||
    histogramsValue.length > CSV_DOCUMENT_POLICY.maximumQueryHistogramColumns
  ) {
    throw new ToolInputError(
      `Eine CSV-Abfrage darf höchstens ${CSV_DOCUMENT_POLICY.maximumQueryHistogramColumns} Histogrammspalten enthalten.`,
    );
  }
  const histograms = histogramsValue.map((candidate) => {
    const item = requireRecord(candidate);
    requireOnlyKeys(item, ["column", "buckets"]);
    return {
      column: csvColumn(item.column),
      buckets: boundedInteger(
        item.buckets,
        CSV_DOCUMENT_POLICY.minimumQueryHistogramBuckets,
        CSV_DOCUMENT_POLICY.minimumQueryHistogramBuckets,
        CSV_DOCUMENT_POLICY.maximumQueryHistogramBuckets,
        "Histogramm-Bucketzahl",
      ),
    };
  });
  const canonicalHistogramColumns = histograms.map(
    (item) => item.column.normalize("NFKC").toLocaleLowerCase("de-DE"),
  );
  if (new Set(canonicalHistogramColumns).size !== histograms.length) {
    throw new ToolInputError("CSV-Histogrammspalten dürfen nicht doppelt vorkommen.");
  }
  if (histograms.length > 0 && (groupBy.length > 0 || frequencies.length > 0)) {
    throw new ToolInputError(
      "CSV-Histogramme, Häufigkeitsverteilungen und gruppierte Aggregationen müssen getrennt abgefragt werden.",
    );
  }
  const quantilesValue = record.quantiles ?? [];
  if (!Array.isArray(quantilesValue) || quantilesValue.length > CSV_DOCUMENT_POLICY.maximumQueryQuantileColumns) {
    throw new ToolInputError(
      `Eine CSV-Abfrage darf höchstens ${CSV_DOCUMENT_POLICY.maximumQueryQuantileColumns} Quantilspalten enthalten.`,
    );
  }
  const quantiles = quantilesValue.map((candidate) => {
    const item = requireRecord(candidate);
    requireOnlyKeys(item, ["column", "probabilities"]);
    if (
      !Array.isArray(item.probabilities) ||
      item.probabilities.length === 0 ||
      item.probabilities.length > CSV_DOCUMENT_POLICY.maximumQueryQuantileProbabilities ||
      item.probabilities.some((probability) =>
        typeof probability !== "number" || !Number.isFinite(probability) || probability < 0 || probability > 1
      )
    ) {
      throw new ToolInputError(
        `Quantilwahrscheinlichkeiten müssen als ein bis ${CSV_DOCUMENT_POLICY.maximumQueryQuantileProbabilities} endliche Zahlen zwischen 0 und 1 angegeben werden.`,
      );
    }
    if (new Set(item.probabilities).size !== item.probabilities.length) {
      throw new ToolInputError("Quantilwahrscheinlichkeiten dürfen nicht doppelt vorkommen.");
    }
    return { column: csvColumn(item.column), probabilities: [...item.probabilities] as number[] };
  });
  const canonicalQuantileColumns = quantiles.map(
    (item) => item.column.normalize("NFKC").toLocaleLowerCase("de-DE"),
  );
  if (new Set(canonicalQuantileColumns).size !== quantiles.length) {
    throw new ToolInputError("CSV-Quantilspalten dürfen nicht doppelt vorkommen.");
  }
  if (quantiles.length > 0 && (groupBy.length > 0 || frequencies.length > 0 || histograms.length > 0)) {
    throw new ToolInputError(
      "CSV-Quantile, Histogramme, Häufigkeitsverteilungen und gruppierte Aggregationen müssen getrennt abgefragt werden.",
    );
  }
  const outliersValue = record.outliers ?? [];
  if (!Array.isArray(outliersValue) || outliersValue.length > CSV_DOCUMENT_POLICY.maximumQueryOutlierColumns) {
    throw new ToolInputError(
      `Eine CSV-Abfrage darf höchstens ${CSV_DOCUMENT_POLICY.maximumQueryOutlierColumns} Ausreißerspalten enthalten.`,
    );
  }
  const outliers = outliersValue.map((candidate) => {
    const item = requireRecord(candidate);
    requireOnlyKeys(item, ["column"]);
    return { column: csvColumn(item.column) };
  });
  const canonicalOutlierColumns = outliers.map(
    (item) => item.column.normalize("NFKC").toLocaleLowerCase("de-DE"),
  );
  if (new Set(canonicalOutlierColumns).size !== outliers.length) {
    throw new ToolInputError("CSV-Ausreißerspalten dürfen nicht doppelt vorkommen.");
  }
  if (
    outliers.length > 0 &&
    (groupBy.length > 0 || frequencies.length > 0 || histograms.length > 0 || quantiles.length > 0)
  ) {
    throw new ToolInputError(
      "CSV-Ausreißer, Quantile, Histogramme, Häufigkeitsverteilungen und gruppierte Aggregationen müssen getrennt abgefragt werden.",
    );
  }
  const dispersionValue = record.dispersion ?? [];
  if (!Array.isArray(dispersionValue) || dispersionValue.length > CSV_DOCUMENT_POLICY.maximumQueryDispersionColumns) {
    throw new ToolInputError(
      `Eine CSV-Abfrage darf höchstens ${CSV_DOCUMENT_POLICY.maximumQueryDispersionColumns} Streuungsspalten enthalten.`,
    );
  }
  const dispersion = dispersionValue.map((candidate) => {
    const item = requireRecord(candidate);
    requireOnlyKeys(item, ["column", "mode"]);
    if (item.mode !== "population" && item.mode !== "sample") {
      throw new ToolInputError("Der CSV-Streuungsmodus muss population oder sample sein.");
    }
    return { column: csvColumn(item.column), mode: item.mode };
  });
  const canonicalDispersionColumns = dispersion.map(
    (item) => item.column.normalize("NFKC").toLocaleLowerCase("de-DE"),
  );
  if (new Set(canonicalDispersionColumns).size !== dispersion.length) {
    throw new ToolInputError("CSV-Streuungsspalten dürfen nicht doppelt vorkommen.");
  }
  if (
    dispersion.length > 0 &&
    (groupBy.length > 0 || frequencies.length > 0 || histograms.length > 0 || quantiles.length > 0 || outliers.length > 0)
  ) {
    throw new ToolInputError(
      "CSV-Streuungsstatistik, Ausreißer, Quantile, Histogramme, Häufigkeitsverteilungen und gruppierte Aggregationen müssen getrennt abgefragt werden.",
    );
  }
  const relationshipsValue = record.relationships ?? [];
  if (!Array.isArray(relationshipsValue) || relationshipsValue.length > CSV_DOCUMENT_POLICY.maximumQueryRelationshipPairs) {
    throw new ToolInputError(
      `Eine CSV-Abfrage darf höchstens ${CSV_DOCUMENT_POLICY.maximumQueryRelationshipPairs} Spaltenpaare enthalten.`,
    );
  }
  const relationships = relationshipsValue.map((candidate) => {
    const item = requireRecord(candidate);
    requireOnlyKeys(item, ["xColumn", "yColumn", "mode"]);
    if (item.mode !== "population" && item.mode !== "sample") {
      throw new ToolInputError("Der CSV-Beziehungsmodus muss population oder sample sein.");
    }
    const xColumn = csvColumn(item.xColumn);
    const yColumn = csvColumn(item.yColumn);
    if (xColumn.normalize("NFKC").toLocaleLowerCase("de-DE") === yColumn.normalize("NFKC").toLocaleLowerCase("de-DE")) {
      throw new ToolInputError("Ein CSV-Spaltenpaar muss aus zwei verschiedenen Spalten bestehen.");
    }
    return { xColumn, yColumn, mode: item.mode };
  });
  const relationshipKeys = relationships.map((item) =>
    `${item.xColumn.normalize("NFKC").toLocaleLowerCase("de-DE")}\u0000${item.yColumn.normalize("NFKC").toLocaleLowerCase("de-DE")}`,
  );
  if (new Set(relationshipKeys).size !== relationships.length) {
    throw new ToolInputError("CSV-Spaltenpaare dürfen nicht doppelt vorkommen.");
  }
  if (
    relationships.length > 0 &&
    (groupBy.length > 0 || frequencies.length > 0 || histograms.length > 0 || quantiles.length > 0 || outliers.length > 0 || dispersion.length > 0)
  ) {
    throw new ToolInputError(
      "CSV-Kovarianz/Korrelation und andere Verteilungs- oder Gruppenausgaben müssen getrennt abgefragt werden.",
    );
  }
  const regressionsValue = record.regressions ?? [];
  if (!Array.isArray(regressionsValue) || regressionsValue.length > CSV_DOCUMENT_POLICY.maximumQueryRegressionPairs) {
    throw new ToolInputError(`Eine CSV-Abfrage darf höchstens ${CSV_DOCUMENT_POLICY.maximumQueryRegressionPairs} Regressionspaare enthalten.`);
  }
  const regressions = regressionsValue.map((candidate) => {
    const item = requireRecord(candidate);
    requireOnlyKeys(item, ["xColumn", "yColumn", "predictionXValues", "intervalConfidenceLevel"]);
    const xColumn = csvColumn(item.xColumn);
    const yColumn = csvColumn(item.yColumn);
    if (xColumn.normalize("NFKC").toLocaleLowerCase("de-DE") === yColumn.normalize("NFKC").toLocaleLowerCase("de-DE")) {
      throw new ToolInputError("Ein CSV-Regressionspaar muss aus zwei verschiedenen Spalten bestehen.");
    }
    const predictionXValuesValue = item.predictionXValues ?? [];
    if (!Array.isArray(predictionXValuesValue) || predictionXValuesValue.length > CSV_DOCUMENT_POLICY.maximumQueryRegressionPredictionsPerPair) {
      throw new ToolInputError(`Ein CSV-Regressionspaar darf höchstens ${CSV_DOCUMENT_POLICY.maximumQueryRegressionPredictionsPerPair} Vorhersagewerte enthalten.`);
    }
    const predictionXValues = predictionXValuesValue.map((value) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new ToolInputError("CSV-Regressionsvorhersagewerte müssen endliche Zahlen sein.");
      }
      return Object.is(value, -0) ? 0 : value;
    });
    if (new Set(predictionXValues).size !== predictionXValues.length) {
      throw new ToolInputError("CSV-Regressionsvorhersagen dürfen keine doppelten x-Werte enthalten.");
    }
    const intervalConfidenceLevel = item.intervalConfidenceLevel ?? null;
    if (
      intervalConfidenceLevel !== null &&
      (typeof intervalConfidenceLevel !== "number" ||
        !CSV_DOCUMENT_POLICY.supportedRegressionIntervalConfidenceLevels.includes(intervalConfidenceLevel))
    ) {
      throw new ToolInputError("Die CSV-Regressions-Konfidenzstufe muss 0,9, 0,95 oder 0,99 sein.");
    }
    if (intervalConfidenceLevel !== null && predictionXValues.length === 0) {
      throw new ToolInputError("CSV-Regressionsintervalle benötigen mindestens einen Vorhersagewert.");
    }
    return { xColumn, yColumn, predictionXValues, intervalConfidenceLevel };
  });
  const regressionKeys = regressions.map((item) =>
    `${item.xColumn.normalize("NFKC").toLocaleLowerCase("de-DE")}\u0000${item.yColumn.normalize("NFKC").toLocaleLowerCase("de-DE")}`,
  );
  if (new Set(regressionKeys).size !== regressions.length) {
    throw new ToolInputError("CSV-Regressionspaare dürfen nicht doppelt vorkommen.");
  }
  if (regressions.length > 0 && (
    groupBy.length > 0 || frequencies.length > 0 || histograms.length > 0 || quantiles.length > 0 ||
    outliers.length > 0 || dispersion.length > 0 || relationships.length > 0
  )) {
    throw new ToolInputError("CSV-Regression und andere Verteilungs-, Beziehungs- oder Gruppenausgaben müssen getrennt abgefragt werden.");
  }
  return {
    columns,
    filters,
    sort,
    aggregates,
    groupBy,
    frequencies,
    histograms,
    quantiles,
    outliers,
    dispersion,
    relationships,
    regressions,
    offset: boundedInteger(record.offset, 0, 0, CSV_DOCUMENT_POLICY.maximumRows, "CSV-Offset"),
    limit: boundedInteger(
      record.limit,
      10,
      1,
      CSV_DOCUMENT_POLICY.maximumQueryRows,
      "CSV-Limit",
    ),
  };
}

export function normalizeToolInput(
  toolName: ToolName,
  input: unknown,
): Record<string, unknown> {
  const record = requireRecord(input);
  switch (toolName) {
    case "text.sha256":
    case "text.analyze":
    case "json.validate": {
      requireOnlyKeys(record, ["text"]);
      return { text: boundedText(record.text) };
    }
    case "memory.retention": {
      requireOnlyKeys(record, []);
      return {};
    }
    case "web.fetch": {
      requireOnlyKeys(record, ["url"]);
      return { url: normalizePublicHttpsUrl(record.url) };
    }
    case "project.document.inspect": {
      requireOnlyKeys(record, ["documentId", "csvQuery"]);
      return {
        documentId: documentId(record.documentId),
        csvQuery: normalizeCsvQuery(record.csvQuery),
      };
    }
    case "code.patch.inspect": {
      requireOnlyKeys(record, ["patch"]);
      return { patch: normalizePatch(record.patch) };
    }
  }
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function rootType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

async function executeNormalizedTool(input: ToolExecutionContext): Promise<Record<string, unknown>> {
  switch (input.toolName) {
    case "text.sha256": {
      const text = String(input.payload.text);
      return {
        algorithm: "SHA-256",
        digest: await sha256(text),
        characters: text.length,
        sizeBytes: textEncoder.encode(text).byteLength,
      };
    }
    case "text.analyze": {
      const text = String(input.payload.text);
      const trimmed = text.trim();
      return {
        characters: text.length,
        codePoints: [...text].length,
        sizeBytes: textEncoder.encode(text).byteLength,
        words: trimmed ? trimmed.split(/\s+/u).length : 0,
        lines: text ? text.split(/\r\n|\r|\n/u).length : 0,
      };
    }
    case "json.validate": {
      const text = String(input.payload.text);
      try {
        const parsed = JSON.parse(text) as unknown;
        return {
          valid: true,
          rootType: rootType(parsed),
          sizeBytes: textEncoder.encode(text).byteLength,
        };
      } catch (error) {
        return {
          valid: false,
          error: error instanceof SyntaxError
            ? error.message.slice(0, 300)
            : "JSON konnte nicht gelesen werden.",
          sizeBytes: textEncoder.encode(text).byteLength,
        };
      }
    }
    case "memory.retention": {
      await maintainMemoryRetention(input.userId);
      return {
        applied: true,
        policy: "hot-warm-cold-expiry",
      };
    }
    case "web.fetch": {
      return safeFetchPublicText(input.payload.url) as unknown as Record<string, unknown>;
    }
    case "project.document.inspect": {
      return inspectOwnedProjectDocument({
        userId: input.userId,
        projectId: input.projectId,
        documentId: input.payload.documentId,
        csvQuery: input.payload.csvQuery as CsvTableQuery,
      });
    }
    case "code.patch.inspect": {
      return inspectUnifiedDiff(input.payload.patch);
    }
  }
}

export async function executeTool(input: ToolExecutionContext): Promise<ToolExecutionEnvelope> {
  const definition = toolDefinition(input.toolName);
  if (!definition.scopes.includes(input.projectId ? "project" : "account")) {
    throw new ToolExecutionError(
      "Der Werkzeugauftrag passt nicht zu seinem Freigabebereich.",
      "TOOL_SCOPE_MISMATCH",
    );
  }
  const payload = normalizeToolInput(input.toolName, input.payload);
  const inputJson = JSON.stringify(payload);
  const inputBytes = textEncoder.encode(inputJson).byteLength;
  if (inputBytes > definition.maximumInputBytes) {
    throw new ToolInputError("Die normalisierte Werkzeugeingabe überschreitet das Werkzeuglimit.");
  }
  const startedAt = Date.now();
  const result = await executeNormalizedTool({ ...input, payload });
  const durationMs = Date.now() - startedAt;
  if (durationMs > definition.maximumDurationMs + 1_000) {
    throw new ToolExecutionError(
      "Das Werkzeug hat sein Laufzeitbudget überschritten.",
      "TOOL_DURATION_BUDGET_EXCEEDED",
    );
  }
  const outputBytes = textEncoder.encode(JSON.stringify(result)).byteLength;
  if (outputBytes > definition.maximumOutputBytes) {
    throw new ToolExecutionError(
      "Die Werkzeugausgabe überschreitet das definierte Ausgabelimit.",
      "TOOL_OUTPUT_TOO_LARGE",
    );
  }
  return {
    result,
    receipt: {
      toolName: input.toolName,
      deterministic: definition.deterministic,
      externalNetwork: definition.externalNetwork,
      durationMs,
      inputBytes,
      outputBytes,
      maximumDurationMs: definition.maximumDurationMs,
      maximumOutputBytes: definition.maximumOutputBytes,
      maximumNetworkRequests: definition.maximumNetworkRequests,
    },
  };
}
