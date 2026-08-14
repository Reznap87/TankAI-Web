import {
  createToolJob,
  executeToolJob,
  type ToolJobRecord,
} from "@/lib/tool-jobs";
import { normalizePublicHttpsUrl } from "@/lib/tool-network";
import { ToolInputError } from "@/lib/tool-runtime";

const MAX_SOURCES = 4;
const MAX_QUERY_CHARACTERS = 500;
const MAX_EXCERPT_CHARACTERS = 1_600;

interface WebFetchOutput {
  result?: {
    source?: {
      requestedUrl?: string;
      finalUrl?: string;
      retrievedAt?: string;
    };
    integrity?: {
      sha256?: string;
      bytesRead?: number;
      truncated?: boolean;
    };
    extraction?: {
      title?: string | null;
      text?: string;
      untrusted?: boolean;
      promptInjectionSignals?: string[];
    };
    egress?: {
      mode?: string;
      policySha256?: string;
      matchedAllowRule?: string;
    };
  };
  receipt?: {
    durationMs?: number;
    maximumNetworkRequests?: number;
  };
}

export interface ResearchSourceReceipt {
  ordinal: number;
  jobId: string;
  jobVersion: number;
  status: ToolJobRecord["status"];
  requestedUrl: string;
  finalUrl: string | null;
  retrievedAt: string | null;
  sha256: string | null;
  bytesRead: number | null;
  truncated: boolean;
  title: string | null;
  excerpt: string | null;
  promptInjectionSignals: string[];
  errorCode: string | null;
  errorMessage: string | null;
  untrusted: true;
}

export interface ResearchBundle {
  query: string;
  status: "complete" | "partial" | "failed";
  verificationStatus: "unverified-source-observations";
  sourceCount: number;
  successfulSourceCount: number;
  failedSourceCount: number;
  distinctHostCount: number;
  createdAt: string;
  sources: ResearchSourceReceipt[];
}

function normalizeQuery(value: unknown): string {
  if (typeof value !== "string") {
    throw new ToolInputError("Die Recherchefrage muss Text enthalten.");
  }
  const query = value.trim();
  if (!query || query.length > MAX_QUERY_CHARACTERS) {
    throw new ToolInputError(
      `Die Recherchefrage muss 1 bis ${MAX_QUERY_CHARACTERS} Zeichen enthalten.`,
    );
  }
  return query;
}

function normalizeSources(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > MAX_SOURCES) {
    throw new ToolInputError(`Eine Recherche benötigt 2 bis ${MAX_SOURCES} HTTPS-Quellen.`);
  }
  const urls = value.map((candidate) => normalizePublicHttpsUrl(candidate));
  if (new Set(urls).size !== urls.length) {
    throw new ToolInputError("Jede Recherchequelle darf nur einmal vorkommen.");
  }
  const hosts = new Set(urls.map((url) => new URL(url).hostname.toLowerCase()));
  if (hosts.size < 2) {
    throw new ToolInputError(
      "Eine Mehrquellen-Recherche benötigt mindestens zwei unterschiedliche Hosts.",
    );
  }
  return urls;
}

function webOutput(job: ToolJobRecord): WebFetchOutput {
  return (job.output ?? {}) as WebFetchOutput;
}

function sourceReceipt(job: ToolJobRecord, requestedUrl: string, ordinal: number): ResearchSourceReceipt {
  const output = webOutput(job);
  const result = output.result;
  const extraction = result?.extraction;
  return {
    ordinal,
    jobId: job.id,
    jobVersion: job.version,
    status: job.status,
    requestedUrl,
    finalUrl: result?.source?.finalUrl ?? null,
    retrievedAt: result?.source?.retrievedAt ?? null,
    sha256: result?.integrity?.sha256 ?? null,
    bytesRead:
      typeof result?.integrity?.bytesRead === "number"
        ? result.integrity.bytesRead
        : null,
    truncated: result?.integrity?.truncated === true,
    title: extraction?.title ?? null,
    excerpt:
      typeof extraction?.text === "string"
        ? extraction.text.slice(0, MAX_EXCERPT_CHARACTERS)
        : null,
    promptInjectionSignals: Array.isArray(extraction?.promptInjectionSignals)
      ? extraction.promptInjectionSignals.slice(0, 8)
      : [],
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    untrusted: true,
  };
}

export async function runMultiSourceResearch(input: {
  userId: string;
  leaseId: string;
  query: unknown;
  urls: unknown;
  idempotencyKey: string;
  projectId?: string;
}): Promise<ResearchBundle> {
  const query = normalizeQuery(input.query);
  const urls = normalizeSources(input.urls);
  const sources: ResearchSourceReceipt[] = [];

  for (const [index, url] of urls.entries()) {
    const created = await createToolJob({
      userId: input.userId,
      leaseId: input.leaseId,
      toolName: "web.fetch",
      ...(input.projectId ? { projectId: input.projectId } : {}),
      payload: { url },
      idempotencyKey: `${input.idempotencyKey}:${index + 1}`,
      maxAttempts: 2,
    });
    const job =
      created.job.status === "queued"
        ? await executeToolJob({
            userId: input.userId,
            jobId: created.job.id,
            expectedVersion: created.job.version,
          })
        : created.job;
    sources.push(sourceReceipt(job, url, index + 1));
  }

  const successfulSourceCount = sources.filter(
    (source) => source.status === "succeeded",
  ).length;
  return {
    query,
    status:
      successfulSourceCount === sources.length
        ? "complete"
        : successfulSourceCount > 0
          ? "partial"
          : "failed",
    verificationStatus: "unverified-source-observations",
    sourceCount: sources.length,
    successfulSourceCount,
    failedSourceCount: sources.length - successfulSourceCount,
    distinctHostCount: new Set(urls.map((url) => new URL(url).hostname)).size,
    createdAt: new Date().toISOString(),
    sources,
  };
}
