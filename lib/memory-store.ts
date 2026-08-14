import {
  createMemoryEmbedding,
  decodeMemoryEmbedding,
  encodeMemoryEmbedding,
  MEMORY_EMBEDDING_DIMENSIONS,
  MEMORY_EMBEDDING_MODEL,
  memoryContentSha256,
  memoryCosineSimilarity,
} from "@/lib/memory-embedding";
import { currentRuntimeBindings } from "@/lib/request-context";
import { readRuntimeInteger } from "@/lib/runtime-env";
import type { TeamMode, TeamRunTrace } from "@/lib/team-runtime";

export type MemoryType = "episodic" | "semantic" | "procedural";
export type MemoryScopeKind = "account" | "project";
export type MemoryVerificationStatus =
  | "observed"
  | "candidate"
  | "confirmed"
  | "disputed"
  | "revoked";
export type MemoryRetentionPolicy = "hot" | "warm" | "cold" | "deleted";

interface MemoryRow {
  id: string;
  project_id: string | null;
  scope_kind: MemoryScopeKind;
  memory_type: MemoryType;
  verification_status: MemoryVerificationStatus;
  retention_policy: MemoryRetentionPolicy;
  source: string;
  content: string;
  confidence: number;
  embedding_base64: string;
  access_count: number;
  created_at: string;
  last_accessed_at: string;
  version: number;
}

interface RunScopeRow {
  project_id: string | null;
  goal_id: string | null;
}

export interface RecalledMemory {
  id: string;
  type: MemoryType;
  verificationStatus: MemoryVerificationStatus;
  source: string;
  content: string;
  confidence: number;
  score: number;
  createdAt: string;
}

export interface MemoryContext {
  embeddingModel: string;
  entries: RecalledMemory[];
}

export interface StoredMemorySummary {
  episodic: number;
  semantic: number;
  procedural: number;
  ids: string[];
}

function database(): D1Database {
  const binding = currentRuntimeBindings().DB;
  if (!binding) throw new Error("TankAI D1 ist nicht gebunden.");
  return binding;
}

