import { apiErrorResponse, jsonResponse } from "@/lib/api-response";
import { requireApiIdentity } from "@/lib/auth";
import {
  createGoal,
  listGoals,
  updateGoal,
  type GoalStatus,
} from "@/lib/database";

export const dynamic = "force-dynamic";

const GOAL_STATUSES = new Set<GoalStatus>([
  "draft",
  "planned",
  "ready",
  "running",
  "waiting",
  "verifying",
  "completed",
  "failed",
  "cancelled",
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

class GoalValidationError extends Error {
  readonly status = 400;
  readonly code = "INVALID_GOAL_REQUEST";
}

function validationResponse(error: GoalValidationError): Response {
  return jsonResponse(
    { error: error.message, code: error.code },
    { status: error.status },
  );
}

function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new GoalValidationError("Die Anfrage stammt nicht von TankAI Web.");
  }
}

async function requestBody(request: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 24_000) {
    throw new GoalValidationError("Der Anfragekörper ist zu groß.");
  }
  try {
    const value = (await request.json()) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new GoalValidationError("Der Anfragekörper ist ungültig.");
    }
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof GoalValidationError) throw error;
    throw new GoalValidationError("Der Anfragekörper ist kein gültiges JSON.");
  }
}

function requiredText(
  value: unknown,
  label: string,
  maximum: number,
): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new GoalValidationError(`${label} fehlt.`);
  if (text.length > maximum) {
    throw new GoalValidationError(
      `${label} darf höchstens ${maximum.toLocaleString("de-DE")} Zeichen enthalten.`,
    );
  }
  return text;
}

function optionalText(
  value: unknown,
  label: string,
  maximum: number,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new GoalValidationError(`${label} ist ungültig.`);
  }
  const text = value.trim();
  if (text.length > maximum) {
    throw new GoalValidationError(
      `${label} darf höchstens ${maximum.toLocaleString("de-DE")} Zeichen enthalten.`,
    );
  }
  return text || null;
}

export async function GET(request: Request) {
  try {
    const identity = await requireApiIdentity(request);
    const goalId = new URL(request.url).searchParams.get("goalId")?.trim();
    if (goalId && !UUID_PATTERN.test(goalId)) {
      throw new GoalValidationError("Die Ziel-ID ist ungültig.");
    }
    return jsonResponse(
      await listGoals(identity.userId, goalId || undefined),
    );
  } catch (error) {
    return error instanceof GoalValidationError
      ? validationResponse(error)
      : apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const identity = await requireApiIdentity(request);
    const body = await requestBody(request);
    const goal = await createGoal({
      userId: identity.userId,
      title: requiredText(body.title, "Der Zieltitel", 120),
      objective: requiredText(body.objective, "Das Ziel", 4_000),
      definitionOfDone: requiredText(
        body.definitionOfDone,
        "Die Definition of Done",
        3_000,
      ),
    });
    return jsonResponse({ goal, created: true }, { status: 201 });
  } catch (error) {
    return error instanceof GoalValidationError
      ? validationResponse(error)
      : apiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const identity = await requireApiIdentity(request);
    const body = await requestBody(request);
    const goalId = typeof body.goalId === "string" ? body.goalId.trim() : "";
    if (!UUID_PATTERN.test(goalId)) {
      throw new GoalValidationError("Die Ziel-ID ist ungültig.");
    }
    if (
      !Number.isInteger(body.expectedVersion) ||
      Number(body.expectedVersion) < 1
    ) {
      throw new GoalValidationError("Die erwartete Zielversion ist ungültig.");
    }

    let status: GoalStatus | undefined;
    if (body.status !== undefined) {
      if (
        typeof body.status !== "string" ||
        !GOAL_STATUSES.has(body.status as GoalStatus)
      ) {
        throw new GoalValidationError("Der Zielstatus ist ungültig.");
      }
      status = body.status as GoalStatus;
    }

    let progressPercent: number | undefined;
    if (body.progressPercent !== undefined) {
      if (
        !Number.isInteger(body.progressPercent) ||
        Number(body.progressPercent) < 0 ||
        Number(body.progressPercent) > 100
      ) {
        throw new GoalValidationError(
          "Der Fortschritt muss eine ganze Zahl zwischen 0 und 100 sein.",
        );
      }
      progressPercent = Number(body.progressPercent);
    }

    const currentStep = optionalText(
      body.currentStep,
      "Der bestätigte Schritt",
      1_000,
    );
    const nextAction = optionalText(
      body.nextAction,
      "Die nächste Aktion",
      1_000,
    );
    const noteValue = optionalText(body.note, "Die Notiz", 2_000);
    const note = noteValue || undefined;
    if (
      status === undefined &&
      progressPercent === undefined &&
      currentStep === undefined &&
      nextAction === undefined &&
      note === undefined
    ) {
      throw new GoalValidationError("Es wurde keine Zieländerung angegeben.");
    }

    const goal = await updateGoal({
      goalId,
      userId: identity.userId,
      expectedVersion: Number(body.expectedVersion),
      ...(status ? { status } : {}),
      ...(progressPercent !== undefined ? { progressPercent } : {}),
      ...(currentStep !== undefined ? { currentStep } : {}),
      ...(nextAction !== undefined ? { nextAction } : {}),
      ...(note ? { note } : {}),
    });
    return jsonResponse({ goal, updated: true });
  } catch (error) {
    return error instanceof GoalValidationError
      ? validationResponse(error)
      : apiErrorResponse(error);
  }
}
