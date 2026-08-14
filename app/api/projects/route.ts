import { apiErrorResponse, jsonResponse } from "@/lib/api-response";
import { requireApiIdentity } from "@/lib/auth";
import {
  createProject,
  listProjects,
  updateProject,
  type ProjectStatus,
} from "@/lib/database";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

class ProjectValidationError extends Error {
  readonly status = 400;
  readonly code = "INVALID_PROJECT_REQUEST";
}

function validationResponse(error: ProjectValidationError): Response {
  return jsonResponse(
    { error: error.message, code: error.code },
    { status: error.status },
  );
}

function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new ProjectValidationError(
      "Die Anfrage stammt nicht von TankAI Web.",
    );
  }
}

async function requestBody(request: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 24_000) {
    throw new ProjectValidationError("Der Anfragekörper ist zu groß.");
  }
  try {
    const value = (await request.json()) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new ProjectValidationError("Der Anfragekörper ist ungültig.");
    }
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ProjectValidationError) throw error;
    throw new ProjectValidationError(
      "Der Anfragekörper ist kein gültiges JSON.",
    );
  }
}

function requiredText(
  value: unknown,
  label: string,
  maximum: number,
): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new ProjectValidationError(`${label} fehlt.`);
  if (text.length > maximum) {
    throw new ProjectValidationError(
      `${label} darf höchstens ${maximum.toLocaleString("de-DE")} Zeichen enthalten.`,
    );
  }
  return text;
}

function optionalText(
  value: unknown,
  label: string,
  maximum: number,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new ProjectValidationError(`${label} ist ungültig.`);
  }
  const text = value.trim();
  if (text.length > maximum) {
    throw new ProjectValidationError(
      `${label} darf höchstens ${maximum.toLocaleString("de-DE")} Zeichen enthalten.`,
    );
  }
  return text;
}

function optionalIdentifier(
  value: string | null,
  label: string,
): string | undefined {
  const identifier = value?.trim();
  if (!identifier) return undefined;
  if (!UUID_PATTERN.test(identifier)) {
    throw new ProjectValidationError(`${label} ist ungültig.`);
  }
  return identifier;
}

export async function GET(request: Request) {
  try {
    const identity = await requireApiIdentity(request);
    const url = new URL(request.url);
    const projectId = optionalIdentifier(
      url.searchParams.get("projectId"),
      "Die Projekt-ID",
    );
    const documentId = optionalIdentifier(
      url.searchParams.get("documentId"),
      "Die Datei-ID",
    );
    if (documentId && !projectId) {
      throw new ProjectValidationError(
        "Für eine Projektdatei muss der Projektbereich angegeben werden.",
      );
    }
    const versionValue = url.searchParams.get("version");
    let version: number | undefined;
    if (versionValue !== null) {
      version = Number(versionValue);
      if (!Number.isInteger(version) || version < 1 || !documentId) {
        throw new ProjectValidationError(
          "Die angeforderte Dateiversion ist ungültig.",
        );
      }
    }
    return jsonResponse(
      await listProjects(identity.userId, projectId, documentId, version),
    );
  } catch (error) {
    return error instanceof ProjectValidationError
      ? validationResponse(error)
      : apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const identity = await requireApiIdentity(request);
    const body = await requestBody(request);
    const project = await createProject({
      userId: identity.userId,
      name: requiredText(body.name, "Der Projektname", 120),
      description:
        optionalText(body.description, "Die Projektbeschreibung", 2_000) ?? "",
    });
    return jsonResponse({ project, created: true }, { status: 201 });
  } catch (error) {
    return error instanceof ProjectValidationError
      ? validationResponse(error)
      : apiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const identity = await requireApiIdentity(request);
    const body = await requestBody(request);
    const projectId =
      typeof body.projectId === "string" ? body.projectId.trim() : "";
    if (!UUID_PATTERN.test(projectId)) {
      throw new ProjectValidationError("Die Projekt-ID ist ungültig.");
    }
    if (
      !Number.isInteger(body.expectedVersion) ||
      Number(body.expectedVersion) < 1
    ) {
      throw new ProjectValidationError(
        "Die erwartete Projektversion ist ungültig.",
      );
    }
    const name =
      body.name === undefined
        ? undefined
        : requiredText(body.name, "Der Projektname", 120);
    const description = optionalText(
      body.description,
      "Die Projektbeschreibung",
      2_000,
    );
    let status: ProjectStatus | undefined;
    if (body.status !== undefined) {
      if (body.status !== "active" && body.status !== "archived") {
        throw new ProjectValidationError("Der Projektstatus ist ungültig.");
      }
      status = body.status;
    }
    const note = optionalText(body.note, "Die Änderungsnotiz", 500);
    if (
      name === undefined &&
      description === undefined &&
      status === undefined
    ) {
      throw new ProjectValidationError(
        "Es wurde keine Projektänderung angegeben.",
      );
    }
    const project = await updateProject({
      projectId,
      userId: identity.userId,
      expectedVersion: Number(body.expectedVersion),
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(note ? { note } : {}),
    });
    return jsonResponse({ project, updated: true });
  } catch (error) {
    return error instanceof ProjectValidationError
      ? validationResponse(error)
      : apiErrorResponse(error);
  }
}
