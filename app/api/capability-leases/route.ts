import { apiErrorResponse, jsonResponse } from "@/lib/api-response";
import { requireApiIdentity } from "@/lib/auth";
import {
  createCapabilityLease,
  listCapabilityLeases,
  revokeCapabilityLease,
  type CapabilityLeaseScope,
} from "@/lib/database";
import type { TeamMode } from "@/lib/team-runtime";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

class CapabilityLeaseValidationError extends Error {
  readonly status = 400;
  readonly code = "INVALID_CAPABILITY_LEASE_REQUEST";
}

function validationResponse(
  error: CapabilityLeaseValidationError,
): Response {
  return jsonResponse(
    { error: error.message, code: error.code },
    { status: error.status },
  );
}

function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new CapabilityLeaseValidationError(
      "Die Anfrage stammt nicht von TankAI Web.",
    );
  }
}

async function requestBody(request: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 8_000) {
    throw new CapabilityLeaseValidationError(
      "Der Anfragekörper ist zu groß.",
    );
  }
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 8_000) {
      throw new CapabilityLeaseValidationError(
        "Der Anfragekörper ist zu groß.",
      );
    }
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new CapabilityLeaseValidationError(
        "Der Anfragekörper ist ungültig.",
      );
    }
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof CapabilityLeaseValidationError) throw error;
    throw new CapabilityLeaseValidationError(
      "Der Anfragekörper ist kein gültiges JSON.",
    );
  }
}

function requireOnlyKeys(
  body: Record<string, unknown>,
  allowed: readonly string[],
): void {
  const allowedKeys = new Set(allowed);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    throw new CapabilityLeaseValidationError(
      "Die Anfrage enthält unbekannte Freigabefelder.",
    );
  }
}

function positiveInteger(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): number {
  if (
    !Number.isInteger(value) ||
    Number(value) < minimum ||
    Number(value) > maximum
  ) {
    throw new CapabilityLeaseValidationError(
      `${label} muss zwischen ${minimum} und ${maximum} liegen.`,
    );
  }
  return Number(value);
}

function identifier(value: unknown, label: string): string {
  const result = typeof value === "string" ? value.trim() : "";
  if (!UUID_PATTERN.test(result)) {
    throw new CapabilityLeaseValidationError(`${label} ist ungültig.`);
  }
  return result;
}

export async function GET(request: Request) {
  try {
    const identity = await requireApiIdentity(request);
    return jsonResponse(await listCapabilityLeases(identity.userId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const identity = await requireApiIdentity(request);
    const body = await requestBody(request);
    requireOnlyKeys(body, [
      "capability",
      "mode",
      "scope",
      "projectId",
      "maxUses",
      "durationMinutes",
    ]);
    if (body.capability !== "model.run") {
      throw new CapabilityLeaseValidationError(
        "Diese Fähigkeit kann nicht freigegeben werden.",
      );
    }
    let mode: TeamMode;
    if (body.mode === "fast" || body.mode === "team" || body.mode === "deep") {
      mode = body.mode;
    } else {
      throw new CapabilityLeaseValidationError(
        "Der freigegebene Teammodus ist ungültig.",
      );
    }
    let scope: CapabilityLeaseScope;
    if (body.scope === "account" || body.scope === "project") {
      scope = body.scope;
    } else {
      throw new CapabilityLeaseValidationError(
        "Der Freigabebereich ist ungültig.",
      );
    }
    const projectId =
      body.projectId === undefined
        ? undefined
        : identifier(body.projectId, "Die Projekt-ID");
    if (
      (scope === "account" && projectId) ||
      (scope === "project" && !projectId)
    ) {
      throw new CapabilityLeaseValidationError(
        "Eine Projektfreigabe benötigt genau einen Projektbereich.",
      );
    }
    const lease = await createCapabilityLease({
      userId: identity.userId,
      mode,
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
    return error instanceof CapabilityLeaseValidationError
      ? validationResponse(error)
      : apiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const identity = await requireApiIdentity(request);
    const body = await requestBody(request);
    requireOnlyKeys(body, ["leaseId", "expectedVersion"]);
    const lease = await revokeCapabilityLease({
      leaseId: identifier(body.leaseId, "Die Freigabe-ID"),
      userId: identity.userId,
      expectedVersion: positiveInteger(
        body.expectedVersion,
        "Die erwartete Freigabeversion",
        1,
        Number.MAX_SAFE_INTEGER,
      ),
    });
    return jsonResponse({ lease, revoked: true });
  } catch (error) {
    return error instanceof CapabilityLeaseValidationError
      ? validationResponse(error)
      : apiErrorResponse(error);
  }
}
