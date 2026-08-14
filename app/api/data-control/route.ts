import { apiErrorResponse, jsonResponse } from "@/lib/api-response";
import { requireApiIdentity } from "@/lib/auth";
import {
  cancelDeletionRequest,
  confirmDeletionRequest,
  createDeletionRequest,
  createUserDataExport,
  DataControlError,
  executeDeletionRequest,
  listDataControlState,
  verifyDeletionReceipt,
} from "@/lib/data-control-runtime";

export const dynamic = "force-dynamic";
const MAXIMUM_REQUEST_BYTES = 4_096;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DataControlError(
      "JSON-Objekt erwartet.",
      400,
      "INVALID_DATA_CONTROL_REQUEST",
    );
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, maximum: number): string {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result || result.length > maximum) {
    throw new DataControlError(
      `${label} ist ungültig.`,
      400,
      "INVALID_DATA_CONTROL_REQUEST",
    );
  }
  return result;
}

function integer(
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
    throw new DataControlError(
      `${label} ist ungültig.`,
      400,
      "INVALID_DATA_CONTROL_REQUEST",
    );
  }
  return Number(value);
}

async function requestBody(request: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAXIMUM_REQUEST_BYTES) {
    throw new DataControlError(
      "Der Anfragekörper ist zu groß.",
      413,
      "DATA_CONTROL_REQUEST_TOO_LARGE",
    );
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAXIMUM_REQUEST_BYTES) {
    throw new DataControlError(
      "Der Anfragekörper ist zu groß.",
      413,
      "DATA_CONTROL_REQUEST_TOO_LARGE",
    );
  }
  try {
    return record(JSON.parse(raw) as unknown);
  } catch (error) {
    if (error instanceof DataControlError) throw error;
    throw new DataControlError(
      "Der Anfragekörper ist kein gültiges JSON.",
      400,
      "INVALID_DATA_CONTROL_REQUEST",
    );
  }
}

function onlyKeys(
  body: Record<string, unknown>,
  allowed: readonly string[],
): void {
  const accepted = new Set(allowed);
  if (Object.keys(body).some((key) => !accepted.has(key))) {
    throw new DataControlError(
      "Die Anfrage enthält unbekannte Datenfelder.",
      400,
      "INVALID_DATA_CONTROL_REQUEST",
    );
  }
}

function sameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new DataControlError(
      "Die Anfrage stammt nicht von TankAI Web.",
      403,
      "DATA_CONTROL_ORIGIN_REJECTED",
    );
  }
}

function errorResponse(error: unknown): Response {
  if (error instanceof DataControlError) {
    return jsonResponse(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  return apiErrorResponse(error);
}

function downloadResponse(
  value: unknown,
  fileName: string,
): Response {
  return new Response(JSON.stringify(value, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  try {
    const identity = await requireApiIdentity(request, {
      allowFrozenAccount: true,
    });
    return jsonResponse(await listDataControlState(identity.userId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    sameOrigin(request);
    const identity = await requireApiIdentity(request, {
      allowFrozenAccount: true,
    });
    const body = await requestBody(request);
    const action = text(body.action, "action", 50);

    if (action === "export") {
      onlyKeys(body, ["action"]);
      const result = await createUserDataExport(identity);
      return downloadResponse(result.payload, result.fileName);
    }
    if (action === "request_deletion") {
      onlyKeys(body, ["action"]);
      return jsonResponse(
        await createDeletionRequest(identity.userId),
        { status: 201 },
      );
    }
    if (action === "confirm_deletion") {
      onlyKeys(body, [
        "action",
        "requestId",
        "confirmationPhrase",
        "expectedVersion",
      ]);
      return jsonResponse(
        await confirmDeletionRequest({
          userId: identity.userId,
          requestId: text(body.requestId, "requestId", 100),
          confirmationPhrase: text(
            body.confirmationPhrase,
            "confirmationPhrase",
            120,
          ),
          expectedVersion: integer(
            body.expectedVersion,
            "expectedVersion",
            1,
            1_000_000,
          ),
        }),
      );
    }
    if (action === "cancel_deletion") {
      onlyKeys(body, ["action", "requestId", "expectedVersion"]);
      return jsonResponse(
        await cancelDeletionRequest({
          userId: identity.userId,
          requestId: text(body.requestId, "requestId", 100),
          expectedVersion: integer(
            body.expectedVersion,
            "expectedVersion",
            1,
            1_000_000,
          ),
        }),
      );
    }
    if (action === "execute_deletion") {
      onlyKeys(body, ["action", "requestId", "expectedVersion"]);
      const result = await executeDeletionRequest({
        userId: identity.userId,
        requestId: text(body.requestId, "requestId", 100),
        expectedVersion: integer(
          body.expectedVersion,
          "expectedVersion",
          1,
          1_000_000,
        ),
      });
      return downloadResponse(result.report, result.fileName);
    }
    if (action === "verify_deletion_receipt") {
      onlyKeys(body, ["action", "receiptId", "reportSha256"]);
      return jsonResponse(
        await verifyDeletionReceipt({
          receiptId: text(body.receiptId, "receiptId", 100),
          reportSha256: text(body.reportSha256, "reportSha256", 64),
        }),
      );
    }
    throw new DataControlError(
      "Unbekannte Datenaktion.",
      400,
      "INVALID_DATA_CONTROL_ACTION",
    );
  } catch (error) {
    return errorResponse(error);
  }
}
