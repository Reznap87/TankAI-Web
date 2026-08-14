import { apiErrorResponse, jsonResponse } from "@/lib/api-response";
import { requireApiIdentity } from "@/lib/auth";
import {
  listMemories,
  MemoryNotFoundError,
  MemoryStateTransitionError,
  MemoryVersionConflictError,
  updateMemoryState,
  type MemoryRetentionPolicy,
  type MemoryType,
} from "@/lib/memory-store";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MEMORY_TYPES = new Set<MemoryType>([
  "episodic",
  "semantic",
  "procedural",
]);
const RETENTION_POLICIES = new Set<MemoryRetentionPolicy>([
  "hot",
  "warm",
  "cold",
  "deleted",
]);
const ACTIONS = new Set<string>([
  "confirm",
  "dispute",
  "archive",
  "restore",
  "delete",
] as const);

function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new MemoryRequestError("Die Anfrage stammt nicht von TankAI Web.");
  }
}

class MemoryRequestError extends Error {
  readonly status = 400;
  readonly code = "INVALID_MEMORY_REQUEST";
}

export async function GET(request: Request) {
  try {
    const identity = await requireApiIdentity(request);
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId") ?? undefined;
    const typeValue = url.searchParams.get("type") ?? undefined;
    const retentionValue = url.searchParams.get("retention") ?? undefined;
    const rawLimit = Number(url.searchParams.get("limit") ?? "50");
    if (projectId && !UUID_PATTERN.test(projectId)) {
      throw new MemoryRequestError("Die Projekt-ID ist ungültig.");
    }
    if (typeValue && !MEMORY_TYPES.has(typeValue as MemoryType)) {
      throw new MemoryRequestError("Der Memory-Typ ist ungültig.");
    }
    if (
      retentionValue &&
      !RETENTION_POLICIES.has(retentionValue as MemoryRetentionPolicy)
    ) {
      throw new MemoryRequestError("Die Retention-Klasse ist ungültig.");
    }
    const limit = Number.isInteger(rawLimit)
      ? Math.max(1, Math.min(rawLimit, 100))
      : 50;
    return jsonResponse(
      await listMemories({
        userId: identity.userId,
        ...(projectId ? { projectId } : {}),
        ...(typeValue ? { type: typeValue as MemoryType } : {}),
        ...(retentionValue
          ? { retentionPolicy: retentionValue as MemoryRetentionPolicy }
          : {}),
        limit,
      }),
    );
  } catch (error) {
    if (error instanceof MemoryRequestError) {
      return jsonResponse(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return apiErrorResponse(error);
  }
}

interface MemoryActionBody {
  memoryId?: unknown;
  expectedVersion?: unknown;
  action?: unknown;
  note?: unknown;
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const identity = await requireApiIdentity(request);
    const body = (await request.json()) as MemoryActionBody;
    if (
      typeof body.memoryId !== "string" ||
      !UUID_PATTERN.test(body.memoryId) ||
      typeof body.expectedVersion !== "number" ||
      !Number.isInteger(body.expectedVersion) ||
      body.expectedVersion < 1 ||
      typeof body.action !== "string" ||
      !ACTIONS.has(body.action)
    ) {
      throw new MemoryRequestError("Memory-Aktion oder Version ist ungültig.");
    }
    const note =
      typeof body.note === "string" ? body.note.trim().slice(0, 500) : undefined;
    await updateMemoryState({
      userId: identity.userId,
      memoryId: body.memoryId,
      expectedVersion: Number(body.expectedVersion),
      action: body.action as
        | "confirm"
        | "dispute"
        | "archive"
        | "restore"
        | "delete",
      ...(note ? { note } : {}),
    });
    return jsonResponse({ updated: true });
  } catch (error) {
    if (error instanceof MemoryRequestError) {
      return jsonResponse(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (
      error instanceof MemoryNotFoundError ||
      error instanceof MemoryStateTransitionError ||
      error instanceof MemoryVersionConflictError
    ) {
      return jsonResponse(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return apiErrorResponse(error);
  }
}
