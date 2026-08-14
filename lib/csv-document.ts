const CONTROL_CHARACTER_PATTERN =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const NUMERIC_LITERAL_PATTERN =
  /^[+-]?(?:(?:\d+(?:[.,]\d*)?)|(?:[.,]\d+))(?:e[+-]?\d+)?$/iu;

export const CSV_DOCUMENT_POLICY = Object.freeze({
  delimiters: [",", ";"] as const,
  maximumRows: 500,
  maximumColumns: 50,
  maximumCellCharacters: 2_000,
  maximumHeaderCharacters: 120,
  maximumInjectionSignals: 20,
  maximumQueryFilters: 5,
  maximumQuerySorts: 2,
  maximumQueryColumns: 8,
  maximumQueryRows: 10,
  maximumQueryRowsWithRegressions: 0,
  maximumQueryCellCharacters: 160,
  maximumQueryAggregations: 8,
  maximumQueryGroupColumns: 2,
  maximumQueryGroups: 8,
  maximumQueryFrequencyColumns: 3,
  maximumQueryFrequencyBuckets: 10,
  maximumQueryHistogramColumns: 3,
  minimumQueryHistogramBuckets: 2,
  maximumQueryHistogramBuckets: 12,
  maximumQueryQuantileColumns: 3,
  maximumQueryQuantileProbabilities: 9,
  maximumQueryOutlierColumns: 3,
  maximumQueryOutliersPerColumn: 20,
  outlierFenceMultiplier: 1.5,
  maximumQueryDispersionColumns: 3,
  maximumQueryRelationshipPairs: 3,
  maximumQueryRegressionPairs: 3,
  maximumQueryRegressionResidualsPerPair: 20,
  maximumQueryRegressionPredictionsPerPair: 10,
  supportedRegressionIntervalConfidenceLevels: [0.9, 0.95, 0.99] as const,
});

export interface CsvInjectionSignal {
  row: number;
  column: number;
  preview: string;
}

export interface CsvDocumentAnalysis {
  delimiter: "," | ";";
  columns: number;
  dataRows: number;
  totalRows: number;
  totalCells: number;
  header: string[];
  quotedCells: number;
  multilineCells: number;
  formulaInjectionSignals: CsvInjectionSignal[];
  executableContentRun: false;
}

export type CsvColumnValueType =
  | "null"
  | "boolean"
  | "integer"
  | "number"
  | "iso-date"
  | "iso-datetime"
  | "text";

export interface CsvColumnProfile {
  column: string;
  position: number;
  nullCount: number;
  nonNullCount: number;
  distinctCount: number;
  inferredType: CsvColumnValueType | "mixed";
  typeCounts: Record<CsvColumnValueType, number>;
}

export type CsvFilterOperator =
  | "equals"
  | "not-equals"
  | "contains"
  | "is-null"
  | "not-null"
  | "greater-than"
  | "greater-or-equal"
  | "less-than"
  | "less-or-equal";

export interface CsvTableFilter {
  column: string;
  operator: CsvFilterOperator;
  value?: string;
}

export interface CsvTableSort {
  column: string;
  direction: "asc" | "desc";
}

export type CsvAggregateOperation = "sum" | "minimum" | "maximum" | "average";

export interface CsvTableAggregate {
  column: string;
  operation: CsvAggregateOperation;
}

export interface CsvTableHistogram {
  column: string;
  buckets: number;
}

export interface CsvTableQuantiles {
  column: string;
  probabilities: number[];
}

export interface CsvTableOutliers {
  column: string;
}

export interface CsvTableDispersion {
  column: string;
  mode: "population" | "sample";
}

export interface CsvTableRelationship {
  xColumn: string;
  yColumn: string;
  mode: "population" | "sample";
}

export interface CsvTableRegression {
  xColumn: string;
  yColumn: string;
  predictionXValues?: number[];
  intervalConfidenceLevel?: 0.9 | 0.95 | 0.99;
}

export interface CsvTableQuery {
  columns: string[];
  filters: CsvTableFilter[];
  sort: CsvTableSort[];
  aggregates: CsvTableAggregate[];
  groupBy: string[];
  frequencies: string[];
  histograms: CsvTableHistogram[];
  quantiles: CsvTableQuantiles[];
  outliers: CsvTableOutliers[];
  dispersion: CsvTableDispersion[];
  relationships: CsvTableRelationship[];
  regressions: CsvTableRegression[];
  offset: number;
  limit: number;
}

export interface CsvTableQueryResult {
  policy: {
    emptyCellsAreNull: true;
    textComparison: "trimmed-nfkc-case-folded";
    nullSort: "last";
    maximumFilters: number;
    maximumSorts: number;
    maximumSelectedColumns: number;
    maximumReturnedRows: number;
    maximumReturnedCellCharacters: number;
    maximumAggregations: number;
    maximumGroupColumns: number;
    maximumGroups: number;
    maximumFrequencyColumns: number;
    maximumFrequencyBuckets: number;
    maximumHistogramColumns: number;
    minimumHistogramBuckets: number;
    maximumHistogramBuckets: number;
    maximumQuantileColumns: number;
    maximumQuantileProbabilities: number;
    quantileMethod: "r7-linear";
    maximumOutlierColumns: number;
    maximumOutliersPerColumn: number;
    outlierMethod: "tukey-iqr-r7";
    outlierFenceMultiplier: 1.5;
    maximumDispersionColumns: number;
    aggregationNullPolicy: "exclude-empty-cells";
    aggregationTypePolicy: "numeric-columns-only";
    aggregationPrecision: "15-significant-digits";
  };
  profiles: CsvColumnProfile[];
  query: CsvTableQuery;
  sourceRows: number;
  matchedRows: number;
  aggregates: Array<{
    column: string;
    operation: CsvAggregateOperation;
    sourceType: "integer" | "number" | "null";
    matchedRows: number;
    numericRows: number;
    nullRows: number;
    value: number | null;
  }>;
  totalGroups: number;
  returnedGroups: number;
  truncatedGroups: number;
  groups: Array<{
    keys: Record<string, string | null>;
    matchedRows: number;
    aggregates: CsvTableQueryResult["aggregates"];
  }>;
  frequencies: Array<{
    column: string;
    sourceType: CsvColumnProfile["inferredType"];
    matchedRows: number;
    distinctValues: number;
    returnedBuckets: number;
    truncatedBuckets: number;
    returnedRows: number;
    otherRows: number;
    buckets: Array<{
      value: string | number | boolean | null;
      count: number;
    }>;
  }>;
  histograms: Array<{
    column: string;
    sourceType: "integer" | "number";
    matchedRows: number;
    numericRows: number;
    nullRows: number;
    requestedBuckets: number;
    returnedBuckets: number;
    minimum: number;
    maximum: number;
    intervalWidth: number;
    degenerate: boolean;
    buckets: Array<{
      index: number;
      lowerBound: number;
      upperBound: number;
      lowerInclusive: true;
      upperInclusive: boolean;
      count: number;
    }>;
  }>;
  quantiles: Array<{
    column: string;
    sourceType: "integer" | "number";
    matchedRows: number;
    numericRows: number;
    nullRows: number;
    method: "r7-linear";
    values: Array<{
      probability: number;
      rank: number;
      lowerIndex: number;
      upperIndex: number;
      interpolationWeight: number;
      value: number;
    }>;
  }>;
  outliers: Array<{
    column: string;
    sourceType: "integer" | "number";
    matchedRows: number;
    numericRows: number;
    nullRows: number;
    method: "tukey-iqr-r7";
    fenceMultiplier: 1.5;
    firstQuartile: number;
    thirdQuartile: number;
    interquartileRange: number;
    lowerFence: number;
    upperFence: number;
    totalOutliers: number;
    returnedOutliers: number;
    truncatedOutliers: number;
    values: Array<{
      sourceRow: number;
      value: number;
      direction: "lower" | "upper";
    }>;
  }>;
  dispersion: Array<{
    column: string;
    sourceType: "integer" | "number";
    matchedRows: number;
    numericRows: number;
    nullRows: number;
    method: "welford-one-pass";
    mode: "population" | "sample";
    denominator: number;
    mean: number;
    variance: number;
    standardDeviation: number;
    minimum: number;
    maximum: number;
    range: number;
  }>;
  relationships?: Array<{
    xColumn: string;
    yColumn: string;
    xSourceType: "integer" | "number";
    ySourceType: "integer" | "number";
    matchedRows: number;
    pairedRows: number;
    excludedNullRows: number;
    xNullRows: number;
    yNullRows: number;
    method: "welford-bivariate-one-pass";
    mode: "population" | "sample";
    denominator: number;
    xMean: number;
    yMean: number;
    covariance: number;
    correlation: number | null;
    correlationDefined: boolean;
    correlationUndefinedReason: "zero-variance" | null;
  }>;
  regressions?: Array<{
    xColumn: string;
    yColumn: string;
    xSourceType: "integer" | "number";
    ySourceType: "integer" | "number";
    matchedRows: number;
    pairedRows: number;
    excludedNullRows: number;
    xNullRows: number;
    yNullRows: number;
    method: "ordinary-least-squares-welford";
    equation: "y=intercept+slope*x";
    slope: number;
    intercept: number;
    xMean: number;
    yMean: number;
    rSquared: number | null;
    rSquaredDefined: boolean;
    rSquaredUndefinedReason: "zero-response-variance" | null;
    residualSumSquares: number;
    residualDegreesOfFreedom: number;
    residualMeanSquare: number | null;
    residualStandardError: number | null;
    residualErrorDefined: boolean;
    residualErrorUndefinedReason: "insufficient-degrees-of-freedom" | null;
    observedXMinimum: number;
    observedXMaximum: number;
    predictionUncertaintyMethod: "residual-standard-error-leverage-1sigma";
    residualDiagnosticMethod: "hat-matrix-leverage-internally-studentized";
    leverageThresholdMethod: "twice-average-leverage";
    leverageThreshold: number;
    studentizedResidualThreshold: 2;
    influenceDiagnosticMethod: "cooks-distance-ols-two-parameters";
    cooksDistanceThresholdMethod: "four-over-n";
    cooksDistanceThreshold: number;
    pressMethod: "leave-one-out-residual-over-one-minus-leverage";
    pressSumSquares: number | null;
    pressDefined: boolean;
    pressUndefinedReason: "unit-leverage" | null;
    predictedRSquared: number | null;
    predictedRSquaredDefined: boolean;
    predictedRSquaredUndefinedReason: "unit-leverage" | "zero-response-variance" | null;
    externallyStudentizedResidualMethod: "deleted-mse-n-minus-three";
    externallyStudentizedResidualThreshold: 2;
    intervalMethod: "student-t-two-sided";
    intervalConfidenceLevel: 0.9 | 0.95 | 0.99 | null;
    intervalCriticalValue: number | null;
    predictions: Array<{
      x: number;
      predicted: number;
      range: "interpolation" | "extrapolation-low" | "extrapolation-high";
      uncertaintyDefined: boolean;
      uncertaintyUndefinedReason: "insufficient-degrees-of-freedom" | null;
      meanResponseStandardError: number | null;
      predictionStandardError: number | null;
      intervalDefined: boolean;
      intervalUndefinedReason: "not-requested" | "insufficient-degrees-of-freedom" | null;
      meanResponseConfidenceInterval: { lower: number; upper: number } | null;
      predictionInterval: { lower: number; upper: number } | null;
    }>;
    totalResiduals: number;
    returnedResiduals: number;
    truncatedResiduals: number;
    residuals: Array<{
      sourceRow: number;
      observed: number;
      predicted: number;
      residual: number;
      leverage: number;
      studentizedResidual: number | null;
      studentizedResidualUndefinedReason?: "insufficient-degrees-of-freedom" | "zero-residual-standard-error" | "unit-leverage";
      cooksDistance: number | null;
      pressResidual: number | null;
      externallyStudentizedResidual: number | null;
      externallyStudentizedResidualUndefinedReason?: "insufficient-deleted-degrees-of-freedom" | "zero-deleted-residual-standard-error" | "unit-leverage";
    }>;
  }>;
  returnedRows: number;
  rows: Array<{ sourceRow: number; values: Record<string, string> }>;
  truncatedCellCount: number;
  executableContentRun: false;
  factsVerified: false;
}

