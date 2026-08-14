import { readRuntimeString } from "@/lib/runtime-env";
import { currentRuntimeBindings } from "@/lib/request-context";

export interface AuthenticatedIdentity {
  email: string;
  userId: string;
}

export class AuthenticationError extends Error {
  readonly status = 401;

  constructor() {
    super("Bitte melde dich mit ChatGPT an, um TankAI zu benutzen.");
    this.name = "AuthenticationError";
  }
}

export class IdentityConfigurationError extends Error {
  readonly status = 503;

  constructor() {
    super("Die sichere Nutzerkennung der TankAI-Runtime ist noch nicht aktiviert.");
    this.name = "IdentityConfigurationError";
  }
}

export class AccountDataFrozenError extends Error {
  readonly status = 423;
  readonly code = "ACCOUNT_DATA_FROZEN";

  constructor() {
    super(
      "Das TankAI-Konto ist wegen eines aktiven Löschauftrags eingefroren. Öffne „Daten & Löschung“, um den Auftrag abzubrechen oder abzuschließen.",
    );
    this.name = "AccountDataFrozenError";
  }
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashIdentity(email: string): Promise<string> {
  const salt = readRuntimeString("TANKAI_ID_SALT");
  if (!salt) throw new IdentityConfigurationError();
  const normalized = email.trim().toLowerCase();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`tankai-web:${salt}:${normalized}`),
  );
  return toHex(digest);
}

export async function requireApiIdentity(
  request: Request,
  options: { allowFrozenAccount?: boolean } = {},
): Promise<AuthenticatedIdentity> {
  const email = request.headers
    .get("oai-authenticated-user-email")
    ?.trim()
    .toLowerCase();
  if (!email) throw new AuthenticationError();
  const identity = { email, userId: await hashIdentity(email) };
  if (!options.allowFrozenAccount) {
    const runtimeDatabase = currentRuntimeBindings().DB;
    if (runtimeDatabase?.prepare) {
      const frozen = await runtimeDatabase
        .prepare(
          `SELECT id FROM data_subject_requests WHERE user_id=? AND request_type='deletion'
           AND status IN ('requested','scheduled','executing') LIMIT 1`,
        )
        .bind(identity.userId)
        .first<{ id: string }>();
      if (frozen) throw new AccountDataFrozenError();
    }
  }
  return identity;
}

export async function safetyIdentifier(userId: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`tankai-safety:${userId}`),
  );
  return `tankai_${toHex(digest).slice(0, 32)}`;
}
