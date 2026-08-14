import { apiErrorResponse, jsonResponse } from "@/lib/api-response";
import { requireApiIdentity } from "@/lib/auth";
import { requireActiveProjectContext } from "@/lib/database";
import {
  createToolLease,
  listToolLeases,
  revokeToolLease,
} from "@/lib/tool-jobs";
import {
  TOOL_CATALOG,
  isToolName,
  toolDefinition,
  type ToolScope,
} from "@/lib/tool-runtime";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

class ToolLeaseRequestError extends Error {
  readonly status = 400;
  readonly code = "INVALID_TOOL_LEASE_REQUEST";
}

function sameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new ToolLeaseRequestError("Die Anfrage stammt nicht von TankAI Web.");
  }
}

async function bodyRecord(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > 8_000) {
    throw new ToolLeaseRequestError("Der Anfragekörper ist zu groß.");
  }
  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new ToolLeaseRequestError("Der Anfragekörper ist ungültig.");
    }
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ToolLeaseRequestError) throw error;
    throw new ToolLeaseRequestError("Der Anfragekörper ist kein gültiges JSON.");
  }
}

function onlyKeys(body: Record<string, unknown>, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  if (Object.keys(body).some((key) => !allowedSet.has(key))) {
    throw new ToolLeaseRequestError("Die Anfrage enthält unbekannte Felder.");
  }
}

function positiveInteger(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new ToolLeaseRequestError(`${label} muss zwischen ${minimum} und ${maximum} liegen.`);
  }
  return Number(value);
}

function uuid(value: unknown, label: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new ToolLeaseRequestError(`${label} ist ungültig.`);
  }
  return value;
}

function errorResponse(error: unknown): Response {
  if (
    error instanceof ToolLeaseRequestError ||
    (error instanceof Error &&
      "status" in error &&
      typeof error.status === "number" &&
      "code" in error &&
      typeof error.code === "string")
  ) {
    return jsonResponse(
      {
        error: error.message,
        code: "code" in error ? String(error.code) : "INVALID_TOOL_LEASE_REQUEST",
      },
      { status: "status" in error ? Number(error.status) : 400 },
    );
  }
  return apiErrorResponse(error);
}

export async function GET(request: Request) {
  try {
    const identity = await requireApiIdentity(request);
    return jsonResponse({
      ...(await listToolLeases(identity.userId)),
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
    onlyKeys(body, [
      "toolName",
      "scope",
      "projectId",
      "maxUses",
      "durationMinutes",
    ]);
    if (!isToolName(body.toolName)) {
      throw new ToolLeaseRequestError("Das Werkzeug ist ungültig.");
    }
    let scope: ToolScope;
    if (body.scope === "account" || body.scope === "project") {
      scope = body.scope;
    } else {
      throw new ToolLeaseRequestError("Der Freigabebereich ist ungültig.");
    }
    const projectId = body.projectId === undefined
      ? undefined
      : uuid(body.projectId, "Die Projekt-ID");
    if ((scope === "account" && projectId) || (scope === "project" && !projectId)) {
      throw new ToolLeaseRequestError("Eine Projektfreigabe benötigt genau einen Projektbereich.");
    }
    if (!toolDefinition(body.toolName).scopes.includes(scope)) {
      throw new ToolLeaseRequestError("Dieses Werkzeug unterstützt den gewählten Freigabebereich nicht.");
    }
    if (projectId) {
      await requireActiveProjectContext(projectId, identity.userId);
    }
    const lease = await createToolLease({
      userId: identity.userId,
      toolName: body.toolName,
      scope,
      ...(projectId ? { projectId } : {}),
      maxUses: positiveInteger(body.maxUses, "Die Nutzungszahl", 1, 20),
      durationMinutes: positiveInteger(
        body.durationMinutes,
        "Die Gültigkeitsdauer in Minuten",
        15,
        1_440,
      ),
    });
    return jsonResponse({ lease, created: true }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const identity = await requireApiIdentity(request);
    const body = await bodyRecord(request);
    onlyKeys(body, ["leaseId", "expectedVersion"]);
    const lease = await revokeToolLease({
      userId: identity.userId,
      leaseId: uuid(body.leaseId, "Die Tool-Freigabe-ID"),
      expectedVersion: positiveInteger(
        body.expectedVersion,
        "Die erwartete Version",
        1,
        Number.MAX_SAFE_INTEGER,
      ),
    });
    return jsonResponse({ lease, revoked: true });
  } catch (error) {
    return errorResponse(error);
  }
}
