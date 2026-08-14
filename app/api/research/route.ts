import { apiErrorResponse, jsonResponse } from "@/lib/api-response";
import { requireApiIdentity } from "@/lib/auth";
import { requireActiveProjectContext } from "@/lib/database";
import { runMultiSourceResearch } from "@/lib/research-orchestrator";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,100}$/u;

class ResearchRequestError extends Error {
  readonly status = 400;
  readonly code = "INVALID_RESEARCH_REQUEST";
}

function uuid(value: unknown, label: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new ResearchRequestError(`${label} ist ungültig.`);
  }
  return value;
}

function errorResponse(error: unknown): Response {
  if (
    error instanceof ResearchRequestError ||
    (error instanceof Error &&
      "status" in error &&
      typeof error.status === "number" &&
      "code" in error &&
      typeof error.code === "string")
  ) {
    return jsonResponse(
      {
        error: error.message,
        code: "code" in error ? String(error.code) : "INVALID_RESEARCH_REQUEST",
      },
      { status: "status" in error ? Number(error.status) : 400 },
    );
  }
  return apiErrorResponse(error);
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      throw new ResearchRequestError("Die Anfrage stammt nicht von TankAI Web.");
    }
    const identity = await requireApiIdentity(request);
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 12_000) {
      throw new ResearchRequestError("Der Anfragekörper ist zu groß.");
    }
    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new ResearchRequestError("Die Rechercheanfrage ist ungültig.");
      }
      body = parsed as Record<string, unknown>;
    } catch (error) {
      if (error instanceof ResearchRequestError) throw error;
      throw new ResearchRequestError("Der Anfragekörper ist kein gültiges JSON.");
    }
    const allowed = new Set(["leaseId", "projectId", "query", "urls", "idempotencyKey"]);
    if (
      Object.keys(body).some((key) => !allowed.has(key))
    ) {
      throw new ResearchRequestError("Die Rechercheanfrage ist ungültig.");
    }
    if (
      typeof body.idempotencyKey !== "string" ||
      !IDEMPOTENCY_PATTERN.test(body.idempotencyKey)
    ) {
      throw new ResearchRequestError("Der Idempotenzschlüssel ist ungültig.");
    }
    const projectId =
      body.projectId === undefined
        ? undefined
        : uuid(body.projectId, "Die Projekt-ID");
    if (projectId) await requireActiveProjectContext(projectId, identity.userId);

    return jsonResponse({
      research: await runMultiSourceResearch({
        userId: identity.userId,
        leaseId: uuid(body.leaseId, "Die Tool-Freigabe-ID"),
        query: body.query,
        urls: body.urls,
        idempotencyKey: body.idempotencyKey,
        ...(projectId ? { projectId } : {}),
      }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