export class CsvDocumentValidationError extends Error {
  readonly code = "INVALID_CSV_DOCUMENT";

  constructor(message: string) {
    super(message);
    this.name = "CsvDocumentValidationError";
  }
}

function delimiterFor(content: string): "," | ";" {
  let commaCount = 0;
  let semicolonCount = 0;
  let quoted = false;
  for (let index = content.charCodeAt(0) === 0xfeff ? 1 : 0; index < content.length; index += 1) {
    const character = content[index];
    if (character === '"') {
      if (quoted && content[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (quoted) continue;
    if (character === "\r" || character === "\n") break;
    if (character === ",") commaCount += 1;
    if (character === ";") semicolonCount += 1;
  }
  return semicolonCount > commaCount ? ";" : ",";
}

function injectionSignal(value: string): boolean {
  const candidate = value.trimStart();
  if (!candidate) return false;
  if (candidate.startsWith("=") || candidate.startsWith("@")) return true;
  if (
    (candidate.startsWith("+") || candidate.startsWith("-")) &&
    !NUMERIC_LITERAL_PATTERN.test(candidate.trim())
  ) {
    return true;
  }
  return false;
}

function parseRows(content: string, delimiter: "," | ";"): {
  rows: string[][];
  quotedCells: number;
  multilineCells: number;
} {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;
  let cellWasQuoted = false;
  let cellWasMultiline = false;
  let quotedCells = 0;
  let multilineCells = 0;
  const start = content.charCodeAt(0) === 0xfeff ? 1 : 0;

  const finishCell = () => {
    if (cell.length > CSV_DOCUMENT_POLICY.maximumCellCharacters) {
      throw new CsvDocumentValidationError(
        `Eine CSV-Zelle darf höchstens ${CSV_DOCUMENT_POLICY.maximumCellCharacters.toLocaleString("de-DE")} Zeichen enthalten.`,
      );
    }
    row.push(cell);
    if (cellWasQuoted) quotedCells += 1;
    if (cellWasMultiline) multilineCells += 1;
    cell = "";
    closedQuote = false;
    cellWasQuoted = false;
    cellWasMultiline = false;
  };

  const finishRow = () => {
    finishCell();
    if (row.every((value) => value.length === 0)) {
      throw new CsvDocumentValidationError(
        "Leere CSV-Zeilen sind nicht erlaubt.",
      );
    }
    rows.push(row);
    if (rows.length > CSV_DOCUMENT_POLICY.maximumRows + 1) {
      throw new CsvDocumentValidationError(
        `Eine CSV-Datei darf höchstens ${CSV_DOCUMENT_POLICY.maximumRows.toLocaleString("de-DE")} Datenzeilen enthalten.`,
      );
    }
    row = [];
  };

  for (let index = start; index < content.length; index += 1) {
    const character = content[index];
    if (quoted) {
      if (character === '"') {
        if (content[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        if (character === "\r" || character === "\n") {
          cellWasMultiline = true;
        }
        cell += character;
      }
      continue;
    }
    if (closedQuote && character !== delimiter && character !== "\r" && character !== "\n") {
      throw new CsvDocumentValidationError(
        "Nach einem schließenden CSV-Anführungszeichen ist nur ein Trennzeichen oder Zeilenende erlaubt.",
      );
    }
    if (character === '"' && cell.length === 0 && !closedQuote) {
      quoted = true;
      cellWasQuoted = true;
      continue;
    }
    if (character === '"') {
      throw new CsvDocumentValidationError(
        "CSV-Anführungszeichen müssen eine vollständige Zelle umschließen.",
      );
    }
    if (character === delimiter) {
      finishCell();
      continue;
    }
    if (character === "\r" || character === "\n") {
      if (character === "\r" && content[index + 1] === "\n") index += 1;
      finishRow();
      continue;
    }
    cell += character;
  }
  if (quoted) {
    throw new CsvDocumentValidationError(
      "Die CSV-Datei enthält ein nicht geschlossenes Anführungszeichen.",
    );
  }
  if (row.length > 0 || cell.length > 0 || closedQuote || cellWasQuoted) {
    finishRow();
  }
  return { rows, quotedCells, multilineCells };
}

function parsedCsvDocument(content: string): {
  analysis: CsvDocumentAnalysis;
  rows: string[][];
} {
  if (!content || content.charCodeAt(0) === 0xfeff && content.length === 1) {
    throw new CsvDocumentValidationError("Die CSV-Datei ist leer.");
  }
  if (CONTROL_CHARACTER_PATTERN.test(content)) {
    throw new CsvDocumentValidationError(
      "Die CSV-Datei enthält nicht erlaubte Steuerzeichen.",
    );
  }
  const delimiter = delimiterFor(content);
  const { rows, quotedCells, multilineCells } = parseRows(content, delimiter);
  if (rows.length < 2) {
    throw new CsvDocumentValidationError(
      "Eine CSV-Datei benötigt eine Kopfzeile und mindestens eine Datenzeile.",
    );
  }
  const columns = rows[0].length;
  if (columns < 1 || columns > CSV_DOCUMENT_POLICY.maximumColumns) {
    throw new CsvDocumentValidationError(
      `Eine CSV-Datei darf höchstens ${CSV_DOCUMENT_POLICY.maximumColumns.toLocaleString("de-DE")} Spalten enthalten.`,
    );
  }
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    if (rows[rowIndex].length !== columns) {
      throw new CsvDocumentValidationError(
        `CSV-Zeile ${rowIndex + 1} enthält ${rows[rowIndex].length} statt ${columns} Spalten.`,
      );
    }
  }
  const header = rows[0].map((value) => value.trim());
  if (header.some((value) => value.length === 0)) {
    throw new CsvDocumentValidationError(
      "Jede CSV-Spalte benötigt einen Namen in der Kopfzeile.",
    );
  }
  if (header.some((value) => value.length > CSV_DOCUMENT_POLICY.maximumHeaderCharacters)) {
    throw new CsvDocumentValidationError(
      `Ein CSV-Spaltenname darf höchstens ${CSV_DOCUMENT_POLICY.maximumHeaderCharacters.toLocaleString("de-DE")} Zeichen enthalten.`,
    );
  }
  const normalizedHeaders = header.map((value) => value.normalize("NFKC").toLocaleLowerCase("de-DE"));
  if (new Set(normalizedHeaders).size !== normalizedHeaders.length) {
    throw new CsvDocumentValidationError(
      "CSV-Spaltennamen müssen eindeutig sein.",
    );
  }
  const formulaInjectionSignals: CsvInjectionSignal[] = [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      const value = rows[rowIndex][columnIndex];
      if (
        injectionSignal(value) &&
        formulaInjectionSignals.length < CSV_DOCUMENT_POLICY.maximumInjectionSignals
      ) {
        formulaInjectionSignals.push({
          row: rowIndex + 1,
          column: columnIndex + 1,
          preview: value.slice(0, 80),
        });
      }
    }
  }
  const analysis: CsvDocumentAnalysis = {
    delimiter,
    columns,
    dataRows: rows.length - 1,
    totalRows: rows.length,
    totalCells: rows.length * columns,
    header,
    quotedCells,
    multilineCells,
    formulaInjectionSignals,
    executableContentRun: false,
  };
  return { analysis, rows };
}

export function inspectCsvDocument(content: string): CsvDocumentAnalysis {
  return parsedCsvDocument(content).analysis;
}

export function validateCsvDocument(content: string): CsvDocumentAnalysis {
  const analysis = parsedCsvDocument(content).analysis;
  if (analysis.formulaInjectionSignals.length > 0) {
    const first = analysis.formulaInjectionSignals[0];
    throw new CsvDocumentValidationError(
      `CSV-Formel-Injection ist nicht erlaubt (erste Fundstelle: Zeile ${first.row}, Spalte ${first.column}). Werte müssen als reine Daten gespeichert werden.`,
    );
  }
  return analysis;
}

function canonicalText(value: string): string {
  return value.trim().normalize("NFKC").toLocaleLowerCase("de-DE");
}

function validIsoDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validIsoDateTime(value: string): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/u.test(
      value,
    )
  ) {
    return false;
  }
  return validIsoDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
}

function numericValue(value: string): number | null {
  const candidate = value.trim();
  if (!NUMERIC_LITERAL_PATTERN.test(candidate)) return null;
  const parsed = Number(candidate.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function valueType(value: string): CsvColumnValueType {
  const candidate = value.trim();
  if (!candidate) return "null";
  if (/^(?:true|false)$/iu.test(candidate)) return "boolean";
  if (/^[+-]?\d+$/u.test(candidate)) return "integer";
  if (numericValue(candidate) !== null) return "number";
  if (validIsoDate(candidate)) return "iso-date";
  if (validIsoDateTime(candidate)) return "iso-datetime";
  return "text";
}

function profilesFor(
  header: string[],
  dataRows: string[][],
): CsvColumnProfile[] {
  return header.map((column, columnIndex) => {
    const counts: Record<CsvColumnValueType, number> = {
      null: 0,
      boolean: 0,
      integer: 0,
      number: 0,
      "iso-date": 0,
      "iso-datetime": 0,
      text: 0,
    };
    const distinct = new Set<string>();
    for (const row of dataRows) {
      const value = row[columnIndex];
      const type = valueType(value);
      counts[type] += 1;
      if (type !== "null") distinct.add(canonicalText(value));
    }
    const observedTypes = (
      Object.keys(counts) as CsvColumnValueType[]
    ).filter((type) => type !== "null" && counts[type] > 0);
    const numericOnly =
      observedTypes.length > 0 &&
      observedTypes.every((type) => type === "integer" || type === "number");
    const inferredType: CsvColumnValueType | "mixed" =
      observedTypes.length === 0
        ? "null"
        : numericOnly
          ? counts.number > 0 ? "number" : "integer"
          : observedTypes.length === 1
            ? observedTypes[0]
            : "mixed";
    return {
      column,
      position: columnIndex + 1,
      nullCount: counts.null,
      nonNullCount: dataRows.length - counts.null,
      distinctCount: distinct.size,
      inferredType,
      typeCounts: counts,
    };
  });
}

function resolveColumn(header: string[], requested: string): number {
  const canonical = canonicalText(requested);
  const index = header.findIndex((column) => canonicalText(column) === canonical);
  if (index < 0) {
    throw new CsvDocumentValidationError(
      `Die CSV-Spalte „${requested.slice(0, CSV_DOCUMENT_POLICY.maximumHeaderCharacters)}“ wurde nicht gefunden.`,
    );
  }
  return index;
}

function filterMatches(
  cell: string,
  filter: CsvTableFilter,
): boolean {
  const canonicalCell = canonicalText(cell);
  if (filter.operator === "is-null") return canonicalCell.length === 0;
  if (filter.operator === "not-null") return canonicalCell.length > 0;
  const expected = filter.value ?? "";
  const canonicalExpected = canonicalText(expected);
  if (filter.operator === "equals") return canonicalCell === canonicalExpected;
  if (filter.operator === "not-equals") return canonicalCell !== canonicalExpected;
  if (filter.operator === "contains") return canonicalCell.includes(canonicalExpected);
  const left = numericValue(cell);
  const right = numericValue(expected);
  if (left === null || right === null) return false;
  if (filter.operator === "greater-than") return left > right;
  if (filter.operator === "greater-or-equal") return left >= right;
  if (filter.operator === "less-than") return left < right;
  return left <= right;
}

function compareCells(
  left: string,
  right: string,
): number {
  const leftNull = left.trim().length === 0;
  const rightNull = right.trim().length === 0;
  if (leftNull || rightNull) {
    if (leftNull && rightNull) return 0;
    return leftNull ? 1 : -1;
  }
  const leftNumber = numericValue(left);
  const rightNumber = numericValue(right);
  if (leftNumber !== null && rightNumber !== null) {
    return leftNumber === rightNumber ? 0 : leftNumber < rightNumber ? -1 : 1;
  }
  const leftDate = validIsoDate(left.trim()) || validIsoDateTime(left.trim())
    ? Date.parse(left.trim())
    : null;
  const rightDate = validIsoDate(right.trim()) || validIsoDateTime(right.trim())
    ? Date.parse(right.trim())
    : null;
  if (leftDate !== null && rightDate !== null) {
    return leftDate === rightDate ? 0 : leftDate < rightDate ? -1 : 1;
  }
  const a = canonicalText(left);
  const b = canonicalText(right);
  return a === b ? 0 : a < b ? -1 : 1;
}

function compensatedSum(values: number[]): number {
  let sum = 0;
  let compensation = 0;
  for (const value of values) {
    const next = sum + value;
    compensation += Math.abs(sum) >= Math.abs(value)
      ? (sum - next) + value
      : (value - next) + sum;
    sum = next;
  }
  const result = sum + compensation;
  if (!Number.isFinite(result)) {
    throw new CsvDocumentValidationError(
      "Das Ergebnis der CSV-Aggregation überschreitet den sicheren Zahlenbereich.",
    );
  }
  return normalizedAggregateNumber(result);
}

function normalizedAggregateNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new CsvDocumentValidationError(
      "Das Ergebnis der CSV-Aggregation überschreitet den sicheren Zahlenbereich.",
    );
  }
  const normalized = Number(value.toPrecision(15));
  return Object.is(normalized, -0) ? 0 : normalized;
}

function logGamma(value: number): number {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7,
  ];
  if (value < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  }
  const shifted = value - 1;
  let series = 0.9999999999998099;
  for (let index = 0; index < coefficients.length; index += 1) {
    series += coefficients[index] / (shifted + index + 1);
  }
  const t = shifted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(series);
}

