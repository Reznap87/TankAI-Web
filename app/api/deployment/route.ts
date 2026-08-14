import { apiErrorResponse, jsonResponse } from "@/lib/api-response";
import { requireApiIdentity } from "@/lib/auth";
import {
  clearDeploymentTraffic,
  configureDeploymentRelease,
  DeploymentControllerError,
  executeDeploymentRequest,
  listDeploymentState,
  resetDeploymentCircuit,
  setDeploymentTraffic,
} from "@/lib/deployment-controller";

export const dynamic = "force-dynamic";

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DeploymentControllerError("JSON-Objekt erwartet.", 400, "INVALID_DEPLOYMENT_REQUEST");
  }
  return value as Record<string, unknown>;
}
function text(value: unknown, name: string, maximum = 8_000): string {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result || result.length > maximum) {
    throw new DeploymentControllerError(`${name} ist ungültig.`, 400, "INVALID_DEPLOYMENT_REQUEST");
  }
  return result;
}
function integer(value: unknown, name: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new DeploymentControllerError(`${name} ist ungültig.`, 400, "INVALID_DEPLOYMENT_REQUEST");
  }
  return Number(value);
}
function optionalInteger(value: unknown, name: string, minimum: number, maximum: number): number | undefined {
  return value === undefined ? undefined : integer(value, name, minimum, maximum);
}
function stringArray(value: unknown, name: string, maximumItems: number): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maximumItems) {
    throw new DeploymentControllerError(`${name} ist ungültig.`, 400, "INVALID_DEPLOYMENT_REQUEST");
  }
  return value.map((entry) => text(entry, name, 100));
}
function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new DeploymentControllerError("Die Anfrage stammt nicht von TankAI Web.", 403, "DEPLOYMENT_ORIGIN_REJECTED");
  }
}
function errorResponse(error: unknown): Response {
  if (error instanceof DeploymentControllerError) {
    return jsonResponse({ error: error.message, code: error.code }, { status: error.status });
  }
  return apiErrorResponse(error);
}

export async function GET(request: Request): Promise<Response> {
  try {
    const identity = await requireApiIdentity(request);
    const url = new URL(request.url);
    return jsonResponse(await listDeploymentState({
      userId: identity.userId,
      projectId: text(url.searchParams.get("projectId"), "projectId", 100),
    }));
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request): Promise<Response> {
  try {
    requireSameOrigin(request);
    const identity = await requireApiIdentity(request);
    const body = objectValue(await request.json());
    const action = text(body.action, "action", 40);
    if (action === "configure") {
      return jsonResponse(await configureDeploymentRelease({
        userId: identity.userId,
        releaseId: text(body.releaseId, "releaseId", 100),
        providerId: text(body.providerId, "providerId", 100),
        fallbackProviderIds: stringArray(body.fallbackProviderIds, "fallbackProviderIds", 3),
        maxOutputTokens: integer(body.maxOutputTokens, "maxOutputTokens", 64, 32768),
        failureThreshold: optionalInteger(body.failureThreshold, "failureThreshold", 1, 20),
        recoveryTimeoutSeconds: optionalInteger(body.recoveryTimeoutSeconds, "recoveryTimeoutSeconds", 5, 3600),
        halfOpenSuccesses: optionalInteger(body.halfOpenSuccesses, "halfOpenSuccesses", 1, 10),
        expectedVersion: optionalInteger(body.expectedVersion, "expectedVersion", 1, 1_000_000),
      }), { status: 201 });
    }
    if (action === "execute") {
      const messages = Array.isArray(body.messages) ? body.messages.map((item) => {
        const message = objectValue(item);
        const role = text(message.role, "role", 20);
        if (role !== "user" && role !== "assistant") throw new DeploymentControllerError(
          "role ist ungültig.", 400, "INVALID_DEPLOYMENT_REQUEST",
        );
        return { role, content: text(message.content, "content", 16_000) };
      }) : [];
      return jsonResponse(await executeDeploymentRequest({
        userId: identity.userId,
        projectId: text(body.projectId, "projectId", 100),
        routingKey: text(body.routingKey, "routingKey", 500),
        request: {
          instructions: text(body.instructions, "instructions", 16_000), messages,
          maxOutputTokens: integer(body.maxOutputTokens, "maxOutputTokens", 64, 32768),
          responseFormat: body.responseFormat === "json" ? "json" : "text",
          safetyIdentifier: identity.userId,
        },
      }));
    }
    throw new DeploymentControllerError("Unbekannte Aktion.", 400, "INVALID_DEPLOYMENT_ACTION");
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    requireSameOrigin(request);
    const identity = await requireApiIdentity(request);
    const body = objectValue(await request.json());
    const action = text(body.action, "action", 40);
    if (action === "set_traffic") return jsonResponse(await setDeploymentTraffic({
      userId: identity.userId,
      projectId: text(body.projectId, "projectId", 100),
      releaseId: text(body.releaseId, "releaseId", 100),
      trafficPercent: integer(body.trafficPercent, "trafficPercent", 0, 100),
      expectedVersion: optionalInteger(body.expectedVersion, "expectedVersion", 1, 1_000_000),
    }));
    if (action === "clear_traffic") return jsonResponse(await clearDeploymentTraffic({
      userId: identity.userId,
      projectId: text(body.projectId, "projectId", 100),
      expectedVersion: integer(body.expectedVersion, "expectedVersion", 1, 1_000_000),
    }));
    if (action === "reset_breaker") return jsonResponse(await resetDeploymentCircuit({
      userId: identity.userId,
      releaseId: text(body.releaseId, "releaseId", 100),
      providerId: text(body.providerId, "providerId", 100),
      expectedVersion: integer(body.expectedVersion, "expectedVersion", 1, 1_000_000),
    }));
    throw new DeploymentControllerError("Unbekannte Aktion.", 400, "INVALID_DEPLOYMENT_ACTION");
  } catch (error) { return errorResponse(error); }
}
