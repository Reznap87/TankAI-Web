import { apiErrorResponse, jsonResponse } from "@/lib/api-response";
import { requireApiIdentity } from "@/lib/auth";
import { saveFeedback } from "@/lib/database";
import { applyRunFeedbackToMemories } from "@/lib/memory-store";

export const dynamic = "force-dynamic";

interface FeedbackBody {
  runId?: unknown;
  rating?: unknown;
  correction?: unknown;
}

export async function POST(request: Request) {
  try {
    const identity = await requireApiIdentity(request);
    const body = (await request.json()) as FeedbackBody;
    if (
      typeof body.runId !== "string" ||
      !/^[0-9a-f-]{36}$/iu.test(body.runId) ||
      (body.rating !== 1 && body.rating !== -1)
    ) {
      return jsonResponse(
        { error: "Run-ID und Bewertung sind ungültig.", code: "INVALID_FEEDBACK" },
        { status: 400 },
      );
    }
    const correction =
      typeof body.correction === "string"
        ? body.correction.trim().slice(0, 4_000)
        : undefined;
    const result = await saveFeedback({
      runId: body.runId,
      userId: identity.userId,
      rating: body.rating,
      ...(correction ? { correction } : {}),
    });
    let memory:
      | { updated: number; correctionMemoryId?: string }
      | { updated: false; warning: string };
    try {
      memory = await applyRunFeedbackToMemories({
        runId: body.runId,
        userId: identity.userId,
        rating: body.rating,
        ...(correction ? { correction } : {}),
      });
    } catch {
      memory = {
        updated: false,
        warning: "Feedback wurde gespeichert; der Memory-Status konnte nicht aktualisiert werden.",
      };
    }
    return jsonResponse({ ...result, memory, saved: true }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