function betaContinuedFraction(a: number, b: number, x: number): number {
  const maximumIterations = 200;
  const epsilon = 3e-14;
  const minimum = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  d = 1 / (Math.abs(d) < minimum ? minimum : d);
  let result = d;
  for (let iteration = 1; iteration <= maximumIterations; iteration += 1) {
    const doubled = 2 * iteration;
    let term = (iteration * (b - iteration) * x) /
      ((qam + doubled) * (a + doubled));
    d = 1 + term * d;
    d = 1 / (Math.abs(d) < minimum ? minimum : d);
    c = 1 + term / c;
    c = Math.abs(c) < minimum ? minimum : c;
    result *= d * c;
    term = -((a + iteration) * (qab + iteration) * x) /
      ((a + doubled) * (qap + doubled));
    d = 1 + term * d;
    d = 1 / (Math.abs(d) < minimum ? minimum : d);
    c = 1 + term / c;
    c = Math.abs(c) < minimum ? minimum : c;
    const delta = d * c;
    result *= delta;
    if (Math.abs(delta - 1) <= epsilon) return result;
  }
  throw new CsvDocumentValidationError("Student-t-Berechnung hat nicht konvergiert.");
}

function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const factor = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log1p(-x),
  );
  return x < (a + 1) / (a + b + 2)
    ? (factor * betaContinuedFraction(a, b, x)) / a
    : 1 - (factor * betaContinuedFraction(b, a, 1 - x)) / b;
}

function studentTCdf(value: number, degreesOfFreedom: number): number {
  const betaArgument = degreesOfFreedom / (degreesOfFreedom + value * value);
  const tail = 0.5 * regularizedIncompleteBeta(betaArgument, degreesOfFreedom / 2, 0.5);
  return value >= 0 ? 1 - tail : tail;
}

function studentTCriticalValue(confidenceLevel: number, degreesOfFreedom: number): number {
  const target = 0.5 + confidenceLevel / 2;
  let lower = 0;
  let upper = 1;
  while (studentTCdf(upper, degreesOfFreedom) < target) {
    upper *= 2;
    if (!Number.isFinite(upper) || upper > 1_000_000) {
      throw new CsvDocumentValidationError("Student-t-Kritikalwert überschreitet den sicheren Zahlenbereich.");
    }
  }
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const middle = (lower + upper) / 2;
    if (studentTCdf(middle, degreesOfFreedom) < target) lower = middle;
    else upper = middle;
  }
  const criticalValue = (lower + upper) / 2;
  if (!Number.isFinite(criticalValue)) {
    throw new CsvDocumentValidationError("Student-t-Kritikalwert überschreitet den sicheren Zahlenbereich.");
  }
  return criticalValue;
}

function aggregateRows(
  header: string[],
  profiles: CsvColumnProfile[],
  rows: Array<{ sourceRow: number; values: string[] }>,
  requested: CsvTableAggregate[],
): CsvTableQueryResult["aggregates"] {
  return requested.map((aggregate) => {
    const columnIndex = resolveColumn(header, aggregate.column);
    const profile = profiles[columnIndex];
    if (
      profile.inferredType !== "integer" &&
      profile.inferredType !== "number" &&
      profile.inferredType !== "null"
    ) {
      throw new CsvDocumentValidationError(
        `Die CSV-Spalte „${profile.column}“ ist nicht rein numerisch und kann nicht aggregiert werden.`,
      );
    }
    const values = rows.flatMap((row) => {
      const cell = row.values[columnIndex];
      if (!cell.trim()) return [];
      const value = numericValue(cell);
      if (value === null) {
        throw new CsvDocumentValidationError(
          `Die CSV-Spalte „${profile.column}“ enthält einen nicht numerischen Aggregationswert.`,
        );
      }
      return [value];
    });
    let value: number | null = null;
    if (values.length > 0) {
      if (aggregate.operation === "minimum") value = normalizedAggregateNumber(Math.min(...values));
      else if (aggregate.operation === "maximum") value = normalizedAggregateNumber(Math.max(...values));
      else {
        const sum = compensatedSum(values);
        value = aggregate.operation === "average"
          ? normalizedAggregateNumber(sum / values.length)
          : sum;
      }
    }
    return {
      column: profile.column,
      operation: aggregate.operation,
      sourceType: profile.inferredType,
      matchedRows: rows.length,
      numericRows: values.length,
      nullRows: rows.length - values.length,
      value,
    };
  });
}

function groupedAggregates(
  header: string[],
  profiles: CsvColumnProfile[],
  rows: Array<{ sourceRow: number; values: string[] }>,
  groupBy: string[],
  requested: CsvTableAggregate[],
): Pick<CsvTableQueryResult, "totalGroups" | "returnedGroups" | "truncatedGroups" | "groups"> {
  if (groupBy.length === 0) {
    return { totalGroups: 0, returnedGroups: 0, truncatedGroups: 0, groups: [] };
  }
  if (groupBy.length > CSV_DOCUMENT_POLICY.maximumQueryGroupColumns) {
    throw new CsvDocumentValidationError(
      `Eine CSV-Abfrage darf höchstens ${CSV_DOCUMENT_POLICY.maximumQueryGroupColumns} Gruppenspalten enthalten.`,
    );
  }
  if (requested.length === 0) {
    throw new CsvDocumentValidationError(
      "Gruppierte CSV-Ausgaben benötigen mindestens eine Aggregation.",
    );
  }
  const indexes = groupBy.map((column) => resolveColumn(header, column));
  if (new Set(indexes).size !== indexes.length) {
    throw new CsvDocumentValidationError("CSV-Gruppenspalten dürfen nicht doppelt vorkommen.");
  }
  const buckets = new Map<string, {
    keys: Record<string, string | null>;
    rows: Array<{ sourceRow: number; values: string[] }>;
  }>();
  for (const row of rows) {
    const keyValues = indexes.map((index) => {
      const value = row.values[index].trim().normalize("NFKC");
      if (value.length > CSV_DOCUMENT_POLICY.maximumQueryCellCharacters) {
        throw new CsvDocumentValidationError(
          `Der Gruppenwert in „${header[index]}“ überschreitet die sichere Ausgabelänge.`,
        );
      }
      return value || null;
    });
    const identity = JSON.stringify(keyValues.map((value) => value === null ? null : canonicalText(value)));
    const existing = buckets.get(identity);
    if (existing) {
      existing.rows.push(row);
      continue;
    }
    buckets.set(identity, {
      keys: Object.fromEntries(indexes.map((index, position) => [header[index], keyValues[position]])),
      rows: [row],
    });
  }
  const allGroups = [...buckets.entries()]
    .sort(([left], [right]) => left === right ? 0 : left < right ? -1 : 1)
    .map(([, bucket]) => ({
      keys: bucket.keys,
      matchedRows: bucket.rows.length,
      aggregates: aggregateRows(header, profiles, bucket.rows, requested),
    }));
  const groups = allGroups.slice(0, CSV_DOCUMENT_POLICY.maximumQueryGroups);
  return {
    totalGroups: allGroups.length,
    returnedGroups: groups.length,
    truncatedGroups: allGroups.length - groups.length,
    groups,
  };
}

