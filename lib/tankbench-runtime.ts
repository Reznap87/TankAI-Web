import { currentRuntimeBindings } from "@/lib/request-context";

export type TankBenchCategory =
  | "completion"
  | "factuality"
  | "tool_use"
  | "build"
  | "recovery"
  | "safety"
  | "efficiency";

export type TankBenchRunStatus = "collecting" | "passed" | "failed" | "cancelled";
export type TankBenchReleaseStatus =
  | "candidate"
  | "canary"
  | "active"
  | "rejected"
  | "rolled_back"
  | "superseded";

export interface TankBenchAssertions {
  requiredStatus?: "completed" | "failed" | "budget_exhausted" | "model_unavailable";
  answerIncludes?: string[];
  answerExcludes?: string[];
  maxModelCalls?: number;
  maxReviewCalls?: number;
  maxToolActions?: number;
  maxCycles?: number;
  requiresToolNames?: string[];
  requiresCriticApproval?: boolean;
  noRejectedDecisions?: boolean;
}

interface SuiteRow {
  id: string;
  project_id: string;
  name: string;
  description: string;
  status: "frozen" | "archived";
  case_count: number;
  suite_sha256: string;
  version: number;
  created_at: string;
  updated_at: string;
  frozen_at: string | null;
}

interface CaseRow {
  id: string;
  suite_id: string;
  ordinal: number;
  title: string;
  category: TankBenchCategory;
  prompt: string;
  definition_of_done: string;
  assertions_json: string;
  case_sha256: string;
  weight: number;
  required: number;
  created_at: string;
}

interface RunRow {
  id: string;
  suite_id: string;
  project_id: string;
  baseline_label: string;
  candidate_label: string;
  status: TankBenchRunStatus;
  min_score_delta_bps: number;
  max_regressions: number;
  baseline_score_bps: number | null;
  candidate_score_bps: number | null;
  delta_bps: number | null;
  regression_count: number;
  required_failure_count: number;
  safety_failure_count: number;
  version: number;
  created_at: string;
  updated_at: string;
  evaluated_at: string | null;
  completed_at: string | null;
}

interface ResultRow {
  id: string;
  run_id: string;
  case_id: string;
  commander_run_id: string;
  variant: "baseline" | "candidate";
  outcome: "pass" | "fail" | "error";
  score_bps: number;
  checks_passed: number;
  checks_total: number;
  evidence_json: string;
  output_sha256: string;
  created_at: string;
}

interface ReleaseRow {
  id: string;
  source_run_id: string;
  project_id: string;
  label: string;
  status: TankBenchReleaseStatus;
  traffic_percent: number;
  max_error_rate_bps: number;
  max_p95_latency_ms: number;
  min_stage_observations: number;
  stage_observation_offset: number;
  observation_count: number;
  error_count: number;
  rollback_release_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  promoted_at: string | null;
  rolled_back_at: string | null;
}

interface CommanderEvidenceRow {
  id: string;
  project_id: string | null;
  status: string;
  final_answer: string | null;
  model_calls_used: number;
  review_calls_used: number;
  cycle_count: number;
  tool_actions_used: number;
}

export interface TankBenchSuiteRecord {
  id: string;
  projectId: string;
  name: string;
  description: string;
  status: "frozen" | "archived";
  caseCount: number;
  suiteSha256: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  frozenAt: string | null;
}

export interface TankBenchCaseRecord {
  id: string;
  suiteId: string;
  ordinal: number;
  title: string;
  category: TankBenchCategory;
  prompt: string;
  definitionOfDone: string;
  assertions: TankBenchAssertions;
  caseSha256: string;
  weight: number;
  required: boolean;
  createdAt: string;
}

export interface TankBenchRunRecord {
  id: string;
  suiteId: string;
  projectId: string;
  baselineLabel: string;
  candidateLabel: string;
  status: TankBenchRunStatus;
  minScoreDeltaBps: number;
  maxRegressions: number;
  baselineScoreBps: number | null;
  candidateScoreBps: number | null;
  deltaBps: number | null;
  regressionCount: number;
  requiredFailureCount: number;
  safetyFailureCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  evaluatedAt: string | null;
  completedAt: string | null;
}

export interface TankBenchResultRecord {
  id: string;
  runId: string;
  caseId: string;
  commanderRunId: string;
  variant: "baseline" | "candidate";
  outcome: "pass" | "fail" | "error";
  scoreBps: number;
  checksPassed: number;
  checksTotal: number;
  evidence: Record<string, unknown>;
  outputSha256: string;
  createdAt: string;
}

export interface TankBenchReleaseRecord {
  id: string;
  sourceRunId: string;
  projectId: string;
  label: string;
  status: TankBenchReleaseStatus;
  trafficPercent: number;
  maxErrorRateBps: number;
  maxP95LatencyMs: number;
  minStageObservations: number;
  stageObservationOffset: number;
  observationCount: number;
  errorCount: number;
  rollbackReleaseId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  promotedAt: string | null;
  rolledBackAt: string | null;
}

export class TankBenchRuntimeError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = code;
  }
}

function database(): D1Database {
  const db = currentRuntimeBindings().DB;
  if (!db) throw new Error("TankAI D1 ist nicht gebunden.");
  return db;
}

function timestamp(): string {
  return new Date().toISOString();
}

function requiredText(value: unknown, label: string, maximum: number): string {
  if (typeof value !== "string") {
    throw new TankBenchRuntimeError(`${label} fehlt.`, 400, "INVALID_TANKBENCH_INPUT");
  }
  const text = value.trim();
  if (!text || text.length > maximum) {
    throw new TankBenchRuntimeError(
      `${label} fehlt oder überschreitet ${maximum.toLocaleString("de-DE")} Zeichen.`,
      400,
      "INVALID_TANKBENCH_INPUT",
    );
  }
  return text;
}

function boundedInteger(value: unknown, label: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new TankBenchRuntimeError(
      `${label} muss zwischen ${minimum.toLocaleString("de-DE")} und ${maximum.toLocaleString("de-DE")} liegen.`,
      400,
      "INVALID_TANKBENCH_INPUT",
    );
  }
  return Number(value);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function parseJsonRecord(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : { value: parsed };
  } catch {
    return { raw: value };
  }
}

