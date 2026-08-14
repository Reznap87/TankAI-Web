import { apiErrorResponse, jsonResponse } from "@/lib/api-response";
import { requireApiIdentity } from "@/lib/auth";
import {
  createProjectDocument,
  updateProjectDocument,
  type ProjectDocumentKind,
} from "@/lib/database";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DOCUMENT_KINDS = new Set<ProjectDocumentKind>([
  "markdown",
  "text",
  "json",
  "csv",
]);

class DocumentValidationError extends Error {
  readonly status = 400;
  readonly code = "INVALID_PROJECT_DOCUMENT_REQUEST";
}

function validationResponse(error: DocumentValidationError): Response {
  return jsonResponse(
    { error: error.message, code: error.code },
    { status: error.status },
  );
}

function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new DocumentValidationError(
      "Die Anfrage stammt nicht von TankAI Web.",
    );
  }
}

async function requestBody(request: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 30_000) {
    throw new DocumentValidationError("Der Anfragekörper ist zu groß.");
  }
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 30_000) {
      throw new DocumentValidationError("Der Anfragekörper ist zu groß.");
    }
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new DocumentValidationError("Der Anfragekörper ist ungültig.");
    }
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof DocumentValidationError) throw error;
    throw new DocumentValidationError(
      "Der Anfragekörper ist kein gültiges JSON.",
    );
  }
}

function onlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): void {
  const accepted = new Set(allowed);
  if (Object.keys(value).some((key) => !accepted.has(key))) {
    throw new DocumentValidationError(
      "Der Anfragekörper enthält unbekannte Felder.",
    );
  }
}

function identifier(value: unknown, label: string): string {
  const result = typeof value === "string" ? value.trim() : "";
  if (!UUID_PATTERN.test(result)) {
    throw new DocumentValidationError(`${label} ist ungültig.`);
  }
  return result;
}

function documentName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) throw new DocumentValidationError("Der Dateiname fehlt.");
  if (
    name.length > 140 ||
    /[\\/\u0000-\u001f\u007f]/u.test(name) ||
    name === "." ||
    name === ".."
  ) {
    throw new DocumentValidationError(
      "Der Dateiname ist ungültig oder länger als 140 Zeichen.",
    );
  }
  return name;
}

function documentKind(value: unknown): ProjectDocumentKind {
  if (
    typeof value !== "string" ||
    !DOCUMENT_KINDS.has(value as ProjectDocumentKind)
  ) {
    throw new DocumentValidationError("Der Dateityp ist ungültig.");
  }
  return value as ProjectDocumentKind;
}

function documentContent(value: unknown): string {
  if (typeof value !== "string") {
    throw new DocumentValidationError("Der Dateiinhalt ist ungültig.");
  }
  const bytes = new TextEncoder().encode(value).byteLength;
  if (value.length > 20_000 || bytes > 24_000) {
    throw new DocumentValidationError(
      "Eine Projektdatei darf höchstens 20.000 Zeichen und 24.000 Bytes enthalten.",
    );
  }
  return value;
}

function optionalNote(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new DocumentValidationError("Die Änderungsnotiz ist ungültig.");
  }
  const note = value.trim();
  if (note.length > 500) {
    throw new DocumentValidationError(
      "Die Änderungsnotiz darf höchstens 500 Zeichen enthalten.",
    );
  }
  return note || undefined;
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const identity = await requireApiIdentity(request);
    const body = await requestBody(request);
    onlyKeys(body, ["projectId", "name", "kind", "content", "changeNote"]);
    const changeNote = optionalNote(body.changeNote);
    const document = await createProjectDocument({
      projectId: identifier(body.projectId, "Die Projekt-ID"),
      userId: identity.userId,
      name: documentName(body.name),
      kind: documentKind(body.kind),
      content: documentContent(body.content),
      ...(changeNote ? { changeNote } : {}),
    });
    return jsonResponse({ document, created: true }, { status: 201 });
  } catch (error) {
    return error instanceof DocumentValidationError
      ? validationResponse(error)
      : apiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const identity = await requireApiIdentity(request);
    const body = await requestBody(request);
    onlyKeys(body, [
      "documentId",
      "expectedVersion",
      "name",
      "kind",
      "content",
      "changeNote",
    ]);
    const documentId = identifier(body.documentId, "Die Datei-ID");
    if (
      !Number.isInteger(body.expectedVersion) ||
      Number(body.expectedVersion) < 1
    ) {
      throw new DocumentValidationError(
        "Die erwartete Dateiversion ist ungültig.",
      );
    }
    const name =
      body.name === undefined ? undefined : documentName(body.name);
    const kind =
      body.kind === undefined ? undefined : documentKind(body.kind);
    const content =
      body.content === undefined
        ? undefined
        : documentContent(body.content);
    const changeNote = optionalNote(body.changeNote);
    if (name === undefined && kind === undefined && content === undefined) {
      throw new DocumentValidationError(
        "Es wurde keine Dateiänderung angegeben.",
      );
    }
    const document = await updateProjectDocument({
      documentId,
      userId: identity.userId,
      expectedVersion: Number(body.expectedVersion),
      ...(name !== undefined ? { name } : {}),
      ...(kind !== undefined ? { kind } : {}),
      ...(content !== undefined ? { content } : {}),
      ...(changeNote ? { changeNote } : {}),
    });
    return jsonResponse({ document, updated: true });
  } catch (error) {
    return error instanceof DocumentValidationError
      ? validationResponse(error)
      : apiErrorResponse(error);
  }
}