function frequencyDistributions(
  header: string[],
  profiles: CsvColumnProfile[],
  rows: Array<{ sourceRow: number; values: string[] }>,
  requested: string[],
  grouped: boolean,
): CsvTableQueryResult["frequencies"] {
  if (grouped && requested.length > 0) {
    throw new CsvDocumentValidationError(
      "CSV-Häufigkeitsverteilungen und gruppierte Aggregationen müssen getrennt abgefragt werden.",
    );
  }
  if (requested.length > CSV_DOCUMENT_POLICY.maximumQueryFrequencyColumns) {
    throw new CsvDocumentValidationError(
      `Eine CSV-Abfrage darf höchstens ${CSV_DOCUMENT_POLICY.maximumQueryFrequencyColumns} Häufigkeitsspalten enthalten.`,
    );
  }
  const indexes = requested.map((column) => resolveColumn(header, column));
  if (new Set(indexes).size !== indexes.length) {
    throw new CsvDocumentValidationError("CSV-Häufigkeitsspalten dürfen nicht doppelt vorkommen.");
  }
  return indexes.map((columnIndex) => {
    const profile = profiles[columnIndex];
    if (profile.inferredType === "mixed") {
      throw new CsvDocumentValidationError(
        `Die CSV-Spalte „${profile.column}“ enthält gemischte Typen und kann nicht als Häufigkeitsverteilung ausgegeben werden.`,
      );
    }
    const counts = new Map<string, { value: string | number | boolean | null; count: number }>();
    for (const row of rows) {
      const raw = row.values[columnIndex].trim().normalize("NFKC");
      let value: string | number | boolean | null;
      let identity: string;
      if (!raw) {
        value = null;
        identity = "null";
      } else if (profile.inferredType === "integer" || profile.inferredType === "number") {
        const numeric = numericValue(raw);
        if (numeric === null || !Number.isFinite(numeric)) {
          throw new CsvDocumentValidationError(
            `Die CSV-Spalte „${profile.column}“ enthält einen ungültigen numerischen Häufigkeitswert.`,
          );
        }
        value = normalizedAggregateNumber(numeric);
        identity = `number:${String(value)}`;
      } else if (profile.inferredType === "boolean") {
        value = raw.toLocaleLowerCase("de-DE") === "true";
        identity = `boolean:${String(value)}`;
      } else {
        if (raw.length > CSV_DOCUMENT_POLICY.maximumQueryCellCharacters) {
          throw new CsvDocumentValidationError(
            `Der Häufigkeitswert in „${profile.column}“ überschreitet die sichere Ausgabelänge.`,
          );
        }
        value = raw;
        identity = `${profile.inferredType}:${canonicalText(raw)}`;
      }
      const existing = counts.get(identity);
      if (existing) existing.count += 1;
      else counts.set(identity, { value, count: 1 });
    }
    const allBuckets = [...counts.entries()]
      .sort(([leftKey, left], [rightKey, right]) =>
        right.count - left.count || (leftKey === rightKey ? 0 : leftKey < rightKey ? -1 : 1),
      )
      .map(([, bucket]) => bucket);
    const buckets = allBuckets.slice(0, CSV_DOCUMENT_POLICY.maximumQueryFrequencyBuckets);
    const returnedRows = buckets.reduce((total, bucket) => total + bucket.count, 0);
    return {
      column: profile.column,
      sourceType: profile.inferredType,
      matchedRows: rows.length,
      distinctValues: allBuckets.length,
      returnedBuckets: buckets.length,
      truncatedBuckets: allBuckets.length - buckets.length,
      returnedRows,
      otherRows: rows.length - returnedRows,
      buckets,
    };
  });
}

function numericHistograms(
  header: string[],
  profiles: CsvColumnProfile[],
  rows: Array<{ sourceRow: number; values: string[] }>,
  requested: CsvTableHistogram[],
  hasGroupedOutput: boolean,
  hasFrequencyOutput: boolean,
): CsvTableQueryResult["histograms"] {
  if ((hasGroupedOutput || hasFrequencyOutput) && requested.length > 0) {
    throw new CsvDocumentValidationError(
      "CSV-Histogramme, Häufigkeitsverteilungen und gruppierte Aggregationen müssen getrennt abgefragt werden.",
    );
  }
  if (requested.length > CSV_DOCUMENT_POLICY.maximumQueryHistogramColumns) {
    throw new CsvDocumentValidationError(
      `Eine CSV-Abfrage darf höchstens ${CSV_DOCUMENT_POLICY.maximumQueryHistogramColumns} Histogrammspalten enthalten.`,
    );
  }
  const indexes = requested.map((item) => resolveColumn(header, item.column));
  if (new Set(indexes).size !== indexes.length) {
    throw new CsvDocumentValidationError("CSV-Histogrammspalten dürfen nicht doppelt vorkommen.");
  }
  return requested.map((item, requestIndex) => {
    if (
      !Number.isInteger(item.buckets) ||
      item.buckets < CSV_DOCUMENT_POLICY.minimumQueryHistogramBuckets ||
      item.buckets > CSV_DOCUMENT_POLICY.maximumQueryHistogramBuckets
    ) {
      throw new CsvDocumentValidationError(
        `Die Histogramm-Bucketzahl muss zwischen ${CSV_DOCUMENT_POLICY.minimumQueryHistogramBuckets} und ${CSV_DOCUMENT_POLICY.maximumQueryHistogramBuckets} liegen.`,
      );
    }
    const columnIndex = indexes[requestIndex];
    const profile = profiles[columnIndex];
    if (profile.inferredType !== "integer" && profile.inferredType !== "number") {
      throw new CsvDocumentValidationError(
        `Die CSV-Spalte „${profile.column}“ ist nicht global numerisch und kann nicht als Histogramm ausgegeben werden.`,
      );
    }
    const values = rows.flatMap((row) => {
      const raw = row.values[columnIndex].trim();
      if (!raw) return [];
      const value = numericValue(raw);
      if (value === null || !Number.isFinite(value)) {
        throw new CsvDocumentValidationError(
          `Die CSV-Spalte „${profile.column}“ enthält einen ungültigen Histogrammwert.`,
        );
      }
      return [value];
    });
    if (values.length === 0) {
      throw new CsvDocumentValidationError(
        `Die CSV-Spalte „${profile.column}“ enthält nach den Filtern keine numerischen Histogrammwerte.`,
      );
    }
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const degenerate = minimum === maximum;
    const returnedBuckets = degenerate ? 1 : item.buckets;
    const intervalWidth = degenerate ? 0 : (maximum - minimum) / item.buckets;
    if (!Number.isFinite(intervalWidth)) {
      throw new CsvDocumentValidationError(
        `Die Histogrammintervalle für „${profile.column}“ sind nicht endlich.`,
      );
    }
    const counts = Array.from({ length: returnedBuckets }, () => 0);
    for (const value of values) {
      const bucketIndex = degenerate
        ? 0
        : Math.min(item.buckets - 1, Math.max(0, Math.floor((value - minimum) / intervalWidth)));
      counts[bucketIndex] += 1;
    }
    return {
      column: profile.column,
      sourceType: profile.inferredType,
      matchedRows: rows.length,
      numericRows: values.length,
      nullRows: rows.length - values.length,
      requestedBuckets: item.buckets,
      returnedBuckets,
      minimum: normalizedAggregateNumber(minimum),
      maximum: normalizedAggregateNumber(maximum),
      intervalWidth: normalizedAggregateNumber(intervalWidth),
      degenerate,
      buckets: counts.map((count, index) => ({
        index,
        lowerBound: normalizedAggregateNumber(degenerate ? minimum : minimum + intervalWidth * index),
        upperBound: normalizedAggregateNumber(
          degenerate || index === returnedBuckets - 1 ? maximum : minimum + intervalWidth * (index + 1),
        ),
        lowerInclusive: true as const,
        upperInclusive: degenerate || index === returnedBuckets - 1,
        count,
      })),
    };
  });
}

function r7Quantile(sortedValues: number[], probability: number): number {
  const rank = (sortedValues.length - 1) * probability;
  const lowerIndex = Math.floor(rank);
  const upperIndex = Math.ceil(rank);
  const interpolationWeight = rank - lowerIndex;
  return lowerIndex === upperIndex
    ? sortedValues[lowerIndex]
    : sortedValues[lowerIndex] * (1 - interpolationWeight) +
        sortedValues[upperIndex] * interpolationWeight;
}

function numericQuantiles(
  header: string[],
  profiles: CsvColumnProfile[],
  rows: Array<{ sourceRow: number; values: string[] }>,
  requested: CsvTableQuantiles[],
  hasGroupedOutput: boolean,
  hasFrequencyOutput: boolean,
  hasHistogramOutput: boolean,
): CsvTableQueryResult["quantiles"] {
  if ((hasGroupedOutput || hasFrequencyOutput || hasHistogramOutput) && requested.length > 0) {
    throw new CsvDocumentValidationError(
      "CSV-Quantile, Histogramme, Häufigkeitsverteilungen und gruppierte Aggregationen müssen getrennt abgefragt werden.",
    );
  }
  if (requested.length > CSV_DOCUMENT_POLICY.maximumQueryQuantileColumns) {
    throw new CsvDocumentValidationError(
      `Eine CSV-Abfrage darf höchstens ${CSV_DOCUMENT_POLICY.maximumQueryQuantileColumns} Quantilspalten enthalten.`,
    );
  }
  const indexes = requested.map((item) => resolveColumn(header, item.column));
  if (new Set(indexes).size !== indexes.length) {
    throw new CsvDocumentValidationError("CSV-Quantilspalten dürfen nicht doppelt vorkommen.");
  }
  return requested.map((item, requestIndex) => {
    if (
      !Array.isArray(item.probabilities) ||
      item.probabilities.length === 0 ||
      item.probabilities.length > CSV_DOCUMENT_POLICY.maximumQueryQuantileProbabilities ||
      item.probabilities.some((probability) =>
        typeof probability !== "number" || !Number.isFinite(probability) || probability < 0 || probability > 1
      )
    ) {
      throw new CsvDocumentValidationError(
        `Quantilwahrscheinlichkeiten müssen als ein bis ${CSV_DOCUMENT_POLICY.maximumQueryQuantileProbabilities} endliche Zahlen zwischen 0 und 1 angegeben werden.`,
      );
    }
    if (new Set(item.probabilities).size !== item.probabilities.length) {
      throw new CsvDocumentValidationError("Quantilwahrscheinlichkeiten dürfen nicht doppelt vorkommen.");
    }
    const columnIndex = indexes[requestIndex];
    const profile = profiles[columnIndex];
    if (profile.inferredType !== "integer" && profile.inferredType !== "number") {
      throw new CsvDocumentValidationError(
        `Die CSV-Spalte „${profile.column}“ ist nicht global numerisch und kann nicht als Quantil ausgegeben werden.`,
      );
    }
    const numericValues = rows.flatMap((row) => {
      const raw = row.values[columnIndex].trim();
      if (!raw) return [];
      const value = numericValue(raw);
      if (value === null || !Number.isFinite(value)) {
        throw new CsvDocumentValidationError(
          `Die CSV-Spalte „${profile.column}“ enthält einen ungültigen Quantilwert.`,
        );
      }
      return [value];
    }).sort((left, right) => left - right);
    if (numericValues.length === 0) {
      throw new CsvDocumentValidationError(
        `Die CSV-Spalte „${profile.column}“ enthält nach den Filtern keine numerischen Quantilwerte.`,
      );
    }
    const values = [...item.probabilities]
      .sort((left, right) => left - right)
      .map((probability) => {
        const rank = (numericValues.length - 1) * probability;
        const lowerIndex = Math.floor(rank);
        const upperIndex = Math.ceil(rank);
        const interpolationWeight = rank - lowerIndex;
        const value = r7Quantile(numericValues, probability);
        if (!Number.isFinite(value)) {
          throw new CsvDocumentValidationError(
            `Das Quantilergebnis für „${profile.column}“ ist nicht endlich.`,
          );
        }
        return {
          probability: normalizedAggregateNumber(probability),
          rank: normalizedAggregateNumber(rank),
          lowerIndex,
          upperIndex,
          interpolationWeight: normalizedAggregateNumber(interpolationWeight),
          value: normalizedAggregateNumber(value),
        };
      });
    return {
      column: profile.column,
      sourceType: profile.inferredType,
      matchedRows: rows.length,
      numericRows: numericValues.length,
      nullRows: rows.length - numericValues.length,
      method: "r7-linear" as const,
      values,
    };
  });
}

