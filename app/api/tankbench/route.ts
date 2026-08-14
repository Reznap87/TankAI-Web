import { requireApiIdentity } from "@/lib/auth";
import { jsonResponse } from "@/lib/api-response";
import {
  attachCommanderResult,
  createTankBenchRelease,
  createTankBenchRun,
  createTankBenchSuite,
  evaluateTankBenchRun,
  listTankBench,
  recordTankBenchCanaryObservation,
  rollbackTankBenchRelease,
  startTankBenchCanary,
  TankBenchRuntimeError,
  type TankBenchCategory,
  type TankBenchAssertions,
} from "@/lib/tankbench-runtime";

class TankBenchValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TankBenchValidationError";
  }
}

function responseError(error: unknown): Response {
  if (error instanceof TankBenchRuntimeError) {
    return jsonResponse({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof TankBenchValidationError) {
    return jsonResponse({ error: error.message, code: "INVALID_TANKBENCH_REQUEST" }, { status: 400 });
  }
  console.error("TankBench API error", error);
  return jsonResponse({ error: "TankBench konnte die Anfrage nicht verarbeiten." }, { status: 500 });
}

function sameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new TankBenchValidationError("Die Anfrage stammt nicht von TankAI Web.");
  }
}

async function bodyRecord(request: Request): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 160_000) {
    throw new TankBenchValidationError("Der Anfragekörper ist zu groß.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new TankBenchValidationError("Der Anfragekörper ist kein gültiges JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new TankBenchValidationError("Der Anfragekörper muss ein JSON-Objekt sein.");
  }
  return parsed as Record<string, unknown>;
}

function onlyKeys(record: Record<string, unknown>, allowed: string[]): void {
  const allowedSet = new Set(allowed);
  if (Object.keys(record).some((key) => !allowedSet.has(key))) {
    throw new TankBenchValidationError("Die Anfrage enthält unbekannte TankBench-Felder.");
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function identifier(value: unknown, label: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!UUID_PATTERN.test(text)) throw new TankBenchValidationError(`${label} ist ungültig.`);
  return text;
}

function optionalIdentifier(value: unknown, label: string): string | undefined {
  return value === undefined || value === null || value === "" ? undefined : identifier(value, label);
}

function text(value: unknown, label: string, maximum: number): string {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result || result.length > maximum) throw new TankBenchValidationError(`${label} fehlt oder ist zu lang.`);
  return result;
}

function integer(value: unknown, label: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new TankBenchValidationError(`${label} muss zwischen ${minimum} und ${maximum} liegen.`);
  }
  return Number(value);
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new TankBenchValidationError(`${label} muss boolesch sein.`);
  return value;
}

const categories = new Set<TankBenchCategory>([
  "completion",
  "factuality",
  "tool_use",
  "build",
  "recovery",
  "safety",
  "efficiency",
]);

function suiteCases(value: unknown): Array<{
  title: string;
  category: TankBenchCategory;
  prompt: string;
  definitionOfDone: string;
  assertions: TankBenchAssertions;
  weight?: number;
  required?: boolean;
}> {
  if (!Array.isArray(value) || value.length < 1 || value.length > 200) {
    throw new TankBenchValidationError("cases muss 1 bis 200 Benchmarkfälle enthalten.");
  }
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new TankBenchValidationError("Jeder Benchmarkfall muss ein JSON-Objekt sein.");
    }
    const record = item as Record<string, unknown>;
    onlyKeys(record, ["title", "category", "prompt", "definitionOfDone", "assertions", "weight", "required"]);
    if (!categories.has(record.category as TankBenchCategory)) {
      throw new TankBenchValidationError("Eine Benchmarkkategorie ist ungültig.");
    }
    if (!record.assertions || typeof record.assertions !== "object" || Array.isArray(record.assertions)) {
      throw new TankBenchValidationError("assertions muss ein JSON-Objekt sein.");
    }
    return {
      title: text(record.title, "Der Falltitel", 240),
      category: record.category as TankBenchCategory,
      prompt: text(record.prompt, "Der Testauftrag", 8_000),
      definitionOfDone: text(record.definitionOfDone, "Die Definition of Done", 4_000),
      assertions: record.assertions as TankBenchAssertions,
      ...(record.weight === undefined ? {} : { weight: integer(record.weight, "Das Gewicht", 1, 20) }),
      ...(record.required === undefined ? {} : { required: boolean(record.required, "required") }),
    };
  });
}

