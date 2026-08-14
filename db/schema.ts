import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    status: text("status", { enum: ["active", "archived"] }).notNull(),
    version: integer("version").notNull().default(1),
    contentRevision: integer("content_revision").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("projects_user_updated_idx").on(table.userId, table.updatedAt),
    index("projects_user_status_updated_idx").on(
      table.userId,
      table.status,
      table.updatedAt,
    ),
    check("projects_version_check", sql`${table.version} >= 1`),
    check(
      "projects_status_check",
      sql`${table.status} IN ('active', 'archived')`,
    ),
    check(
      "projects_content_revision_check",
      sql`${table.contentRevision} >= 0`,
    ),
  ],
);

export const projectDocuments = sqliteTable(
  "project_documents",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    kind: text("kind", { enum: ["markdown", "text", "json", "csv"] }).notNull(),
    content: text("content").notNull(),
    contentSha256: text("content_sha256").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("project_documents_project_updated_idx").on(
      table.projectId,
      table.updatedAt,
    ),
    index("project_documents_user_updated_idx").on(
      table.userId,
      table.updatedAt,
    ),
    uniqueIndex("project_documents_project_name_idx").on(
      table.projectId,
      table.name,
    ),
    check("project_documents_version_check", sql`${table.version} >= 1`),
    check(
      "project_documents_kind_check",
      sql`${table.kind} IN ('markdown', 'text', 'json', 'csv')`,
    ),
    check(
      "project_documents_size_check",
      sql`${table.sizeBytes} >= 0 AND ${table.sizeBytes} <= 24000 AND ${table.sizeBytes} = length(CAST(${table.content} AS BLOB))`,
    ),
    check(
      "project_documents_content_length_check",
      sql`length(${table.content}) <= 20000`,
    ),
    check(
      "project_documents_hash_check",
      sql`length(${table.contentSha256}) = 64 AND ${table.contentSha256} NOT GLOB '*[^0-9a-f]*'`,
    ),
  ],
);

export const projectDocumentVersions = sqliteTable(
  "project_document_versions",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => projectDocuments.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    version: integer("version").notNull(),
    name: text("name").notNull(),
    kind: text("kind", { enum: ["markdown", "text", "json", "csv"] }).notNull(),
    content: text("content").notNull(),
    contentSha256: text("content_sha256").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    changeNote: text("change_note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("project_document_versions_document_version_idx").on(
      table.documentId,
      table.version,
    ),
    index("project_document_versions_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
    index("project_document_versions_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    check(
      "project_document_versions_version_check",
      sql`${table.version} >= 1`,
    ),
    check(
      "project_document_versions_kind_check",
      sql`${table.kind} IN ('markdown', 'text', 'json', 'csv')`,
    ),
    check(
      "project_document_versions_size_check",
      sql`${table.sizeBytes} >= 0 AND ${table.sizeBytes} <= 24000 AND ${table.sizeBytes} = length(CAST(${table.content} AS BLOB))`,
    ),
    check(
      "project_document_versions_content_length_check",
      sql`length(${table.content}) <= 20000`,
    ),
    check(
      "project_document_versions_hash_check",
      sql`length(${table.contentSha256}) = 64 AND ${table.contentSha256} NOT GLOB '*[^0-9a-f]*'`,
    ),
  ],
);

export const goals = sqliteTable(
  "goals",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    objective: text("objective").notNull(),
    definitionOfDone: text("definition_of_done").notNull(),
    status: text("status", {
      enum: [
        "draft",
        "planned",
        "ready",
        "running",
        "waiting",
        "verifying",
        "completed",
        "failed",
        "cancelled",
      ],
    }).notNull(),
    progressPercent: integer("progress_percent").notNull().default(0),
    currentStep: text("current_step"),
    nextAction: text("next_action"),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [
    index("goals_user_updated_idx").on(table.userId, table.updatedAt),
    index("goals_user_status_updated_idx").on(
      table.userId,
      table.status,
      table.updatedAt,
    ),
    check(
      "goals_progress_check",
      sql`${table.progressPercent} >= 0 AND ${table.progressPercent} <= 100`,
    ),
    check("goals_version_check", sql`${table.version} >= 1`),
  ],
);

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("conversations_user_updated_idx").on(table.userId, table.updatedAt),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    runId: text("run_id"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt,
    ),
    index("messages_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const capabilityLeases = sqliteTable(
  "capability_leases",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    capability: text("capability", { enum: ["model.run"] }).notNull(),
    mode: text("mode", { enum: ["fast", "team", "deep"] }).notNull(),
    scopeKind: text("scope_kind", {
      enum: ["account", "project"],
    }).notNull(),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    status: text("status", {
      enum: ["active", "revoked", "depleted"],
    }).notNull(),
    maxUses: integer("max_uses").notNull(),
    remainingUses: integer("remaining_uses").notNull(),
    version: integer("version").notNull().default(1),
    expiresAt: text("expires_at").notNull(),
    lastEventId: text("last_event_id").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    lastUsedAt: text("last_used_at"),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    index("capability_leases_user_status_expires_idx").on(
      table.userId,
      table.status,
      table.expiresAt,
    ),
    index("capability_leases_project_status_idx").on(
      table.projectId,
      table.status,
    ),
    uniqueIndex("capability_leases_last_event_idx").on(table.lastEventId),
    check(
      "capability_leases_capability_check",
      sql`${table.capability} = 'model.run'`,
    ),
    check(
      "capability_leases_mode_check",
      sql`${table.mode} IN ('fast', 'team', 'deep')`,
    ),
    check(
      "capability_leases_scope_check",
      sql`(${table.scopeKind} = 'account' AND ${table.projectId} IS NULL) OR (${table.scopeKind} = 'project' AND ${table.projectId} IS NOT NULL)`,
    ),
    check(
      "capability_leases_status_check",
      sql`${table.status} IN ('active', 'revoked', 'depleted')`,
    ),
    check(
      "capability_leases_usage_check",
      sql`${table.maxUses} >= 1 AND ${table.maxUses} <= 20 AND ${table.remainingUses} >= 0 AND ${table.remainingUses} <= ${table.maxUses}`,
    ),
    check("capability_leases_version_check", sql`${table.version} >= 1`),
    check(
      "capability_leases_state_check",
      sql`(${table.status} = 'active' AND ${table.remainingUses} > 0 AND ${table.revokedAt} IS NULL) OR (${table.status} = 'revoked' AND ${table.revokedAt} IS NOT NULL) OR (${table.status} = 'depleted' AND ${table.remainingUses} = 0 AND ${table.revokedAt} IS NULL)`,
    ),
  ],
);

export const runs = sqliteTable(
  "runs",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    goalId: text("goal_id").references(() => goals.id, {
      onDelete: "set null",
    }),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    capabilityLeaseId: text("capability_lease_id").references(
      () => capabilityLeases.id,
      { onDelete: "set null" },
    ),
    userId: text("user_id").notNull(),
    mode: text("mode", { enum: ["fast", "team", "deep"] }).notNull(),
    status: text("status", {
      enum: ["running", "completed", "failed"],
    }).notNull(),
    promptVersion: text("prompt_version").notNull(),
    traceJson: text("trace_json"),
    errorCode: text("error_code"),
    modelCalls: integer("model_calls").notNull().default(0),
    elapsedMs: integer("elapsed_ms"),
    createdAt: text("created_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [
    index("runs_user_created_idx").on(table.userId, table.createdAt),
    index("runs_conversation_created_idx").on(
      table.conversationId,
      table.createdAt,
    ),
    index("runs_goal_created_idx").on(table.goalId, table.createdAt),
    index("runs_project_created_idx").on(table.projectId, table.createdAt),
    index("runs_capability_lease_created_idx").on(
      table.capabilityLeaseId,
      table.createdAt,
    ),
  ],
);