function numericOutliers(
  header: string[],
  profiles: CsvColumnProfile[],
  rows: Array<{ sourceRow: number; values: string[] }>,
  requested: CsvTableOutliers[],
  hasGroupedOutput: boolean,
  hasFrequencyOutput: boolean,
  hasHistogramOutput: boolean,
  hasQuantileOutput: boolean,
): CsvTableQueryResult["outliers"] {
  if (
    (hasGroupedOutput || hasFrequencyOutput || hasHistogramOutput || hasQuantileOutput) &&
    requested.length > 0
  ) {
    throw new CsvDocumentValidationError(
      "CSV-Ausreißer, Quantile, Histogramme, Häufigkeitsverteilungen und gruppierte Aggregationen müssen getrennt abgefragt werden.",
    );
  }
  if (requested.length > CSV_DOCUMENT_POLICY.maximumQueryOutlierColumns) {
    throw new CsvDocumentValidationError(
      `Eine CSV-Abfrage darf höchstens ${CSV_DOCUMENT_POLICY.maximumQueryOutlierColumns} Ausreißerspalten enthalten.`,
    );
  }
  const indexes = requested.map((item) => resolveColumn(header, item.column));
  if (new Set(indexes).size !== indexes.length) {
    throw new CsvDocumentValidationError("CSV-Ausreißerspalten dürfen nicht doppelt vorkommen.");
  }
  return requested.map((_, requestIndex) => {
    const columnIndex = indexes[requestIndex];
    const profile = profiles[columnIndex];
    if (profile.inferredType !== "integer" && profile.inferredType !== "number") {
      throw new CsvDocumentValidationError(
        `Die CSV-Spalte „${profile.column}“ ist nicht global numerisch und kann nicht auf Ausreißer geprüft werden.`,
      );
    }
    const numericRows = rows.flatMap((row) => {
      const raw = row.values[columnIndex].trim();
      if (!raw) return [];
      const value = numericValue(raw);
      if (value === null || !Number.isFinite(value)) {
        throw new CsvDocumentValidationError(
          `Die CSV-Spalte „${profile.column}“ enthält einen ungültigen Ausreißerwert.`,
        );
      }
      return [{ sourceRow: row.sourceRow, value }];
    });
    if (numericRows.length === 0) {
      throw new CsvDocumentValidationError(
        `Die CSV-Spalte „${profile.column}“ enthält nach den Filtern keine numerischen Ausreißerwerte.`,
      );
    }
    const sortedValues = numericRows.map(({ value }) => value).sort((left, right) => left - right);
    const firstQuartile = r7Quantile(sortedValues, 0.25);
    const thirdQuartile = r7Quantile(sortedValues, 0.75);
    const interquartileRange = thirdQuartile - firstQuartile;
    const lowerFence = firstQuartile - CSV_DOCUMENT_POLICY.outlierFenceMultiplier * interquartileRange;
    const upperFence = thirdQuartile + CSV_DOCUMENT_POLICY.outlierFenceMultiplier * interquartileRange;
    if (![firstQuartile, thirdQuartile, interquartileRange, lowerFence, upperFence].every(Number.isFinite)) {
      throw new CsvDocumentValidationError(
        `Die IQR-Ausreißergrenzen für „${profile.column}“ sind nicht endlich.`,
      );
    }
    const allOutliers = numericRows
      .filter(({ value }) => value < lowerFence || value > upperFence)
      .sort((left, right) => left.value - right.value || left.sourceRow - right.sourceRow);
    const values = allOutliers
      .slice(0, CSV_DOCUMENT_POLICY.maximumQueryOutliersPerColumn)
      .map(({ sourceRow, value }) => ({
        sourceRow,
        value: normalizedAggregateNumber(value),
        direction: value < lowerFence ? "lower" as const : "upper" as const,
      }));
    return {
      column: profile.column,
      sourceType: profile.inferredType,
      matchedRows: rows.length,
      numericRows: numericRows.length,
      nullRows: rows.length - numericRows.length,
      method: "tukey-iqr-r7" as const,
      fenceMultiplier: CSV_DOCUMENT_POLICY.outlierFenceMultiplier,
      firstQuartile: normalizedAggregateNumber(firstQuartile),
      thirdQuartile: normalizedAggregateNumber(thirdQuartile),
      interquartileRange: normalizedAggregateNumber(interquartileRange),
      lowerFence: normalizedAggregateNumber(lowerFence),
      upperFence: normalizedAggregateNumber(upperFence),
      totalOutliers: allOutliers.length,
      returnedOutliers: values.length,
      truncatedOutliers: allOutliers.length - values.length,
      values,
    };
  });
}

function numericDispersion(
  header: string[],
  profiles: CsvColumnProfile[],
  rows: Array<{ sourceRow: number; values: string[] }>,
  requested: CsvTableDispersion[],
  hasGroupedOutput: boolean,
  hasFrequencyOutput: boolean,
  hasHistogramOutput: boolean,
  hasQuantileOutput: boolean,
  hasOutlierOutput: boolean,
): CsvTableQueryResult["dispersion"] {
  if (
    (hasGroupedOutput || hasFrequencyOutput || hasHistogramOutput || hasQuantileOutput || hasOutlierOutput) &&
    requested.length > 0
  ) {
    throw new CsvDocumentValidationError(
      "CSV-Streuungsstatistik, Ausreißer, Quantile, Histogramme, Häufigkeitsverteilungen und gruppierte Aggregationen müssen getrennt abgefragt werden.",
    );
  }
  if (requested.length > CSV_DOCUMENT_POLICY.maximumQueryDispersionColumns) {
    throw new CsvDocumentValidationError(
      `Eine CSV-Abfrage darf höchstens ${CSV_DOCUMENT_POLICY.maximumQueryDispersionColumns} Streuungsspalten enthalten.`,
    );
  }
  const indexes = requested.map((item) => resolveColumn(header, item.column));
  if (new Set(indexes).size !== indexes.length) {
    throw new CsvDocumentValidationError("CSV-Streuungsspalten dürfen nicht doppelt vorkommen.");
  }
  return requested.map((item, requestIndex) => {
    if (item.mode !== "population" && item.mode !== "sample") {
      throw new CsvDocumentValidationError(
        "Der CSV-Streuungsmodus muss population oder sample sein.",
      );
    }
    const columnIndex = indexes[requestIndex];
    const profile = profiles[columnIndex];
    if (profile.inferredType !== "integer" && profile.inferredType !== "number") {
      throw new CsvDocumentValidationError(
        `Die CSV-Spalte „${profile.column}“ ist nicht global numerisch und kann nicht als Streuungsstatistik ausgegeben werden.`,
      );
    }
    let count = 0;
    let mean = 0;
    let sumSquaredDeviations = 0;
    let minimum = Number.POSITIVE_INFINITY;
    let maximum = Number.NEGATIVE_INFINITY;
    for (const row of rows) {
      const raw = row.values[columnIndex].trim();
      if (!raw) continue;
      const value = numericValue(raw);
      if (value === null || !Number.isFinite(value)) {
        throw new CsvDocumentValidationError(
          `Die CSV-Spalte „${profile.column}“ enthält einen ungültigen Streuungswert.`,
        );
      }
      count += 1;
      const delta = value - mean;
      mean += delta / count;
      const deltaFromUpdatedMean = value - mean;
      sumSquaredDeviations += delta * deltaFromUpdatedMean;
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
      if (![mean, sumSquaredDeviations].every(Number.isFinite)) {
        throw new CsvDocumentValidationError(
          `Die Streuungsstatistik für „${profile.column}“ überschreitet den sicheren Zahlenbereich.`,
        );
      }
    }
    if (count === 0) {
      throw new CsvDocumentValidationError(
        `Die CSV-Spalte „${profile.column}“ enthält nach den Filtern keine numerischen Streuungswerte.`,
      );
    }
    if (item.mode === "sample" && count < 2) {
      throw new CsvDocumentValidationError(
        `Die Stichprobenstreuung für „${profile.column}“ benötigt mindestens zwei numerische Werte.`,
      );
    }
    const denominator = item.mode === "sample" ? count - 1 : count;
    const variance = sumSquaredDeviations / denominator;
    const standardDeviation = Math.sqrt(variance);
    const range = maximum - minimum;
    if (![variance, standardDeviation, range].every(Number.isFinite) || variance < 0) {
      throw new CsvDocumentValidationError(
        `Die Streuungsstatistik für „${profile.column}“ überschreitet den sicheren Zahlenbereich.`,
      );
    }
    return {
      column: profile.column,
      sourceType: profile.inferredType,
      matchedRows: rows.length,
      numericRows: count,
      nullRows: rows.length - count,
      method: "welford-one-pass" as const,
      mode: item.mode,
      denominator,
      mean: normalizedAggregateNumber(mean),
      variance: normalizedAggregateNumber(variance),
      standardDeviation: normalizedAggregateNumber(standardDeviation),
      minimum: normalizedAggregateNumber(minimum),
      maximum: normalizedAggregateNumber(maximum),
      range: normalizedAggregateNumber(range),
    };
  });
}

