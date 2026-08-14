export const TANKAI_WEB_RELEASE = "0.43.0";
export const PUBLIC_READINESS_CONTRACT = "1.0.0";

const PROVIDER_SECRET_NAMES = [
  "OPENAI_API_KEY",
  "XAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "CUSTOM_AI_API_KEY",
] as const;

type DatabaseBinding = {
  prepare?: unknown;
};

export type PublicReadinessBindings = Record<string, unknown> & {
  DB?: DatabaseBinding;
};

export type PublicReadinessBlocker =
  | "database_binding_missing"
  | "identity_salt_missing"
  | "provider_secret_missing";

export interface PublicReadinessSnapshot {
  contractVersion: typeof PUBLIC_READINESS_CONTRACT;
  releaseVersion: typeof TANKAI_WEB_RELEASE;
  runtimeOnline: true;
  applicationReady: boolean;
  modelExecutionReady: boolean;
  publicAudience: {
    controlledExternally: true;
    publiclyReachable: null;
    verificationRequired: readonly [
      "hosting_audience_setting",
      "public_dns",
      "external_https_request",
    ];
  };
  services: {
    databaseBinding: boolean;
    identitySalt: boolean;
    modelProvider: boolean;
    egressAllowlist: boolean;
  };
  blockers: PublicReadinessBlocker[];
  executionVerified: true;
  factsVerified: false;
}

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasDatabaseBinding(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return typeof (value as DatabaseBinding).prepare === "function";
}

export function evaluatePublicReadiness(
  bindings: PublicReadinessBindings,
): PublicReadinessSnapshot {
  const databaseBinding = hasDatabaseBinding(bindings.DB);
  const identitySalt = hasNonEmptyString(bindings.TANKAI_ID_SALT);
  const modelProvider = PROVIDER_SECRET_NAMES.some((name) =>
    hasNonEmptyString(bindings[name]),
  );
  const egressAllowlist = hasNonEmptyString(
    bindings.TANKAI_EGRESS_ALLOWED_HOSTS,
  );

  const blockers: PublicReadinessBlocker[] = [];
  if (!databaseBinding) blockers.push("database_binding_missing");
  if (!identitySalt) blockers.push("identity_salt_missing");
  if (!modelProvider) blockers.push("provider_secret_missing");

  const applicationReady = databaseBinding && identitySalt;

  return {
    contractVersion: PUBLIC_READINESS_CONTRACT,
    releaseVersion: TANKAI_WEB_RELEASE,
    runtimeOnline: true,
    applicationReady,
    modelExecutionReady: applicationReady && modelProvider,
    publicAudience: {
      controlledExternally: true,
      publiclyReachable: null,
      verificationRequired: [
        "hosting_audience_setting",
        "public_dns",
        "external_https_request",
      ],
    },
    services: {
      databaseBinding,
      identitySalt,
      modelProvider,
      egressAllowlist,
    },
    blockers,
    executionVerified: true,
    factsVerified: false,
  };
}
