import { apiErrorResponse, jsonResponse } from "@/lib/api-response";
import {
  authenticateWorker,
  claimNextWorkerJob,
  executeClaimedWorkerJob,
  heartbeatWorker,
  heartbeatWorkerJob,
} from "@/lib/worker-runtime";

export const dynamic = "force-dynamic";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

class WorkerRuntimeRequestError extends Error {
  readonly status = 400;
  readonly code = "INVALID_WORKER_RUNTIME_REQUEST";
}

async function bodyRecord(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > 8_000) throw new WorkerRuntimeRequestError("Der Worker-Anfragekörper ist zu groß.");
  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkerRuntimeRequestError("Der Worker-Anfragekörper ist ungültig.");
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof WorkerRuntimeRequestError) throw error;
    throw new WorkerRuntimeRequestError("Der Worker-Anfragekörper ist kein gültiges JSON.");
  }
}

function onlyKeys(body: Record<string, unknown>, allowed: readonly string[]): void {
  const set = new Set(allowed);
  if (Object.keys(body).some((key) => !set.has(key))) throw new WorkerRuntimeRequestError("Die Worker-Anfrage enthält unbekannte Felder.");
}

function uuid(value: unknown, label: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw new WorkerRuntimeRequestError(`${label} ist ungültig.`);
  return value;
}

function claimToken(value: unknown): string {
  return uuid(value, "Der Claim-Token");
}

function errorResponse(error: unknown): Response {
  if (error instanceof WorkerRuntimeRequestError || (error instanceof Error && "status" in error && "code" in error)) {
    return jsonResponse({ error: error.message, code: "code" in error ? String(error.code) : "INVALID_WORKER_RUNTIME_REQUEST" }, { status: "status" in error ? Number(error.status) : 400 });
  }
  return apiErrorResponse(error);
}

export async function POST(request: Request) {
  try {
    const worker = await authenticateWorker(request.headers.get("authorization"));
    const body = await bodyRecord(request);
    const action = typeof body.action === "string" ? body.action : "claim";
    if (action === "workerHeartbeat") {
      onlyKeys(body, ["action"]);
      return jsonResponse({ worker: await heartbeatWorker(worker) });
    }
    if (action === "claim") {
      onlyKeys(body, ["action"]);
      return jsonResponse({ job: await claimNextWorkerJob(worker) });
    }
    if (action === "jobHeartbeat") {
      onlyKeys(body, ["action", "jobId", "claimToken", "progressPercent", "note"]);
      const progressPercent = Number(body.progressPercent);
      if (!Number.isInteger(progressPercent)) throw new WorkerRuntimeRequestError("Der Fortschritt ist ungültig.");
      const note = body.note === undefined ? undefined : String(body.note);
      return jsonResponse({ heartbeat: await heartbeatWorkerJob({ worker, jobId: uuid(body.jobId, "Die Job-ID"), claimToken: claimToken(body.claimToken), progressPercent, ...(note ? { note } : {}) }) });
    }
    if (action === "execute") {
      onlyKeys(body, ["action", "jobId", "claimToken"]);
      return jsonResponse({ job: await executeClaimedWorkerJob({ worker, jobId: uuid(body.jobId, "Die Job-ID"), claimToken: claimToken(body.claimToken) }) });
    }
    throw new WorkerRuntimeRequestError("Die Worker-Aktion ist ungültig.");
  } catch (error) {
    return errorResponse(error);
  }
}