function numericRelationships(
  header: string[],
  profiles: CsvColumnProfile[],
  rows: Array<{ sourceRow: number; values: string[] }>,
  requested: CsvTableRelationship[],
  hasOtherDistributionOutput: boolean,
): NonNullable<CsvTableQueryResult["relationships"]> {
  if (hasOtherDistributionOutput && requested.length > 0) {
    throw new CsvDocumentValidationError(
      "CSV-Kovarianz/Korrelation und andere Verteilungs- oder Gruppenausgaben müssen getrennt abgefragt werden.",
    );
  }
  if (requested.length > CSV_DOCUMENT_POLICY.maximumQueryRelationshipPairs) {
    throw new CsvDocumentValidationError(
      `Eine CSV-Abfrage darf höchstens ${CSV_DOCUMENT_POLICY.maximumQueryRelationshipPairs} Spaltenpaare enthalten.`,
    );
  }
  const resolved = requested.map((item) => ({
    xIndex: resolveColumn(header, item.xColumn),
    yIndex: resolveColumn(header, item.yColumn),
  }));
  const pairKeys = resolved.map(({ xIndex, yIndex }) => `${xIndex}\u0000${yIndex}`);
  if (new Set(pairKeys).size !== pairKeys.length) {
    throw new CsvDocumentValidationError("CSV-Spaltenpaare dürfen nicht doppelt vorkommen.");
  }
  return requested.map((item, requestIndex) => {
    if (item.mode !== "population" && item.mode !== "sample") {
      throw new CsvDocumentValidationError("Der CSV-Beziehungsmodus muss population oder sample sein.");
    }
    const { xIndex, yIndex } = resolved[requestIndex];
    if (xIndex === yIndex) {
      throw new CsvDocumentValidationError("Ein CSV-Spaltenpaar muss aus zwei verschiedenen Spalten bestehen.");
    }
    const xProfile = profiles[xIndex];
    const yProfile = profiles[yIndex];
    for (const profile of [xProfile, yProfile]) {
      if (profile.inferredType !== "integer" && profile.inferredType !== "number") {
        throw new CsvDocumentValidationError(
          `Die CSV-Spalte „${profile.column}“ ist nicht global numerisch und kann nicht für Kovarianz/Korrelation verwendet werden.`,
        );
      }
    }
    let count = 0;
    let xNullRows = 0;
    let yNullRows = 0;
    let xMean = 0;
    let yMean = 0;
    let xSumSquaredDeviations = 0;
    let ySumSquaredDeviations = 0;
    let coMoment = 0;
    for (const row of rows) {
      const xRaw = row.values[xIndex].trim();
      const yRaw = row.values[yIndex].trim();
      if (!xRaw) xNullRows += 1;
      if (!yRaw) yNullRows += 1;
      if (!xRaw || !yRaw) continue;
      const x = numericValue(xRaw);
      const y = numericValue(yRaw);
      if (x === null || y === null || !Number.isFinite(x) || !Number.isFinite(y)) {
        throw new CsvDocumentValidationError("Ein CSV-Spaltenpaar enthält einen ungültigen numerischen Wert.");
      }
      count += 1;
      const xDelta = x - xMean;
      const yDelta = y - yMean;
      xMean += xDelta / count;
      yMean += yDelta / count;
      xSumSquaredDeviations += xDelta * (x - xMean);
      ySumSquaredDeviations += yDelta * (y - yMean);
      coMoment += xDelta * (y - yMean);
      if (![xMean, yMean, xSumSquaredDeviations, ySumSquaredDeviations, coMoment].every(Number.isFinite)) {
        throw new CsvDocumentValidationError("CSV-Kovarianz/Korrelation überschreitet den sicheren Zahlenbereich.");
      }
    }
    if (count === 0) {
      throw new CsvDocumentValidationError("Das CSV-Spaltenpaar enthält nach Filtern keine vollständigen Zahlenpaare.");
    }
    if (item.mode === "sample" && count < 2) {
      throw new CsvDocumentValidationError("CSV-Stichprobenkovarianz benötigt mindestens zwei vollständige Zahlenpaare.");
    }
    const denominator = item.mode === "sample" ? count - 1 : count;
    const covariance = coMoment / denominator;
    if (!Number.isFinite(covariance) || xSumSquaredDeviations < 0 || ySumSquaredDeviations < 0) {
      throw new CsvDocumentValidationError("CSV-Kovarianz/Korrelation überschreitet den sicheren Zahlenbereich.");
    }
    const correlationDenominator = Math.sqrt(xSumSquaredDeviations * ySumSquaredDeviations);
    const correlationDefined = correlationDenominator > 0 && Number.isFinite(correlationDenominator);
    const correlation = correlationDefined ? coMoment / correlationDenominator : null;
    if (correlation !== null && (!Number.isFinite(correlation) || Math.abs(correlation) > 1 + 1e-12)) {
      throw new CsvDocumentValidationError("CSV-Korrelation überschreitet den sicheren Zahlenbereich.");
    }
    return {
      xColumn: xProfile.column,
      yColumn: yProfile.column,
      xSourceType: xProfile.inferredType,
      ySourceType: yProfile.inferredType,
      matchedRows: rows.length,
      pairedRows: count,
      excludedNullRows: rows.length - count,
      xNullRows,
      yNullRows,
      method: "welford-bivariate-one-pass" as const,
      mode: item.mode,
      denominator,
      xMean: normalizedAggregateNumber(xMean),
      yMean: normalizedAggregateNumber(yMean),
      covariance: normalizedAggregateNumber(covariance),
      correlation: correlation === null ? null : normalizedAggregateNumber(Math.max(-1, Math.min(1, correlation))),
      correlationDefined,
      correlationUndefinedReason: correlationDefined ? null : "zero-variance" as const,
    };
  });
}

