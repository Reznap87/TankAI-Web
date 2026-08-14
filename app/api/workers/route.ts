import { apiErrorResponse, jsonResponse } from "@/lib/api-response";
import { requireApiIdentity } from "@/lib/auth";
import { listWorkers, registerWorker, setWorkerStatus } from "@/lib/worker-runtime";

export const dynamic = "force-dynamic";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

class WorkerRequestError extends Error {
  readonly status = 400;
  readonly code = "INVALID_WORKER_REQUEST";
}

function sameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new WorkerRequestError("Die Anfrage stammt nicht von TankAI Web.");
}

async function bodyRecord(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > 8_000) throw new WorkerRequestError("Der Anfragekörper ist zu groß.");
  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkerRequestError("Der Anfragekörper ist ungültig.");
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof WorkerRequestError) throw error;
    throw new WorkerRequestError("Der Anfragekörper ist kein gültiges JSON.");
  }
}

function onlyKeys(body: Record<string, unknown>, allowed: readonly string[]): void {
  const set = new Set(allowed);
  if (Object.keys(body).some((key) => !set.has(key))) throw new WorkerRequestError("Die Anfrage enthält unbekannte Felder.");
}

function uuid(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw new WorkerRequestError("Die Worker-ID ist ungültig.");
  return value;
}

function positiveInteger(value: unknown, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) throw new WorkerRequestError("Der Zahlenwert liegt außerhalb des erlaubten Bereichs.");
  return Number(value);
}

function errorResponse(error: unknown): Response {
  if (error instanceof WorkerRequestError || (error instanceof Error && "status" in error && "code" in error)) {
    return jsonResponse({ error: error.message, code: "code" in error ? String(error.code) : "INVALID_WORKER_REQUEST" }, { status: "status" in error ? Number(error.status) : 400 });
  }
  return apiErrorResponse(error);
}

export async function GET(request: Request) {
  try {
    const identity = await requireApiIdentity(request);
    return jsonResponse(await listWorkers(identity.userId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const identity = await requireApiIdentity(request);
    const body = await bodyRecord(request);
    onlyKeys(body, ["name", "maxConcurrency"]);
    const name = typeof body.name === "string" ? body.name : "";
    const result = await registerWorker({ userId: identity.userId, name, maxConcurrency: positiveInteger(body.maxConcurrency ?? 1, 1, 4) });
    return jsonResponse({ ...result, tokenShownOnce: true }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const identity = await requireApiIdentity(request);
    const body = await bodyRecord(request);
    onlyKeys(body, ["workerId", "expectedVersion", "status"]);
    if (body.status !== "active" && body.status !== "draining" && body.status !== "revoked") throw new WorkerRequestError("Der Worker-Status ist ungültig.");
    const worker = await setWorkerStatus({
      userId: identity.userId,
      workerId: uuid(body.workerId),
      expectedVersion: positiveInteger(body.expectedVersion, 1, Number.MAX_SAFE_INTEGER),
      status: body.status,
    });
    return jsonResponse({ worker, updated: true });
  } catch (error) {
    return errorResponse(error);
  }
}