function now(): string {
  return new Date().toISOString();
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function trimMemoryContent(
  value: string,
  maximumCharacters = 6_000,
  maximumBytes = 12_000,
): string {
  const normalized = value.replace(/\u0000/gu, "").trim();
  let output =
    normalized.length <= maximumCharacters
      ? normalized
      : normalized.slice(0, maximumCharacters);
  const encoder = new TextEncoder();
  while (output && encoder.encode(output).byteLength > maximumBytes) {
    output = output.slice(0, Math.max(0, output.length - 128));
  }
  return output;
}

function safeJson(value: unknown): string {
  return JSON.stringify(value);
}

function scoreMemory(
  row: MemoryRow,
  queryEmbedding: Int8Array,
): number {
  const embedding = decodeMemoryEmbedding(row.embedding_base64);
  if (!embedding) return -1;
  const similarity = memoryCosineSimilarity(queryEmbedding, embedding);
  const verificationAdjustment: Record<MemoryVerificationStatus, number> = {
    confirmed: 0.12,
    observed: 0.06,
    candidate: 0,
    disputed: -0.25,
    revoked: -1,
  };
  const retentionAdjustment = row.retention_policy === "hot" ? 0.03 : 0;
  const typeAdjustment = row.memory_type === "procedural" ? 0.025 : 0;
  const confidenceAdjustment = (row.confidence - 0.5) * 0.08;
  return (
    similarity +
    verificationAdjustment[row.verification_status] +
    retentionAdjustment +
    typeAdjustment +
    confidenceAdjustment
  );
}

async function createEntry(input: {
  userId: string;
  projectId?: string;
  runId?: string;
  goalId?: string;
  type: MemoryType;
  verificationStatus: MemoryVerificationStatus;
  source: string;
  content: string;
  confidence: number;
  retentionPolicy?: MemoryRetentionPolicy;
  expiresAt?: string;
  provenance?: string[];
  metadata?: Record<string, unknown>;
}): Promise<string | undefined> {
  const content = trimMemoryContent(input.content);
  if (content.length < 20) return undefined;
  const timestamp = now();
  const contentSha256 = await memoryContentSha256(content);
  const existing = await database()
    .prepare(
      `SELECT id FROM memory_entries
       WHERE user_id = ? AND memory_type = ? AND content_sha256 = ?
         AND scope_kind = ?
         AND ((project_id IS NULL AND ? IS NULL) OR project_id = ?)
         AND retention_policy <> 'deleted'
       LIMIT 1`,
    )
    .bind(
      input.userId,
      input.type,
      contentSha256,
      input.projectId ? "project" : "account",
      input.projectId ?? null,
      input.projectId ?? null,
    )
    .first<{ id: string }>();
  if (existing) return undefined;

  const id = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const embeddingBase64 = encodeMemoryEmbedding(createMemoryEmbedding(content));
  await database().batch([
    database()
      .prepare(
        `INSERT INTO memory_entries
          (id, user_id, project_id, related_run_id, related_goal_id, scope_kind,
           memory_type, verification_status, retention_policy, source, content,
           content_sha256, confidence, embedding_model, embedding_dimensions,
           embedding_base64, provenance_json, metadata_json, access_count,
           version, created_at, updated_at, last_accessed_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.userId,
        input.projectId ?? null,
        input.runId ?? null,
        input.goalId ?? null,
        input.projectId ? "project" : "account",
        input.type,
        input.verificationStatus,
        input.retentionPolicy ?? "hot",
        input.source.slice(0, 120),
        content,
        contentSha256,
        clampConfidence(input.confidence),
        MEMORY_EMBEDDING_MODEL,
        MEMORY_EMBEDDING_DIMENSIONS,
        embeddingBase64,
        safeJson(input.provenance ?? []),
        safeJson(input.metadata ?? {}),
        timestamp,
        timestamp,
        timestamp,
        input.expiresAt ?? null,
      ),
    database()
      .prepare(
        `INSERT INTO memory_events
          (id, memory_id, user_id, project_id, run_id, event_type,
           memory_version, note, created_at)
         VALUES (?, ?, ?, ?, ?, 'created', 1, ?, ?)`,
      )
      .bind(
        eventId,
        id,
        input.userId,
        input.projectId ?? null,
        input.runId ?? null,
        `${input.type}:${input.verificationStatus}`,
        timestamp,
      ),
  ]);
  return id;
}

export async function maintainMemoryRetention(userId: string): Promise<void> {
  const timestamp = now();
  const emptyContentHash = await memoryContentSha256("");
  const emptyEmbedding = encodeMemoryEmbedding(createMemoryEmbedding(""));
  const warmCutoff = daysAgo(
    readRuntimeInteger("TANKAI_MEMORY_WARM_AFTER_DAYS", 14, 1, 365),
  );
  const coldCutoff = daysAgo(
    readRuntimeInteger("TANKAI_MEMORY_COLD_AFTER_DAYS", 90, 7, 1_825),
  );
  const maximumHot = readRuntimeInteger(
    "TANKAI_MEMORY_MAX_HOT_ENTRIES",
    400,
    50,
    2_000,
  );
  type RetentionCandidate = {
    id: string;
    project_id: string | null;
    version: number;
  };
  type RetentionTransition = RetentionCandidate & {
    target: "warm" | "cold" | "deleted";
    event: "warmed" | "cooled" | "expired";
    note: string;
  };

  const warmRows = await database()
    .prepare(
      `SELECT id, project_id, version FROM memory_entries
       WHERE user_id = ? AND retention_policy = 'hot'
         AND last_accessed_at < ?
       ORDER BY last_accessed_at ASC
       LIMIT 40`,
    )
    .bind(userId, warmCutoff)
    .all<RetentionCandidate>();
  const overflowRows = await database()
    .prepare(
      `SELECT id, project_id, version FROM memory_entries
       WHERE user_id = ? AND retention_policy = 'hot'
       ORDER BY
         CASE verification_status
           WHEN 'confirmed' THEN 4
           WHEN 'observed' THEN 3
           WHEN 'candidate' THEN 2
           WHEN 'disputed' THEN 1
           ELSE 0
         END ASC,
         confidence ASC, access_count ASC, last_accessed_at ASC
       LIMIT 40 OFFSET ?`,
    )
    .bind(userId, maximumHot)
    .all<RetentionCandidate>();
  const coldRows = await database()
    .prepare(
      `SELECT id, project_id, version FROM memory_entries
       WHERE user_id = ? AND retention_policy IN ('hot', 'warm')
         AND verification_status IN ('candidate', 'disputed')
         AND access_count < 2 AND last_accessed_at < ?
       ORDER BY last_accessed_at ASC
       LIMIT 40`,
    )
    .bind(userId, coldCutoff)
    .all<RetentionCandidate>();
  const expiredRows = await database()
    .prepare(
      `SELECT id, project_id, version FROM memory_entries
       WHERE user_id = ? AND retention_policy <> 'deleted'
         AND expires_at IS NOT NULL AND expires_at <= ?
       ORDER BY expires_at ASC
       LIMIT 40`,
    )
    .bind(userId, timestamp)
    .all<RetentionCandidate>();

  const transitions = new Map<string, RetentionTransition>();
  for (const row of warmRows.results ?? []) {
    transitions.set(row.id, {
      ...row,
      target: "warm",
      event: "warmed",
      note: "Automatische Retention nach Inaktivität.",
    });
  }
  for (const row of overflowRows.results ?? []) {
    transitions.set(row.id, {
      ...row,
      target: "warm",
      event: "warmed",
      note: "Automatische Retention wegen Hot-Memory-Limit.",
    });
  }
  for (const row of coldRows.results ?? []) {
    transitions.set(row.id, {
      ...row,
      target: "cold",
      event: "cooled",
      note: "Automatische Cold-Retention für inaktiven unbestätigten Eintrag.",
    });
  }
  for (const row of expiredRows.results ?? []) {
    transitions.set(row.id, {
      ...row,
      target: "deleted",
      event: "expired",
      note: "Ablaufzeit erreicht; aktiver Inhalt wurde entfernt.",
    });
  }

  const selected = [...transitions.values()].slice(0, 40);
  if (selected.length === 0) return;
  const statements: D1PreparedStatement[] = [];
  for (const transition of selected) {
    const nextVersion = transition.version + 1;
    if (transition.target === "deleted") {
      statements.push(
        database()
          .prepare(
            `UPDATE memory_entries
             SET retention_policy = 'deleted', verification_status = 'revoked',
                 content = '', content_sha256 = ?, embedding_base64 = ?,
                 version = version + 1, updated_at = ?
             WHERE id = ? AND user_id = ? AND version = ?
               AND retention_policy <> 'deleted'`,
          )
          .bind(
            emptyContentHash,
            emptyEmbedding,
            timestamp,
            transition.id,
            userId,
            transition.version,
          ),
      );
    } else {
      statements.push(
        database()
          .prepare(
            `UPDATE memory_entries
             SET retention_policy = ?, version = version + 1, updated_at = ?
             WHERE id = ? AND user_id = ? AND version = ?
               AND retention_policy <> 'deleted'`,
          )
          .bind(
            transition.target,
            timestamp,
            transition.id,
            userId,
            transition.version,
          ),
      );
    }
    statements.push(
      database()
        .prepare(
          `INSERT INTO memory_events
            (id, memory_id, user_id, project_id, run_id, event_type,
             memory_version, note, created_at)
           SELECT ?, id, user_id, project_id, related_run_id, ?, version, ?, ?
           FROM memory_entries
           WHERE id = ? AND user_id = ? AND version = ?
             AND retention_policy = ?`,
        )
        .bind(
          crypto.randomUUID(),
          transition.event,
          transition.note,
          timestamp,
          transition.id,
          userId,
          nextVersion,
          transition.target,
        ),
    );
  }
  await database().batch(statements);
}

export async function recallMemoryContext(input: {
  userId: string;
  query: string;
  projectId?: string;
}): Promise<MemoryContext> {
  await maintainMemoryRetention(input.userId);
  const candidateLimit = readRuntimeInteger(
    "TANKAI_MEMORY_RECALL_CANDIDATES",
    160,
    20,
    500,
  );
  const recallLimit = readRuntimeInteger(
    "TANKAI_MEMORY_RECALL_LIMIT",
    8,
    1,
    20,
  );
  const timestamp = now();
  const rows = await database()
    .prepare(
      `SELECT id, project_id, scope_kind, memory_type, verification_status,
              retention_policy, source, content, confidence, embedding_base64,
              access_count, created_at, last_accessed_at, version
       FROM memory_entries
       WHERE user_id = ? AND retention_policy IN ('hot', 'warm')
         AND verification_status <> 'revoked'
         AND (expires_at IS NULL OR expires_at > ?)
         AND (
           (scope_kind = 'account' AND project_id IS NULL)
           OR (scope_kind = 'project' AND project_id = ? AND ? IS NOT NULL)
         )
       ORDER BY last_accessed_at DESC, created_at DESC
       LIMIT ?`,
    )
    .bind(
      input.userId,
      timestamp,
      input.projectId ?? null,
      input.projectId ?? null,
      candidateLimit,
    )
    .all<MemoryRow>();
  const queryEmbedding = createMemoryEmbedding(input.query);
  const selected = (rows.results ?? [])
    .map((row) => ({ row, score: scoreMemory(row, queryEmbedding) }))
    .filter(({ score, row }) => score >= (row.memory_type === "episodic" ? 0.08 : 0.1))
    .sort((left, right) => right.score - left.score)
    .slice(0, recallLimit);

  if (selected.length > 0) {
    const statements: D1PreparedStatement[] = [];
    for (const { row, score } of selected) {
      statements.push(
        database()
          .prepare(
            `UPDATE memory_entries
             SET access_count = access_count + 1, last_accessed_at = ?, updated_at = ?
             WHERE id = ? AND user_id = ?`,
          )
          .bind(timestamp, timestamp, row.id, input.userId),
        database()
          .prepare(
            `INSERT INTO memory_events
              (id, memory_id, user_id, project_id, run_id, event_type,
               memory_version, note, created_at)
             VALUES (?, ?, ?, ?, NULL, 'recalled', ?, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            row.id,
            input.userId,
            row.project_id,
            row.version,
            `score=${score.toFixed(4)}`,
            timestamp,
          ),
      );
    }
    await database().batch(statements);
  }

  return {
    embeddingModel: MEMORY_EMBEDDING_MODEL,
    entries: selected.map(({ row, score }) => ({
      id: row.id,
      type: row.memory_type,
      verificationStatus: row.verification_status,
      source: row.source,
      content: trimMemoryContent(row.content, 1_200),
      confidence: row.confidence,
      score: Number(score.toFixed(4)),
      createdAt: row.created_at,
    })),
  };
}

function semanticCandidates(answer: string): string[] {
  const withoutCode = answer.replace(/```[\s\S]*?```/gu, " ");
  const blocks = withoutCode
    .split(/\n{2,}|(?<=[.!?])\s+(?=[A-ZÄÖÜ0-9])/u)
    .map((value) => value.replace(/^#{1,6}\s+/u, "").trim())
    .filter(
      (value) =>
        value.length >= 80 &&
        value.length <= 1_200 &&
        !/^(kurz|fazit|antwort|hinweis)\s*:/iu.test(value),
    );
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const block of blocks) {
    const key = block.toLocaleLowerCase("de-DE").replace(/\s+/gu, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(block);
    if (unique.length >= 3) break;
  }
  if (unique.length === 0 && answer.trim().length >= 80) {
    unique.push(trimMemoryContent(answer, 1_200));
  }
  return unique;
}

function procedureContent(trace: TeamRunTrace, message: string): string {
  const steps = trace.plan.tasks
    .map(
      (task, index) =>
        `${index + 1}. [${task.role}] ${task.instruction} | Erfolg: ${task.successCriteria.join("; ")}`,
    )
    .join("\n");
  return `Wiederverwendbares Arbeitsmuster für eine ähnliche Aufgabe.\nAufgabenklasse: ${trimMemoryContent(message, 280)}\nPlan: ${trace.plan.summary}\n${steps}`;
}

export async function persistRunMemories(input: {
  userId: string;
  runId: string;
  message: string;
  answer: string;
  mode: TeamMode;
  trace: TeamRunTrace;
  projectId?: string;
  goalId?: string;
}): Promise<StoredMemorySummary> {
  const ids: string[] = [];
  let episodic = 0;
  let semantic = 0;
  let procedural = 0;
  const expiresAt = daysFromNow(
    readRuntimeInteger("TANKAI_MEMORY_EPISODIC_TTL_DAYS", 365, 30, 3_650),
  );
  const episode = await createEntry({
    userId: input.userId,
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.goalId ? { goalId: input.goalId } : {}),
    runId: input.runId,
    type: "episodic",
    verificationStatus: "observed",
    source: "run:completed",
    confidence: input.trace.degraded ? 0.58 : 0.78,
    expiresAt,
    content: `Nutzerauftrag:\n${trimMemoryContent(input.message, 1_200)}\n\nTankAI-Endantwort:\n${trimMemoryContent(input.answer, 4_300)}`,
    provenance: [input.runId],
    metadata: {
      mode: input.mode,
      planSource: input.trace.plan.source,
      executionState: input.trace.receipt.state,
      factualClaimsVerified: input.trace.receipt.verification.factualClaimsVerified,
    },
  });
  if (episode) {
    ids.push(episode);
    episodic += 1;
  }

  for (const candidate of semanticCandidates(input.answer)) {
    const id = await createEntry({
      userId: input.userId,
      ...(input.projectId ? { projectId: input.projectId } : {}),
      ...(input.goalId ? { goalId: input.goalId } : {}),
      runId: input.runId,
      type: "semantic",
      verificationStatus: "candidate",
      source: "consolidation:deterministic",
      confidence: input.trace.degraded ? 0.42 : 0.62,
      expiresAt: daysFromNow(180),
      content: candidate,
      provenance: [input.runId],
      metadata: {
        extraction: "paragraph-sentence-v1",
        factualClaimsVerified: false,
      },
    });
    if (id) {
      ids.push(id);
      semantic += 1;
    }
  }

  if (
    input.mode !== "fast" &&
    input.trace.plan.source === "planner" &&
    input.trace.receipt.state === "complete" &&
    input.trace.receipt.failedSteps === 0
  ) {
    const id = await createEntry({
      userId: input.userId,
      ...(input.projectId ? { projectId: input.projectId } : {}),
      ...(input.goalId ? { goalId: input.goalId } : {}),
      runId: input.runId,
      type: "procedural",
      verificationStatus: "candidate",
      source: "procedure:successful-team-run",
      confidence: input.trace.receipt.independentProviderReview ? 0.74 : 0.64,
      expiresAt: daysFromNow(365),
      content: procedureContent(input.trace, input.message),
      provenance: [input.runId],
      metadata: {
        mode: input.mode,
        modelCalls: input.trace.modelCalls,
        independentProviderReview:
          input.trace.receipt.independentProviderReview,
      },
    });
    if (id) {
      ids.push(id);
      procedural += 1;
    }
  }

  return { episodic, semantic, procedural, ids };
}

export async function applyRunFeedbackToMemories(input: {
  userId: string;
  runId: string;
  rating: -1 | 1;
  correction?: string;
}): Promise<{ updated: number; correctionMemoryId?: string }> {
  const timestamp = now();
  const rows = await database()
    .prepare(
      `SELECT id, project_id, version FROM memory_entries
       WHERE user_id = ? AND related_run_id = ?
         AND memory_type IN ('semantic', 'procedural')
         AND verification_status IN ('candidate', 'confirmed', 'disputed')
         AND retention_policy <> 'deleted'`,
    )
    .bind(input.userId, input.runId)
    .all<{ id: string; project_id: string | null; version: number }>();
  const entries = rows.results ?? [];
  const statements: D1PreparedStatement[] = [];
  const nextStatus = input.rating === 1 ? "confirmed" : "disputed";
  for (const row of entries) {
    const nextVersion = row.version + 1;
    statements.push(
      database()
        .prepare(
          `UPDATE memory_entries
           SET verification_status = ?,
               confidence = CASE WHEN ? = 1 THEN MAX(confidence, 0.85) ELSE MIN(confidence, 0.2) END,
               retention_policy = CASE WHEN ? = 1 THEN 'hot' ELSE retention_policy END,
               version = version + 1, updated_at = ?
           WHERE id = ? AND user_id = ? AND version = ?
             AND retention_policy <> 'deleted'`,
        )
        .bind(
          nextStatus,
          input.rating,
          input.rating,
          timestamp,
          row.id,
          input.userId,
          row.version,
        ),
      database()
        .prepare(
          `INSERT INTO memory_events
            (id, memory_id, user_id, project_id, run_id, event_type,
             memory_version, note, created_at)
           SELECT ?, id, user_id, project_id, ?, ?, version, ?, ?
           FROM memory_entries
           WHERE id = ? AND user_id = ? AND version = ?
             AND verification_status = ?`,
        )
        .bind(
          crypto.randomUUID(),
          input.runId,
          nextStatus,
          input.correction?.slice(0, 500) ?? null,
          timestamp,
          row.id,
          input.userId,
          nextVersion,
          nextStatus,
        ),
    );
  }
  let updated = 0;
  if (statements.length > 0) {
    const results = await database().batch(statements);
    for (let index = 0; index < results.length; index += 2) {
      updated += Number(
        (results[index].meta as { changes?: number } | undefined)?.changes ?? 0,
      );
    }
  }

  let correctionMemoryId: string | undefined;
  if (input.rating === -1 && input.correction) {
    const scope = await database()
      .prepare(
        `SELECT project_id, goal_id FROM runs
         WHERE id = ? AND user_id = ? AND status = 'completed'`,
      )
      .bind(input.runId, input.userId)
      .first<RunScopeRow>();
    correctionMemoryId = await createEntry({
      userId: input.userId,
      ...(scope?.project_id ? { projectId: scope.project_id } : {}),
      ...(scope?.goal_id ? { goalId: scope.goal_id } : {}),
      runId: input.runId,
      type: "semantic",
      verificationStatus: "confirmed",
      source: "user:correction",
      confidence: 1,
      content: input.correction,
      provenance: [input.runId],
      metadata: { userConfirmed: true },
    });
  }
  return {
    updated,
    ...(correctionMemoryId ? { correctionMemoryId } : {}),
  };
}

export async function listMemories(input: {
  userId: string;
  projectId?: string;
  type?: MemoryType;
  retentionPolicy?: MemoryRetentionPolicy;
  limit?: number;
}): Promise<{
  entries: Array<{
    id: string;
    projectId: string | null;
    scopeKind: MemoryScopeKind;
    type: MemoryType;
    verificationStatus: MemoryVerificationStatus;
    retentionPolicy: MemoryRetentionPolicy;
    source: string;
    content: string;
    confidence: number;
    accessCount: number;
    version: number;
    createdAt: string;
    updatedAt: string;
    lastAccessedAt: string;
  }>;
}> {
  const limit = Math.max(1, Math.min(input.limit ?? 50, 100));
  const conditions = ["user_id = ?"];
  const bindings: Array<string | number | null> = [input.userId];
  if (input.projectId) {
    conditions.push("project_id = ?");
    bindings.push(input.projectId);
  }
  if (input.type) {
    conditions.push("memory_type = ?");
    bindings.push(input.type);
  }
  if (input.retentionPolicy) {
    conditions.push("retention_policy = ?");
    bindings.push(input.retentionPolicy);
  }
  const result = await database()
    .prepare(
      `SELECT id, project_id, scope_kind, memory_type, verification_status,
              retention_policy, source, content, confidence, access_count,
              version, created_at, updated_at, last_accessed_at
       FROM memory_entries
       WHERE ${conditions.join(" AND ")}
       ORDER BY updated_at DESC
       LIMIT ?`,
    )
    .bind(...bindings, limit)
    .all<{
      id: string;
      project_id: string | null;
      scope_kind: MemoryScopeKind;
      memory_type: MemoryType;
      verification_status: MemoryVerificationStatus;
      retention_policy: MemoryRetentionPolicy;
      source: string;
      content: string;
      confidence: number;
      access_count: number;
      version: number;
      created_at: string;
      updated_at: string;
      last_accessed_at: string;
    }>();
  return {
    entries: (result.results ?? []).map((row) => ({
      id: row.id,
      projectId: row.project_id,
      scopeKind: row.scope_kind,
      type: row.memory_type,
      verificationStatus: row.verification_status,
      retentionPolicy: row.retention_policy,
      source: row.source,
      content: row.content,
      confidence: row.confidence,
      accessCount: row.access_count,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastAccessedAt: row.last_accessed_at,
    })),
  };
}

export async function updateMemoryState(input: {
  userId: string;
  memoryId: string;
  expectedVersion: number;
  action: "confirm" | "dispute" | "archive" | "restore" | "delete";
  note?: string;
}): Promise<void> {
  const timestamp = now();
  const emptyContentHash = await memoryContentSha256("");
  const emptyEmbedding = encodeMemoryEmbedding(createMemoryEmbedding(""));
  const mapping = {
    confirm: { verification: "confirmed", retention: null, event: "confirmed" },
    dispute: { verification: "disputed", retention: null, event: "disputed" },
    archive: { verification: null, retention: "cold", event: "archived" },
    restore: { verification: null, retention: "warm", event: "restored" },
    delete: { verification: "revoked", retention: "deleted", event: "deleted" },
  } as const;
  const selected = mapping[input.action];
  const row = await database()
    .prepare(
      `SELECT id, project_id, version, verification_status, retention_policy
       FROM memory_entries
       WHERE id = ? AND user_id = ?`,
    )
    .bind(input.memoryId, input.userId)
    .first<{
      id: string;
      project_id: string | null;
      version: number;
      verification_status: MemoryVerificationStatus;
      retention_policy: MemoryRetentionPolicy;
    }>();
  if (!row) throw new MemoryNotFoundError();
  if (row.version !== input.expectedVersion) throw new MemoryVersionConflictError();
  if (row.retention_policy === "deleted") {
    throw new MemoryStateTransitionError("Ein gelöschter Memory-Eintrag kann nicht verändert werden.");
  }
  if (input.action === "restore" && row.retention_policy !== "cold") {
    throw new MemoryStateTransitionError("Nur ein Cold-Memory-Eintrag kann wiederhergestellt werden.");
  }
  if (input.action === "archive" && row.retention_policy === "cold") {
    throw new MemoryStateTransitionError("Der Memory-Eintrag ist bereits archiviert.");
  }
  if (
    (input.action === "confirm" || input.action === "dispute") &&
    row.verification_status === "revoked"
  ) {
    throw new MemoryStateTransitionError("Ein widerrufener Memory-Eintrag kann nicht bewertet werden.");
  }

  const nextVersion = input.expectedVersion + 1;
  const updateStatement = database()
    .prepare(
      `UPDATE memory_entries
       SET verification_status = COALESCE(?, verification_status),
           confidence = CASE
             WHEN ? = 'confirm' THEN MAX(confidence, 0.9)
             WHEN ? = 'dispute' THEN MIN(confidence, 0.15)
             ELSE confidence
           END,
           retention_policy = CASE
             WHEN ? = 'confirm' THEN 'hot'
             ELSE COALESCE(?, retention_policy)
           END,
           content = CASE WHEN ? = 'delete' THEN '' ELSE content END,
           content_sha256 = CASE WHEN ? = 'delete' THEN ? ELSE content_sha256 END,
           embedding_base64 = CASE WHEN ? = 'delete' THEN ? ELSE embedding_base64 END,
           version = version + 1, updated_at = ?
       WHERE id = ? AND user_id = ? AND version = ?
         AND retention_policy <> 'deleted'`,
    )
    .bind(
      selected.verification,
      input.action,
      input.action,
      input.action,
      selected.retention,
      input.action,
      input.action,
      emptyContentHash,
      input.action,
      emptyEmbedding,
      timestamp,
      input.memoryId,
      input.userId,
      input.expectedVersion,
    );
  const eventStatement = database()
    .prepare(
      `INSERT INTO memory_events
        (id, memory_id, user_id, project_id, run_id, event_type,
         memory_version, note, created_at)
       SELECT ?, id, user_id, project_id, related_run_id, ?, version, ?, ?
       FROM memory_entries
       WHERE id = ? AND user_id = ? AND version = ?`,
    )
    .bind(
      crypto.randomUUID(),
      selected.event,
      input.note?.slice(0, 500) ?? null,
      timestamp,
      input.memoryId,
      input.userId,
      nextVersion,
    );
  const results = await database().batch([updateStatement, eventStatement]);
  const changes = Number(
    (results[0].meta as { changes?: number } | undefined)?.changes ?? 0,
  );
  if (changes !== 1) throw new MemoryVersionConflictError();
}

export class MemoryNotFoundError extends Error {
  readonly status = 404;
  readonly code = "MEMORY_NOT_FOUND";
  constructor() {
    super("Der Memory-Eintrag wurde nicht gefunden.");
    this.name = "MemoryNotFoundError";
  }
}

export class MemoryStateTransitionError extends Error {
  readonly status = 409;
  readonly code = "MEMORY_STATE_TRANSITION";
  constructor(message: string) {
    super(message);
    this.name = "MemoryStateTransitionError";
  }
}

export class MemoryVersionConflictError extends Error {
  readonly status = 409;
  readonly code = "MEMORY_VERSION_CONFLICT";
  constructor() {
    super("Der Memory-Eintrag wurde zwischenzeitlich verändert.");
    this.name = "MemoryVersionConflictError";
  }
}