function mapSuite(row: SuiteRow): TankBenchSuiteRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    status: row.status,
    caseCount: Number(row.case_count),
    suiteSha256: row.suite_sha256,
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    frozenAt: row.frozen_at,
  };
}

function mapCase(row: CaseRow): TankBenchCaseRecord {
  return {
    id: row.id,
    suiteId: row.suite_id,
    ordinal: Number(row.ordinal),
    title: row.title,
    category: row.category,
    prompt: row.prompt,
    definitionOfDone: row.definition_of_done,
    assertions: parseJsonRecord(row.assertions_json) as TankBenchAssertions,
    caseSha256: row.case_sha256,
    weight: Number(row.weight),
    required: Boolean(row.required),
    createdAt: row.created_at,
  };
}

function mapRun(row: RunRow): TankBenchRunRecord {
  return {
    id: row.id,
    suiteId: row.suite_id,
    projectId: row.project_id,
    baselineLabel: row.baseline_label,
    candidateLabel: row.candidate_label,
    status: row.status,
    minScoreDeltaBps: Number(row.min_score_delta_bps),
    maxRegressions: Number(row.max_regressions),
    baselineScoreBps: row.baseline_score_bps === null ? null : Number(row.baseline_score_bps),
    candidateScoreBps: row.candidate_score_bps === null ? null : Number(row.candidate_score_bps),
    deltaBps: row.delta_bps === null ? null : Number(row.delta_bps),
    regressionCount: Number(row.regression_count),
    requiredFailureCount: Number(row.required_failure_count),
    safetyFailureCount: Number(row.safety_failure_count),
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    evaluatedAt: row.evaluated_at,
    completedAt: row.completed_at,
  };
}

function mapResult(row: ResultRow): TankBenchResultRecord {
  return {
    id: row.id,
    runId: row.run_id,
    caseId: row.case_id,
    commanderRunId: row.commander_run_id,
    variant: row.variant,
    outcome: row.outcome,
    scoreBps: Number(row.score_bps),
    checksPassed: Number(row.checks_passed),
    checksTotal: Number(row.checks_total),
    evidence: parseJsonRecord(row.evidence_json),
    outputSha256: row.output_sha256,
    createdAt: row.created_at,
  };
}

function mapRelease(row: ReleaseRow): TankBenchReleaseRecord {
  return {
    id: row.id,
    sourceRunId: row.source_run_id,
    projectId: row.project_id,
    label: row.label,
    status: row.status,
    trafficPercent: Number(row.traffic_percent),
    maxErrorRateBps: Number(row.max_error_rate_bps),
    maxP95LatencyMs: Number(row.max_p95_latency_ms),
    minStageObservations: Number(row.min_stage_observations),
    stageObservationOffset: Number(row.stage_observation_offset),
    observationCount: Number(row.observation_count),
    errorCount: Number(row.error_count),
    rollbackReleaseId: row.rollback_release_id,
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    promotedAt: row.promoted_at,
    rolledBackAt: row.rolled_back_at,
  };
}

async function suiteRow(id: string, userId: string): Promise<SuiteRow> {
  const row = await database()
    .prepare("SELECT * FROM tankbench_suites WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first<SuiteRow>();
  if (!row) throw new TankBenchRuntimeError("Die TankBench-Suite wurde nicht gefunden.", 404, "TANKBENCH_SUITE_NOT_FOUND");
  return row;
}

async function runRow(id: string, userId: string): Promise<RunRow> {
  const row = await database()
    .prepare("SELECT * FROM tankbench_runs WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first<RunRow>();
  if (!row) throw new TankBenchRuntimeError("Der TankBench-Lauf wurde nicht gefunden.", 404, "TANKBENCH_RUN_NOT_FOUND");
  return row;
}

async function releaseRow(id: string, userId: string): Promise<ReleaseRow> {
  const row = await database()
    .prepare("SELECT * FROM tankbench_releases WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first<ReleaseRow>();
  if (!row) throw new TankBenchRuntimeError("Der TankBench-Release wurde nicht gefunden.", 404, "TANKBENCH_RELEASE_NOT_FOUND");
  return row;
}

const assertionKeys = new Set([
  "requiredStatus",
  "answerIncludes",
  "answerExcludes",
  "maxModelCalls",
  "maxReviewCalls",
  "maxToolActions",
  "maxCycles",
  "requiresToolNames",
  "requiresCriticApproval",
  "noRejectedDecisions",
]);

function stringList(value: unknown, label: string, maximumItems: number): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > maximumItems) {
    throw new TankBenchRuntimeError(`${label} ist ungültig.`, 400, "INVALID_TANKBENCH_ASSERTIONS");
  }
  const result = value.map((item) => requiredText(item, label, 240));
  return [...new Set(result)];
}

function normalizeAssertions(value: unknown): TankBenchAssertions {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TankBenchRuntimeError("Die Assertions müssen ein JSON-Objekt sein.", 400, "INVALID_TANKBENCH_ASSERTIONS");
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!assertionKeys.has(key)) {
      throw new TankBenchRuntimeError(`Unbekannte TankBench-Assertion: ${key}`, 400, "INVALID_TANKBENCH_ASSERTIONS");
    }
  }
  const result: TankBenchAssertions = {};
  if (record.requiredStatus !== undefined) {
    if (!["completed", "failed", "budget_exhausted", "model_unavailable"].includes(String(record.requiredStatus))) {
      throw new TankBenchRuntimeError("requiredStatus ist ungültig.", 400, "INVALID_TANKBENCH_ASSERTIONS");
    }
    result.requiredStatus = record.requiredStatus as TankBenchAssertions["requiredStatus"];
  }
  result.answerIncludes = stringList(record.answerIncludes, "answerIncludes", 20);
  result.answerExcludes = stringList(record.answerExcludes, "answerExcludes", 20);
  result.requiresToolNames = stringList(record.requiresToolNames, "requiresToolNames", 20);
  for (const [key, maximum] of [
    ["maxModelCalls", 20],
    ["maxReviewCalls", 16],
    ["maxToolActions", 32],
    ["maxCycles", 24],
  ] as const) {
    if (record[key] !== undefined) result[key] = boundedInteger(record[key], key, 0, maximum);
  }
  for (const key of ["requiresCriticApproval", "noRejectedDecisions"] as const) {
    if (record[key] !== undefined) {
      if (typeof record[key] !== "boolean") {
        throw new TankBenchRuntimeError(`${key} muss boolesch sein.`, 400, "INVALID_TANKBENCH_ASSERTIONS");
      }
      result[key] = record[key];
    }
  }
  const count = Object.values(result).reduce((total, item) => {
    if (Array.isArray(item)) return total + item.length;
    return item === undefined ? total : total + 1;
  }, 0);
  if (count < 1 || count > 64) {
    throw new TankBenchRuntimeError("Jeder Fall benötigt 1 bis 64 prüfbare Assertions.", 400, "INVALID_TANKBENCH_ASSERTIONS");
  }
  return Object.fromEntries(Object.entries(result).filter(([, item]) => item !== undefined)) as TankBenchAssertions;
}

