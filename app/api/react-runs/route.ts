import { apiErrorResponse, jsonResponse } from "@/lib/api-response";
import { requireApiIdentity } from "@/lib/auth";
import {
  cancelReActRun,
  createReActRun,
  listReActRuns,
  ReActRuntimeError,
  submitReActDecision,
  synchronizeReActRun,
} from "@/lib/react-runtime";
import { toolDefinition, type ToolName } from "@/lib/tool-runtime";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

class ReActValidationError extends Error {
  readonly status = 400;
  readonly code = "INVALID_REACT_REQUEST";
}

function responseError(error: unknown): Response {
  if (error instanceof ReActValidationError || error instanceof ReActRuntimeError) {
    return jsonResponse(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  return apiErrorResponse(error);
}

function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new ReActValidationError("Die Anfrage stammt nicht von TankAI Web.");
  }
}

async function requestBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > 32_000) {
    throw new ReActValidationError("Der Anfragekörper ist zu groß.");
  }
  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new ReActValidationError("Der Anfragekörper ist ungültig.");
    }
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ReActValidationError) throw error;
    throw new ReActValidationError("Der Anfragekörper ist kein gültiges JSON.");
  }
}

function onlyKeys(body: Record<string, unknown>, allowed: readonly string[]): void {
  const keys = new Set(allowed);
  if (Object.keys(body).some((key) => !keys.has(key))) {
    throw new ReActValidationError("Die Anfrage enthält unbekannte ReAct-Felder.");
  }
}

function text(value: unknown, label: string, maximum: number): string {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result || result.length > maximum) {
    throw new ReActValidationError(`${label} fehlt oder ist zu lang.`);
  }
  return result;
}

function identifier(value: unknown, label: string): string {
  const result = typeof value === "string" ? value.trim() : "";
  if (!UUID_PATTERN.test(result)) {
    throw new ReActValidationError(`${label} ist ungültig.`);
  }
  return result;
}

function optionalIdentifier(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return identifier(value, label);
}

function integer(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new ReActValidationError(
      `${label} muss zwischen ${minimum} und ${maximum} liegen.`,
    );
  }
  return Number(value);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ReActValidationError(`${label} muss ein JSON-Objekt sein.`);
  }
  return value as Record<string, unknown>;
}

function toolName(value: unknown): ToolName {
  if (typeof value !== "string") {
    throw new ReActValidationError("Der Werkzeugname fehlt.");
  }
  try {
    return toolDefinition(value as ToolName).name;
  } catch {
    throw new ReActValidationError("Das Werkzeug ist nicht registriert.");
  }
}

export async function GET(request: Request) {
  try {
    const identity = await requireApiIdentity(request);
    const runId = optionalIdentifier(
      new URL(request.url).searchParams.get("runId"),
      "Die ReAct-Lauf-ID",
    );
    return jsonResponse(
      await listReActRuns({ userId: identity.userId, ...(runId ? { runId } : {}) }),
    );
  } catch (error) {
    return responseError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const identity = await requireApiIdentity(request);
    const body = await requestBody(request);
    onlyKeys(body, [
      "projectId",
      "objective",
      "definitionOfDone",
      "maxSteps",
      "maxModelCalls",
      "maxToolActions",
    ]);
    const projectId = optionalIdentifier(body.projectId, "Die Projekt-ID");
    const run = await createReActRun({
      userId: identity.userId,
      ...(projectId ? { projectId } : {}),
      objective: text(body.objective, "Das Ziel", 8_000),
      definitionOfDone: text(
        body.definitionOfDone,
        "Die Definition of Done",
        4_000,
      ),
      maxSteps: integer(body.maxSteps, "Das Schrittlimit", 1, 32),
      maxModelCalls: integer(
        body.maxModelCalls,
        "Das Modellaufruflimit",
        1,
        64,
      ),
      maxToolActions: integer(
        body.maxToolActions,
        "Das Werkzeuglimit",
        0,
        32,
      ),
    });
    return jsonResponse({ run, created: true }, { status: 201 });
  } catch (error) {
    return responseError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const identity = await requireApiIdentity(request);
    const body = await requestBody(request);
    const action = body.action;
    if (action !== "decide" && action !== "sync" && action !== "cancel") {
      throw new ReActValidationError("Die ReAct-Aktion ist ungültig.");
    }
    const runId = identifier(body.runId, "Die ReAct-Lauf-ID");
    const expectedVersion = integer(
      body.expectedVersion,
      "Die erwartete Laufversion",
      1,
      Number.MAX_SAFE_INTEGER,
    );
    if (action === "sync") {
      onlyKeys(body, ["action", "runId", "expectedVersion"]);
      return jsonResponse({
        run: await synchronizeReActRun({
          userId: identity.userId,
          runId,
          expectedVersion,
        }),
      });
    }
    if (action === "cancel") {
      onlyKeys(body, ["action", "runId", "expectedVersion"]);
      return jsonResponse({
        run: await cancelReActRun({
          userId: identity.userId,
          runId,
          expectedVersion,
        }),
      });
    }

    onlyKeys(body, [
      "action",
      "runId",
      "expectedVersion",
      "decisionSummary",
      "decision",
    ]);
    const decision = record(body.decision, "Die Entscheidung");
    const decisionType = decision.type;
    if (decisionType === "final") {
      onlyKeys(decision, ["type", "answer"]);
      return jsonResponse(
        await submitReActDecision({
          userId: identity.userId,
          runId,
          expectedVersion,
          decisionSummary: text(
            body.decisionSummary,
            "Die Entscheidungszusammenfassung",
            1_000,
          ),
          action: {
            type: "final",
            answer: text(decision.answer, "Die finale Antwort", 40_000),
          },
        }),
      );
    }
    if (decisionType !== "tool") {
      throw new ReActValidationError(
        "Die Entscheidung muss eine Werkzeugaktion oder eine finale Antwort sein.",
      );
    }
    onlyKeys(decision, [
      "type",
      "leaseId",
      "toolName",
      "payload",
      "maxAttempts",
    ]);
    return jsonResponse(
      await submitReActDecision({
        userId: identity.userId,
        runId,
        expectedVersion,
        decisionSummary: text(
          body.decisionSummary,
          "Die Entscheidungszusammenfassung",
          1_000,
        ),
        action: {
          type: "tool",
          leaseId: identifier(decision.leaseId, "Die Tool-Freigabe-ID"),
          toolName: toolName(decision.toolName),
          payload: record(decision.payload, "Die Werkzeugnutzlast"),
          maxAttempts: integer(
            decision.maxAttempts,
            "Die maximale Versuchszahl",
            1,
            3,
          ),
        },
      }),
    );
  } catch (error) {
    return responseError(error);
  }
}