export async function GET(request: Request) {
  try {
    const identity = await requireApiIdentity(request);
    const url = new URL(request.url);
    return jsonResponse(await listTankBench({
      userId: identity.userId,
      ...(optionalIdentifier(url.searchParams.get("runId"), "Die TankBench-Lauf-ID") ? { runId: identifier(url.searchParams.get("runId"), "Die TankBench-Lauf-ID") } : {}),
      ...(optionalIdentifier(url.searchParams.get("releaseId"), "Die Release-ID") ? { releaseId: identifier(url.searchParams.get("releaseId"), "Die Release-ID") } : {}),
    }));
  } catch (error) {
    return responseError(error);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const identity = await requireApiIdentity(request);
    const body = await bodyRecord(request);
    const action = body.action;
    if (action === "create_suite") {
      onlyKeys(body, ["action", "projectId", "name", "description", "cases"]);
      return jsonResponse(await createTankBenchSuite({
        userId: identity.userId,
        projectId: identifier(body.projectId, "Die Projekt-ID"),
        name: text(body.name, "Der Suitename", 160),
        description: typeof body.description === "string" ? body.description : "",
        cases: suiteCases(body.cases),
      }), { status: 201 });
    }
    if (action === "create_run") {
      onlyKeys(body, ["action", "suiteId", "baselineLabel", "candidateLabel", "minScoreDeltaBps", "maxRegressions"]);
      return jsonResponse({ run: await createTankBenchRun({
        userId: identity.userId,
        suiteId: identifier(body.suiteId, "Die Suite-ID"),
        baselineLabel: text(body.baselineLabel, "Das Baseline-Label", 160),
        candidateLabel: text(body.candidateLabel, "Das Kandidaten-Label", 160),
        minScoreDeltaBps: integer(body.minScoreDeltaBps, "Das Mindestdelta", -10000, 10000),
        maxRegressions: integer(body.maxRegressions, "Die maximale Regressionszahl", 0, 200),
      }) }, { status: 201 });
    }
    if (action === "create_release") {
      onlyKeys(body, ["action", "runId", "label", "maxErrorRateBps", "maxP95LatencyMs", "minStageObservations"]);
      return jsonResponse({ release: await createTankBenchRelease({
        userId: identity.userId,
        runId: identifier(body.runId, "Die TankBench-Lauf-ID"),
        label: text(body.label, "Das Release-Label", 160),
        maxErrorRateBps: integer(body.maxErrorRateBps, "Die maximale Fehlerrate", 0, 10000),
        maxP95LatencyMs: integer(body.maxP95LatencyMs, "Die maximale P95-Latenz", 1, 120000),
        minStageObservations: integer(body.minStageObservations, "Die Mindestbeobachtungen", 3, 1000),
      }) }, { status: 201 });
    }
    throw new TankBenchValidationError("Die TankBench-Erstellaktion ist ungültig.");
  } catch (error) {
    return responseError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const identity = await requireApiIdentity(request);
    const body = await bodyRecord(request);
    const action = body.action;
    if (action === "attach_result") {
      onlyKeys(body, ["action", "runId", "caseId", "commanderRunId", "variant", "expectedVersion"]);
      if (body.variant !== "baseline" && body.variant !== "candidate") throw new TankBenchValidationError("variant ist ungültig.");
      return jsonResponse(await attachCommanderResult({
        userId: identity.userId,
        runId: identifier(body.runId, "Die TankBench-Lauf-ID"),
        caseId: identifier(body.caseId, "Die Fall-ID"),
        commanderRunId: identifier(body.commanderRunId, "Die Commander-Lauf-ID"),
        variant: body.variant,
        expectedVersion: integer(body.expectedVersion, "Die erwartete Version", 1, Number.MAX_SAFE_INTEGER),
      }));
    }
    if (action === "evaluate_run") {
      onlyKeys(body, ["action", "runId", "expectedVersion"]);
      return jsonResponse({ run: await evaluateTankBenchRun({
        userId: identity.userId,
        runId: identifier(body.runId, "Die TankBench-Lauf-ID"),
        expectedVersion: integer(body.expectedVersion, "Die erwartete Version", 1, Number.MAX_SAFE_INTEGER),
      }) });
    }
    if (action === "start_canary") {
      onlyKeys(body, ["action", "releaseId", "expectedVersion"]);
      return jsonResponse({ release: await startTankBenchCanary({
        userId: identity.userId,
        releaseId: identifier(body.releaseId, "Die Release-ID"),
        expectedVersion: integer(body.expectedVersion, "Die erwartete Version", 1, Number.MAX_SAFE_INTEGER),
      }) });
    }
    if (action === "observe_canary") {
      onlyKeys(body, ["action", "releaseId", "expectedVersion", "success", "latencyMs", "errorCode"]);
      return jsonResponse(await recordTankBenchCanaryObservation({
        userId: identity.userId,
        releaseId: identifier(body.releaseId, "Die Release-ID"),
        expectedVersion: integer(body.expectedVersion, "Die erwartete Version", 1, Number.MAX_SAFE_INTEGER),
        success: boolean(body.success, "success"),
        latencyMs: integer(body.latencyMs, "Die Latenz", 0, 120000),
        ...(body.success === false ? { errorCode: text(body.errorCode, "Der Fehlercode", 120) } : {}),
      }));
    }
    if (action === "rollback") {
      onlyKeys(body, ["action", "releaseId", "expectedVersion", "reason"]);
      return jsonResponse({ release: await rollbackTankBenchRelease({
        userId: identity.userId,
        releaseId: identifier(body.releaseId, "Die Release-ID"),
        expectedVersion: integer(body.expectedVersion, "Die erwartete Version", 1, Number.MAX_SAFE_INTEGER),
        reason: text(body.reason, "Der Rollback-Grund", 1_000),
      }) });
    }
    throw new TankBenchValidationError("Die TankBench-Aktion ist ungültig.");
  } catch (error) {
    return responseError(error);
  }
}
