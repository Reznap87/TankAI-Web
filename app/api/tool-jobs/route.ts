import { apiErrorResponse, jsonResponse } from "@/lib/api-response";
import { requireApiIdentity } from "@/lib/auth";
import { requireActiveProjectContext } from "@/lib/database";
import {
  createToolJob,
  executeToolJob,
  listToolJobs,
  recoverStaleToolJobs,
  transitionToolJob,
} from "@/lib/tool-jobs";
import { TOOL_CATALOG, isToolName } from "@/lib/tool-runtime";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,120}$/u;

class ToolJobRequestError extends Error {
  readonly status = 400;
  readonly code = "INVALID_TOOL_JOB_REQUEST";
}

function sameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new ToolJobRequestError("Die Anfrage stammt nicht von TankAI Web.");
  }
}

async function bodyRecord(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > 32_000) {
    throw new ToolJobRequestError("Der Anfragekörper ist zu groß.");
  }
  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new ToolJobRequestError("Der Anfragekörper ist ungültig.");
    }
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ToolJobRequestError) throw error;
    throw new ToolJobRequestError("Der Anfragekörper ist kein gültiges JSON.");
  }
}

function onlyKeys(body: Record<string, unknown>, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  if (Object.keys(body).some((key) => !allowedSet.has(key))) {
    throw new ToolJobRequestError("Die Anfrage enthält unbekannte Felder.");
  }
}

function uuid(value: unknown, label: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new ToolJobRequestError(`${label} ist ungültig.`);
  }
  return value;
}

function version(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new ToolJobRequestError("Die erwartete Jobversion ist ungültig.");
  }
  return Number(value);
}

function errorResponse(error: unknown): Response {
  if (
    error instanceof ToolJobRequestError ||
    (error instanceof Error &&
      "status" in error &&
      typeof error.status === "number" &&
      "code" in error &&
      typeof error.code === "string")
  ) {
    return jsonResponse(
      {
        error: error.message,
        code: "code" in error ? String(error.code) : "INVALID_TOOL_JOB_REQUEST",
      },
      { status: "status" in error ? Number(error.status) : 400 },
    );
  }
  return apiErrorResponse(error);
}

export async function GET(request: Request) {
  try {
    const identity = await requireApiIdentity(request);
    const url = new URL(request.url);
    const rawProjectId = url.searchParams.get("projectId");
    const projectId = rawProjectId ? uuid(rawProjectId, "Die Projekt-ID") : undefined;
    if (projectId) await requireActiveProjectContext(projectId, identity.userId);
    return jsonResponse({
      ...(await listToolJobs({
        userId: identity.userId,
        ...(projectId ? { projectId } : {}),
      })),
      catalog: TOOL_CATALOG,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const identity = await requireApiIdentity(request);
    const body = await bodyRecord(request);
    const action = typeof body.action === "string" ? body.action : "create";

    if (action === "create") {
      onlyKeys(body, [
        "action",
        "leaseId",
        "toolName",
        "projectId",
        "input",
        "idempotencyKey",
        "maxAttempts",
      ]);
      if (!isToolName(body.toolName)) {
        throw new ToolJobRequestError("Das Werkzeug ist ungültig.");
      }
      const projectId = body.projectId === undefined
        ? undefined
        : uuid(body.projectId, "Die Projekt-ID");
      if (projectId) await requireActiveProjectContext(projectId, identity.userId);
      if (
        typeof body.idempotencyKey !== "string" ||
        !IDEMPOTENCY_PATTERN.test(body.idempotencyKey)
      ) {
        throw new ToolJobRequestError(
          "Der Idempotenzschlüssel muss 8 bis 120 sichere Zeichen enthalten.",
        );
      }
      const maxAttempts = body.maxAttempts === undefined ? 1 : Number(body.maxAttempts);
      if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) {
        throw new ToolJobRequestError("Maximale Versuche müssen zwischen 1 und 3 liegen.");
      }
      const result = await createToolJob({
        userId: identity.userId,
        leaseId: uuid(body.leaseId, "Die Tool-Freigabe-ID"),
        toolName: body.toolName,
        ...(projectId ? { projectId } : {}),
        payload: body.input,
        idempotencyKey: body.idempotencyKey,
        maxAttempts,
      });
      return jsonResponse(result, { status: result.created ? 201 : 200 });
    }

    if (action === "execute") {
      onlyKeys(body, ["action", "jobId", "expectedVersion"]);
      return jsonResponse({
        job: await executeToolJob({
          userId: identity.userId,
          jobId: uuid(body.jobId, "Die Job-ID"),
          expectedVersion: version(body.expectedVersion),
        }),
        executed: true,
      });
    }

    if (action === "retry" || action === "cancel") {
      onlyKeys(body, ["action", "jobId", "expectedVersion"]);
      return jsonResponse({
        job: await transitionToolJob({
          userId: identity.userId,
          jobId: uuid(body.jobId, "Die Job-ID"),
          expectedVersion: version(body.expectedVersion),
          action,
        }),
        updated: true,
      });
    }

    if (action === "recover") {
      onlyKeys(body, ["action"]);
      return jsonResponse({ recovered: await recoverStaleToolJobs(identity.userId) });
    }

    throw new ToolJobRequestError("Die Jobaktion ist ungültig.");
  } catch (error) {
    return errorResponse(error);
  }
}
