import { ToolExecutionError, ToolInputError } from "@/lib/tool-errors";
import { EGRESS_POLICY_CONTRACT, enforceEgressPolicy } from "@/lib/egress-policy";

const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 28_000;
const FETCH_TIMEOUT_MS = 10_000;
const ALLOWED_CONTENT_TYPES = [
  "text/html",
  "text/plain",
  "application/json",
  "application/xml",
  "text/xml",
] as const;
const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".home",
  ".lan",
  ".localdomain",
  ".onion",
  ".home.arpa",
] as const;
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/iu,
  /ignore\s+(all\s+)?prior\s+instructions/iu,
  /system\s+prompt/iu,
  /developer\s+message/iu,
  /reveal\s+(your\s+)?instructions/iu,
  /tool\s*call/iu,
];

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: false });

export interface SafeFetchResult {
  source: {
    requestedUrl: string;
    finalUrl: string;
    retrievedAt: string;
    status: number;
    contentType: string;
    redirects: string[];
  };
  integrity: {
    sha256: string;
    bytesRead: number;
    truncated: boolean;
  };
  extraction: {
    title: string | null;
    text: string;
    untrusted: true;
    promptInjectionSignals: string[];
  };
  budget: {
    networkRequests: number;
    maximumNetworkRequests: number;
    timeoutMs: number;
    maximumResponseBytes: number;
  };
  egress: {
    mode: "deny-by-default";
    policySha256: string;
    matchedAllowRule: string;
    redirectsRevalidated: number;
  };
}

function isIPv4Literal(hostname: string): boolean {
  const parts = hostname.split(".");
  return parts.length === 4 && parts.every((part) => {
    if (!/^\d{1,3}$/u.test(part)) return false;
    const value = Number(part);
    return value >= 0 && value <= 255 && String(value) === String(Number(part));
  });
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/u, "");
  if (!normalized || normalized === "localhost") return true;
  if (isIPv4Literal(normalized) || normalized.includes(":")) return true;
  if (!normalized.includes(".")) return true;
  return BLOCKED_HOST_SUFFIXES.some(
    (suffix) => normalized === suffix.slice(1) || normalized.endsWith(suffix),
  );
}

export function normalizePublicHttpsUrl(value: unknown): string {
  if (typeof value !== "string") {
    throw new ToolInputError("Das Feld „url“ muss eine HTTPS-Adresse enthalten.");
  }
  const input = value.trim();
  if (!input || input.length > 2_048) {
    throw new ToolInputError("Die HTTPS-Adresse fehlt oder ist zu lang.");
  }
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ToolInputError("Die HTTPS-Adresse ist ungültig.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    isBlockedHostname(url.hostname)
  ) {
    throw new ToolInputError(
      "Das Netzwerkwerkzeug erlaubt nur öffentliche HTTPS-Ziele ohne Zugangsdaten oder Sonderport.",
    );
  }
  url.hash = "";
  return url.toString();
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function htmlEntityDecode(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    hellip: "…",
    laquo: "«",
    ldquo: "“",
    lsquo: "‘",
    lt: "<",
    nbsp: " ",
    quot: '"',
    raquo: "»",
    rdquo: "”",
    rsquo: "’",
  };
  return value.replace(
    /&(#x?[0-9a-f]+|[a-z]+);/giu,
    (match, entity: string) => {
      const lower = entity.toLowerCase();
      if (lower.startsWith("#")) {
        const hexadecimal = lower.startsWith("#x");
        const raw = hexadecimal ? lower.slice(2) : lower.slice(1);
        const codePoint = Number.parseInt(raw, hexadecimal ? 16 : 10);
        if (
          Number.isInteger(codePoint) &&
          codePoint > 0 &&
          codePoint <= 0x10ffff &&
          !(codePoint >= 0xd800 && codePoint <= 0xdfff)
        ) {
          return String.fromCodePoint(codePoint);
        }
        return " ";
      }
      return named[lower] ?? match;
    },
  );
}

function normalizeExtractedText(value: string): string {
  return htmlEntityDecode(value)
    .replace(/\r\n?|\u2028|\u2029/gu, "\n")
    .replace(/[\t\f\v ]+/gu, " ")
    .replace(/ *\n */gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim()
    .slice(0, 20_000);
}

function extractHtml(value: string): { title: string | null; text: string } {
  const titleMatch = value.match(/<title\b[^>]*>([\s\S]*?)<\/title>/iu);
  const title = titleMatch
    ? normalizeExtractedText(titleMatch[1]).slice(0, 300) || null
    : null;
  const withoutUnsafeBlocks = value
    .replace(/<!--([\s\S]*?)-->/gu, " ")
    .replace(/<(script|style|template|noscript|svg|canvas)\b[^>]*>[\s\S]*?<\/\1>/giu, " ")
    .replace(/<(br|hr)\b[^>]*>/giu, "\n")
    .replace(/<\/(p|div|section|article|header|footer|main|aside|nav|li|h[1-6]|tr)>/giu, "\n")
    .replace(/<[^>]+>/gu, " ");
  return { title, text: normalizeExtractedText(withoutUnsafeBlocks) };
}

function extractText(value: string, contentType: string): {
  title: string | null;
  text: string;
} {
  if (contentType === "text/html") return extractHtml(value);
  if (contentType === "application/json") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return {
        title: null,
        text: JSON.stringify(parsed, null, 2).slice(0, 20_000),
      };
    } catch {
      return { title: null, text: normalizeExtractedText(value) };
    }
  }
  return { title: null, text: normalizeExtractedText(value) };
}