function numericRegressions(
  header: string[],
  profiles: CsvColumnProfile[],
  rows: Array<{ sourceRow: number; values: string[] }>,
  requested: CsvTableRegression[],
  hasOtherAnalyticalOutput: boolean,
): NonNullable<CsvTableQueryResult["regressions"]> {
  if (hasOtherAnalyticalOutput && requested.length > 0) {
    throw new CsvDocumentValidationError(
      "CSV-Regression und andere Verteilungs-, Beziehungs- oder Gruppenausgaben müssen getrennt abgefragt werden.",
    );
  }
  if (requested.length > CSV_DOCUMENT_POLICY.maximumQueryRegressionPairs) {
    throw new CsvDocumentValidationError(
      `Eine CSV-Abfrage darf höchstens ${CSV_DOCUMENT_POLICY.maximumQueryRegressionPairs} Regressionspaare enthalten.`,
    );
  }
  const resolved = requested.map((item) => ({
    xIndex: resolveColumn(header, item.xColumn),
    yIndex: resolveColumn(header, item.yColumn),
  }));
  const pairKeys = resolved.map(({ xIndex, yIndex }) => `${xIndex}\u0000${yIndex}`);
  if (new Set(pairKeys).size !== pairKeys.length) {
    throw new CsvDocumentValidationError("CSV-Regressionspaare dürfen nicht doppelt vorkommen.");
  }
  return requested.map((item, requestIndex) => {
    const { xIndex, yIndex } = resolved[requestIndex];
    if (xIndex === yIndex) {
      throw new CsvDocumentValidationError("Ein CSV-Regressionspaar muss aus zwei verschiedenen Spalten bestehen.");
    }
    const xProfile = profiles[xIndex];
    const yProfile = profiles[yIndex];
    for (const profile of [xProfile, yProfile]) {
      if (profile.inferredType !== "integer" && profile.inferredType !== "number") {
        throw new CsvDocumentValidationError(
          `Die CSV-Spalte „${profile.column}“ ist nicht global numerisch und kann nicht für Regression verwendet werden.`,
        );
      }
    }
    const pairs: Array<{ sourceRow: number; x: number; y: number }> = [];
    let xNullRows = 0;
    let yNullRows = 0;
    let xMean = 0;
    let yMean = 0;
    let xSumSquaredDeviations = 0;
    let ySumSquaredDeviations = 0;
    let coMoment = 0;
    for (const row of rows) {
      const xRaw = row.values[xIndex].trim();
      const yRaw = row.values[yIndex].trim();
      if (!xRaw) xNullRows += 1;
      if (!yRaw) yNullRows += 1;
      if (!xRaw || !yRaw) continue;
      const x = numericValue(xRaw);
      const y = numericValue(yRaw);
      if (x === null || y === null || !Number.isFinite(x) || !Number.isFinite(y)) {
        throw new CsvDocumentValidationError("Ein CSV-Regressionspaar enthält einen ungültigen numerischen Wert.");
      }
      pairs.push({ sourceRow: row.sourceRow, x, y });
      const count = pairs.length;
      const xDelta = x - xMean;
      const yDelta = y - yMean;
      xMean += xDelta / count;
      yMean += yDelta / count;
      xSumSquaredDeviations += xDelta * (x - xMean);
      ySumSquaredDeviations += yDelta * (y - yMean);
      coMoment += xDelta * (y - yMean);
      if (![xMean, yMean, xSumSquaredDeviations, ySumSquaredDeviations, coMoment].every(Number.isFinite)) {
        throw new CsvDocumentValidationError("CSV-Regression überschreitet den sicheren Zahlenbereich.");
      }
    }
    if (pairs.length < 2) {
      throw new CsvDocumentValidationError("CSV-Regression benötigt mindestens zwei vollständige Zahlenpaare.");
    }
    if (!(xSumSquaredDeviations > 0)) {
      throw new CsvDocumentValidationError("CSV-Regression ist bei Nullvarianz der x-Spalte nicht definiert.");
    }
    const slope = coMoment / xSumSquaredDeviations;
    const intercept = yMean - slope * xMean;
    const observedXMinimum = Math.min(...pairs.map(({ x }) => x));
    const observedXMaximum = Math.max(...pairs.map(({ x }) => x));
    const allResiduals = pairs.map(({ sourceRow, x, y }) => {
      const predicted = intercept + slope * x;
      const residual = y - predicted;
      if (![predicted, residual].every(Number.isFinite)) {
        throw new CsvDocumentValidationError("CSV-Regression überschreitet den sicheren Zahlenbereich.");
      }
      return { sourceRow, x, observed: y, predicted, residual };
    });
    const residualSumSquares = allResiduals.reduce((sum, item) => sum + item.residual ** 2, 0);
    const residualDegreesOfFreedom = pairs.length - 2;
    const residualErrorDefined = residualDegreesOfFreedom > 0;
    const residualMeanSquare = residualErrorDefined ? residualSumSquares / residualDegreesOfFreedom : null;
    const residualStandardError = residualMeanSquare === null ? null : Math.sqrt(residualMeanSquare);
    const leverageThreshold = 4 / pairs.length;
    const rSquaredDefined = ySumSquaredDeviations > 0;
    const rSquared = rSquaredDefined ? 1 - residualSumSquares / ySumSquaredDeviations : null;
    if (
      ![slope, intercept, residualSumSquares].every(Number.isFinite) ||
      (residualMeanSquare !== null && !Number.isFinite(residualMeanSquare)) ||
      (residualStandardError !== null && !Number.isFinite(residualStandardError)) ||
      (rSquared !== null && (!Number.isFinite(rSquared) || rSquared < -1e-12 || rSquared > 1 + 1e-12))
    ) {
      throw new CsvDocumentValidationError("CSV-Regression überschreitet den sicheren Zahlenbereich.");
    }
    const predictionXValues = item.predictionXValues ?? [];
    const intervalConfidenceLevel = item.intervalConfidenceLevel ?? null;
    if (predictionXValues.length > CSV_DOCUMENT_POLICY.maximumQueryRegressionPredictionsPerPair) {
      throw new CsvDocumentValidationError(
        `Ein CSV-Regressionspaar darf höchstens ${CSV_DOCUMENT_POLICY.maximumQueryRegressionPredictionsPerPair} Vorhersagewerte enthalten.`,
      );
    }
    if (new Set(predictionXValues.map((value) => Object.is(value, -0) ? 0 : value)).size !== predictionXValues.length) {
      throw new CsvDocumentValidationError("CSV-Regressionsvorhersagen dürfen keine doppelten x-Werte enthalten.");
    }
    if (
      intervalConfidenceLevel !== null &&
      !CSV_DOCUMENT_POLICY.supportedRegressionIntervalConfidenceLevels.includes(intervalConfidenceLevel)
    ) {
      throw new CsvDocumentValidationError("Die CSV-Regressions-Konfidenzstufe muss 0,9, 0,95 oder 0,99 sein.");
    }
    if (intervalConfidenceLevel !== null && predictionXValues.length === 0) {
      throw new CsvDocumentValidationError("CSV-Regressionsintervalle benötigen mindestens einen Vorhersagewert.");
    }
    const intervalCriticalValue = intervalConfidenceLevel !== null && residualErrorDefined
      ? studentTCriticalValue(intervalConfidenceLevel, residualDegreesOfFreedom)
      : null;
    const predictions = predictionXValues.map((x) => {
      if (typeof x !== "number" || !Number.isFinite(x)) {
        throw new CsvDocumentValidationError("Ein CSV-Regressionsvorhersagewert ist nicht endlich.");
      }
      const predicted = intercept + slope * x;
      const leverage = 1 / pairs.length + ((x - xMean) ** 2) / xSumSquaredDeviations;
      const meanResponseStandardError = residualStandardError === null
        ? null
        : residualStandardError * Math.sqrt(leverage);
      const predictionStandardError = residualStandardError === null
        ? null
        : residualStandardError * Math.sqrt(1 + leverage);
      const meanResponseMargin = intervalCriticalValue === null || meanResponseStandardError === null
        ? null
        : intervalCriticalValue * meanResponseStandardError;
      const predictionMargin = intervalCriticalValue === null || predictionStandardError === null
        ? null
        : intervalCriticalValue * predictionStandardError;
      if (
        ![predicted, leverage].every(Number.isFinite) || leverage < 0 ||
        (meanResponseStandardError !== null && !Number.isFinite(meanResponseStandardError)) ||
        (predictionStandardError !== null && !Number.isFinite(predictionStandardError)) ||
        (meanResponseMargin !== null && !Number.isFinite(meanResponseMargin)) ||
        (predictionMargin !== null && !Number.isFinite(predictionMargin))
      ) {
        throw new CsvDocumentValidationError("CSV-Regressionsvorhersage überschreitet den sicheren Zahlenbereich.");
      }
      return {
        x: normalizedAggregateNumber(x),
        predicted: normalizedAggregateNumber(predicted),
        range: x < observedXMinimum
          ? "extrapolation-low" as const
          : x > observedXMaximum
            ? "extrapolation-high" as const
            : "interpolation" as const,
        uncertaintyDefined: residualErrorDefined,
        uncertaintyUndefinedReason: residualErrorDefined ? null : "insufficient-degrees-of-freedom" as const,
        meanResponseStandardError: meanResponseStandardError === null ? null : normalizedAggregateNumber(meanResponseStandardError),
        predictionStandardError: predictionStandardError === null ? null : normalizedAggregateNumber(predictionStandardError),
        intervalDefined: intervalCriticalValue !== null,
        intervalUndefinedReason: intervalConfidenceLevel === null
          ? "not-requested" as const
          : intervalCriticalValue === null
            ? "insufficient-degrees-of-freedom" as const
            : null,
        meanResponseConfidenceInterval: meanResponseMargin === null ? null : {
          lower: normalizedAggregateNumber(predicted - meanResponseMargin),
          upper: normalizedAggregateNumber(predicted + meanResponseMargin),
        },
        predictionInterval: predictionMargin === null ? null : {
          lower: normalizedAggregateNumber(predicted - predictionMargin),
          upper: normalizedAggregateNumber(predicted + predictionMargin),
        },
      };
    });
    const allDiagnostics = allResiduals.map((entry) => {
        const rawLeverage = 1 / pairs.length + ((entry.x - xMean) ** 2) / xSumSquaredDeviations;
        if (!Number.isFinite(rawLeverage) || rawLeverage < 0 || rawLeverage > 1 + 1e-12) {
          throw new CsvDocumentValidationError("CSV-Regressionsdiagnostik überschreitet den sicheren Zahlenbereich.");
        }
        const leverage = Math.max(0, Math.min(1, rawLeverage));
        const remainingLeverage = 1 - leverage;
        const studentizedResidualUndefinedReason = !residualErrorDefined
          ? "insufficient-degrees-of-freedom" as const
          : residualStandardError === 0
            ? "zero-residual-standard-error" as const
            : remainingLeverage <= 1e-12
              ? "unit-leverage" as const
              : null;
        const studentizedResidual = studentizedResidualUndefinedReason === null && residualStandardError !== null
          ? entry.residual / (residualStandardError * Math.sqrt(remainingLeverage))
          : null;
        const cooksDistance = studentizedResidual === null
          ? null
          : studentizedResidual ** 2 * leverage / (2 * remainingLeverage);
        const pressResidual = remainingLeverage <= 1e-12
          ? null
          : entry.residual / remainingLeverage;
        const deletedResidualDegreesOfFreedom = residualDegreesOfFreedom - 1;
        const deletedResidualAdjustment = remainingLeverage <= 1e-12
          ? null
          : entry.residual ** 2 / remainingLeverage;
        const rawDeletedResidualSumSquares = deletedResidualAdjustment === null
          ? null
          : residualSumSquares - deletedResidualAdjustment;
        const deletedResidualTolerance = deletedResidualAdjustment === null
          ? 0
          : 1e-12 * Math.max(1, Math.abs(residualSumSquares), Math.abs(deletedResidualAdjustment));
        if (
          rawDeletedResidualSumSquares !== null &&
          (!Number.isFinite(rawDeletedResidualSumSquares) || rawDeletedResidualSumSquares < -deletedResidualTolerance)
        ) {
          throw new CsvDocumentValidationError("CSV-Deleted-Residual-Diagnostik überschreitet den sicheren Zahlenbereich.");
        }
        const deletedResidualSumSquares = rawDeletedResidualSumSquares === null
          ? null
          : Math.abs(rawDeletedResidualSumSquares) <= deletedResidualTolerance
            ? 0
            : rawDeletedResidualSumSquares;
        const externallyStudentizedResidualUndefinedReason = remainingLeverage <= 1e-12
          ? "unit-leverage" as const
          : deletedResidualDegreesOfFreedom <= 0
            ? "insufficient-deleted-degrees-of-freedom" as const
            : deletedResidualSumSquares === 0
              ? "zero-deleted-residual-standard-error" as const
              : null;
        const externallyStudentizedResidual =
          externallyStudentizedResidualUndefinedReason === null && deletedResidualSumSquares !== null
            ? entry.residual / Math.sqrt(
                (deletedResidualSumSquares / deletedResidualDegreesOfFreedom) * remainingLeverage,
              )
            : null;
        if (
          (studentizedResidual !== null && !Number.isFinite(studentizedResidual)) ||
          (cooksDistance !== null && (!Number.isFinite(cooksDistance) || cooksDistance < 0)) ||
          (pressResidual !== null && !Number.isFinite(pressResidual)) ||
          (externallyStudentizedResidual !== null && !Number.isFinite(externallyStudentizedResidual))
        ) {
          throw new CsvDocumentValidationError("CSV-Regressionsdiagnostik überschreitet den sicheren Zahlenbereich.");
        }
        return {
          sourceRow: entry.sourceRow,
          observed: normalizedAggregateNumber(entry.observed),
          predicted: normalizedAggregateNumber(entry.predicted),
          residual: normalizedAggregateNumber(entry.residual),
          leverage: normalizedAggregateNumber(leverage),
          studentizedResidual: studentizedResidual === null ? null : normalizedAggregateNumber(studentizedResidual),
          ...(studentizedResidualUndefinedReason === null ? {} : { studentizedResidualUndefinedReason }),
          cooksDistance: cooksDistance === null ? null : normalizedAggregateNumber(cooksDistance),
          pressResidual: pressResidual === null ? null : normalizedAggregateNumber(pressResidual),
          externallyStudentizedResidual: externallyStudentizedResidual === null
            ? null
            : normalizedAggregateNumber(externallyStudentizedResidual),
          ...(externallyStudentizedResidualUndefinedReason === null
            ? {}
            : { externallyStudentizedResidualUndefinedReason }),
        };
      });
    const pressDefined = allDiagnostics.every(({ pressResidual }) => pressResidual !== null);
    const pressSumSquares = pressDefined
      ? allDiagnostics.reduce((sum, { pressResidual }) => sum + (pressResidual ?? 0) ** 2, 0)
      : null;
    const predictedRSquaredDefined = pressDefined && ySumSquaredDeviations > 0;
    const predictedRSquared = predictedRSquaredDefined && pressSumSquares !== null
      ? 1 - pressSumSquares / ySumSquaredDeviations
      : null;
    if (
      (pressSumSquares !== null && !Number.isFinite(pressSumSquares)) ||
      (predictedRSquared !== null && !Number.isFinite(predictedRSquared))
    ) {
      throw new CsvDocumentValidationError("CSV-PRESS-Diagnostik überschreitet den sicheren Zahlenbereich.");
    }
    const residuals = allDiagnostics.slice(0, CSV_DOCUMENT_POLICY.maximumQueryRegressionResidualsPerPair);
    return {
      xColumn: xProfile.column,
      yColumn: yProfile.column,
      xSourceType: xProfile.inferredType,
      ySourceType: yProfile.inferredType,
      matchedRows: rows.length,
      pairedRows: pairs.length,
      excludedNullRows: rows.length - pairs.length,
      xNullRows,
      yNullRows,
      method: "ordinary-least-squares-welford" as const,
      equation: "y=intercept+slope*x" as const,
      slope: normalizedAggregateNumber(slope),
      intercept: normalizedAggregateNumber(intercept),
      xMean: normalizedAggregateNumber(xMean),
      yMean: normalizedAggregateNumber(yMean),
      rSquared: rSquared === null ? null : normalizedAggregateNumber(Math.max(0, Math.min(1, rSquared))),
      rSquaredDefined,
      rSquaredUndefinedReason: rSquaredDefined ? null : "zero-response-variance" as const,
      residualSumSquares: normalizedAggregateNumber(residualSumSquares),
      residualDegreesOfFreedom,
      residualMeanSquare: residualMeanSquare === null ? null : normalizedAggregateNumber(residualMeanSquare),
      residualStandardError: residualStandardError === null ? null : normalizedAggregateNumber(residualStandardError),
      residualErrorDefined,
      residualErrorUndefinedReason: residualErrorDefined ? null : "insufficient-degrees-of-freedom" as const,
      observedXMinimum: normalizedAggregateNumber(observedXMinimum),
      observedXMaximum: normalizedAggregateNumber(observedXMaximum),
      predictionUncertaintyMethod: "residual-standard-error-leverage-1sigma" as const,
      residualDiagnosticMethod: "hat-matrix-leverage-internally-studentized" as const,
      leverageThresholdMethod: "twice-average-leverage" as const,
      leverageThreshold: normalizedAggregateNumber(leverageThreshold),
      studentizedResidualThreshold: 2 as const,
      influenceDiagnosticMethod: "cooks-distance-ols-two-parameters" as const,
      cooksDistanceThresholdMethod: "four-over-n" as const,
      cooksDistanceThreshold: normalizedAggregateNumber(4 / pairs.length),
      pressMethod: "leave-one-out-residual-over-one-minus-leverage" as const,
      pressSumSquares: pressSumSquares === null ? null : normalizedAggregateNumber(pressSumSquares),
      pressDefined,
      pressUndefinedReason: pressDefined ? null : "unit-leverage" as const,
      predictedRSquared: predictedRSquared === null ? null : normalizedAggregateNumber(predictedRSquared),
      predictedRSquaredDefined,
      predictedRSquaredUndefinedReason: predictedRSquaredDefined
        ? null
        : pressDefined
          ? "zero-response-variance" as const
          : "unit-leverage" as const,
      externallyStudentizedResidualMethod: "deleted-mse-n-minus-three" as const,
      externallyStudentizedResidualThreshold: 2 as const,
      intervalMethod: "student-t-two-sided" as const,
      intervalConfidenceLevel,
      intervalCriticalValue: intervalCriticalValue === null ? null : normalizedAggregateNumber(intervalCriticalValue),
      predictions,
      totalResiduals: allResiduals.length,
      returnedResiduals: residuals.length,
      truncatedResiduals: allResiduals.length - residuals.length,
      residuals,
    };
  });
}