export async function createTankBenchSuite(input: {
  userId: string;
  projectId: string;
  name: string;
  description?: string;
  cases: Array<{
    title: string;
    category: TankBenchCategory;
    prompt: string;
    definitionOfDone: string;
    assertions: TankBenchAssertions;
    weight?: number;
    required?: boolean;
  }>;
}): Promise<{ suite: TankBenchSuiteRecord; cases: TankBenchCaseRecord[] }> {
  const project = await database()
    .prepare("SELECT id FROM projects WHERE id = ? AND user_id = ? AND status = 'active'")
    .bind(input.projectId, input.userId)
    .first<{ id: string }>();
  if (!project) throw new TankBenchRuntimeError("Das aktive Projekt wurde nicht gefunden.", 404, "TANKBENCH_PROJECT_NOT_FOUND");
  if (!Array.isArray(input.cases) || input.cases.length < 1 || input.cases.length > 200) {
    throw new TankBenchRuntimeError("Eine Suite benötigt 1 bis 200 Fälle.", 400, "INVALID_TANKBENCH_INPUT");
  }
  const name = requiredText(input.name, "Der Suitename", 160);
  const description = typeof input.description === "string" ? input.description.trim().slice(0, 2_000) : "";
  const categories = new Set<TankBenchCategory>(["completion", "factuality", "tool_use", "build", "recovery", "safety", "efficiency"]);
  const prepared = await Promise.all(input.cases.map(async (item, index) => {
    if (!categories.has(item.category)) throw new TankBenchRuntimeError("Eine Fallkategorie ist ungültig.", 400, "INVALID_TANKBENCH_INPUT");
    const normalized = {
      ordinal: index + 1,
      title: requiredText(item.title, "Der Falltitel", 240),
      category: item.category,
      prompt: requiredText(item.prompt, "Der Testauftrag", 8_000),
      definitionOfDone: requiredText(item.definitionOfDone, "Die Definition of Done", 4_000),
      assertions: normalizeAssertions(item.assertions),
      weight: boundedInteger(item.weight ?? 1, "Das Fallgewicht", 1, 20),
      required: item.required !== false,
    };
    return { ...normalized, hash: await sha256(canonical(normalized)) };
  }));
  const suiteId = crypto.randomUUID();
  const now = timestamp();
  const suiteHash = await sha256(canonical({ name, description, projectId: input.projectId, cases: prepared.map((item) => item.hash) }));
  const statements = [
    database().prepare(
      `INSERT INTO tankbench_suites
       (id,user_id,project_id,name,description,status,case_count,suite_sha256,version,created_at,updated_at,frozen_at)
       VALUES (?,?,?,?,?,'frozen',?,?,1,?,?,?)`,
    ).bind(suiteId, input.userId, input.projectId, name, description, prepared.length, suiteHash, now, now, now),
    ...prepared.map((item) => database().prepare(
      `INSERT INTO tankbench_cases
       (id,suite_id,user_id,ordinal,title,category,prompt,definition_of_done,assertions_json,case_sha256,weight,required,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).bind(crypto.randomUUID(), suiteId, input.userId, item.ordinal, item.title, item.category, item.prompt, item.definitionOfDone, canonical(item.assertions), item.hash, item.weight, item.required ? 1 : 0, now)),
    database().prepare(
      `INSERT INTO tankbench_events
       (id,user_id,suite_id,event_type,entity_version,note,created_at)
       VALUES (?,?,?,'suite_frozen',1,?,?)`,
    ).bind(crypto.randomUUID(), input.userId, suiteId, `Suite mit ${prepared.length.toLocaleString("de-DE")} unveränderlichen Fällen eingefroren.`, now),
  ];
  await database().batch(statements);
  const suite = mapSuite(await suiteRow(suiteId, input.userId));
  const cases = await listCases(suiteId, input.userId);
  return { suite, cases };
}

async function listCases(suiteId: string, userId: string): Promise<TankBenchCaseRecord[]> {
  const rows = await database()
    .prepare("SELECT * FROM tankbench_cases WHERE suite_id = ? AND user_id = ? ORDER BY ordinal")
    .bind(suiteId, userId)
    .all<CaseRow>();
  return rows.results.map(mapCase);
}

export async function createTankBenchRun(input: {
  userId: string;
  suiteId: string;
  baselineLabel: string;
  candidateLabel: string;
  minScoreDeltaBps: number;
  maxRegressions: number;
}): Promise<TankBenchRunRecord> {
  const suite = await suiteRow(input.suiteId, input.userId);
  if (suite.status !== "frozen") throw new TankBenchRuntimeError("Nur eingefrorene Suiten dürfen ausgeführt werden.", 409, "TANKBENCH_SUITE_NOT_FROZEN");
  const baselineLabel = requiredText(input.baselineLabel, "Das Baseline-Label", 160);
  const candidateLabel = requiredText(input.candidateLabel, "Das Kandidaten-Label", 160);
  if (baselineLabel === candidateLabel) throw new TankBenchRuntimeError("Baseline und Kandidat müssen verschieden sein.", 400, "INVALID_TANKBENCH_INPUT");
  const id = crypto.randomUUID();
  const now = timestamp();
  await database().batch([
    database().prepare(
      `INSERT INTO tankbench_runs
       (id,suite_id,user_id,project_id,baseline_label,candidate_label,status,min_score_delta_bps,max_regressions,version,created_at,updated_at)
       VALUES (?,?,?,?,?,?,'collecting',?,?,1,?,?)`,
    ).bind(id, suite.id, input.userId, suite.project_id, baselineLabel, candidateLabel, boundedInteger(input.minScoreDeltaBps, "Das Mindestdelta", -10000, 10000), boundedInteger(input.maxRegressions, "Die maximale Regressionszahl", 0, suite.case_count), now, now),
    database().prepare(
      `INSERT INTO tankbench_events
       (id,user_id,run_id,event_type,entity_version,note,created_at)
       VALUES (?,?,?,'run_created',1,?,?)`,
    ).bind(crypto.randomUUID(), input.userId, id, `${baselineLabel} gegen ${candidateLabel}`, now),
  ]);
  return mapRun(await runRow(id, input.userId));
}

function evaluateChecks(input: {
  assertions: TankBenchAssertions;
  commander: CommanderEvidenceRow;
  toolNames: string[];
  criticApproved: boolean;
  rejectedDecisionCount: number;
}): Array<{ assertion: string; passed: boolean; actual: unknown; expected: unknown }> {
  const { assertions, commander } = input;
  const answer = commander.final_answer ?? "";
  const checks: Array<{ assertion: string; passed: boolean; actual: unknown; expected: unknown }> = [];
  if (assertions.requiredStatus) checks.push({ assertion: "requiredStatus", passed: commander.status === assertions.requiredStatus, actual: commander.status, expected: assertions.requiredStatus });
  for (const text of assertions.answerIncludes ?? []) checks.push({ assertion: `answerIncludes:${text}`, passed: answer.toLocaleLowerCase("de-DE").includes(text.toLocaleLowerCase("de-DE")), actual: answer, expected: text });
  for (const text of assertions.answerExcludes ?? []) checks.push({ assertion: `answerExcludes:${text}`, passed: !answer.toLocaleLowerCase("de-DE").includes(text.toLocaleLowerCase("de-DE")), actual: answer, expected: `nicht enthalten: ${text}` });
  if (assertions.maxModelCalls !== undefined) checks.push({ assertion: "maxModelCalls", passed: commander.model_calls_used <= assertions.maxModelCalls, actual: commander.model_calls_used, expected: assertions.maxModelCalls });
  if (assertions.maxReviewCalls !== undefined) checks.push({ assertion: "maxReviewCalls", passed: commander.review_calls_used <= assertions.maxReviewCalls, actual: commander.review_calls_used, expected: assertions.maxReviewCalls });
  if (assertions.maxToolActions !== undefined) checks.push({ assertion: "maxToolActions", passed: commander.tool_actions_used <= assertions.maxToolActions, actual: commander.tool_actions_used, expected: assertions.maxToolActions });
  if (assertions.maxCycles !== undefined) checks.push({ assertion: "maxCycles", passed: commander.cycle_count <= assertions.maxCycles, actual: commander.cycle_count, expected: assertions.maxCycles });
  for (const toolName of assertions.requiresToolNames ?? []) checks.push({ assertion: `requiresTool:${toolName}`, passed: input.toolNames.includes(toolName), actual: input.toolNames, expected: toolName });
  if (assertions.requiresCriticApproval !== undefined) checks.push({ assertion: "requiresCriticApproval", passed: input.criticApproved === assertions.requiresCriticApproval, actual: input.criticApproved, expected: assertions.requiresCriticApproval });
  if (assertions.noRejectedDecisions !== undefined) checks.push({ assertion: "noRejectedDecisions", passed: (input.rejectedDecisionCount === 0) === assertions.noRejectedDecisions, actual: input.rejectedDecisionCount, expected: assertions.noRejectedDecisions ? 0 : "> 0" });
  return checks;
}

export async function attachCommanderResult(input: {
  userId: string;
  runId: string;
  caseId: string;
  commanderRunId: string;
  variant: "baseline" | "candidate";
  expectedVersion: number;
}): Promise<{ run: TankBenchRunRecord; result: TankBenchResultRecord }> {
  const run = await runRow(input.runId, input.userId);
  if (run.status !== "collecting" || run.version !== input.expectedVersion) {
    throw new TankBenchRuntimeError("Der TankBench-Lauf wurde verändert oder ist nicht mehr offen.", 409, "TANKBENCH_VERSION_CONFLICT");
  }
  const testCase = await database()
    .prepare("SELECT * FROM tankbench_cases WHERE id = ? AND suite_id = ? AND user_id = ?")
    .bind(input.caseId, run.suite_id, input.userId)
    .first<CaseRow>();
  if (!testCase) throw new TankBenchRuntimeError("Der Benchmarkfall gehört nicht zu diesem Lauf.", 404, "TANKBENCH_CASE_NOT_FOUND");
  const commander = await database()
    .prepare(
      `SELECT cr.id,cr.project_id,cr.status,cr.final_answer,cr.model_calls_used,cr.review_calls_used,cr.cycle_count,rr.tool_actions_used
       FROM commander_runs cr JOIN react_runs rr ON rr.id = cr.react_run_id
       WHERE cr.id = ? AND cr.user_id = ?`,
    )
    .bind(input.commanderRunId, input.userId)
    .first<CommanderEvidenceRow>();
  if (!commander || commander.project_id !== run.project_id) {
    throw new TankBenchRuntimeError("Der Commander-Lauf fehlt oder gehört zu einem anderen Projekt.", 404, "TANKBENCH_COMMANDER_RUN_NOT_FOUND");
  }
  const toolRows = await database()
    .prepare("SELECT DISTINCT tool_name FROM commander_decisions WHERE commander_run_id = ? AND user_id = ? AND status = 'accepted' AND tool_name IS NOT NULL")
    .bind(commander.id, input.userId)
    .all<{ tool_name: string }>();
  const critic = await database()
    .prepare("SELECT COUNT(*) AS total FROM commander_events WHERE commander_run_id = ? AND user_id = ? AND event_type = 'review_approved'")
    .bind(commander.id, input.userId)
    .first<{ total: number }>();
  const rejected = await database()
    .prepare("SELECT COUNT(*) AS total FROM commander_decisions WHERE commander_run_id = ? AND user_id = ? AND status = 'rejected'")
    .bind(commander.id, input.userId)
    .first<{ total: number }>();
  const assertions = parseJsonRecord(testCase.assertions_json) as TankBenchAssertions;
  const checks = evaluateChecks({
    assertions,
    commander,
    toolNames: toolRows.results.map((row) => row.tool_name),
    criticApproved: Number(critic?.total ?? 0) > 0,
    rejectedDecisionCount: Number(rejected?.total ?? 0),
  });
  const passed = checks.filter((check) => check.passed).length;
  const score = Math.round((passed / checks.length) * 10000);
  const outcome: "pass" | "fail" | "error" = checks.length === 0 ? "error" : passed === checks.length ? "pass" : "fail";
  const evidence = canonical({
    caseSha256: testCase.case_sha256,
    commanderStatus: commander.status,
    checks,
    metrics: {
      modelCalls: Number(commander.model_calls_used),
      reviewCalls: Number(commander.review_calls_used),
      toolActions: Number(commander.tool_actions_used),
      cycles: Number(commander.cycle_count),
    },
  });
  const outputHash = await sha256(commander.final_answer ?? commander.status);
  const resultId = crypto.randomUUID();
  const now = timestamp();
  const nextVersion = run.version + 1;
  const batch = await database().batch([
    database().prepare(
      `UPDATE tankbench_runs SET version = version + 1, updated_at = ?
       WHERE id = ? AND user_id = ? AND version = ? AND status = 'collecting'`,
    ).bind(now, run.id, input.userId, run.version),
    database().prepare(
      `INSERT INTO tankbench_results
       (id,run_id,case_id,commander_run_id,user_id,variant,outcome,score_bps,checks_passed,checks_total,evidence_json,output_sha256,created_at)
       SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?
       FROM tankbench_runs
       WHERE id=? AND user_id=? AND version=? AND status='collecting' AND changes() = 1`,
    ).bind(resultId, run.id, testCase.id, commander.id, input.userId, input.variant, outcome, score, passed, checks.length, evidence, outputHash, now, run.id, input.userId, nextVersion),
    database().prepare(
      `INSERT INTO tankbench_events
       (id,user_id,run_id,event_type,entity_version,note,created_at)
       SELECT ?,?,?,'case_evaluated',?,?,?
       FROM tankbench_runs
       WHERE id=? AND user_id=? AND version=? AND status='collecting' AND changes() = 1`,
    ).bind(crypto.randomUUID(), input.userId, run.id, nextVersion, `${input.variant}: ${testCase.title} = ${score.toLocaleString("de-DE")} bps`, now, run.id, input.userId, nextVersion),
  ]);
  const changes = Number((batch[0].meta as { changes?: number } | undefined)?.changes ?? 0);
  if (changes !== 1) throw new TankBenchRuntimeError("Der TankBench-Lauf wurde parallel verändert.", 409, "TANKBENCH_VERSION_CONFLICT");
  const row = await database().prepare("SELECT * FROM tankbench_results WHERE id = ?").bind(resultId).first<ResultRow>();
  if (!row) throw new TankBenchRuntimeError("Das Benchmarkresultat wurde nicht gespeichert.", 500, "TANKBENCH_RESULT_MISSING");
  return { run: mapRun(await runRow(run.id, input.userId)), result: mapResult(row) };
}

export async function evaluateTankBenchRun(input: {
  userId: string;
  runId: string;
  expectedVersion: number;
}): Promise<TankBenchRunRecord> {
  const run = await runRow(input.runId, input.userId);
  if (run.status !== "collecting" || run.version !== input.expectedVersion) {
    throw new TankBenchRuntimeError("Der TankBench-Lauf ist nicht auswertbar.", 409, "TANKBENCH_VERSION_CONFLICT");
  }
  const cases = await listCases(run.suite_id, input.userId);
  const rows = await database()
    .prepare("SELECT * FROM tankbench_results WHERE run_id = ? AND user_id = ?")
    .bind(run.id, input.userId)
    .all<ResultRow>();
  if (rows.results.length !== cases.length * 2) {
    throw new TankBenchRuntimeError("Für jeden Fall werden Baseline- und Kandidatenresultat benötigt.", 409, "TANKBENCH_RESULTS_INCOMPLETE");
  }
  const byKey = new Map(rows.results.map((row) => [`${row.case_id}:${row.variant}`, row]));
  let weightTotal = 0;
  let baselineWeighted = 0;
  let candidateWeighted = 0;
  let regressions = 0;
  let requiredFailures = 0;
  let safetyFailures = 0;
  for (const item of cases) {
    const baseline = byKey.get(`${item.id}:baseline`);
    const candidate = byKey.get(`${item.id}:candidate`);
    if (!baseline || !candidate) throw new TankBenchRuntimeError("Ein Benchmarkresultat fehlt.", 409, "TANKBENCH_RESULTS_INCOMPLETE");
    weightTotal += item.weight;
    baselineWeighted += Number(baseline.score_bps) * item.weight;
    candidateWeighted += Number(candidate.score_bps) * item.weight;
    if (Number(candidate.score_bps) < Number(baseline.score_bps)) regressions += 1;
    if (item.required && candidate.outcome !== "pass") requiredFailures += 1;
    if (item.category === "safety" && candidate.outcome !== "pass") safetyFailures += 1;
  }
  const baselineScore = Math.round(baselineWeighted / weightTotal);
  const candidateScore = Math.round(candidateWeighted / weightTotal);
  const delta = candidateScore - baselineScore;
  const passed = delta >= run.min_score_delta_bps && regressions <= run.max_regressions && requiredFailures === 0 && safetyFailures === 0;
  const now = timestamp();
  const nextVersion = run.version + 1;
  const status = passed ? "passed" : "failed";
  const batch = await database().batch([
    database().prepare(
      `UPDATE tankbench_runs
       SET status = ?, baseline_score_bps = ?, candidate_score_bps = ?, delta_bps = ?,
           regression_count = ?, required_failure_count = ?, safety_failure_count = ?,
           version = version + 1, updated_at = ?, evaluated_at = ?, completed_at = ?
       WHERE id = ? AND user_id = ? AND version = ? AND status = 'collecting'`,
    ).bind(status, baselineScore, candidateScore, delta, regressions, requiredFailures, safetyFailures, now, now, now, run.id, input.userId, run.version),
    database().prepare(
      `INSERT INTO tankbench_events
       (id,user_id,run_id,event_type,entity_version,note,created_at)
       SELECT ?,?,?,?,?,?,?
       FROM tankbench_runs
       WHERE id=? AND user_id=? AND version=? AND status=? AND changes() = 1`,
    ).bind(crypto.randomUUID(), input.userId, run.id, passed ? "run_passed" : "run_failed", nextVersion, `Delta ${delta.toLocaleString("de-DE")} bps, Regressionen ${regressions.toLocaleString("de-DE")}, Pflichtfehler ${requiredFailures.toLocaleString("de-DE")}, Safety-Fehler ${safetyFailures.toLocaleString("de-DE")}.`, now, run.id, input.userId, nextVersion, status),
  ]);
  const changes = Number((batch[0].meta as { changes?: number } | undefined)?.changes ?? 0);
  if (changes !== 1) throw new TankBenchRuntimeError("Der TankBench-Lauf wurde parallel verändert.", 409, "TANKBENCH_VERSION_CONFLICT");
  return mapRun(await runRow(run.id, input.userId));
}

export async function createTankBenchRelease(input: {
  userId: string;
  runId: string;
  label: string;
  maxErrorRateBps: number;
  maxP95LatencyMs: number;
  minStageObservations: number;
}): Promise<TankBenchReleaseRecord> {
  const run = await runRow(input.runId, input.userId);
  if (run.status !== "passed") throw new TankBenchRuntimeError("Nur bestandene TankBench-Läufe dürfen Releases erzeugen.", 409, "TANKBENCH_RUN_NOT_PROMOTABLE");
  const existing = await database().prepare("SELECT id FROM tankbench_releases WHERE source_run_id = ? AND user_id = ?").bind(run.id, input.userId).first<{ id: string }>();
  if (existing) throw new TankBenchRuntimeError("Für diesen Lauf existiert bereits ein Release.", 409, "TANKBENCH_RELEASE_EXISTS");
  const id = crypto.randomUUID();
  const now = timestamp();
  await database().batch([
    database().prepare(
      `INSERT INTO tankbench_releases
       (id,source_run_id,user_id,project_id,label,status,traffic_percent,max_error_rate_bps,max_p95_latency_ms,min_stage_observations,stage_observation_offset,observation_count,error_count,version,created_at,updated_at)
       VALUES (?,?,?,?,?,'candidate',0,?,?,?,0,0,0,1,?,?)`,
    ).bind(id, run.id, input.userId, run.project_id, requiredText(input.label, "Das Release-Label", 160), boundedInteger(input.maxErrorRateBps, "Die maximale Fehlerrate", 0, 10000), boundedInteger(input.maxP95LatencyMs, "Die maximale P95-Latenz", 1, 120000), boundedInteger(input.minStageObservations, "Die Mindestbeobachtungen", 3, 1000), now, now),
    database().prepare(
      `INSERT INTO tankbench_events
       (id,user_id,release_id,event_type,entity_version,note,created_at)
       VALUES (?,?,?,'release_created',1,?,?)`,
    ).bind(crypto.randomUUID(), input.userId, id, "Kandidat aus bestandenem TankBench-Lauf erzeugt.", now),
  ]);
  return mapRelease(await releaseRow(id, input.userId));
}

export async function startTankBenchCanary(input: {
  userId: string;
  releaseId: string;
  expectedVersion: number;
}): Promise<TankBenchReleaseRecord> {
  const release = await releaseRow(input.releaseId, input.userId);
  if (release.status !== "candidate" || release.version !== input.expectedVersion) {
    throw new TankBenchRuntimeError("Der Release kann nicht als Canary gestartet werden.", 409, "TANKBENCH_RELEASE_CONFLICT");
  }
  const now = timestamp();
  const nextVersion = release.version + 1;
  const batch = await database().batch([
    database().prepare(
      `UPDATE tankbench_releases SET status='canary',traffic_percent=5,version=version+1,updated_at=?,promoted_at=?
       WHERE id=? AND user_id=? AND version=? AND status='candidate'`,
    ).bind(now, now, release.id, input.userId, release.version),
    database().prepare(
      `INSERT INTO tankbench_events
       (id,user_id,release_id,event_type,entity_version,note,created_at)
       SELECT ?,?,?,'canary_started',?,?,?
       FROM tankbench_releases
       WHERE id=? AND user_id=? AND version=? AND status='canary' AND changes() = 1`,
    ).bind(crypto.randomUUID(), input.userId, release.id, nextVersion, "Canary mit 5 Prozent Traffic gestartet.", now, release.id, input.userId, nextVersion),
  ]);
  const changes = Number((batch[0].meta as { changes?: number } | undefined)?.changes ?? 0);
  if (changes !== 1) throw new TankBenchRuntimeError("Der Release wurde parallel verändert.", 409, "TANKBENCH_RELEASE_CONFLICT");
  return mapRelease(await releaseRow(release.id, input.userId));
}

function percentile95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
}

export async function recordTankBenchCanaryObservation(input: {
  userId: string;
  releaseId: string;
  expectedVersion: number;
  success: boolean;
  latencyMs: number;
  errorCode?: string;
}): Promise<{ release: TankBenchReleaseRecord; evaluatedStage: boolean; errorRateBps: number | null; p95LatencyMs: number | null }> {
  const release = await releaseRow(input.releaseId, input.userId);
  if (release.status !== "canary" || release.version !== input.expectedVersion) {
    throw new TankBenchRuntimeError("Der Canary-Release wurde verändert oder ist nicht aktiv.", 409, "TANKBENCH_RELEASE_CONFLICT");
  }
  const latency = boundedInteger(input.latencyMs, "Die Latenz", 0, 120000);
  const errorCode = input.success ? null : requiredText(input.errorCode, "Der Fehlercode", 120);
  const now = timestamp();
  const batch = await database().batch([
    database().prepare(
      `UPDATE tankbench_releases
       SET observation_count=observation_count+1,error_count=error_count+?,version=version+1,updated_at=?
       WHERE id=? AND user_id=? AND version=? AND status='canary'`,
    ).bind(input.success ? 0 : 1, now, release.id, input.userId, release.version),
    database().prepare(
      `INSERT INTO tankbench_canary_observations
       (id,release_id,user_id,success,latency_ms,error_code,created_at)
       SELECT ?,?,?,?,?,?,?
       FROM tankbench_releases
       WHERE id=? AND user_id=? AND version=? AND status='canary' AND changes() = 1`,
    ).bind(crypto.randomUUID(), release.id, input.userId, input.success ? 1 : 0, latency, errorCode, now, release.id, input.userId, release.version + 1),
  ]);
  const changes = Number((batch[0].meta as { changes?: number } | undefined)?.changes ?? 0);
  if (changes !== 1) throw new TankBenchRuntimeError("Der Canary-Release wurde parallel verändert.", 409, "TANKBENCH_RELEASE_CONFLICT");
  let current = await releaseRow(release.id, input.userId);
  const stageCount = current.observation_count - current.stage_observation_offset;
  if (stageCount < current.min_stage_observations) {
    return { release: mapRelease(current), evaluatedStage: false, errorRateBps: null, p95LatencyMs: null };
  }
  const stageRows = await database()
    .prepare("SELECT success,latency_ms FROM tankbench_canary_observations WHERE release_id=? AND user_id=? ORDER BY created_at,id LIMIT -1 OFFSET ?")
    .bind(current.id, input.userId, current.stage_observation_offset)
    .all<{ success: number; latency_ms: number }>();
  const errors = stageRows.results.filter((row) => !Boolean(row.success)).length;
  const errorRateBps = Math.round((errors / stageRows.results.length) * 10000);
  const p95LatencyMs = percentile95(stageRows.results.map((row) => Number(row.latency_ms)));
  const healthy = errorRateBps <= current.max_error_rate_bps && p95LatencyMs <= current.max_p95_latency_ms;
  const transitionTime = timestamp();
  if (!healthy) {
    const rollback = await database()
      .prepare("SELECT id FROM tankbench_releases WHERE project_id=? AND user_id=? AND status='active' AND id<>? ORDER BY updated_at DESC LIMIT 1")
      .bind(current.project_id, input.userId, current.id)
      .first<{ id: string }>();
    const nextVersion = current.version + 1;
    const rollbackBatch = await database().batch([
      database().prepare(
        `UPDATE tankbench_releases
         SET status='rolled_back',traffic_percent=0,rollback_release_id=?,version=version+1,updated_at=?,rolled_back_at=?
         WHERE id=? AND user_id=? AND version=? AND status='canary'`,
      ).bind(rollback?.id ?? null, transitionTime, transitionTime, current.id, input.userId, current.version),
      database().prepare(
        `INSERT INTO tankbench_events
         (id,user_id,release_id,event_type,entity_version,note,created_at)
         SELECT ?,?,?,'release_rolled_back',?,?,?
         FROM tankbench_releases
         WHERE id=? AND user_id=? AND version=? AND status='rolled_back' AND changes() = 1`,
      ).bind(crypto.randomUUID(), input.userId, current.id, nextVersion, `Automatischer Rollback: Fehlerrate ${errorRateBps.toLocaleString("de-DE")} bps, P95 ${p95LatencyMs.toLocaleString("de-DE")} ms.`, transitionTime, current.id, input.userId, nextVersion),
    ]);
    if (Number((rollbackBatch[0].meta as { changes?: number } | undefined)?.changes ?? 0) !== 1) {
      throw new TankBenchRuntimeError("Der Canary-Release wurde parallel verändert.", 409, "TANKBENCH_RELEASE_CONFLICT");
    }
    current = await releaseRow(current.id, input.userId);
    return { release: mapRelease(current), evaluatedStage: true, errorRateBps, p95LatencyMs };
  }
  const nextTraffic = current.traffic_percent === 5 ? 25 : current.traffic_percent === 25 ? 50 : 100;
  const nextVersion = current.version + 1;
  if (nextTraffic === 100) {
    const activationBatch = await database().batch([
      database().prepare(
        `UPDATE tankbench_releases
         SET status='active',traffic_percent=100,stage_observation_offset=observation_count,version=version+1,updated_at=?,promoted_at=?
         WHERE id=? AND user_id=? AND version=? AND status='canary'`,
      ).bind(transitionTime, transitionTime, current.id, input.userId, current.version),
      database().prepare(
        `INSERT INTO tankbench_events
         (id,user_id,release_id,event_type,entity_version,note,created_at)
         SELECT ?,?,?,'release_activated',?,?,?
         FROM tankbench_releases
         WHERE id=? AND user_id=? AND version=? AND status='active' AND changes() = 1`,
      ).bind(crypto.randomUUID(), input.userId, current.id, nextVersion, `Canary bestanden: Fehlerrate ${errorRateBps.toLocaleString("de-DE")} bps, P95 ${p95LatencyMs.toLocaleString("de-DE")} ms.`, transitionTime, current.id, input.userId, nextVersion),
      database().prepare(
        `UPDATE tankbench_releases SET status='superseded',traffic_percent=0,version=version+1,updated_at=?
         WHERE project_id=? AND user_id=? AND status='active' AND id<>?
           AND EXISTS (SELECT 1 FROM tankbench_releases current_release WHERE current_release.id=? AND current_release.user_id=? AND current_release.version=? AND current_release.status='active')`,
      ).bind(transitionTime, current.project_id, input.userId, current.id, current.id, input.userId, nextVersion),
    ]);
    if (Number((activationBatch[0].meta as { changes?: number } | undefined)?.changes ?? 0) !== 1) {
      throw new TankBenchRuntimeError("Der Canary-Release wurde parallel verändert.", 409, "TANKBENCH_RELEASE_CONFLICT");
    }
  } else {
    const advanceBatch = await database().batch([
      database().prepare(
        `UPDATE tankbench_releases
         SET traffic_percent=?,stage_observation_offset=observation_count,version=version+1,updated_at=?
         WHERE id=? AND user_id=? AND version=? AND status='canary'`,
      ).bind(nextTraffic, transitionTime, current.id, input.userId, current.version),
      database().prepare(
        `INSERT INTO tankbench_events
         (id,user_id,release_id,event_type,entity_version,note,created_at)
         SELECT ?,?,?,'canary_advanced',?,?,?
         FROM tankbench_releases
         WHERE id=? AND user_id=? AND version=? AND status='canary' AND traffic_percent=? AND changes() = 1`,
      ).bind(crypto.randomUUID(), input.userId, current.id, nextVersion, `Canary auf ${nextTraffic.toLocaleString("de-DE")} Prozent erhöht.`, transitionTime, current.id, input.userId, nextVersion, nextTraffic),
    ]);
    if (Number((advanceBatch[0].meta as { changes?: number } | undefined)?.changes ?? 0) !== 1) {
      throw new TankBenchRuntimeError("Der Canary-Release wurde parallel verändert.", 409, "TANKBENCH_RELEASE_CONFLICT");
    }
  }
  current = await releaseRow(current.id, input.userId);
  return { release: mapRelease(current), evaluatedStage: true, errorRateBps, p95LatencyMs };
}

export async function rollbackTankBenchRelease(input: {
  userId: string;
  releaseId: string;
  expectedVersion: number;
  reason: string;
}): Promise<TankBenchReleaseRecord> {
  const release = await releaseRow(input.releaseId, input.userId);
  if (!(release.status === "canary" || release.status === "active") || release.version !== input.expectedVersion) {
    throw new TankBenchRuntimeError("Dieser Release kann nicht zurückgerollt werden.", 409, "TANKBENCH_RELEASE_CONFLICT");
  }
  const rollback = await database()
    .prepare("SELECT id FROM tankbench_releases WHERE project_id=? AND user_id=? AND status IN ('active','superseded') AND id<>? ORDER BY updated_at DESC LIMIT 1")
    .bind(release.project_id, input.userId, release.id)
    .first<{ id: string }>();
  const now = timestamp();
  const nextVersion = release.version + 1;
  const batch = await database().batch([
    database().prepare(
      `UPDATE tankbench_releases SET status='rolled_back',traffic_percent=0,rollback_release_id=?,version=version+1,updated_at=?,rolled_back_at=?
       WHERE id=? AND user_id=? AND version=? AND status IN ('canary','active')`,
    ).bind(rollback?.id ?? null, now, now, release.id, input.userId, release.version),
    database().prepare(
      `INSERT INTO tankbench_events
       (id,user_id,release_id,event_type,entity_version,note,created_at)
       SELECT ?,?,?,'release_rolled_back',?,?,?
       FROM tankbench_releases
       WHERE id=? AND user_id=? AND version=? AND status='rolled_back' AND changes() = 1`,
    ).bind(crypto.randomUUID(), input.userId, release.id, nextVersion, requiredText(input.reason, "Der Rollback-Grund", 1_000), now, release.id, input.userId, nextVersion),
  ]);
  if (Number((batch[0].meta as { changes?: number } | undefined)?.changes ?? 0) !== 1) {
    throw new TankBenchRuntimeError("Der Release wurde parallel verändert.", 409, "TANKBENCH_RELEASE_CONFLICT");
  }
  return mapRelease(await releaseRow(release.id, input.userId));
}

export async function listTankBench(input: {
  userId: string;
  runId?: string;
  releaseId?: string;
}): Promise<{
  suites: Array<TankBenchSuiteRecord & { cases: TankBenchCaseRecord[] }>;
  runs: TankBenchRunRecord[];
  releases: TankBenchReleaseRecord[];
  selectedRun: { run: TankBenchRunRecord; results: TankBenchResultRecord[] } | null;
  selectedRelease: TankBenchReleaseRecord | null;
}> {
  const suiteRows = await database().prepare("SELECT * FROM tankbench_suites WHERE user_id=? ORDER BY updated_at DESC LIMIT 100").bind(input.userId).all<SuiteRow>();
  const suites = await Promise.all(suiteRows.results.map(async (row) => ({ ...mapSuite(row), cases: await listCases(row.id, input.userId) })));
  const runRows = await database().prepare("SELECT * FROM tankbench_runs WHERE user_id=? ORDER BY updated_at DESC LIMIT 100").bind(input.userId).all<RunRow>();
  const releaseRows = await database().prepare("SELECT * FROM tankbench_releases WHERE user_id=? ORDER BY updated_at DESC LIMIT 100").bind(input.userId).all<ReleaseRow>();
  let selectedRun: { run: TankBenchRunRecord; results: TankBenchResultRecord[] } | null = null;
  if (input.runId) {
    const run = await runRow(input.runId, input.userId);
    const results = await database().prepare("SELECT * FROM tankbench_results WHERE run_id=? AND user_id=? ORDER BY created_at").bind(run.id, input.userId).all<ResultRow>();
    selectedRun = { run: mapRun(run), results: results.results.map(mapResult) };
  }
  return {
    suites,
    runs: runRows.results.map(mapRun),
    releases: releaseRows.results.map(mapRelease),
    selectedRun,
    selectedRelease: input.releaseId ? mapRelease(await releaseRow(input.releaseId, input.userId)) : null,
  };
}
