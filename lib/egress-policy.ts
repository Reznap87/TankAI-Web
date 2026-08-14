import { readRuntimeString } from "@/lib/runtime-env";
import { ToolExecutionError } from "@/lib/tool-errors";

const HOST_RULE_PATTERN =
  /^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
const MAX_RULES = 64;

export interface EgressPolicyDecision {
  mode: "deny-by-default";
  allowed: true;
  matchedAllowRule: string;
  policySha256: string;
}

interface EgressPolicy {
  allowed: string[];
  denied: string[];
  policySha256: string;
}

function normalizeRule(value: string): string | null {
  const normalized = value.trim().toLowerCase().replace(/\.$/u, "");
  return HOST_RULE_PATTERN.test(normalized) ? normalized : null;
}

function parseRules(value: string | undefined): string[] {
  if (!value) return [];
  return [...new Set(value.split(",").map(normalizeRule).filter((rule): rule is string => Boolean(rule)))]
    .sort()
    .slice(0, MAX_RULES);
}

function ruleMatches(hostname: string, rule: string): boolean {
  if (!rule.startsWith("*.")) return hostname === rule;
  const suffix = rule.slice(1);
  return hostname.endsWith(suffix) && hostname.length > suffix.length;
}

async function policySha256(allowed: string[], denied: string[]): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify({ allowed, denied }));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function currentPolicy(): Promise<EgressPolicy> {
  const allowed = parseRules(readRuntimeString("TANKAI_EGRESS_ALLOWED_HOSTS"));
  const denied = parseRules(readRuntimeString("TANKAI_EGRESS_DENIED_HOSTS"));
  return { allowed, denied, policySha256: await policySha256(allowed, denied) };
}

export async function enforceEgressPolicy(urlValue: string): Promise<EgressPolicyDecision> {
  const hostname = new URL(urlValue).hostname.toLowerCase().replace(/\.$/u, "");
  const policy = await currentPolicy();
  const deniedRule = policy.denied.find((rule) => ruleMatches(hostname, rule));
  if (deniedRule) {
    throw new ToolExecutionError(
      "Die zentrale Egress-Richtlinie blockiert dieses Ziel.",
      "NETWORK_EGRESS_DENIED",
    );
  }
  const allowedRule = policy.allowed.find((rule) => ruleMatches(hostname, rule));
  if (!allowedRule) {
    throw new ToolExecutionError(
      policy.allowed.length
        ? "Das Ziel ist nicht von der zentralen Egress-Allowlist freigegeben."
        : "Externe Netzwerkzugriffe sind gesperrt, bis eine Egress-Allowlist konfiguriert ist.",
      "NETWORK_EGRESS_NOT_ALLOWED",
    );
  }
  return {
    mode: "deny-by-default",
    allowed: true,
    matchedAllowRule: allowedRule,
    policySha256: policy.policySha256,
  };
}

export const EGRESS_POLICY_CONTRACT = {
  mode: "deny-by-default",
  configuration: "TANKAI_EGRESS_ALLOWED_HOSTS",
  supplementalDenylist: "TANKAI_EGRESS_DENIED_HOSTS",
  maximumRulesPerList: MAX_RULES,
  exactAndWildcardSubdomainRules: true,
  redirectRevalidation: true,
  denyTakesPrecedence: true,
  dnsRebindingProtection: false,
} as const;