export function queryCsvDocument(
  content: string,
  query: CsvTableQuery,
): CsvTableQueryResult {
  const parsed = parsedCsvDocument(content);
  const firstSignal = parsed.analysis.formulaInjectionSignals[0];
  if (firstSignal) {
    throw new CsvDocumentValidationError(
      `CSV-Formel-Injection ist nicht erlaubt (erste Fundstelle: Zeile ${firstSignal.row}, Spalte ${firstSignal.column}).`,
    );
  }
  const header = parsed.analysis.header;
  const dataRows = parsed.rows.slice(1);
  const profiles = profilesFor(header, dataRows);
  const selected = query.columns.length > 0 ? query.columns : header.slice(0, 8);
  if (selected.length > CSV_DOCUMENT_POLICY.maximumQueryColumns) {
    throw new CsvDocumentValidationError(
      `Eine CSV-Abfrage darf höchstens ${CSV_DOCUMENT_POLICY.maximumQueryColumns} Spalten zurückgeben.`,
    );
  }
  const selectedIndexes = selected.map((column) => resolveColumn(header, column));
  const filterIndexes = query.filters.map((filter) => resolveColumn(header, filter.column));
  const sortIndexes = query.sort.map((sort) => resolveColumn(header, sort.column));
  const groupBy = query.groupBy ?? [];
  const frequencyColumns = query.frequencies ?? [];
  const histogramRequests = query.histograms ?? [];
  const quantileRequests = query.quantiles ?? [];
  const outlierRequests = query.outliers ?? [];
  const dispersionRequests = query.dispersion ?? [];
  const relationshipRequests = query.relationships ?? [];
  const regressionRequests = query.regressions ?? [];
  const indexedRows = dataRows
    .map((values, index) => ({ sourceRow: index + 2, values }))
    .filter((row) =>
      query.filters.every((filter, index) =>
        filterMatches(row.values[filterIndexes[index]], filter),
      ),
    );
  const grouped = groupedAggregates(
    header,
    profiles,
    indexedRows,
    groupBy,
    query.aggregates ?? [],
  );
  const frequencies = frequencyDistributions(
    header,
    profiles,
    indexedRows,
    frequencyColumns,
    groupBy.length > 0,
  );
  const histograms = numericHistograms(
    header,
    profiles,
    indexedRows,
    histogramRequests,
    groupBy.length > 0,
    frequencyColumns.length > 0,
  );
  const quantiles = numericQuantiles(
    header,
    profiles,
    indexedRows,
    quantileRequests,
    groupBy.length > 0,
    frequencyColumns.length > 0,
    histogramRequests.length > 0,
  );
  const outliers = numericOutliers(
    header,
    profiles,
    indexedRows,
    outlierRequests,
    groupBy.length > 0,
    frequencyColumns.length > 0,
    histogramRequests.length > 0,
    quantileRequests.length > 0,
  );
  const dispersion = numericDispersion(
    header,
    profiles,
    indexedRows,
    dispersionRequests,
    groupBy.length > 0,
    frequencyColumns.length > 0,
    histogramRequests.length > 0,
    quantileRequests.length > 0,
    outlierRequests.length > 0,
  );
  const relationships = numericRelationships(
    header,
    profiles,
    indexedRows,
    relationshipRequests,
    groupBy.length > 0 || frequencyColumns.length > 0 || histogramRequests.length > 0 ||
      quantileRequests.length > 0 || outlierRequests.length > 0 || dispersionRequests.length > 0,
  );
  const regressions = numericRegressions(
    header,
    profiles,
    indexedRows,
    regressionRequests,
    groupBy.length > 0 || frequencyColumns.length > 0 || histogramRequests.length > 0 ||
      quantileRequests.length > 0 || outlierRequests.length > 0 || dispersionRequests.length > 0 ||
      relationshipRequests.length > 0,
  );
  indexedRows.sort((left, right) => {
    for (let index = 0; index < query.sort.length; index += 1) {
      const leftCell = left.values[sortIndexes[index]];
      const rightCell = right.values[sortIndexes[index]];
      const leftNull = leftCell.trim().length === 0;
      const rightNull = rightCell.trim().length === 0;
      if (leftNull !== rightNull) return leftNull ? 1 : -1;
      const order = compareCells(
        leftCell,
        rightCell,
      );
      if (order !== 0) {
        return query.sort[index].direction === "desc" ? -order : order;
      }
    }
    return left.sourceRow - right.sourceRow;
  });
  const aggregates = aggregateRows(
    header,
    profiles,
    indexedRows,
    query.aggregates ?? [],
  );
  const maximumReturnedRows = regressions.length > 0
    ? CSV_DOCUMENT_POLICY.maximumQueryRowsWithRegressions
    : CSV_DOCUMENT_POLICY.maximumQueryRows;
  let truncatedCellCount = 0;
  const rows = indexedRows
    .slice(query.offset, query.offset + Math.min(query.limit, maximumReturnedRows))
    .map((row) => ({
      sourceRow: row.sourceRow,
      values: Object.fromEntries(
        selected.map((column, index) => {
          const value = row.values[selectedIndexes[index]];
          if (value.length > CSV_DOCUMENT_POLICY.maximumQueryCellCharacters) {
            truncatedCellCount += 1;
          }
          return [
            header[selectedIndexes[index]],
            value.slice(0, CSV_DOCUMENT_POLICY.maximumQueryCellCharacters),
          ];
        }),
      ),
    }));
  return {
    policy: {
      emptyCellsAreNull: true,
      textComparison: "trimmed-nfkc-case-folded",
      nullSort: "last",
      maximumFilters: CSV_DOCUMENT_POLICY.maximumQueryFilters,
      maximumSorts: CSV_DOCUMENT_POLICY.maximumQuerySorts,
      maximumSelectedColumns: CSV_DOCUMENT_POLICY.maximumQueryColumns,
      maximumReturnedRows,
      maximumReturnedCellCharacters: CSV_DOCUMENT_POLICY.maximumQueryCellCharacters,
      maximumAggregations: CSV_DOCUMENT_POLICY.maximumQueryAggregations,
      maximumGroupColumns: CSV_DOCUMENT_POLICY.maximumQueryGroupColumns,
      maximumGroups: CSV_DOCUMENT_POLICY.maximumQueryGroups,
      maximumFrequencyColumns: CSV_DOCUMENT_POLICY.maximumQueryFrequencyColumns,
      maximumFrequencyBuckets: CSV_DOCUMENT_POLICY.maximumQueryFrequencyBuckets,
      maximumHistogramColumns: CSV_DOCUMENT_POLICY.maximumQueryHistogramColumns,
      minimumHistogramBuckets: CSV_DOCUMENT_POLICY.minimumQueryHistogramBuckets,
      maximumHistogramBuckets: CSV_DOCUMENT_POLICY.maximumQueryHistogramBuckets,
      maximumQuantileColumns: CSV_DOCUMENT_POLICY.maximumQueryQuantileColumns,
      maximumQuantileProbabilities: CSV_DOCUMENT_POLICY.maximumQueryQuantileProbabilities,
      quantileMethod: "r7-linear",
      maximumOutlierColumns: CSV_DOCUMENT_POLICY.maximumQueryOutlierColumns,
      maximumOutliersPerColumn: CSV_DOCUMENT_POLICY.maximumQueryOutliersPerColumn,
      outlierMethod: "tukey-iqr-r7",
      outlierFenceMultiplier: CSV_DOCUMENT_POLICY.outlierFenceMultiplier,
      maximumDispersionColumns: CSV_DOCUMENT_POLICY.maximumQueryDispersionColumns,
      aggregationNullPolicy: "exclude-empty-cells",
      aggregationTypePolicy: "numeric-columns-only",
      aggregationPrecision: "15-significant-digits",
    },
    profiles,
    query: {
      ...query,
      columns: selected.map((_, index) => header[selectedIndexes[index]]),
      aggregates: aggregates.map(({ column, operation }) => ({ column, operation })),
      groupBy: groupBy.map((column) => header[resolveColumn(header, column)]),
      frequencies: frequencies.map(({ column }) => column),
      histograms: histograms.map(({ column }, index) => ({
        column,
        buckets: histogramRequests[index].buckets,
      })),
      quantiles: quantiles.map(({ column }, index) => ({
        column,
        probabilities: [...quantileRequests[index].probabilities].sort((left, right) => left - right),
      })),
      outliers: outliers.map(({ column }) => ({ column })),
      dispersion: dispersion.map(({ column, mode }) => ({ column, mode })),
      ...(relationships.length > 0 ? {
        relationships: relationships.map(({ xColumn, yColumn, mode }) => ({ xColumn, yColumn, mode })),
      } : {}),
      ...(regressions.length > 0 ? {
        regressions: regressions.map(({ xColumn, yColumn }, index) => ({
          xColumn,
          yColumn,
          predictionXValues: regressionRequests[index].predictionXValues ?? [],
          intervalConfidenceLevel: regressionRequests[index].intervalConfidenceLevel ?? null,
        })),
      } : {}),
    },
    sourceRows: dataRows.length,
    matchedRows: indexedRows.length,
    aggregates,
    ...grouped,
    frequencies,
    histograms,
    quantiles,
    outliers,
    dispersion,
    ...(relationships.length > 0 ? { relationships } : {}),
    ...(regressions.length > 0 ? { regressions } : {}),
    returnedRows: rows.length,
    rows,
    truncatedCellCount,
    executableContentRun: false,
    factsVerified: false,
  };
}