export const capabilityLeaseEvents = sqliteTable(
  "capability_lease_events",
  {
    id: text("id").primaryKey(),
    leaseId: text("lease_id")
      .notNull()
      .references(() => capabilityLeases.id, { onDelete: "cascade" }),
    runId: text("run_id").references(() => runs.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").notNull(),
    eventType: text("event_type", {
      enum: ["created", "consumed", "revoked"],
    }).notNull(),
    leaseVersion: integer("lease_version").notNull(),
    remainingUses: integer("remaining_uses").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("capability_lease_events_lease_created_idx").on(
      table.leaseId,
      table.createdAt,
    ),
    index("capability_lease_events_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("capability_lease_events_run_idx").on(table.runId),
    check(
      "capability_lease_events_type_check",
      sql`${table.eventType} IN ('created', 'consumed', 'revoked')`,
    ),
    check(
      "capability_lease_events_version_check",
      sql`${table.leaseVersion} >= 1`,
    ),
    check(
      "capability_lease_events_remaining_check",
      sql`${table.remainingUses} >= 0`,
    ),
  ],
);

export const projectEvents = sqliteTable(
  "project_events",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    documentId: text("document_id").references(() => projectDocuments.id, {
      onDelete: "set null",
    }),
    runId: text("run_id").references(() => runs.id, { onDelete: "set null" }),
    userId: text("user_id").notNull(),
    eventType: text("event_type", {
      enum: [
        "project_created",
        "project_updated",
        "project_archived",
        "project_restored",
        "document_created",
        "document_updated",
        "run_started",
        "run_completed",
        "run_failed",
      ],
    }).notNull(),
    projectVersion: integer("project_version").notNull(),
    documentVersion: integer("document_version"),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("project_events_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
    index("project_events_document_created_idx").on(
      table.documentId,
      table.createdAt,
    ),
    index("project_events_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("project_events_run_idx").on(table.runId),
    check(
      "project_events_project_version_check",
      sql`${table.projectVersion} >= 1`,
    ),
    check(
      "project_events_type_check",
      sql`${table.eventType} IN ('project_created', 'project_updated', 'project_archived', 'project_restored', 'document_created', 'document_updated', 'run_started', 'run_completed', 'run_failed')`,
    ),
    check(
      "project_events_document_version_check",
      sql`${table.documentVersion} IS NULL OR ${table.documentVersion} >= 1`,
    ),
  ],
);

export const goalEvents = sqliteTable(
  "goal_events",
  {
    id: text("id").primaryKey(),
    goalId: text("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    runId: text("run_id").references(() => runs.id, { onDelete: "set null" }),
    userId: text("user_id").notNull(),
    eventType: text("event_type", {
      enum: [
        "created",
        "status_changed",
        "progress_recorded",
        "note_added",
        "run_started",
        "run_completed",
        "run_failed",
      ],
    }).notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    progressPercent: integer("progress_percent"),
    currentStep: text("current_step"),
    nextAction: text("next_action"),
    note: text("note"),
    goalVersion: integer("goal_version").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("goal_events_goal_created_idx").on(table.goalId, table.createdAt),
    index("goal_events_user_created_idx").on(table.userId, table.createdAt),
    index("goal_events_run_idx").on(table.runId),
    check(
      "goal_events_progress_check",
      sql`${table.progressPercent} IS NULL OR (${table.progressPercent} >= 0 AND ${table.progressPercent} <= 100)`,
    ),
  ],
);

export const feedback = sqliteTable(
  "feedback",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    rating: integer("rating").notNull(),
    correction: text("correction"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("feedback_run_user_idx").on(table.runId, table.userId)],
);

export const learningCases = sqliteTable(
  "learning_cases",
  {
    id: text("id").primaryKey(),
    feedbackId: text("feedback_id")
      .notNull()
      .references(() => feedback.id, { onDelete: "cascade" }),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    source: text("source", {
      enum: ["corrected-negative-feedback"],
    }).notNull(),
    status: text("status", {
      enum: ["queued", "included", "dismissed"],
    }).notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("learning_cases_user_status_idx").on(table.userId, table.status),
    index("learning_cases_feedback_idx").on(table.feedbackId),
  ],
);


export const memoryEntries = sqliteTable(
  "memory_entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    relatedRunId: text("related_run_id").references(() => runs.id, {
      onDelete: "set null",
    }),
    relatedGoalId: text("related_goal_id").references(() => goals.id, {
      onDelete: "set null",
    }),
    scopeKind: text("scope_kind", {
      enum: ["account", "project"],
    }).notNull(),
    memoryType: text("memory_type", {
      enum: ["episodic", "semantic", "procedural"],
    }).notNull(),
    verificationStatus: text("verification_status", {
      enum: ["observed", "candidate", "confirmed", "disputed", "revoked"],
    }).notNull(),
    retentionPolicy: text("retention_policy", {
      enum: ["hot", "warm", "cold", "deleted"],
    }).notNull(),
    source: text("source").notNull(),
    content: text("content").notNull(),
    contentSha256: text("content_sha256").notNull(),
    confidence: real("confidence").notNull(),
    embeddingModel: text("embedding_model").notNull(),
    embeddingDimensions: integer("embedding_dimensions").notNull(),
    embeddingBase64: text("embedding_base64").notNull(),
    provenanceJson: text("provenance_json").notNull(),
    metadataJson: text("metadata_json").notNull(),
    accessCount: integer("access_count").notNull().default(0),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    lastAccessedAt: text("last_accessed_at").notNull(),
    expiresAt: text("expires_at"),
  },
  (table) => [
    index("memory_entries_user_recent_idx").on(
      table.userId,
      table.retentionPolicy,
      table.lastAccessedAt,
    ),
    index("memory_entries_project_recent_idx").on(
      table.projectId,
      table.retentionPolicy,
      table.lastAccessedAt,
    ),
    index("memory_entries_run_idx").on(table.relatedRunId),
    index("memory_entries_goal_idx").on(table.relatedGoalId),
    index("memory_entries_user_type_idx").on(
      table.userId,
      table.memoryType,
      table.verificationStatus,
    ),
    index("memory_entries_hash_idx").on(table.userId, table.contentSha256),
    check(
      "memory_entries_scope_check",
      sql`(${table.scopeKind} = 'account' AND ${table.projectId} IS NULL) OR (${table.scopeKind} = 'project' AND ${table.projectId} IS NOT NULL)`,
    ),
    check(
      "memory_entries_type_check",
      sql`${table.memoryType} IN ('episodic', 'semantic', 'procedural')`,
    ),
    check(
      "memory_entries_verification_check",
      sql`${table.verificationStatus} IN ('observed', 'candidate', 'confirmed', 'disputed', 'revoked')`,
    ),
    check(
      "memory_entries_retention_check",
      sql`${table.retentionPolicy} IN ('hot', 'warm', 'cold', 'deleted')`,
    ),
    check(
      "memory_entries_confidence_check",
      sql`${table.confidence} >= 0 AND ${table.confidence} <= 1`,
    ),
    check(
      "memory_entries_content_size_check",
      sql`length(${table.content}) <= 6000 AND length(CAST(${table.content} AS BLOB)) <= 12000`,
    ),
    check(
      "memory_entries_hash_check",
      sql`length(${table.contentSha256}) = 64 AND ${table.contentSha256} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check(
      "memory_entries_embedding_check",
      sql`${table.embeddingDimensions} = 192 AND length(${table.embeddingBase64}) > 0`,
    ),
    check("memory_entries_access_check", sql`${table.accessCount} >= 0`),
    check("memory_entries_version_check", sql`${table.version} >= 1`),
  ],
);

export const memoryEvents = sqliteTable(
  "memory_events",
  {
    id: text("id").primaryKey(),
    memoryId: text("memory_id")
      .notNull()
      .references(() => memoryEntries.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    runId: text("run_id").references(() => runs.id, { onDelete: "set null" }),
    eventType: text("event_type", {
      enum: [
        "created",
        "recalled",
        "confirmed",
        "disputed",
        "warmed",
        "cooled",
        "archived",
        "restored",
        "expired",
        "deleted",
      ],
    }).notNull(),
    memoryVersion: integer("memory_version").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("memory_events_memory_created_idx").on(
      table.memoryId,
      table.createdAt,
    ),
    index("memory_events_user_created_idx").on(table.userId, table.createdAt),
    index("memory_events_run_idx").on(table.runId),
    check(
      "memory_events_type_check",
      sql`${table.eventType} IN ('created', 'recalled', 'confirmed', 'disputed', 'warmed', 'cooled', 'archived', 'restored', 'expired', 'deleted')`,
    ),
    check("memory_events_version_check", sql`${table.memoryVersion} >= 1`),
  ],
);


export const toolExecutionLeases = sqliteTable(
  "tool_execution_leases",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    scopeKind: text("scope_kind", {
      enum: ["account", "project"],
    }).notNull(),
    toolName: text("tool_name", {
      enum: [
        "text.sha256",
        "text.analyze",
        "json.validate",
        "memory.retention",
        "web.fetch",
        "project.document.inspect",
        "code.patch.inspect",
      ],
    }).notNull(),
    status: text("status", {
      enum: ["active", "revoked", "depleted"],
    }).notNull(),
    maxUses: integer("max_uses").notNull(),
    remainingUses: integer("remaining_uses").notNull(),
    version: integer("version").notNull().default(1),
    expiresAt: text("expires_at").notNull(),
    lastEventId: text("last_event_id").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    lastUsedAt: text("last_used_at"),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    index("tool_execution_leases_user_status_expires_idx").on(
      table.userId,
      table.status,
      table.expiresAt,
    ),
    index("tool_execution_leases_project_status_idx").on(
      table.projectId,
      table.status,
    ),
    uniqueIndex("tool_execution_leases_last_event_idx").on(table.lastEventId),
    check(
      "tool_execution_leases_scope_check",
      sql`(${table.scopeKind} = 'account' AND ${table.projectId} IS NULL) OR (${table.scopeKind} = 'project' AND ${table.projectId} IS NOT NULL)`,
    ),
    check(
      "tool_execution_leases_tool_check",
      sql`${table.toolName} IN ('text.sha256', 'text.analyze', 'json.validate', 'memory.retention', 'web.fetch', 'project.document.inspect', 'code.patch.inspect')`,
    ),
    check(
      "tool_execution_leases_status_check",
      sql`${table.status} IN ('active', 'revoked', 'depleted')`,
    ),
    check(
      "tool_execution_leases_usage_check",
      sql`${table.maxUses} >= 1 AND ${table.maxUses} <= 20 AND ${table.remainingUses} >= 0 AND ${table.remainingUses} <= ${table.maxUses}`,
    ),
    check("tool_execution_leases_version_check", sql`${table.version} >= 1`),
    check(
      "tool_execution_leases_state_check",
      sql`(${table.status} = 'active' AND ${table.remainingUses} > 0 AND ${table.revokedAt} IS NULL) OR (${table.status} = 'revoked' AND ${table.revokedAt} IS NOT NULL) OR (${table.status} = 'depleted' AND ${table.remainingUses} = 0 AND ${table.revokedAt} IS NULL)`,
    ),
  ],
);

export const workerAgents = sqliteTable(
  "worker_agents",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    status: text("status", { enum: ["active", "draining", "revoked"] }).notNull(),
    tokenSha256: text("token_sha256").notNull(),
    maxConcurrency: integer("max_concurrency").notNull().default(1),
    version: integer("version").notNull().default(1),
    lastSeenAt: text("last_seen_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    uniqueIndex("worker_agents_token_sha256_idx").on(table.tokenSha256),
    index("worker_agents_user_status_idx").on(table.userId, table.status),
    check("worker_agents_status_check", sql`${table.status} IN ('active', 'draining', 'revoked')`),
    check("worker_agents_name_check", sql`length(${table.name}) >= 1 AND length(${table.name}) <= 80`),
    check("worker_agents_token_hash_check", sql`length(${table.tokenSha256}) = 64 AND ${table.tokenSha256} NOT GLOB '*[^0-9a-f]*'`),
    check("worker_agents_concurrency_check", sql`${table.maxConcurrency} >= 1 AND ${table.maxConcurrency} <= 4`),
    check("worker_agents_version_check", sql`${table.version} >= 1`),
    check("worker_agents_state_check", sql`(${table.status} IN ('active', 'draining') AND ${table.revokedAt} IS NULL) OR (${table.status} = 'revoked' AND ${table.revokedAt} IS NOT NULL)`),
  ],
);

export const workerAgentEvents = sqliteTable(
  "worker_agent_events",
  {
    id: text("id").primaryKey(),
    workerId: text("worker_id").notNull().references(() => workerAgents.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    eventType: text("event_type", { enum: ["registered", "activated", "draining", "revoked"] }).notNull(),
    workerVersion: integer("worker_version").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("worker_agent_events_worker_created_idx").on(table.workerId, table.createdAt),
    index("worker_agent_events_user_created_idx").on(table.userId, table.createdAt),
    check("worker_agent_events_type_check", sql`${table.eventType} IN ('registered', 'activated', 'draining', 'revoked')`),
    check("worker_agent_events_version_check", sql`${table.workerVersion} >= 1`),
  ],
);

export const toolJobs = sqliteTable(
  "tool_jobs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
    leaseId: text("lease_id").notNull().references(() => toolExecutionLeases.id, { onDelete: "restrict" }),
    toolName: text("tool_name", { enum: ["text.sha256", "text.analyze", "json.validate", "memory.retention", "web.fetch", "project.document.inspect", "code.patch.inspect"] }).notNull(),
    status: text("status", { enum: ["queued", "running", "succeeded", "failed", "cancelled", "dead_letter"] }).notNull(),
    inputJson: text("input_json").notNull(),
    inputSha256: text("input_sha256").notNull(),
    outputJson: text("output_json"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    progressPercent: integer("progress_percent").notNull().default(0),
    attempt: integer("attempt").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(1),
    version: integer("version").notNull().default(1),
    workerId: text("worker_id").references(() => workerAgents.id, { onDelete: "set null" }),
    claimToken: text("claim_token"),
    heartbeatAt: text("heartbeat_at"),
    claimExpiresAt: text("claim_expires_at"),
    availableAt: text("available_at").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
  },
  (table) => [
    uniqueIndex("tool_jobs_user_idempotency_idx").on(table.userId, table.idempotencyKey),
    index("tool_jobs_user_status_available_idx").on(table.userId, table.status, table.availableAt),
    index("tool_jobs_project_created_idx").on(table.projectId, table.createdAt),
    index("tool_jobs_lease_created_idx").on(table.leaseId, table.createdAt),
    index("tool_jobs_worker_status_expires_idx").on(table.workerId, table.status, table.claimExpiresAt),
    check("tool_jobs_tool_check", sql`${table.toolName} IN ('text.sha256', 'text.analyze', 'json.validate', 'memory.retention', 'web.fetch', 'project.document.inspect', 'code.patch.inspect')`),
    check("tool_jobs_status_check", sql`${table.status} IN ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'dead_letter')`),
    check("tool_jobs_progress_check", sql`${table.progressPercent} >= 0 AND ${table.progressPercent} <= 100`),
    check("tool_jobs_attempt_check", sql`${table.attempt} >= 0 AND ${table.maxAttempts} >= 1 AND ${table.maxAttempts} <= 3 AND ${table.attempt} <= ${table.maxAttempts}`),
    check("tool_jobs_version_check", sql`${table.version} >= 1`),
    check("tool_jobs_input_size_check", sql`length(CAST(${table.inputJson} AS BLOB)) <= 24000`),
    check("tool_jobs_output_size_check", sql`${table.outputJson} IS NULL OR length(CAST(${table.outputJson} AS BLOB)) <= 48000`),
    check("tool_jobs_hash_check", sql`length(${table.inputSha256}) = 64 AND ${table.inputSha256} NOT GLOB '*[^0-9a-f]*'`),
    check("tool_jobs_worker_claim_check", sql`(${table.workerId} IS NULL AND ${table.claimExpiresAt} IS NULL) OR (${table.workerId} IS NOT NULL AND ${table.claimExpiresAt} IS NOT NULL)`),
  ],
);

export const toolExecutionLeaseEvents = sqliteTable(
  "tool_execution_lease_events",
  {
    id: text("id").primaryKey(),
    leaseId: text("lease_id")
      .notNull()
      .references(() => toolExecutionLeases.id, { onDelete: "cascade" }),
    jobId: text("job_id").references(() => toolJobs.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").notNull(),
    eventType: text("event_type", {
      enum: ["created", "consumed", "revoked"],
    }).notNull(),
    leaseVersion: integer("lease_version").notNull(),
    remainingUses: integer("remaining_uses").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("tool_execution_lease_events_lease_created_idx").on(
      table.leaseId,
      table.createdAt,
    ),
    index("tool_execution_lease_events_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("tool_execution_lease_events_job_idx").on(table.jobId),
    check(
      "tool_execution_lease_events_type_check",
      sql`${table.eventType} IN ('created', 'consumed', 'revoked')`,
    ),
    check(
      "tool_execution_lease_events_version_check",
      sql`${table.leaseVersion} >= 1`,
    ),
    check(
      "tool_execution_lease_events_remaining_check",
      sql`${table.remainingUses} >= 0`,
    ),
  ],
);

export const toolJobEvents = sqliteTable(
  "tool_job_events",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id").notNull().references(() => toolJobs.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    workerId: text("worker_id").references(() => workerAgents.id, { onDelete: "set null" }),
    eventType: text("event_type", { enum: ["created", "claimed", "heartbeat", "progress", "succeeded", "failed", "requeued", "retry_scheduled", "cancelled", "recovered", "dead_letter"] }).notNull(),
    jobVersion: integer("job_version").notNull(),
    attempt: integer("attempt").notNull(),
    progressPercent: integer("progress_percent").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("tool_job_events_job_created_idx").on(table.jobId, table.createdAt),
    index("tool_job_events_user_created_idx").on(table.userId, table.createdAt),
    index("tool_job_events_worker_created_idx").on(table.workerId, table.createdAt),
    check("tool_job_events_type_check", sql`${table.eventType} IN ('created', 'claimed', 'heartbeat', 'progress', 'succeeded', 'failed', 'requeued', 'retry_scheduled', 'cancelled', 'recovered', 'dead_letter')`),
    check("tool_job_events_version_check", sql`${table.jobVersion} >= 1`),
    check("tool_job_events_attempt_check", sql`${table.attempt} >= 0`),
    check("tool_job_events_progress_check", sql`${table.progressPercent} >= 0 AND ${table.progressPercent} <= 100`),
  ],
);


export const reactRuns = sqliteTable(
  "react_runs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
    objective: text("objective").notNull(),
    definitionOfDone: text("definition_of_done").notNull(),
    status: text("status", { enum: ["ready", "running", "waiting_tool", "verifying", "completed", "failed", "cancelled", "budget_exhausted"] }).notNull(),
    currentStep: integer("current_step").notNull().default(0),
    maxSteps: integer("max_steps").notNull(),
    modelCallsUsed: integer("model_calls_used").notNull().default(0),
    maxModelCalls: integer("max_model_calls").notNull(),
    toolActionsUsed: integer("tool_actions_used").notNull().default(0),
    maxToolActions: integer("max_tool_actions").notNull(),
    version: integer("version").notNull().default(1),
    finalAnswer: text("final_answer"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [
    index("react_runs_user_updated_idx").on(table.userId, table.updatedAt),
    index("react_runs_project_updated_idx").on(table.projectId, table.updatedAt),
    index("react_runs_user_status_idx").on(table.userId, table.status, table.updatedAt),
    check("react_runs_status_check", sql`${table.status} IN ('ready','running','waiting_tool','verifying','completed','failed','cancelled','budget_exhausted')`),
    check("react_runs_steps_check", sql`${table.currentStep} >= 0 AND ${table.maxSteps} >= 1 AND ${table.maxSteps} <= 32 AND ${table.currentStep} <= ${table.maxSteps}`),
    check("react_runs_model_budget_check", sql`${table.modelCallsUsed} >= 0 AND ${table.maxModelCalls} >= 1 AND ${table.maxModelCalls} <= 20 AND ${table.modelCallsUsed} <= ${table.maxModelCalls}`),
    check("react_runs_tool_budget_check", sql`${table.toolActionsUsed} >= 0 AND ${table.maxToolActions} >= 0 AND ${table.maxToolActions} <= 32 AND ${table.toolActionsUsed} <= ${table.maxToolActions}`),
    check("react_runs_version_check", sql`${table.version} >= 1`),
  ],
);

export const reactSteps = sqliteTable(
  "react_steps",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull().references(() => reactRuns.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    sequenceNumber: integer("sequence_number").notNull(),
    status: text("status", { enum: ["waiting_tool", "observed", "completed", "failed"] }).notNull(),
    decisionSummary: text("decision_summary").notNull(),
    actionType: text("action_type", { enum: ["tool", "final"] }).notNull(),
    toolName: text("tool_name", { enum: ["text.sha256", "text.analyze", "json.validate", "memory.retention", "web.fetch", "project.document.inspect", "code.patch.inspect"] }),
    toolJobId: text("tool_job_id").references(() => toolJobs.id, { onDelete: "set null" }),
    actionInputJson: text("action_input_json"),
    observationJson: text("observation_json"),
    observationSha256: text("observation_sha256"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [
    uniqueIndex("react_steps_run_sequence_idx").on(table.runId, table.sequenceNumber),
    index("react_steps_user_created_idx").on(table.userId, table.createdAt),
    index("react_steps_tool_job_idx").on(table.toolJobId),
    check("react_steps_sequence_check", sql`${table.sequenceNumber} >= 1 AND ${table.sequenceNumber} <= 32`),
    check("react_steps_status_check", sql`${table.status} IN ('waiting_tool','observed','completed','failed')`),
    check("react_steps_action_check", sql`${table.actionType} IN ('tool','final')`),
  ],
);

export const reactEvents = sqliteTable(
  "react_events",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull().references(() => reactRuns.id, { onDelete: "cascade" }),
    stepId: text("step_id").references(() => reactSteps.id, { onDelete: "set null" }),
    userId: text("user_id").notNull(),
    eventType: text("event_type", { enum: ["created", "decision", "tool_dispatched", "observation", "completed", "failed", "cancelled", "budget_exhausted"] }).notNull(),
    runVersion: integer("run_version").notNull(),
    sequenceNumber: integer("sequence_number").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("react_events_run_created_idx").on(table.runId, table.createdAt),
    index("react_events_user_created_idx").on(table.userId, table.createdAt),
    check("react_events_type_check", sql`${table.eventType} IN ('created','decision','tool_dispatched','observation','completed','failed','cancelled','budget_exhausted')`),
    check("react_events_version_check", sql`${table.runVersion} >= 1`),
    check("react_events_sequence_check", sql`${table.sequenceNumber} >= 0 AND ${table.sequenceNumber} <= 32`),
  ],
);


export const commanderRuns = sqliteTable(
  "commander_runs",
  {
    id: text("id").primaryKey(),
    reactRunId: text("react_run_id").notNull().references(() => reactRuns.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
    capabilityLeaseId: text("capability_lease_id").notNull().references(() => capabilityLeases.id, { onDelete: "restrict" }),
    status: text("status", { enum: ["ready", "running", "waiting_tool", "reviewing", "completed", "failed", "cancelled", "budget_exhausted", "model_unavailable"] }).notNull(),
    cycleCount: integer("cycle_count").notNull().default(0),
    maxCycles: integer("max_cycles").notNull(),
    modelCallsUsed: integer("model_calls_used").notNull().default(0),
    maxModelCalls: integer("max_model_calls").notNull(),
    reviewCallsUsed: integer("review_calls_used").notNull().default(0),
    maxReviewCalls: integer("max_review_calls").notNull(),
    version: integer("version").notNull().default(1),
    finalAnswer: text("final_answer"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [
    uniqueIndex("commander_runs_react_idx").on(table.reactRunId),
    index("commander_runs_user_updated_idx").on(table.userId, table.updatedAt),
    index("commander_runs_user_status_idx").on(table.userId, table.status, table.updatedAt),
    index("commander_runs_project_updated_idx").on(table.projectId, table.updatedAt),
    index("commander_runs_capability_lease_idx").on(table.capabilityLeaseId, table.updatedAt),
    check("commander_runs_status_check", sql`${table.status} IN ('ready','running','waiting_tool','reviewing','completed','failed','cancelled','budget_exhausted','model_unavailable')`),
    check("commander_runs_cycles_check", sql`${table.cycleCount} >= 0 AND ${table.maxCycles} >= 1 AND ${table.maxCycles} <= 24 AND ${table.cycleCount} <= ${table.maxCycles}`),
    check("commander_runs_model_budget_check", sql`${table.modelCallsUsed} >= 0 AND ${table.maxModelCalls} >= 2 AND ${table.maxModelCalls} <= 20 AND ${table.modelCallsUsed} <= ${table.maxModelCalls}`),
    check("commander_runs_review_budget_check", sql`${table.reviewCallsUsed} >= 0 AND ${table.maxReviewCalls} >= 1 AND ${table.maxReviewCalls} <= 16 AND ${table.reviewCallsUsed} <= ${table.maxReviewCalls}`),
    check("commander_runs_version_check", sql`${table.version} >= 1`),
  ],
);

export const commanderCapabilityEvents = sqliteTable(
  "commander_capability_events",
  {
    id: text("id").primaryKey(),
    capabilityLeaseId: text("capability_lease_id").notNull().references(() => capabilityLeases.id, { onDelete: "restrict" }),
    commanderRunId: text("commander_run_id").notNull().references(() => commanderRuns.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    phase: text("phase", { enum: ["decision", "review"] }).notNull(),
    leaseVersion: integer("lease_version").notNull(),
    remainingUses: integer("remaining_uses").notNull(),
    cycleNumber: integer("cycle_number").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("commander_capability_events_run_created_idx").on(table.commanderRunId, table.createdAt),
    index("commander_capability_events_lease_created_idx").on(table.capabilityLeaseId, table.createdAt),
    index("commander_capability_events_user_created_idx").on(table.userId, table.createdAt),
    check("commander_capability_events_phase_check", sql`${table.phase} IN ('decision','review')`),
    check("commander_capability_events_version_check", sql`${table.leaseVersion} >= 2`),
    check("commander_capability_events_remaining_check", sql`${table.remainingUses} >= 0`),
    check("commander_capability_events_cycle_check", sql`${table.cycleNumber} >= 0 AND ${table.cycleNumber} <= 24`),
  ],
);

export const commanderDecisions = sqliteTable(
  "commander_decisions",
  {
    id: text("id").primaryKey(),
    commanderRunId: text("commander_run_id").notNull().references(() => commanderRuns.id, { onDelete: "cascade" }),
    reactStepId: text("react_step_id").references(() => reactSteps.id, { onDelete: "set null" }),
    userId: text("user_id").notNull(),
    cycleNumber: integer("cycle_number").notNull(),
    phase: text("phase", { enum: ["decision", "review"] }).notNull(),
    providerId: text("provider_id").notNull(),
    providerFamily: text("provider_family").notNull(),
    providerName: text("provider_name").notNull(),
    model: text("model").notNull(),
    status: text("status", { enum: ["accepted", "rejected", "failed"] }).notNull(),
    summary: text("summary").notNull(),
    actionType: text("action_type", { enum: ["tool", "final", "review"] }),
    toolName: text("tool_name", { enum: ["text.sha256", "text.analyze", "json.validate", "memory.retention", "web.fetch", "project.document.inspect", "code.patch.inspect"] }),
    payloadJson: text("payload_json"),
    payloadSha256: text("payload_sha256"),
    rawResponseSha256: text("raw_response_sha256").notNull(),
    latencyMs: integer("latency_ms").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("commander_decisions_run_cycle_idx").on(table.commanderRunId, table.cycleNumber, table.createdAt),
    index("commander_decisions_user_created_idx").on(table.userId, table.createdAt),
    check("commander_decisions_cycle_check", sql`${table.cycleNumber} >= 1 AND ${table.cycleNumber} <= 24`),
    check("commander_decisions_phase_check", sql`${table.phase} IN ('decision','review')`),
    check("commander_decisions_status_check", sql`${table.status} IN ('accepted','rejected','failed')`),
    check("commander_decisions_action_check", sql`${table.actionType} IS NULL OR ${table.actionType} IN ('tool','final','review')`),
    check("commander_decisions_latency_check", sql`${table.latencyMs} >= 0 AND ${table.latencyMs} <= 120000`),
  ],
);

export const commanderEvents = sqliteTable(
  "commander_events",
  {
    id: text("id").primaryKey(),
    commanderRunId: text("commander_run_id").notNull().references(() => commanderRuns.id, { onDelete: "cascade" }),
    reactRunId: text("react_run_id").notNull().references(() => reactRuns.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    eventType: text("event_type", { enum: ["created", "decision_requested", "decision_accepted", "tool_dispatched", "tool_waiting", "observation_synced", "review_requested", "review_approved", "review_rejected", "completed", "failed", "cancelled", "budget_exhausted", "model_unavailable"] }).notNull(),
    commanderVersion: integer("commander_version").notNull(),
    cycleNumber: integer("cycle_number").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("commander_events_run_created_idx").on(table.commanderRunId, table.createdAt),
    index("commander_events_user_created_idx").on(table.userId, table.createdAt),
    check("commander_events_type_check", sql`${table.eventType} IN ('created','decision_requested','decision_accepted','decision_rejected','tool_dispatched','tool_waiting','observation_synced','review_requested','review_approved','review_rejected','completed','failed','cancelled','budget_exhausted','model_unavailable')`),
    check("commander_events_version_check", sql`${table.commanderVersion} >= 1`),
    check("commander_events_cycle_check", sql`${table.cycleNumber} >= 0 AND ${table.cycleNumber} <= 24`),
  ],
);


export const tankbenchSuites = sqliteTable(
  "tankbench_suites",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    status: text("status", { enum: ["frozen", "archived"] }).notNull(),
    caseCount: integer("case_count").notNull(),
    suiteSha256: text("suite_sha256").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    frozenAt: text("frozen_at"),
  },
  (table) => [
    index("tankbench_suites_user_updated_idx").on(table.userId, table.updatedAt),
    index("tankbench_suites_project_updated_idx").on(table.projectId, table.updatedAt),
    index("tankbench_suites_hash_idx").on(table.suiteSha256),
    check("tankbench_suites_status_check", sql`${table.status} IN ('frozen','archived')`),
    check("tankbench_suites_case_count_check", sql`${table.caseCount} >= 1 AND ${table.caseCount} <= 200`),
    check("tankbench_suites_hash_check", sql`length(${table.suiteSha256}) = 64 AND ${table.suiteSha256} NOT GLOB '*[^0-9a-f]*'`),
    check("tankbench_suites_version_check", sql`${table.version} >= 1`),
  ],
);

export const tankbenchCases = sqliteTable(
  "tankbench_cases",
  {
    id: text("id").primaryKey(),
    suiteId: text("suite_id").notNull().references(() => tankbenchSuites.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    ordinal: integer("ordinal").notNull(),
    title: text("title").notNull(),
    category: text("category", { enum: ["completion", "factuality", "tool_use", "build", "recovery", "safety", "efficiency"] }).notNull(),
    prompt: text("prompt").notNull(),
    definitionOfDone: text("definition_of_done").notNull(),
    assertionsJson: text("assertions_json").notNull(),
    caseSha256: text("case_sha256").notNull(),
    weight: integer("weight").notNull().default(1),
    required: integer("required", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("tankbench_cases_suite_ordinal_idx").on(table.suiteId, table.ordinal),
    index("tankbench_cases_suite_category_idx").on(table.suiteId, table.category, table.ordinal),
    index("tankbench_cases_user_created_idx").on(table.userId, table.createdAt),
    check("tankbench_cases_ordinal_check", sql`${table.ordinal} >= 1 AND ${table.ordinal} <= 200`),
    check("tankbench_cases_weight_check", sql`${table.weight} >= 1 AND ${table.weight} <= 20`),
  ],
);

export const tankbenchRuns = sqliteTable(
  "tankbench_runs",
  {
    id: text("id").primaryKey(),
    suiteId: text("suite_id").notNull().references(() => tankbenchSuites.id, { onDelete: "restrict" }),
    userId: text("user_id").notNull(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    baselineLabel: text("baseline_label").notNull(),
    candidateLabel: text("candidate_label").notNull(),
    status: text("status", { enum: ["collecting", "passed", "failed", "cancelled"] }).notNull(),
    minScoreDeltaBps: integer("min_score_delta_bps").notNull().default(0),
    maxRegressions: integer("max_regressions").notNull().default(0),
    baselineScoreBps: integer("baseline_score_bps"),
    candidateScoreBps: integer("candidate_score_bps"),
    deltaBps: integer("delta_bps"),
    regressionCount: integer("regression_count").notNull().default(0),
    requiredFailureCount: integer("required_failure_count").notNull().default(0),
    safetyFailureCount: integer("safety_failure_count").notNull().default(0),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    evaluatedAt: text("evaluated_at"),
    completedAt: text("completed_at"),
  },
  (table) => [
    index("tankbench_runs_user_updated_idx").on(table.userId, table.updatedAt),
    index("tankbench_runs_project_updated_idx").on(table.projectId, table.updatedAt),
    index("tankbench_runs_suite_updated_idx").on(table.suiteId, table.updatedAt),
    index("tankbench_runs_status_updated_idx").on(table.status, table.updatedAt),
    check("tankbench_runs_version_check", sql`${table.version} >= 1`),
  ],
);

export const tankbenchResults = sqliteTable(
  "tankbench_results",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull().references(() => tankbenchRuns.id, { onDelete: "cascade" }),
    caseId: text("case_id").notNull().references(() => tankbenchCases.id, { onDelete: "restrict" }),
    commanderRunId: text("commander_run_id").notNull().references(() => commanderRuns.id, { onDelete: "restrict" }),
    userId: text("user_id").notNull(),
    variant: text("variant", { enum: ["baseline", "candidate"] }).notNull(),
    outcome: text("outcome", { enum: ["pass", "fail", "error"] }).notNull(),
    scoreBps: integer("score_bps").notNull(),
    checksPassed: integer("checks_passed").notNull(),
    checksTotal: integer("checks_total").notNull(),
    evidenceJson: text("evidence_json").notNull(),
    outputSha256: text("output_sha256").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("tankbench_results_run_case_variant_idx").on(table.runId, table.caseId, table.variant),
    index("tankbench_results_run_variant_idx").on(table.runId, table.variant, table.createdAt),
    index("tankbench_results_commander_idx").on(table.commanderRunId, table.createdAt),
    check("tankbench_results_score_check", sql`${table.scoreBps} >= 0 AND ${table.scoreBps} <= 10000`),
  ],
);

export const tankbenchReleases = sqliteTable(
  "tankbench_releases",
  {
    id: text("id").primaryKey(),
    sourceRunId: text("source_run_id").notNull().references(() => tankbenchRuns.id, { onDelete: "restrict" }),
    userId: text("user_id").notNull(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    status: text("status", { enum: ["candidate", "canary", "active", "rejected", "rolled_back", "superseded"] }).notNull(),
    trafficPercent: integer("traffic_percent").notNull().default(0),
    maxErrorRateBps: integer("max_error_rate_bps").notNull(),
    maxP95LatencyMs: integer("max_p95_latency_ms").notNull(),
    minStageObservations: integer("min_stage_observations").notNull(),
    stageObservationOffset: integer("stage_observation_offset").notNull().default(0),
    observationCount: integer("observation_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    rollbackReleaseId: text("rollback_release_id"),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    promotedAt: text("promoted_at"),
    rolledBackAt: text("rolled_back_at"),
  },
  (table) => [
    index("tankbench_releases_user_updated_idx").on(table.userId, table.updatedAt),
    index("tankbench_releases_project_status_idx").on(table.projectId, table.status, table.updatedAt),
    index("tankbench_releases_source_run_idx").on(table.sourceRunId, table.createdAt),
    check("tankbench_releases_version_check", sql`${table.version} >= 1`),
  ],
);

export const tankbenchCanaryObservations = sqliteTable(
  "tankbench_canary_observations",
  {
    id: text("id").primaryKey(),
    releaseId: text("release_id").notNull().references(() => tankbenchReleases.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    success: integer("success", { mode: "boolean" }).notNull(),
    latencyMs: integer("latency_ms").notNull(),
    errorCode: text("error_code"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("tankbench_canary_release_created_idx").on(table.releaseId, table.createdAt),
    index("tankbench_canary_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const tankbenchEvents = sqliteTable(
  "tankbench_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    suiteId: text("suite_id").references(() => tankbenchSuites.id, { onDelete: "cascade" }),
    runId: text("run_id").references(() => tankbenchRuns.id, { onDelete: "cascade" }),
    releaseId: text("release_id").references(() => tankbenchReleases.id, { onDelete: "cascade" }),
    eventType: text("event_type", { enum: ["suite_frozen", "run_created", "case_evaluated", "run_passed", "run_failed", "release_created", "canary_started", "canary_advanced", "release_activated", "release_rolled_back", "release_rejected"] }).notNull(),
    entityVersion: integer("entity_version").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("tankbench_events_suite_created_idx").on(table.suiteId, table.createdAt),
    index("tankbench_events_run_created_idx").on(table.runId, table.createdAt),
    index("tankbench_events_release_created_idx").on(table.releaseId, table.createdAt),
    index("tankbench_events_user_created_idx").on(table.userId, table.createdAt),
    check("tankbench_events_version_check", sql`${table.entityVersion} >= 1`),
  ],
);

export const usageBuckets = sqliteTable(
  "usage_buckets",
  {
    userId: text("user_id").notNull(),
    day: text("day").notNull(),
    requests: integer("requests").notNull(),
    modelCalls: integer("model_calls").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.day] }),
    index("usage_day_idx").on(table.day),
  ],
);

export const deploymentReleaseConfigs = sqliteTable(
  "deployment_release_configs",
  {
    id: text("id").primaryKey(),
    releaseId: text("release_id").notNull().references(() => tankbenchReleases.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    providerId: text("provider_id").notNull(),
    fallbackProviderIdsJson: text("fallback_provider_ids_json").notNull().default("[]"),
    maxOutputTokens: integer("max_output_tokens").notNull(),
    failureThreshold: integer("failure_threshold").notNull().default(3),
    recoveryTimeoutSeconds: integer("recovery_timeout_seconds").notNull().default(60),
    halfOpenSuccesses: integer("half_open_successes").notNull().default(1),
    configSha256: text("config_sha256").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("deployment_release_configs_release_idx").on(table.releaseId),
    index("deployment_release_configs_project_idx").on(table.userId, table.projectId, table.updatedAt),
    check("deployment_release_configs_tokens_check", sql`${table.maxOutputTokens} BETWEEN 64 AND 32768`),
    check("deployment_release_configs_version_check", sql`${table.version} >= 1`),
  ],
);

export const deploymentRequests = sqliteTable(
  "deployment_requests",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    releaseId: text("release_id").notNull().references(() => tankbenchReleases.id, { onDelete: "restrict" }),
    configId: text("config_id").notNull().references(() => deploymentReleaseConfigs.id, { onDelete: "restrict" }),
    providerId: text("provider_id").notNull(),
    routingKeyHash: text("routing_key_hash").notNull(),
    requestSha256: text("request_sha256").notNull(),
    responseSha256: text("response_sha256"),
    status: text("status", { enum: ["succeeded", "failed"] }).notNull(),
    source: text("source", { enum: ["active", "canary"] }).notNull().default("active"),
    attemptCount: integer("attempt_count").notNull().default(1),
    latencyMs: integer("latency_ms").notNull(),
    errorCode: text("error_code"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("deployment_requests_release_created_idx").on(table.releaseId, table.createdAt),
    index("deployment_requests_project_created_idx").on(table.projectId, table.createdAt),
    check("deployment_requests_status_check", sql`${table.status} IN ('succeeded','failed')`),
    check("deployment_requests_source_check", sql`${table.source} IN ('active','canary')`),
    check("deployment_requests_latency_check", sql`${table.latencyMs} BETWEEN 0 AND 120000`),
  ],
);

export const deploymentEvents = sqliteTable(
  "deployment_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    releaseId: text("release_id").notNull().references(() => tankbenchReleases.id, { onDelete: "cascade" }),
    eventType: text("event_type", { enum: ["configured", "reconfigured", "request_succeeded", "request_failed"] }).notNull(),
    entityVersion: integer("entity_version").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("deployment_events_release_created_idx").on(table.releaseId, table.createdAt),
    check("deployment_events_version_check", sql`${table.entityVersion} >= 1`),
  ],
);

export const deploymentTrafficOverrides = sqliteTable(
  "deployment_traffic_overrides",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    canaryReleaseId: text("canary_release_id").notNull().references(() => tankbenchReleases.id, { onDelete: "cascade" }),
    trafficPercent: integer("traffic_percent").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("deployment_traffic_project_idx").on(table.userId, table.projectId),
    index("deployment_traffic_release_idx").on(table.canaryReleaseId, table.updatedAt),
    check("deployment_traffic_percent_check", sql`${table.trafficPercent} BETWEEN 0 AND 100`),
    check("deployment_traffic_version_check", sql`${table.version} >= 1`),
  ],
);

export const deploymentCircuitBreakers = sqliteTable(
  "deployment_circuit_breakers",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    releaseId: text("release_id").notNull().references(() => tankbenchReleases.id, { onDelete: "cascade" }),
    providerId: text("provider_id").notNull(),
    state: text("state", { enum: ["closed", "open", "half_open"] }).notNull().default("closed"),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    halfOpenSuccessCount: integer("half_open_success_count").notNull().default(0),
    openedAt: text("opened_at"),
    nextProbeAt: text("next_probe_at"),
    lastFailureAt: text("last_failure_at"),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("deployment_breaker_release_provider_idx").on(table.releaseId, table.providerId),
    index("deployment_breaker_project_state_idx").on(table.userId, table.projectId, table.state, table.updatedAt),
    check("deployment_breaker_state_check", sql`${table.state} IN ('closed','open','half_open')`),
    check("deployment_breaker_version_check", sql`${table.version} >= 1`),
  ],
);

export const deploymentRequestAttempts = sqliteTable(
  "deployment_request_attempts",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull().references(() => deploymentRequests.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    releaseId: text("release_id").notNull().references(() => tankbenchReleases.id, { onDelete: "restrict" }),
    attemptOrdinal: integer("attempt_ordinal").notNull(),
    providerId: text("provider_id").notNull(),
    status: text("status", { enum: ["succeeded", "failed", "skipped_open", "unavailable"] }).notNull(),
    latencyMs: integer("latency_ms").notNull(),
    errorCode: text("error_code"),
    responseSha256: text("response_sha256"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("deployment_attempts_request_idx").on(table.requestId, table.attemptOrdinal),
    index("deployment_attempts_provider_created_idx").on(table.providerId, table.createdAt),
    check("deployment_attempt_ordinal_check", sql`${table.attemptOrdinal} BETWEEN 1 AND 4`),
    check("deployment_attempt_status_check", sql`${table.status} IN ('succeeded','failed','skipped_open','unavailable')`),
  ],
);

export const deploymentControlEvents = sqliteTable(
  "deployment_control_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    releaseId: text("release_id").references(() => tankbenchReleases.id, { onDelete: "cascade" }),
    providerId: text("provider_id"),
    eventType: text("event_type", { enum: ["traffic_shifted", "traffic_automatic", "breaker_opened", "breaker_half_opened", "breaker_closed", "breaker_reset", "fallback_used"] }).notNull(),
    entityVersion: integer("entity_version").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("deployment_control_events_project_created_idx").on(table.userId, table.projectId, table.createdAt),
    index("deployment_control_events_release_created_idx").on(table.releaseId, table.createdAt),
    check("deployment_control_events_version_check", sql`${table.entityVersion} >= 1`),
  ],
);

export const deploymentOperationsPolicies = sqliteTable(
  "deployment_operations_policies",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    rateLimitPerMinute: integer("rate_limit_per_minute").notNull().default(60),
    maxConcurrency: integer("max_concurrency").notNull().default(4),
    inflightLeaseSeconds: integer("inflight_lease_seconds").notNull().default(180),
    sloWindowMinutes: integer("slo_window_minutes").notNull().default(60),
    sloMinRequests: integer("slo_min_requests").notNull().default(20),
    minSuccessRateBps: integer("min_success_rate_bps").notNull().default(9900),
    maxP95LatencyMs: integer("max_p95_latency_ms").notNull().default(5000),
    alertCooldownMinutes: integer("alert_cooldown_minutes").notNull().default(15),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("deployment_operations_policy_project_idx").on(table.userId, table.projectId),
    index("deployment_operations_policy_updated_idx").on(table.userId, table.updatedAt),
    check("deployment_operations_rate_limit_check", sql`${table.rateLimitPerMinute} BETWEEN 1 AND 10000`),
    check("deployment_operations_concurrency_check", sql`${table.maxConcurrency} BETWEEN 1 AND 100`),
    check("deployment_operations_lease_check", sql`${table.inflightLeaseSeconds} BETWEEN 5 AND 600`),
    check("deployment_operations_slo_window_check", sql`${table.sloWindowMinutes} BETWEEN 5 AND 1440`),
    check("deployment_operations_slo_min_requests_check", sql`${table.sloMinRequests} BETWEEN 1 AND 10000`),
    check("deployment_operations_success_rate_check", sql`${table.minSuccessRateBps} BETWEEN 0 AND 10000`),
    check("deployment_operations_latency_check", sql`${table.maxP95LatencyMs} BETWEEN 1 AND 120000`),
    check("deployment_operations_cooldown_check", sql`${table.alertCooldownMinutes} BETWEEN 1 AND 1440`),
    check("deployment_operations_version_check", sql`${table.version} >= 1`),
  ],
);

export const deploymentAdmissionBuckets = sqliteTable(
  "deployment_admission_buckets",
  {
    userId: text("user_id").notNull(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    windowStart: text("window_start").notNull(),
    requestCount: integer("request_count").notNull().default(0),
    rejectedCount: integer("rejected_count").notNull().default(0),
    version: integer("version").notNull().default(1),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.projectId, table.windowStart] }),
    index("deployment_admission_project_window_idx").on(table.userId, table.projectId, table.windowStart),
    check("deployment_admission_request_count_check", sql`${table.requestCount} >= 0`),
    check("deployment_admission_rejected_count_check", sql`${table.rejectedCount} >= 0`),
    check("deployment_admission_version_check", sql`${table.version} >= 1`),
  ],
);

export const deploymentInflightLeases = sqliteTable(
  "deployment_inflight_leases",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    acquiredAt: text("acquired_at").notNull(),
    expiresAt: text("expires_at").notNull(),
  },
  (table) => [index("deployment_inflight_project_expiry_idx").on(table.userId, table.projectId, table.expiresAt)],
);

export const deploymentSloSnapshots = sqliteTable(
  "deployment_slo_snapshots",
  {
    id: text("id").primaryKey(),
    policyId: text("policy_id").notNull().references(() => deploymentOperationsPolicies.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    windowStartedAt: text("window_started_at").notNull(),
    windowEndedAt: text("window_ended_at").notNull(),
    requestCount: integer("request_count").notNull(),
    successCount: integer("success_count").notNull(),
    successRateBps: integer("success_rate_bps").notNull(),
    p95LatencyMs: integer("p95_latency_ms").notNull(),
    status: text("status", { enum: ["healthy", "breached", "insufficient"] }).notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("deployment_slo_snapshots_project_created_idx").on(table.userId, table.projectId, table.createdAt)],
);

export const deploymentAlerts = sqliteTable(
  "deployment_alerts",
  {
    id: text("id").primaryKey(),
    policyId: text("policy_id").notNull().references(() => deploymentOperationsPolicies.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["success_rate", "latency", "rate_limit", "concurrency", "dead_letter"] }).notNull(),
    status: text("status", { enum: ["open", "acknowledged", "resolved"] }).notNull(),
    severity: text("severity", { enum: ["warning", "critical"] }).notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    message: text("message").notNull(),
    observedValue: integer("observed_value").notNull(),
    thresholdValue: integer("threshold_value").notNull(),
    version: integer("version").notNull().default(1),
    firstSeenAt: text("first_seen_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
    acknowledgedAt: text("acknowledged_at"),
    resolvedAt: text("resolved_at"),
  },
  (table) => [
    index("deployment_alerts_project_status_idx").on(table.userId, table.projectId, table.status, table.lastSeenAt),
    check("deployment_alert_version_check", sql`${table.version} >= 1`),
  ],
);

export const toolJobReplays = sqliteTable(
  "tool_job_replays",
  {
    id: text("id").primaryKey(),
    sourceJobId: text("source_job_id").notNull().references(() => toolJobs.id, { onDelete: "restrict" }),
    replayJobId: text("replay_job_id").notNull().references(() => toolJobs.id, { onDelete: "cascade" }),
    leaseId: text("lease_id").notNull().references(() => toolExecutionLeases.id, { onDelete: "restrict" }),
    userId: text("user_id").notNull(),
    projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
    sourceJobVersion: integer("source_job_version").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("tool_job_replays_replay_job_idx").on(table.replayJobId),
    index("tool_job_replays_source_created_idx").on(table.sourceJobId, table.createdAt),
    check("tool_job_replays_source_version_check", sql`${table.sourceJobVersion} >= 1`),
  ],
);

export const deploymentOperationsEvents = sqliteTable(
  "deployment_operations_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    eventType: text("event_type", { enum: ["policy_configured", "policy_reconfigured", "admission_granted", "rate_limited", "concurrency_limited", "inflight_recovered", "slo_evaluated", "alert_opened", "alert_updated", "alert_acknowledged", "alert_resolved", "dead_letter_replayed", "audit_exported"] }).notNull(),
    entityId: text("entity_id"),
    entityVersion: integer("entity_version").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("deployment_operations_events_project_created_idx").on(table.userId, table.projectId, table.createdAt),
    check("deployment_operations_event_version_check", sql`${table.entityVersion} >= 1`),
  ],
);

export const dataSubjectRequests = sqliteTable(
  "data_subject_requests",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    requestType: text("request_type", {
      enum: ["export", "deletion"],
    }).notNull(),
    status: text("status", {
      enum: [
        "requested",
        "scheduled",
        "executing",
        "completed",
        "cancelled",
        "failed",
      ],
    }).notNull(),
    manifestSha256: text("manifest_sha256"),
    payloadSha256: text("payload_sha256"),
    datasetCount: integer("dataset_count"),
    rowCount: integer("row_count"),
    confirmationSha256: text("confirmation_sha256"),
    confirmationHint: text("confirmation_hint"),
    confirmBy: text("confirm_by"),
    executeAfter: text("execute_after"),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    completedAt: text("completed_at"),
    cancelledAt: text("cancelled_at"),
  },
  (table) => [
    index("data_subject_requests_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("data_subject_requests_user_status_idx").on(
      table.userId,
      table.requestType,
      table.status,
      table.updatedAt,
    ),
    uniqueIndex("data_subject_requests_active_deletion_idx")
      .on(table.userId)
      .where(
        sql`${table.requestType} = 'deletion' AND ${table.status} IN ('requested', 'scheduled', 'executing')`,
      ),
    check(
      "data_subject_requests_type_check",
      sql`${table.requestType} IN ('export', 'deletion')`,
    ),
    check(
      "data_subject_requests_status_check",
      sql`${table.status} IN ('requested', 'scheduled', 'executing', 'completed', 'cancelled', 'failed')`,
    ),
    check("data_subject_requests_version_check", sql`${table.version} >= 1`),
    check(
      "data_subject_requests_counts_check",
      sql`(${table.datasetCount} IS NULL OR ${table.datasetCount} >= 0) AND (${table.rowCount} IS NULL OR ${table.rowCount} >= 0)`,
    ),
    check(
      "data_subject_requests_manifest_hash_check",
      sql`${table.manifestSha256} IS NULL OR (length(${table.manifestSha256}) = 64 AND ${table.manifestSha256} NOT GLOB '*[^0-9a-f]*')`,
    ),
    check(
      "data_subject_requests_payload_hash_check",
      sql`${table.payloadSha256} IS NULL OR (length(${table.payloadSha256}) = 64 AND ${table.payloadSha256} NOT GLOB '*[^0-9a-f]*')`,
    ),
    check(
      "data_subject_requests_confirmation_hash_check",
      sql`${table.confirmationSha256} IS NULL OR (length(${table.confirmationSha256}) = 64 AND ${table.confirmationSha256} NOT GLOB '*[^0-9a-f]*')`,
    ),
    check(
      "data_subject_requests_export_state_check",
      sql`${table.requestType} <> 'export' OR (${table.status} = 'completed' AND ${table.manifestSha256} IS NOT NULL AND ${table.payloadSha256} IS NOT NULL AND ${table.datasetCount} IS NOT NULL AND ${table.rowCount} IS NOT NULL AND ${table.completedAt} IS NOT NULL AND ${table.cancelledAt} IS NULL)`,
    ),
    check(
      "data_subject_requests_deletion_state_check",
      sql`${table.requestType} <> 'deletion' OR (${table.status} = 'requested' AND ${table.confirmationSha256} IS NOT NULL AND ${table.confirmationHint} IS NOT NULL AND ${table.confirmBy} IS NOT NULL AND ${table.executeAfter} IS NULL AND ${table.completedAt} IS NULL AND ${table.cancelledAt} IS NULL) OR (${table.status} IN ('scheduled', 'executing') AND ${table.confirmationSha256} IS NOT NULL AND ${table.confirmationHint} IS NOT NULL AND ${table.confirmBy} IS NOT NULL AND ${table.executeAfter} IS NOT NULL AND ${table.completedAt} IS NULL AND ${table.cancelledAt} IS NULL) OR (${table.status} = 'cancelled' AND ${table.cancelledAt} IS NOT NULL AND ${table.completedAt} IS NULL) OR (${table.status} = 'failed' AND ${table.completedAt} IS NULL)`,
    ),
  ],
);

export const dataSubjectEvents = sqliteTable(
  "data_subject_events",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => dataSubjectRequests.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    eventType: text("event_type", {
      enum: [
        "export_completed",
        "deletion_requested",
        "deletion_scheduled",
        "deletion_cancelled",
        "deletion_executing",
      ],
    }).notNull(),
    requestVersion: integer("request_version").notNull(),
    evidenceSha256: text("evidence_sha256"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("data_subject_events_request_created_idx").on(
      table.requestId,
      table.createdAt,
    ),
    index("data_subject_events_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    check(
      "data_subject_events_type_check",
      sql`${table.eventType} IN ('export_completed', 'deletion_requested', 'deletion_scheduled', 'deletion_cancelled', 'deletion_executing')`,
    ),
    check(
      "data_subject_events_version_check",
      sql`${table.requestVersion} >= 1`,
    ),
    check(
      "data_subject_events_evidence_hash_check",
      sql`${table.evidenceSha256} IS NULL OR (length(${table.evidenceSha256}) = 64 AND ${table.evidenceSha256} NOT GLOB '*[^0-9a-f]*')`,
    ),
  ],
);

export const dataDeletionReceipts = sqliteTable(
  "data_deletion_receipts",
  {
    id: text("id").primaryKey(),
    reportSha256: text("report_sha256").notNull(),
    proofSha256: text("proof_sha256").notNull(),
    deletedRowCount: integer("deleted_row_count").notNull(),
    datasetCount: integer("dataset_count").notNull(),
    softwareRelease: text("software_release").notNull(),
    completedAt: text("completed_at").notNull(),
  },
  (table) => [
    uniqueIndex("data_deletion_receipts_report_hash_idx").on(
      table.reportSha256,
    ),
    check(
      "data_deletion_receipts_report_hash_check",
      sql`length(${table.reportSha256}) = 64 AND ${table.reportSha256} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check(
      "data_deletion_receipts_proof_hash_check",
      sql`length(${table.proofSha256}) = 64 AND ${table.proofSha256} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check(
      "data_deletion_receipts_counts_check",
      sql`${table.deletedRowCount} >= 0 AND ${table.datasetCount} >= 0`,
    ),
  ],
);
