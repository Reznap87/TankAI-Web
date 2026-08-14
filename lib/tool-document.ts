import { currentRuntimeBindings } from "@/lib/request-context";
import {
  inspectCsvDocument,
  queryCsvDocument,
  type CsvTableQuery,
} from "@/lib/csv-document";
import { ToolExecutionError } from "@/lib/tool-errors";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/iu,
  /system\s+prompt/iu,
  /developer\s+message/iu,
  /reveal\s+(your\s+)?instructions/iu,
  /tool\s*call/iu,
];

interface DocumentRow {
  id: string;
  name: string;
  kind: "markdown" | "text" | "json" | "csv";
  content: string;
  content_sha256: string;
  size_bytes: number;
  version: number;
  created_at: string;
  updated_at: string;
}

function database(): D1Database {
  const db = currentRuntimeBindings().DB;
  if (!db) throw new Error("TankAI D1 ist nicht gebunden.");
  return db;
}

export function normalizeDocumentId(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new ToolExecutionError(
      "Die Projektdatei-ID ist ungültig.",
      "DOCUMENT_ID_INVALID",
    );
  }
  return value;
}

function rootType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function headings(content: string): string[] {
  return content
    .split(/\r\n?|\n/gu)
    .flatMap((line) => {
      const match = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/u);
      return match ? [match[1].slice(0, 200)] : [];
    })
    .slice(0, 30);
}

function promptInjectionSignals(content: string): string[] {
  return INJECTION_PATTERNS.flatMap((pattern) => {
    const match = content.match(pattern);
    return match ? [match[0].slice(0, 120)] : [];
  }).slice(0, 8);
}

export async function inspectOwnedProjectDocument(input: {
  userId: string;
  projectId: string | undefined;
  documentId: unknown;
  csvQuery?: CsvTableQuery;
}): Promise<Record<string, unknown>> {
  if (!input.projectId) {
    throw new ToolExecutionError(
      "Die Dokumentprüfung benötigt eine Projektfreigabe.",
      "PROJECT_SCOPE_REQUIRED",
    );
  }
  const documentId = normalizeDocumentId(input.documentId);
  const row = await database()
    .prepare(
      `SELECT id, name, kind, content, content_sha256, size_bytes, version,
              created_at, updated_at
       FROM project_documents
       WHERE id = ? AND project_id = ? AND user_id = ?`,
    )
    .bind(documentId, input.projectId, input.userId)
    .first<DocumentRow>();
  if (!row) {
    throw new ToolExecutionError(
      "Die Projektdatei wurde im freigegebenen Projekt nicht gefunden.",
      "PROJECT_DOCUMENT_NOT_FOUND",
    );
  }
  const trimmed = row.content.trim();
  const result: Record<string, unknown> = {
    document: {
      id: row.id,
      name: row.name,
      kind: row.kind,
      version: Number(row.version),
      sizeBytes: Number(row.size_bytes),
      contentSha256: row.content_sha256,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    analysis: {
      characters: row.content.length,
      codePoints: [...row.content].length,
      words: trimmed ? trimmed.split(/\s+/u).length : 0,
      lines: row.content ? row.content.split(/\r\n?|\n/gu).length : 0,
      headings: row.kind === "markdown" ? headings(row.content) : [],
      preview: row.content.slice(0, 2_000),
    },
    security: {
      untrusted: true,
      promptInjectionSignals: promptInjectionSignals(row.content),
      executableContentRun: false,
    },
  };
  if (row.kind === "json") {
    try {
      const parsed = JSON.parse(row.content) as unknown;
      result.json = { valid: true, rootType: rootType(parsed) };
    } catch (error) {
      result.json = {
        valid: false,
        error: error instanceof SyntaxError
          ? error.message.slice(0, 300)
          : "JSON konnte nicht gelesen werden.",
      };
    }
  }
  if (row.kind === "csv") {
    try {
      result.csv = {
        valid: true,
        ...inspectCsvDocument(row.content),
        table: queryCsvDocument(
          row.content,
          input.csvQuery ?? {
            columns: [],
            filters: [],
            sort: [],
            aggregates: [],
            groupBy: [],
            frequencies: [],
            histograms: [],
            quantiles: [],
            outliers: [],
            dispersion: [],
            relationships: [],
            regressions: [],
            offset: 0,
            limit: 10,
          },
        ),
      };
    } catch (error) {
      result.csv = {
        valid: false,
        error: error instanceof Error
          ? error.message.slice(0, 300)
          : "CSV konnte nicht statisch geprüft werden.",
        executableContentRun: false,
      };
    }
  }
  return result;
}
