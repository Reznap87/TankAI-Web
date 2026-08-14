import {
  AccountDataFrozenError,
  AuthenticationError,
  IdentityConfigurationError,
} from "@/lib/auth";
import {
  CapabilityLeaseInputError,
  CapabilityLeaseLimitError,
  CapabilityLeaseNotFoundError,
  CapabilityLeaseUnavailableError,
  CapabilityLeaseVersionConflictError,
  ConversationNotFoundError,
  GoalNotFoundError,
  GoalNotRunnableError,
  GoalTransitionError,
  GoalVersionConflictError,
  ProjectArchivedError,
  ProjectDocumentContentError,
  ProjectDocumentLimitError,
  ProjectDocumentNameConflictError,
  ProjectDocumentNotFoundError,
  ProjectDocumentVersionConflictError,
  ProjectNotFoundError,
  ProjectLimitError,
  ProjectVersionConflictError,
  UsageLimitError,
} from "@/lib/database";
import { ModelAccessError, TeamExecutionError } from "@/lib/team-runtime";

interface KnownApiError {
  status: number;
  code?: string;
  message: string;
}

function knownError(error: unknown): KnownApiError | undefined {
  if (
    error instanceof AccountDataFrozenError ||
    error instanceof AuthenticationError ||
    error instanceof IdentityConfigurationError ||
    error instanceof CapabilityLeaseInputError ||
    error instanceof CapabilityLeaseLimitError ||
    error instanceof CapabilityLeaseNotFoundError ||
    error instanceof CapabilityLeaseUnavailableError ||
    error instanceof CapabilityLeaseVersionConflictError ||
    error instanceof ConversationNotFoundError ||
    error instanceof GoalNotFoundError ||
    error instanceof GoalNotRunnableError ||
    error instanceof GoalTransitionError ||
    error instanceof GoalVersionConflictError ||
    error instanceof ProjectNotFoundError ||
    error instanceof ProjectVersionConflictError ||
    error instanceof ProjectLimitError ||
    error instanceof ProjectArchivedError ||
    error instanceof ProjectDocumentNotFoundError ||
    error instanceof ProjectDocumentVersionConflictError ||
    error instanceof ProjectDocumentNameConflictError ||
    error instanceof ProjectDocumentContentError ||
    error instanceof ProjectDocumentLimitError ||
    error instanceof UsageLimitError ||
    error instanceof ModelAccessError ||
    error instanceof TeamExecutionError
  ) {
    return {
      status: error.status,
      code: "code" in error ? error.code : error.name,
      message: error.message,
    };
  }
  return undefined;
}

export function jsonResponse(
  value: unknown,
  init: ResponseInit = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(value), { ...init, headers });
}

export function apiErrorResponse(error: unknown): Response {
  const known = knownError(error);
  if (known) {
    return jsonResponse(
      {
        error: known.message,
        code: known.code ?? "REQUEST_FAILED",
      },
      { status: known.status },
    );
  }
  console.error(
    "TankAI API error:",
    error instanceof Error ? error.name : "UnknownError",
  );
  return jsonResponse(
    {
      error: "TankAI konnte die Anfrage wegen eines internen Fehlers nicht abschließen.",
      code: "INTERNAL_ERROR",
    },
    { status: 500 },
  );
}
