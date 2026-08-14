import { apiErrorResponse, jsonResponse } from "@/lib/api-response";
import { requireApiIdentity } from "@/lib/auth";
import {
  advanceCommanderRun,
  cancelCommanderRun,
  CommanderRuntimeError,
  createCommanderRun,
  listCommanderRuns,
} from "@/lib/commander-runtime";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

class CommanderValidationError extends Error {
  readonly status = 400;
  readonly code = "INVALID_COMMANDER_REQUEST";
}

function responseError(error: unknown): Response {
  if (error instanceof CommanderValidationError || error instanceof CommanderRuntimeError) {
    return jsonResponse({ error: error.message, code: error.code }, { status: error.status });
  }
  return apiErrorResponse(error);
}

function sameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new CommanderValidationError("Die Anfrage stammt nicht von TankAI Web.");
  }
}

async function bodyRecord(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > 32_000) {
    throw new CommanderValidationError("Der Anfragekörper ist zu groß.");
  }
  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new CommanderValidationError("Der Anfragekörper ist kein gültiges JSON-Objekt.");
  }
}

function onlyKeys(body: Record<string, unknown>, allowed: readonly string[]): void {
  const keys = new Set(allowed);
  if (Object.keys(body).some((key) => !keys.has(key))) {
    throw new CommanderValidationError("Die Anfrage enthält unbekannte Commander-Felder.");
  }
}

function identifier(value: unknown, label: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!UUID_PATTERN.test(text)) throw new CommanderValidationError(`${label} ist ungültig.`);
  return text;
}

function optionalIdentifier(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return identifier(value, label);
}

function text(value: unknown, label: string, maximum: number): string {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result || result.length > maximum) {
    throw new CommanderValidationError(`${label} fehlt oder ist zu lang.`);
  }
  return result;
}

function integer(value: unknown, label: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new CommanderValidationError(`${label} muss zwischen ${minimum} und ${maximum} liegen.`);
  }
  return Number(value);
}

export async function GET(request: Request) {
  try {
    const identity = await requireApiIdentity(request);
    const runId = optionalIdentifier(new URL(request.url).searchParams.get("runId"), "Die Commander-Lauf-ID");
    return jsonResponse(await listCommanderRuns({ userId: identity.userId, ...(runId ? { runId } : {}) }));
  } catch (error) {
    return responseError(error);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const identity = await requireApiIdentity(request);
    const body = await bodyRecord(request);
    onlyKeys(body, [
      "capabilityLeaseId",
      "projectId",
      "objective",
      "definitionOfDone",
      "maxCycles",
      "maxModelCalls",
      "maxReviewCalls",
      "maxToolActions",
    ]);
    const capabilityLeaseId = identifier(body.capabilityLeaseId, "Die model.run-Freigabe-ID");
    const projectId = optionalIdentifier(body.projectId, "Die Projekt-ID");
    const run = await createCommanderRun({
      userId: identity.userId,
      capabilityLeaseId,
      ...(projectId ? { projectId } : {}),
      objective: text(body.objective, "Das Ziel", 8_000),
      definitionOfDone: text(body.definitionOfDone, "Die Definition of Done", 4_000),
      maxCycles: integer(body.maxCycles, "Das Zykluslimit", 1, 24),
      maxModelCalls: integer(body.maxModelCalls, "Das Modellaufruflimit", 2, 20),
      maxReviewCalls: integer(body.maxReviewCalls, "Das Prüflimit", 1, 16),
      maxToolActions: integer(body.maxToolActions, "Das Werkzeuglimit", 0, 32),
    });
    return jsonResponse({ run, created: true }, { status: 201 });
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
    if (action !== "advance" && action !== "cancel") {
      throw new CommanderValidationError("Die Commander-Aktion ist ungültig.");
    }
    const runId = identifier(body.runId, "Die Commander-Lauf-ID");
    const expectedVersion = integer(body.expectedVersion, "Die erwartete Version", 1, Number.MAX_SAFE_INTEGER);
    if (action === "cancel") {
      onlyKeys(body, ["action", "runId", "expectedVersion"]);
      return jsonResponse({
        run: await cancelCommanderRun({ userId: identity.userId, runId, expectedVersion }),
      });
    }
    onlyKeys(body, ["action", "runId", "expectedVersion", "maxTransitions"]);
    return jsonResponse(
      await advanceCommanderRun({
        userId: identity.userId,
        runId,
        expectedVersion,
        maxTransitions: integer(body.maxTransitions ?? 4, "Das Übergangslimit", 1, 8),
      }),
    );
  } catch (error) {
    return responseError(error);
  }
}