function injectionSignals(value: string): string[] {
  return INJECTION_PATTERNS.flatMap((pattern) => {
    const match = value.match(pattern);
    return match ? [match[0].slice(0, 120)] : [];
  }).slice(0, 8);
}

async function readBoundedBody(response: Response): Promise<{
  bytes: Uint8Array;
  truncated: boolean;
}> {
  const announced = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(announced) && announced > MAX_RESPONSE_BYTES) {
    throw new ToolExecutionError(
      "Die entfernte Antwort überschreitet das erlaubte Größenlimit.",
      "NETWORK_RESPONSE_TOO_LARGE",
    );
  }
  if (!response.body) return { bytes: new Uint8Array(), truncated: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      const remaining = MAX_RESPONSE_BYTES - total;
      if (value.byteLength > remaining) {
        if (remaining > 0) chunks.push(value.slice(0, remaining));
        total = MAX_RESPONSE_BYTES;
        truncated = true;
        await reader.cancel("TankAI response byte budget reached");
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, truncated };
}

export async function safeFetchPublicText(rawUrl: unknown): Promise<SafeFetchResult> {
  const requestedUrl = normalizePublicHttpsUrl(rawUrl);
  let egressDecision = await enforceEgressPolicy(requestedUrl);
  const redirects: string[] = [];
  let currentUrl = requestedUrl;
  let networkRequests = 0;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("TankAI fetch timeout"), FETCH_TIMEOUT_MS);
  try {
    while (networkRequests < MAX_REDIRECTS + 1) {
      networkRequests += 1;
      let response: Response;
      try {
        response = await fetch(currentUrl, {
          method: "GET",
          redirect: "manual",
          credentials: "omit",
          cache: "no-store",
          headers: {
            accept: "text/html,text/plain,application/json,application/xml,text/xml;q=0.9",
          },
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          throw new ToolExecutionError(
            "Das öffentliche HTTPS-Ziel hat nicht innerhalb des Zeitlimits geantwortet.",
            "NETWORK_TIMEOUT",
          );
        }
        throw new ToolExecutionError(
          "Das öffentliche HTTPS-Ziel konnte nicht abgerufen werden.",
          "NETWORK_FETCH_FAILED",
        );
      }

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirects.length >= MAX_REDIRECTS) {
          throw new ToolExecutionError(
            "Die Redirect-Kette ist unvollständig oder überschreitet das Limit.",
            "NETWORK_REDIRECT_LIMIT",
          );
        }
        const next = normalizePublicHttpsUrl(new URL(location, currentUrl).toString());
        egressDecision = await enforceEgressPolicy(next);
        redirects.push(next);
        currentUrl = next;
        continue;
      }

      if (!response.ok) {
        throw new ToolExecutionError(
          `Das HTTPS-Ziel antwortete mit Status ${response.status}.`,
          "NETWORK_HTTP_STATUS",
        );
      }
      const rawContentType = response.headers.get("content-type") ?? "";
      const contentType = rawContentType.split(";", 1)[0].trim().toLowerCase();
      if (!ALLOWED_CONTENT_TYPES.includes(contentType as (typeof ALLOWED_CONTENT_TYPES)[number])) {
        throw new ToolExecutionError(
          "Das Netzwerkwerkzeug verarbeitet ausschließlich HTML, Klartext, JSON oder XML.",
          "NETWORK_CONTENT_TYPE_BLOCKED",
        );
      }
      const { bytes, truncated } = await readBoundedBody(response);
      const decoded = decoder.decode(bytes);
      const extraction = extractText(decoded, contentType);
      return {
        source: {
          requestedUrl,
          finalUrl: currentUrl,
          retrievedAt: new Date().toISOString(),
          status: response.status,
          contentType,
          redirects,
        },
        integrity: {
          sha256: await sha256(bytes),
          bytesRead: bytes.byteLength,
          truncated,
        },
        extraction: {
          title: extraction.title,
          text: extraction.text,
          untrusted: true,
          promptInjectionSignals: injectionSignals(extraction.text),
        },
        budget: {
          networkRequests,
          maximumNetworkRequests: MAX_REDIRECTS + 1,
          timeoutMs: FETCH_TIMEOUT_MS,
          maximumResponseBytes: MAX_RESPONSE_BYTES,
        },
        egress: {
          mode: egressDecision.mode,
          policySha256: egressDecision.policySha256,
          matchedAllowRule: egressDecision.matchedAllowRule,
          redirectsRevalidated: redirects.length,
        },
      };
    }
    throw new ToolExecutionError(
      "Die Redirect-Kette überschreitet das erlaubte Limit.",
      "NETWORK_REDIRECT_LIMIT",
    );
  } finally {
    clearTimeout(timeout);
  }
}

export const NETWORK_TOOL_POLICY = {
  protocol: "https-only",
  blocksPrivateAddressLiterals: true,
  blocksLocalHostnameShapes: true,
  applicationEgressPolicy: EGRESS_POLICY_CONTRACT,
  dnsRebindingProtection: false,
  credentials: "omit",
  redirectMode: "manual-revalidate",
  maximumRedirects: MAX_REDIRECTS,
  timeoutMs: FETCH_TIMEOUT_MS,
  maximumResponseBytes: MAX_RESPONSE_BYTES,
  allowedContentTypes: ALLOWED_CONTENT_TYPES,
} as const;
