import { apiErrorResponse, jsonResponse } from "@/lib/api-response";
import { requireApiIdentity } from "@/lib/auth";
import {
  acknowledgeOperationsAlert,
  configureOperationsPolicy,
  evaluateDeploymentSlo,
  exportOperationsAudit,
  listOperationsState,
  OperationsRuntimeError,
  replayDeadLetterToolJob,
} from "@/lib/operations-runtime";

export const dynamic = "force-dynamic";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OperationsRuntimeError("JSON-Objekt erwartet.", 400, "INVALID_OPERATIONS_REQUEST");
  }
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, maximum = 200): string {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result || result.length > maximum) {
    throw new OperationsRuntimeError(`${label} ist ungültig.`, 400, "INVALID_OPERATIONS_REQUEST");
  }
  return result;
}
function integer(value: unknown, label: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new OperationsRuntimeError(`${label} ist ungültig.`, 400, "INVALID_OPERATIONS_REQUEST");
  }
  return Number(value);
}
function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new OperationsRuntimeError(
    `${label} ist ungültig.`, 400, "INVALID_OPERATIONS_REQUEST",
  );
  return value;
}
function sameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new OperationsRuntimeError(
    "Die Anfrage stammt nicht von TankAI Web.", 403, "OPERATIONS_ORIGIN_REJECTED",
  );
}
function errorResponse(error: unknown): Response {
  if (error instanceof OperationsRuntimeError) {
    return jsonResponse({ error: error.message, code: error.code }, { status: error.status });
  }
  return apiErrorResponse(error);
}

export async function GET(request: Request): Promise<Response> {
  try {
    const identity = await requireApiIdentity(request); const url = new URL(request.url);
    const projectId = text(url.searchParams.get("projectId"), "projectId", 100);
    if (url.searchParams.get("export") === "1") {
      const payload = await exportOperationsAudit({ userId: identity.userId, projectId });
      return new Response(JSON.stringify(payload, null, 2), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="tankai-operations-audit-${projectId}.json"`,
          "cache-control": "no-store",
        },
      });
    }
    return jsonResponse(await listOperationsState({ userId: identity.userId, projectId }));
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request): Promise<Response> {
  try {
    sameOrigin(request); const identity = await requireApiIdentity(request); const body = record(await request.json());
    const action = text(body.action, "action", 40);
    if (action === "configure") return jsonResponse(await configureOperationsPolicy({
      userId: identity.userId,
      projectId: text(body.projectId, "projectId", 100),
      rateLimitPerMinute: integer(body.rateLimitPerMinute, "rateLimitPerMinute", 1, 10000),
      maxConcurrency: integer(body.maxConcurrency, "maxConcurrency", 1, 100),
      inflightLeaseSeconds: integer(body.inflightLeaseSeconds, "inflightLeaseSeconds", 5, 600),
      sloWindowMinutes: integer(body.sloWindowMinutes, "sloWindowMinutes", 5, 1440),
      sloMinRequests: integer(body.sloMinRequests, "sloMinRequests", 1, 10000),
      minSuccessRateBps: integer(body.minSuccessRateBps, "minSuccessRateBps", 0, 10000),
      maxP95LatencyMs: integer(body.maxP95LatencyMs, "maxP95LatencyMs", 1, 120000),
      alertCooldownMinutes: integer(body.alertCooldownMinutes, "alertCooldownMinutes", 1, 1440),
      enabled: booleanValue(body.enabled, "enabled"),
      expectedVersion: integer(body.expectedVersion, "expectedVersion", 1, 1_000_000),
    }));
    if (action === "evaluate") return jsonResponse(await evaluateDeploymentSlo({
      userId: identity.userId, projectId: text(body.projectId, "projectId", 100),
    }));
    if (action === "replay_dead_letter") return jsonResponse(await replayDeadLetterToolJob({
      userId: identity.userId,
      projectId: text(body.projectId, "projectId", 100),
      sourceJobId: text(body.sourceJobId, "sourceJobId", 100),
      leaseId: text(body.leaseId, "leaseId", 100),
      expectedVersion: integer(body.expectedVersion, "expectedVersion", 1, 1_000_000),
    }), { status: 201 });
    throw new OperationsRuntimeError("Unbekannte Aktion.", 400, "INVALID_OPERATIONS_ACTION");
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    sameOrigin(request); const identity = await requireApiIdentity(request); const body = record(await request.json());
    const action = text(body.action, "action", 40);
    if (action === "acknowledge_alert") return jsonResponse(await acknowledgeOperationsAlert({
      userId: identity.userId,
      projectId: text(body.projectId, "projectId", 100),
      alertId: text(body.alertId, "alertId", 100),
      expectedVersion: integer(body.expectedVersion, "expectedVersion", 1, 1_000_000),
    }));
    throw new OperationsRuntimeError("Unbekannte Aktion.", 400, "INVALID_OPERATIONS_ACTION");
  } catch (error) { return errorResponse(error); }
}
