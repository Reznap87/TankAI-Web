import { apiErrorResponse, jsonResponse } from "@/lib/api-response";
import { requireApiIdentity } from "@/lib/auth";
import {
  readToolJobProgress,
  type ToolJobProgressSnapshot,
} from "@/lib/tool-jobs";
import { serverComment, serverEvent } from "@/lib/server-sent-events";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const STREAM_WINDOW_MS = 15_000;
const POLL_INTERVAL_MS = 750;
const HEARTBEAT_INTERVAL_MS = 5_000;

class ToolProgressRequestError extends Error {
  readonly status = 400;
  readonly code = "INVALID_TOOL_PROGRESS_REQUEST";
}

function jobId(value: string | null): string {
  if (!value || !UUID_PATTERN.test(value)) {
    throw new ToolProgressRequestError("Die Job-ID ist ungültig.");
  }
  return value;
}

function errorResponse(error: unknown): Response {
  if (
    error instanceof ToolProgressRequestError ||
    (error instanceof Error &&
      "status" in error &&
      typeof error.status === "number" &&
      "code" in error &&
      typeof error.code === "string")
  ) {
    return jsonResponse(
      {
        error: error.message,
        code: "code" in error
          ? String(error.code)
          : "INVALID_TOOL_PROGRESS_REQUEST",
      },
      { status: "status" in error ? Number(error.status) : 400 },
    );
  }
  return apiErrorResponse(error);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function progressPayload(snapshot: ToolJobProgressSnapshot) {
  return {
    job: snapshot.job,
    events: snapshot.events,
    terminal: snapshot.terminal,
    executionStatusOnly: true,
    factsVerified: false,
  };
}

export async function GET(request: Request) {
  try {
    const identity = await requireApiIdentity(request);
    const url = new URL(request.url);
    const selectedJobId = jobId(url.searchParams.get("jobId"));
    const headerCursor = request.headers.get("last-event-id");
    const queryCursor = url.searchParams.get("cursor");
    let snapshot = await readToolJobProgress({
      userId: identity.userId,
      jobId: selectedJobId,
      cursor: headerCursor ?? queryCursor,
    });
    let cursor = snapshot.cursor;
    let cancelled = false;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const startedAt = Date.now();
          let lastHeartbeatAt = startedAt;
          controller.enqueue(
            serverEvent({
              event: "snapshot",
              id: cursor ?? undefined,
              retry: 1_500,
              data: progressPayload(snapshot),
            }),
          );
          if (snapshot.terminal) {
            controller.close();
            return;
          }

          while (!cancelled && Date.now() - startedAt < STREAM_WINDOW_MS) {
            await sleep(POLL_INTERVAL_MS);
            if (cancelled) return;
            snapshot = await readToolJobProgress({
              userId: identity.userId,
              jobId: selectedJobId,
              cursor,
            });
            if (snapshot.events.length > 0 || snapshot.terminal) {
              cursor = snapshot.cursor;
              controller.enqueue(
                serverEvent({
                  event: "progress",
                  id: cursor ?? undefined,
                  data: progressPayload(snapshot),
                }),
              );
            }
            if (snapshot.terminal) {
              controller.close();
              return;
            }
            if (Date.now() - lastHeartbeatAt >= HEARTBEAT_INTERVAL_MS) {
              controller.enqueue(serverComment("tankai-progress"));
              lastHeartbeatAt = Date.now();
            }
          }
          if (!cancelled) {
            controller.enqueue(
              serverEvent({
                event: "reconnect",
                id: cursor ?? undefined,
                retry: 1_500,
                data: {
                  jobId: selectedJobId,
                  executionStatusOnly: true,
                  factsVerified: false,
                },
              }),
            );
            controller.close();
          }
        } catch (error) {
          if (!cancelled) controller.error(error);
        }
      },
      cancel() {
        cancelled = true;
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store, no-transform",
        "x-accel-buffering": "no",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
