import { readRuntimeInteger } from "@/lib/runtime-env";
import {
  CsvDocumentValidationError,
  validateCsvDocument,
} from "@/lib/csv-document";
import type { ModelMessage } from "@/lib/providers";
import type { TeamMode, TeamRunTrace } from "@/lib/team-runtime";
import { currentRuntimeBindings } from "@/lib/request-context";

interface ConversationRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  run_id: string | null;
  created_at: string;
}

interface UsageRow {
  requests: number;
  model_calls: number;
}

export type ProjectStatus = "active" | "archived";
export type ProjectDocumentKind = "markdown" | "text" | "json" | "csv";
export type CapabilityName = "model.run";
export type CapabilityLeaseScope = "account" | "project";
export type CapabilityLeaseStatus =
  | "active"
  | "revoked"
  | "depleted"
  | "expired";

type ProjectEventType =
  | "project_created"
  | "project_updated"
  | "project_archived"
  | "project_restored"
  | "document_created"
  | "document_updated"
  | "run_started"
  | "run_completed"
  | "run_failed";

interface ProjectRow {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  version: number;
  content_revision: number;
  document_count: number;
  created_at: string;
  updated_at: string;
}

interface ProjectDocumentRow {
  id: string;
  project_id: string;
  name: string;
  kind: ProjectDocumentKind;
  content: string;
  content_sha256: string;
  size_bytes: number;
  version: number;
  created_at: string;
  updated_at: string;
}

type ProjectDocumentMetadataRow = Omit<ProjectDocumentRow, "content">;

interface ProjectDocumentVersionRow {
  id: string;
  document_id: string;
  project_id: string;
  version: number;
  name: string;
  kind: ProjectDocumentKind;
  content: string;
  content_sha256: string;
  size_bytes: number;
  change_note: string | null;
  created_at: string;
}

type ProjectDocumentVersionMetadataRow = Omit<
  ProjectDocumentVersionRow,
  "content"
>;

interface ProjectEventRow {
  id: string;
  project_id: string;
  document_id: string | null;
  run_id: string | null;
  event_type: ProjectEventType;
  project_version: number;
  document_version: number | null;
  note: string | null;
  created_at: string;
}

interface CapabilityLeaseRow {
  id: string;
  capability: CapabilityName;
  mode: TeamMode;
  scope_kind: CapabilityLeaseScope;
  project_id: string | null;
  project_name: string | null;
  status: Exclude<CapabilityLeaseStatus, "expired">;
  max_uses: number;
  remaining_uses: number;
  version: number;
  expires_at: string;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

interface CapabilityLeaseEventRow {
  id: string;
  lease_id: string;
  run_id: string | null;
  event_type: "created" | "consumed" | "revoked";
  lease_version: number;
  remaining_uses: number;
  created_at: string;
}

export type GoalStatus =
  | "draft"
  | "planned"
  | "ready"
  | "running"
  | "waiting"
  | "verifying"
  | "completed"
  | "failed"
  | "cancelled";

type GoalEventType =
  | "created"
  | "status_changed"
  | "progress_recorded"
  | "note_added"
  | "run_started"
  | "run_completed"
  | "run_failed";

interface GoalRow {
  id: string;
  title: string;
  objective: string;
  definition_of_done: string;
  status: GoalStatus;
  progress_percent: number;
  current_step: string | null;
  next_action: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface GoalEventRow {
  id: string;
  goal_id: string;
  run_id: string | null;
  event_type: GoalEventType;
  from_status: string | null;
  to_status: string | null;
  progress_percent: number | null;
  current_step: string | null;
  next_action: string | null;
  note: string | null;
  goal_version: number;
  created_at: string;
}

interface ImprovementSignalRow {
  total: number;
  positive: number;
  negative: number;
  corrections: number;
  last_signal_at: string | null;
}

interface ImprovementQueueRow {
  queued: number;
  included: number;
  dismissed: number;
}

export interface ConversationHistory {
  conversation: {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
  };
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    runId: string | null;
    createdAt: string;
  }>;
}

export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  version: number;
  contentRevision: number;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDocumentRecord {
  id: string;
  projectId: string;
  name: string;
  kind: ProjectDocumentKind;
  content: string;
  contentSha256: string;
  sizeBytes: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDocumentVersionRecord {
  id: string;
  documentId: string;
  projectId: string;
  version: number;
  name: string;
  kind: ProjectDocumentKind;
  content: string;
  contentSha256: string;
  sizeBytes: number;
  changeNote: string | null;
  createdAt: string;
}

export interface ProjectEventRecord {
  id: string;
  projectId: string;
  documentId: string | null;
  runId: string | null;
  type: ProjectEventType;
  projectVersion: number;
  documentVersion: number | null;
  note: string | null;
  createdAt: string;
}

export interface ProjectContext {
  id: string;
  name: string;
  description: string;
  version: number;
  contentRevision: number;
  documentCount: number;
  includedDocumentCount: number;
  omittedDocumentNames: string[];
  documents: Array<{
    id: string;
    name: string;
    kind: ProjectDocumentKind;
    content: string;
    contentSha256: string;
    version: number;
  }>;
}

export interface CapabilityLeaseRecord {
  id: string;
  capability: CapabilityName;
  mode: TeamMode;
  scope: CapabilityLeaseScope;
  projectId: string | null;
  projectName: string | null;
  status: CapabilityLeaseStatus;
  maxUses: number;
  remainingUses: number;
  version: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface CapabilityLeaseEventRecord {
  id: string;
  leaseId: string;
  runId: string | null;
  type: "created" | "consumed" | "revoked";
  leaseVersion: number;
  remainingUses: number;
  createdAt: string;
}

export interface GoalRecord {
  id: string;
  title: string;
  objective: string;
  definitionOfDone: string;
  status: GoalStatus;
  progressPercent: number;
  currentStep: string | null;
  nextAction: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface GoalEventRecord {
  id: string;
  goalId: string;
  runId: string | null;
  type: GoalEventType;
  fromStatus: GoalStatus | null;
  toStatus: GoalStatus | null;
  progressPercent: number | null;
  currentStep: string | null;
  nextAction: string | null;
  note: string | null;
  goalVersion: number;
  createdAt: string;
}

export interface GoalContext {
  id: string;
  title: string;
  objective: string;
  definitionOfDone: string;
  status: Exclude<GoalStatus, "completed" | "failed" | "cancelled">;
  progressPercent: number;
  currentStep: string | null;
  nextAction: string | null;
  version: number;
}

export class ConversationNotFoundError extends Error {
  readonly status = 404;
  readonly code = "CONVERSATION_NOT_FOUND";

  constructor() {
    super("Die Unterhaltung wurde nicht gefunden.");
    this.name = "ConversationNotFoundError";
  }
}

export class ProjectNotFoundError extends Error {
  readonly status = 404;
  readonly code = "PROJECT_NOT_FOUND";

  constructor() {
    super("Der Projektbereich wurde nicht gefunden.");
    this.name = "ProjectNotFoundError";
  }
}

export class ProjectVersionConflictError extends Error {
  readonly status = 409;
  readonly code = "PROJECT_VERSION_CONFLICT";

  constructor() {
    super(
      "Der Projektbereich wurde zwischenzeitlich geändert. Lade den aktuellen Stand und versuche es erneut.",
    );
    this.name = "ProjectVersionConflictError";
  }
}

export class ProjectLimitError extends Error {
  readonly status = 409;
  readonly code = "PROJECT_LIMIT_REACHED";

  constructor() {
    super("Es können höchstens 50 Projektbereiche angelegt werden.");
    this.name = "ProjectLimitError";
  }
}

export class ProjectArchivedError extends Error {
  readonly status = 409;
  readonly code = "PROJECT_ARCHIVED";

  constructor() {
    super(
      "Der Projektbereich ist archiviert. Stelle ihn wieder her, bevor du Dateien änderst oder einen Lauf startest.",
    );
    this.name = "ProjectArchivedError";
  }
}

export class ProjectDocumentNotFoundError extends Error {
  readonly status = 404;
  readonly code = "PROJECT_DOCUMENT_NOT_FOUND";

  constructor() {
    super("Die Projektdatei wurde nicht gefunden.");
    this.name = "ProjectDocumentNotFoundError";
  }
}

export class ProjectDocumentVersionConflictError extends Error {
  readonly status = 409;
  readonly code = "PROJECT_DOCUMENT_VERSION_CONFLICT";

  constructor() {
    super(
      "Die Projektdatei wurde zwischenzeitlich geändert. Lade den aktuellen Stand und versuche es erneut.",
    );
    this.name = "ProjectDocumentVersionConflictError";
  }
}

export class ProjectDocumentNameConflictError extends Error {
  readonly status = 409;
  readonly code = "PROJECT_DOCUMENT_NAME_CONFLICT";

  constructor() {
    super("In diesem Projektbereich existiert bereits eine Datei mit diesem Namen.");
    this.name = "ProjectDocumentNameConflictError";
  }
}

export class ProjectDocumentLimitError extends Error {
  readonly status = 409;
  readonly code = "PROJECT_DOCUMENT_LIMIT_REACHED";

  constructor() {
    super("Ein Projektbereich kann höchstens 100 Dateien enthalten.");
    this.name = "ProjectDocumentLimitError";
  }
}

export class ProjectDocumentContentError extends Error {
  readonly status = 400;
  readonly code = "INVALID_PROJECT_DOCUMENT_CONTENT";

  constructor(message: string) {
    super(message);
    this.name = "ProjectDocumentContentError";
  }
}

export class CapabilityLeaseNotFoundError extends Error {
  readonly status = 404;
  readonly code = "CAPABILITY_LEASE_NOT_FOUND";

  constructor() {
    super("Die Ausführungsfreigabe wurde nicht gefunden.");
    this.name = "CapabilityLeaseNotFoundError";
  }
}

export class CapabilityLeaseUnavailableError extends Error {
  readonly status = 409;
  readonly code = "CAPABILITY_LEASE_UNAVAILABLE";

  constructor() {
    super(
      "Für diesen Modelllauf fehlt eine aktive, passende Ausführungsfreigabe für Modus und Projekt.",
    );
    this.name = "CapabilityLeaseUnavailableError";
  }
}

export class CapabilityLeaseVersionConflictError extends Error {
  readonly status = 409;
  readonly code = "CAPABILITY_LEASE_VERSION_CONFLICT";

  constructor() {
    super(
      "Die Ausführungsfreigabe wurde zwischenzeitlich geändert. Lade den aktuellen Stand und versuche es erneut.",
    );
    this.name = "CapabilityLeaseVersionConflictError";
  }
}

export class CapabilityLeaseLimitError extends Error {
  readonly status = 409;
  readonly code = "CAPABILITY_LEASE_LIMIT_REACHED";

  constructor() {
    super("Es können höchstens 20 aktive Ausführungsfreigaben bestehen.");
    this.name = "CapabilityLeaseLimitError";
  }
}

export class CapabilityLeaseInputError extends Error {
  readonly status = 400;
  readonly code = "INVALID_CAPABILITY_LEASE";

  constructor(message: string) {
    super(message);
    this.name = "CapabilityLeaseInputError";
  }
}

export class GoalNotFoundError extends Error {
  readonly status = 404;
  readonly code = "GOAL_NOT_FOUND";

  constructor() {
    super("Das Ziel wurde nicht gefunden.");
    this.name = "GoalNotFoundError";
  }
}

export class GoalVersionConflictError extends Error {
  readonly status = 409;
  readonly code = "GOAL_VERSION_CONFLICT";

  constructor() {
    super(
      "Das Ziel wurde zwischenzeitlich geändert. Lade den aktuellen Stand und versuche es erneut.",
    );
    this.name = "GoalVersionConflictError";
  }
}

export class GoalTransitionError extends Error {
  readonly status = 409;
  readonly code = "INVALID_GOAL_TRANSITION";

  constructor(from: GoalStatus, to: GoalStatus) {
    super(`Der Zielstatus kann nicht direkt von „${from}“ auf „${to}“ wechseln.`);
    this.name = "GoalTransitionError";
  }
}

export class GoalNotRunnableError extends Error {
  readonly status = 409;
  readonly code = "GOAL_NOT_RUNNABLE";

  constructor() {
    super(
      "Dieses Ziel ist abgeschlossen, fehlgeschlagen oder abgebrochen und kann keinen neuen Lauf starten.",
    );
    this.name = "GoalNotRunnableError";
  }
}

export class UsageLimitError extends Error {
  readonly status = 429;
  readonly code = "DAILY_LIMIT_REACHED";

  constructor() {
    super("Das tägliche TankAI-Limit ist erreicht. Morgen steht das Budget wieder bereit.");
    this.name = "UsageLimitError";
  }
}

function database(): D1Database {
  const db = currentRuntimeBindings().DB;
  if (!db) {
    throw new Error("Die persistente TankAI-Datenbank ist nicht verfügbar.");
  }
  return db;
}

function now(): string {
  return new Date().toISOString();
}

function titleFromMessage(message: string): string {
  const compact = message.replace(/\s+/gu, " ").trim();
  return compact.length <= 72 ? compact : `${compact.slice(0, 69)}…`;
}

function mapProject(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    version: Number(row.version),
    contentRevision: Number(row.content_revision),
    documentCount: Number(row.document_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProjectDocument(
  row: ProjectDocumentRow,
): ProjectDocumentRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    kind: row.kind,
    content: row.content,
    contentSha256: row.content_sha256,
    sizeBytes: Number(row.size_bytes),
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProjectDocumentVersion(
  row: ProjectDocumentVersionRow,
): ProjectDocumentVersionRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    projectId: row.project_id,
    version: Number(row.version),
    name: row.name,
    kind: row.kind,
    content: row.content,
    contentSha256: row.content_sha256,
    sizeBytes: Number(row.size_bytes),
    changeNote: row.change_note,
    createdAt: row.created_at,
  };
}

function mapProjectDocumentMetadataRow(
  row: ProjectDocumentMetadataRow,
): Omit<ProjectDocumentRecord, "content"> {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    kind: row.kind,
    contentSha256: row.content_sha256,
    sizeBytes: Number(row.size_bytes),
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProjectDocumentVersionMetadataRow(
  row: ProjectDocumentVersionMetadataRow,
): Omit<ProjectDocumentVersionRecord, "content"> {
  return {
    id: row.id,
    documentId: row.document_id,
    projectId: row.project_id,
    version: Number(row.version),
    name: row.name,
    kind: row.kind,
    contentSha256: row.content_sha256,
    sizeBytes: Number(row.size_bytes),
    changeNote: row.change_note,
    createdAt: row.created_at,
  };
}

function mapProjectEvent(row: ProjectEventRow): ProjectEventRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    documentId: row.document_id,
    runId: row.run_id,
    type: row.event_type,
    projectVersion: Number(row.project_version),
    documentVersion:
      row.document_version === null ? null : Number(row.document_version),
    note: row.note,
    createdAt: row.created_at,
  };
}

function effectiveCapabilityLeaseStatus(
  row: CapabilityLeaseRow,
  timestamp = now(),
): CapabilityLeaseStatus {
  return row.status === "active" && row.expires_at <= timestamp
    ? "expired"
    : row.status;
}

function mapCapabilityLease(
  row: CapabilityLeaseRow,
  timestamp = now(),
): CapabilityLeaseRecord {
  return {
    id: row.id,
    capability: row.capability,
    mode: row.mode,
    scope: row.scope_kind,
    projectId: row.project_id,
    projectName: row.project_name,
    status: effectiveCapabilityLeaseStatus(row, timestamp),
    maxUses: Number(row.max_uses),
    remainingUses: Number(row.remaining_uses),
    version: Number(row.version),
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  };
}

function mapCapabilityLeaseEvent(
  row: CapabilityLeaseEventRow,
): CapabilityLeaseEventRecord {
  return {
    id: row.id,
    leaseId: row.lease_id,
    runId: row.run_id,
    type: row.event_type,
    leaseVersion: Number(row.lease_version),
    remainingUses: Number(row.remaining_uses),
    createdAt: row.created_at,
  };
}

async function contentSha256(content: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(content),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function projectRow(
  projectId: string,
  userId: string,
): Promise<ProjectRow> {
  const row = await database()
    .prepare(
      `SELECT
         projects.id, projects.name, projects.description, projects.status,
         projects.version, projects.content_revision, projects.created_at,
         projects.updated_at,
         (SELECT COUNT(*) FROM project_documents
          WHERE project_documents.project_id = projects.id
            AND project_documents.user_id = projects.user_id) AS document_count
       FROM projects
       WHERE projects.id = ? AND projects.user_id = ?`,
    )
    .bind(projectId, userId)
    .first<ProjectRow>();
  if (!row) throw new ProjectNotFoundError();
  return row;
}

async function projectDocumentRow(
  documentId: string,
  userId: string,
): Promise<ProjectDocumentRow> {
  const row = await database()
    .prepare(
      `SELECT
         id, project_id, name, kind, content, content_sha256, size_bytes,
         version, created_at, updated_at
       FROM project_documents
       WHERE id = ? AND user_id = ?`,
    )
    .bind(documentId, userId)
    .first<ProjectDocumentRow>();
  if (!row) throw new ProjectDocumentNotFoundError();
  return row;
}

async function capabilityLeaseRow(
  leaseId: string,
  userId: string,
): Promise<CapabilityLeaseRow> {
  const row = await database()
    .prepare(
      `SELECT
         capability_leases.id, capability_leases.capability,
         capability_leases.mode, capability_leases.scope_kind,
         capability_leases.project_id, projects.name AS project_name,
         capability_leases.status, capability_leases.max_uses,
         capability_leases.remaining_uses, capability_leases.version,
         capability_leases.expires_at, capability_leases.created_at,
         capability_leases.updated_at, capability_leases.last_used_at,
         capability_leases.revoked_at
       FROM capability_leases
       LEFT JOIN projects
         ON projects.id = capability_leases.project_id
        AND projects.user_id = capability_leases.user_id
       WHERE capability_leases.id = ? AND capability_leases.user_id = ?`,
    )
    .bind(leaseId, userId)
    .first<CapabilityLeaseRow>();
  if (!row) throw new CapabilityLeaseNotFoundError();
  return row;
}

async function requireAvailableDocumentName(input: {
  projectId: string;
  userId: string;
  name: string;
  exceptDocumentId?: string;
}): Promise<void> {
  const row = await database()
    .prepare(
      `SELECT id
       FROM project_documents
       WHERE project_id = ? AND user_id = ? AND lower(name) = lower(?)
         AND (? IS NULL OR id <> ?)
       LIMIT 1`,
    )
    .bind(
      input.projectId,
      input.userId,
      input.name,
      input.exceptDocumentId ?? null,
      input.exceptDocumentId ?? null,
    )
    .first<{ id: string }>();
  if (row) throw new ProjectDocumentNameConflictError();
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /unique constraint|constraint failed.*project_documents/iu.test(
      error.message,
    )
  );
}

function validateProjectDocumentContent(
  kind: ProjectDocumentKind,
  content: string,
): number {
  const sizeBytes = new TextEncoder().encode(content).byteLength;
  if (content.length > 20_000 || sizeBytes > 24_000) {
    throw new ProjectDocumentContentError(
      "Eine Projektdatei darf höchstens 20.000 Zeichen und 24.000 Bytes enthalten.",
    );
  }
  if (kind === "json") {
    try {
      JSON.parse(content);
    } catch {
      throw new ProjectDocumentContentError(
        "Eine JSON-Projektdatei muss gültiges JSON enthalten.",
      );
    }
  }
  if (kind === "csv") {
    try {
      validateCsvDocument(content);
    } catch (error) {
      if (error instanceof CsvDocumentValidationError) {
        throw new ProjectDocumentContentError(error.message);
      }
      throw error;
    }
  }
  return sizeBytes;
}

export async function createProject(input: {
  userId: string;
  name: string;
  description: string;
}): Promise<ProjectRecord> {
  const count = await database()
    .prepare(
      "SELECT COUNT(*) AS project_count FROM projects WHERE user_id = ?",
    )
    .bind(input.userId)
    .first<{ project_count: number }>();
  if (Number(count?.project_count ?? 0) >= 50) {
    throw new ProjectLimitError();
  }
  const id = crypto.randomUUID();
  const timestamp = now();
  await database().batch([
    database()
      .prepare(
        `INSERT INTO projects
          (id, user_id, name, description, status, version, content_revision,
           created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', 1, 0, ?, ?)`,
      )
      .bind(
        id,
        input.userId,
        input.name,
        input.description,
        timestamp,
        timestamp,
      ),
    database()
      .prepare(
        `INSERT INTO project_events
          (id, project_id, document_id, run_id, user_id, event_type,
           project_version, document_version, note, created_at)
         VALUES (?, ?, NULL, NULL, ?, 'project_created', 1, NULL, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        id,
        input.userId,
        "Projektbereich angelegt.",
        timestamp,
      ),
  ]);
  return mapProject(await projectRow(id, input.userId));
}

export async function listProjects(
  userId: string,
  selectedProjectId?: string,
  selectedDocumentId?: string,
  selectedVersion?: number,
): Promise<{
  projects: ProjectRecord[];
  active: {
    project: ProjectRecord;
    documents: Array<Omit<ProjectDocumentRecord, "content">>;
    events: ProjectEventRecord[];
    document: {
      current: ProjectDocumentRecord;
      versions: Array<Omit<ProjectDocumentVersionRecord, "content">>;
      selectedVersion: ProjectDocumentVersionRecord | null;
    } | null;
  } | null;
}> {
  const projectsResult = await database()
    .prepare(
      `SELECT
         projects.id, projects.name, projects.description, projects.status,
         projects.version, projects.content_revision, projects.created_at,
         projects.updated_at,
         (SELECT COUNT(*) FROM project_documents
          WHERE project_documents.project_id = projects.id
            AND project_documents.user_id = projects.user_id) AS document_count
       FROM projects
       WHERE projects.user_id = ?
       ORDER BY
         CASE WHEN projects.status = 'archived' THEN 1 ELSE 0 END,
         projects.updated_at DESC
       LIMIT 50`,
    )
    .bind(userId)
    .all<ProjectRow>();
  const projects = (projectsResult.results ?? []).map(mapProject);
  if (!selectedProjectId) return { projects, active: null };

  const project = mapProject(await projectRow(selectedProjectId, userId));
  const [documentsResult, eventsResult] = await Promise.all([
    database()
      .prepare(
        `SELECT
           id, project_id, name, kind, content_sha256, size_bytes,
           version, created_at, updated_at
         FROM project_documents
         WHERE project_id = ? AND user_id = ?
         ORDER BY updated_at DESC
         LIMIT 100`,
      )
      .bind(selectedProjectId, userId)
      .all<ProjectDocumentMetadataRow>(),
    database()
      .prepare(
        `SELECT
           id, project_id, document_id, run_id, event_type, project_version,
           document_version, note, created_at
         FROM project_events
         WHERE project_id = ? AND user_id = ?
         ORDER BY created_at DESC
         LIMIT 100`,
      )
      .bind(selectedProjectId, userId)
      .all<ProjectEventRow>(),
  ]);
  const documents = (documentsResult.results ?? []).map(
    mapProjectDocumentMetadataRow,
  );

  let document: {
    current: ProjectDocumentRecord;
    versions: Array<Omit<ProjectDocumentVersionRecord, "content">>;
    selectedVersion: ProjectDocumentVersionRecord | null;
  } | null = null;
  if (selectedDocumentId) {
    const current = mapProjectDocument(
      await projectDocumentRow(selectedDocumentId, userId),
    );
    if (current.projectId !== selectedProjectId) {
      throw new ProjectDocumentNotFoundError();
    }
    const versionsResult = await database()
      .prepare(
        `SELECT
           id, document_id, project_id, version, name, kind,
           content_sha256, size_bytes, change_note, created_at
         FROM project_document_versions
         WHERE document_id = ? AND project_id = ? AND user_id = ?
         ORDER BY version DESC
         LIMIT 100`,
      )
      .bind(selectedDocumentId, selectedProjectId, userId)
      .all<ProjectDocumentVersionMetadataRow>();
    const versions = (versionsResult.results ?? []).map(
      mapProjectDocumentVersionMetadataRow,
    );
    const historical =
      selectedVersion === undefined
        ? null
        : await database()
            .prepare(
              `SELECT
                 id, document_id, project_id, version, name, kind, content,
                 content_sha256, size_bytes, change_note, created_at
               FROM project_document_versions
               WHERE document_id = ? AND project_id = ? AND user_id = ?
                 AND version = ?`,
            )
            .bind(
              selectedDocumentId,
              selectedProjectId,
              userId,
              selectedVersion,
            )
            .first<ProjectDocumentVersionRow>();
    if (selectedVersion !== undefined && !historical) {
      throw new ProjectDocumentNotFoundError();
    }
    document = {
      current,
      versions,
      selectedVersion: historical
        ? mapProjectDocumentVersion(historical)
        : null,
    };
  }

  return {
    projects,
    active: {
      project,
      documents,
      events: (eventsResult.results ?? []).map(mapProjectEvent),
      document,
    },
  };
}

export async function updateProject(input: {
  projectId: string;
  userId: string;
  expectedVersion: number;
  name?: string;
  description?: string;
  status?: ProjectStatus;
  note?: string;
}): Promise<ProjectRecord> {
  const existing = await projectRow(input.projectId, input.userId);
  if (Number(existing.version) !== input.expectedVersion) {
    throw new ProjectVersionConflictError();
  }
  const name = input.name ?? existing.name;
  const description = input.description ?? existing.description;
  const status = input.status ?? existing.status;
  const eventType: ProjectEventType =
    status !== existing.status
      ? status === "archived"
        ? "project_archived"
        : "project_restored"
      : "project_updated";
  const nextVersion = input.expectedVersion + 1;
  const timestamp = now();
  const [, updateResult] = await database().batch([
    database()
      .prepare(
        `INSERT INTO project_events
          (id, project_id, document_id, run_id, user_id, event_type,
           project_version, document_version, note, created_at)
         SELECT ?, id, NULL, NULL, user_id, ?, version + 1, NULL, ?, ?
         FROM projects
         WHERE id = ? AND user_id = ? AND version = ?`,
      )
      .bind(
        crypto.randomUUID(),
        eventType,
        input.note ?? null,
        timestamp,
        input.projectId,
        input.userId,
        input.expectedVersion,
      ),
    database()
      .prepare(
        `UPDATE projects
         SET name = ?, description = ?, status = ?, version = ?, updated_at = ?
         WHERE id = ? AND user_id = ? AND version = ?`,
      )
      .bind(
        name,
        description,
        status,
        nextVersion,
        timestamp,
        input.projectId,
        input.userId,
        input.expectedVersion,
      ),
  ]);
  const changes = Number(
    (updateResult.meta as { changes?: number } | undefined)?.changes ?? 0,
  );
  if (changes < 1) throw new ProjectVersionConflictError();
  return mapProject(await projectRow(input.projectId, input.userId));
}

export async function createProjectDocument(input: {
  projectId: string;
  userId: string;
  name: string;
  kind: ProjectDocumentKind;
  content: string;
  changeNote?: string;
}): Promise<ProjectDocumentRecord> {
  const project = await projectRow(input.projectId, input.userId);
  if (project.status !== "active") throw new ProjectArchivedError();
  if (Number(project.document_count) >= 100) {
    throw new ProjectDocumentLimitError();
  }
  await requireAvailableDocumentName(input);
  const id = crypto.randomUUID();
  const timestamp = now();
  const sizeBytes = validateProjectDocumentContent(input.kind, input.content);
  const sha256 = await contentSha256(input.content);
  try {
    await database().batch([
      database()
        .prepare(
          `INSERT INTO project_documents
            (id, project_id, user_id, name, kind, content, content_sha256,
             size_bytes, version, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        )
        .bind(
          id,
          input.projectId,
          input.userId,
          input.name,
          input.kind,
          input.content,
          sha256,
          sizeBytes,
          timestamp,
          timestamp,
        ),
      database()
        .prepare(
          `INSERT INTO project_document_versions
            (id, document_id, project_id, user_id, version, name, kind,
             content, content_sha256, size_bytes, change_note, created_at)
           VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          id,
          input.projectId,
          input.userId,
          input.name,
          input.kind,
          input.content,
          sha256,
          sizeBytes,
          input.changeNote ?? "Datei angelegt.",
          timestamp,
        ),
      database()
        .prepare(
          `INSERT INTO project_events
            (id, project_id, document_id, run_id, user_id, event_type,
             project_version, document_version, note, created_at)
           VALUES (?, ?, ?, NULL, ?, 'document_created', ?, 1, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          input.projectId,
          id,
          input.userId,
          Number(project.version),
          input.changeNote ?? `Datei „${input.name}“ angelegt.`,
          timestamp,
        ),
      database()
        .prepare(
          `UPDATE projects
           SET content_revision = content_revision + 1, updated_at = ?
           WHERE id = ? AND user_id = ? AND status = 'active'`,
        )
        .bind(timestamp, input.projectId, input.userId),
    ]);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ProjectDocumentNameConflictError();
    }
    throw error;
  }
  return mapProjectDocument(await projectDocumentRow(id, input.userId));
}

export async function updateProjectDocument(input: {
  documentId: string;
  userId: string;
  expectedVersion: number;
  name?: string;
  kind?: ProjectDocumentKind;
  content?: string;
  changeNote?: string;
}): Promise<ProjectDocumentRecord> {
  const existing = await projectDocumentRow(input.documentId, input.userId);
  const project = await projectRow(existing.project_id, input.userId);
  if (project.status !== "active") throw new ProjectArchivedError();
  if (Number(existing.version) !== input.expectedVersion) {
    throw new ProjectDocumentVersionConflictError();
  }
  const name = input.name ?? existing.name;
  const kind = input.kind ?? existing.kind;
  const content = input.content ?? existing.content;
  await requireAvailableDocumentName({
    projectId: existing.project_id,
    userId: input.userId,
    name,
    exceptDocumentId: input.documentId,
  });
  const sizeBytes = validateProjectDocumentContent(kind, content);
  const sha256 = await contentSha256(content);
  const nextVersion = input.expectedVersion + 1;
  const timestamp = now();
  try {
    const results = await database().batch([
      database()
        .prepare(
          `INSERT INTO project_document_versions
            (id, document_id, project_id, user_id, version, name, kind,
             content, content_sha256, size_bytes, change_note, created_at)
           SELECT ?, id, project_id, user_id, version + 1, ?, ?, ?, ?, ?, ?, ?
           FROM project_documents
           WHERE id = ? AND user_id = ? AND version = ?`,
        )
        .bind(
          crypto.randomUUID(),
          name,
          kind,
          content,
          sha256,
          sizeBytes,
          input.changeNote ?? null,
          timestamp,
          input.documentId,
          input.userId,
          input.expectedVersion,
        ),
      database()
        .prepare(
          `INSERT INTO project_events
            (id, project_id, document_id, run_id, user_id, event_type,
             project_version, document_version, note, created_at)
           SELECT ?, projects.id, project_documents.id, NULL, projects.user_id,
                  'document_updated', projects.version,
                  project_documents.version + 1, ?, ?
           FROM project_documents
           INNER JOIN projects
             ON projects.id = project_documents.project_id
            AND projects.user_id = project_documents.user_id
           WHERE project_documents.id = ? AND project_documents.user_id = ?
             AND project_documents.version = ? AND projects.status = 'active'`,
        )
        .bind(
          crypto.randomUUID(),
          input.changeNote ?? `Datei „${name}“ aktualisiert.`,
          timestamp,
          input.documentId,
          input.userId,
          input.expectedVersion,
        ),
      database()
        .prepare(
          `UPDATE projects
           SET content_revision = content_revision + 1, updated_at = ?
           WHERE id = ? AND user_id = ? AND status = 'active'
             AND EXISTS (
               SELECT 1 FROM project_documents
               WHERE id = ? AND user_id = ? AND version = ?
             )`,
        )
        .bind(
          timestamp,
          existing.project_id,
          input.userId,
          input.documentId,
          input.userId,
          input.expectedVersion,
        ),
      database()
        .prepare(
          `UPDATE project_documents
           SET name = ?, kind = ?, content = ?, content_sha256 = ?,
               size_bytes = ?, version = ?, updated_at = ?
           WHERE id = ? AND user_id = ? AND version = ?`,
        )
        .bind(
          name,
          kind,
          content,
          sha256,
          sizeBytes,
          nextVersion,
          timestamp,
          input.documentId,
          input.userId,
          input.expectedVersion,
        ),
    ]);
    const updateResult = results[3];
    const changes = Number(
      (updateResult.meta as { changes?: number } | undefined)?.changes ?? 0,
    );
    if (changes < 1) throw new ProjectDocumentVersionConflictError();
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ProjectDocumentNameConflictError();
    }
    throw error;
  }
  return mapProjectDocument(
    await projectDocumentRow(input.documentId, input.userId),
  );
}

export async function requireActiveProjectContext(
  projectId: string,
  userId: string,
): Promise<ProjectContext> {
  const project = mapProject(await projectRow(projectId, userId));
  if (project.status !== "active") throw new ProjectArchivedError();
  const result = await database()
    .prepare(
      `SELECT
         id, project_id, name, kind, content, content_sha256, size_bytes,
         version, created_at, updated_at
       FROM project_documents
       WHERE project_id = ? AND user_id = ?
       ORDER BY updated_at DESC
       LIMIT 100`,
    )
    .bind(projectId, userId)
    .all<ProjectDocumentRow>();
  const available = (result.results ?? []).map(mapProjectDocument);
  const documents: ProjectContext["documents"] = [];
  const omittedDocumentNames: string[] = [];
  let contextCharacters = 0;
  for (const document of available) {
    const overhead = document.name.length + document.kind.length + 180;
    if (contextCharacters + overhead + document.content.length > 18_000) {
      omittedDocumentNames.push(document.name);
      continue;
    }
    documents.push({
      id: document.id,
      name: document.name,
      kind: document.kind,
      content: document.content,
      contentSha256: document.contentSha256,
      version: document.version,
    });
    contextCharacters += overhead + document.content.length;
  }
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    version: project.version,
    contentRevision: project.contentRevision,
    documentCount: project.documentCount,
    includedDocumentCount: documents.length,
    omittedDocumentNames,
    documents,
  };
}

export async function createCapabilityLease(input: {
  userId: string;
  mode: TeamMode;
  scope: CapabilityLeaseScope;
  projectId?: string;
  maxUses: number;
  durationMinutes: number;
}): Promise<CapabilityLeaseRecord> {
  if (
    !Number.isInteger(input.maxUses) ||
    input.maxUses < 1 ||
    input.maxUses > 20
  ) {
    throw new CapabilityLeaseInputError(
      "Eine Ausführungsfreigabe erlaubt zwischen 1 und 20 Nutzungen.",
    );
  }
  if (
    !Number.isInteger(input.durationMinutes) ||
    input.durationMinutes < 15 ||
    input.durationMinutes > 1_440
  ) {
    throw new CapabilityLeaseInputError(
      "Eine Ausführungsfreigabe gilt zwischen 15 Minuten und 24 Stunden.",
    );
  }
  if (
    (input.scope === "account" && input.projectId) ||
    (input.scope === "project" && !input.projectId)
  ) {
    throw new CapabilityLeaseInputError(
      "Projektbezogene Freigaben benötigen genau einen Projektbereich.",
    );
  }
  if (input.scope === "project" && input.projectId) {
    const project = await projectRow(input.projectId, input.userId);
    if (project.status !== "active") throw new ProjectArchivedError();
  }

  const timestamp = now();
  const activeCount = await database()
    .prepare(
      `SELECT COUNT(*) AS lease_count
       FROM capability_leases
       WHERE user_id = ? AND status = 'active'
         AND remaining_uses > 0 AND expires_at > ?`,
    )
    .bind(input.userId, timestamp)
    .first<{ lease_count: number }>();
  if (Number(activeCount?.lease_count ?? 0) >= 20) {
    throw new CapabilityLeaseLimitError();
  }

  const id = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const expiresAt = new Date(
    Date.parse(timestamp) + input.durationMinutes * 60_000,
  ).toISOString();
  const results = await database().batch([
    database()
      .prepare(
        `INSERT INTO capability_leases
          (id, user_id, capability, mode, scope_kind, project_id, status,
           max_uses, remaining_uses, version, expires_at, last_event_id,
           created_at, updated_at, last_used_at, revoked_at)
         SELECT ?, ?, 'model.run', ?, ?, ?, 'active', ?, ?, 1, ?, ?, ?, ?,
                NULL, NULL
         WHERE (
           SELECT COUNT(*)
           FROM capability_leases
           WHERE user_id = ? AND status = 'active'
             AND remaining_uses > 0 AND expires_at > ?
         ) < 20`,
      )
      .bind(
        id,
        input.userId,
        input.mode,
        input.scope,
        input.projectId ?? null,
        input.maxUses,
        input.maxUses,
        expiresAt,
        eventId,
        timestamp,
        timestamp,
        input.userId,
        timestamp,
      ),
    database()
      .prepare(
        `INSERT INTO capability_lease_events
          (id, lease_id, run_id, user_id, event_type, lease_version,
           remaining_uses, created_at)
         SELECT ?, id, NULL, user_id, 'created', 1, remaining_uses, ?
         FROM capability_leases
         WHERE id = ? AND user_id = ? AND last_event_id = ?`,
      )
      .bind(eventId, timestamp, id, input.userId, eventId),
  ]);
  const changes = Number(
    (results[0].meta as { changes?: number } | undefined)?.changes ?? 0,
  );
  if (changes < 1) throw new CapabilityLeaseLimitError();
  return mapCapabilityLease(
    await capabilityLeaseRow(id, input.userId),
    timestamp,
  );
}

export async function listCapabilityLeases(userId: string): Promise<{
  leases: CapabilityLeaseRecord[];
  events: CapabilityLeaseEventRecord[];
}> {
  const timestamp = now();
  const [leasesResult, eventsResult] = await Promise.all([
    database()
      .prepare(
        `SELECT
           capability_leases.id, capability_leases.capability,
           capability_leases.mode, capability_leases.scope_kind,
           capability_leases.project_id, projects.name AS project_name,
           capability_leases.status, capability_leases.max_uses,
           capability_leases.remaining_uses, capability_leases.version,
           capability_leases.expires_at, capability_leases.created_at,
           capability_leases.updated_at, capability_leases.last_used_at,
           capability_leases.revoked_at
         FROM capability_leases
         LEFT JOIN projects
           ON projects.id = capability_leases.project_id
          AND projects.user_id = capability_leases.user_id
         WHERE capability_leases.user_id = ?
         ORDER BY capability_leases.created_at DESC
         LIMIT 100`,
      )
      .bind(userId)
      .all<CapabilityLeaseRow>(),
    database()
      .prepare(
        `SELECT
           id, lease_id, run_id, event_type, lease_version, remaining_uses,
           created_at
         FROM capability_lease_events
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 200`,
      )
      .bind(userId)
      .all<CapabilityLeaseEventRow>(),
  ]);
  return {
    leases: (leasesResult.results ?? []).map((row) =>
      mapCapabilityLease(row, timestamp),
    ),
    events: (eventsResult.results ?? []).map(mapCapabilityLeaseEvent),
  };
}

export async function revokeCapabilityLease(input: {
  leaseId: string;
  userId: string;
  expectedVersion: number;
}): Promise<CapabilityLeaseRecord> {
  const existing = await capabilityLeaseRow(input.leaseId, input.userId);
  if (Number(existing.version) !== input.expectedVersion) {
    throw new CapabilityLeaseVersionConflictError();
  }
  const timestamp = now();
  if (effectiveCapabilityLeaseStatus(existing, timestamp) !== "active") {
    throw new CapabilityLeaseUnavailableError();
  }
  const eventId = crypto.randomUUID();
  const results = await database().batch([
    database()
      .prepare(
        `UPDATE capability_leases
         SET status = 'revoked', version = version + 1, last_event_id = ?,
             updated_at = ?, revoked_at = ?
         WHERE id = ? AND user_id = ? AND version = ? AND status = 'active'
           AND remaining_uses > 0 AND expires_at > ?`,
      )
      .bind(
        eventId,
        timestamp,
        timestamp,
        input.leaseId,
        input.userId,
        input.expectedVersion,
        timestamp,
      ),
    database()
      .prepare(
        `INSERT INTO capability_lease_events
          (id, lease_id, run_id, user_id, event_type, lease_version,
           remaining_uses, created_at)
         SELECT ?, id, NULL, user_id, 'revoked', version, remaining_uses, ?
         FROM capability_leases
         WHERE id = ? AND user_id = ? AND last_event_id = ?`,
      )
      .bind(
        eventId,
        timestamp,
        input.leaseId,
        input.userId,
        eventId,
      ),
  ]);
  const changes = Number(
    (results[0].meta as { changes?: number } | undefined)?.changes ?? 0,
  );
  if (changes < 1) throw new CapabilityLeaseVersionConflictError();
  return mapCapabilityLease(
    await capabilityLeaseRow(input.leaseId, input.userId),
    timestamp,
  );
}

export async function requireCapabilityLeaseForRun(input: {
  leaseId: string;
  userId: string;
  mode: TeamMode;
  projectId?: string;
}): Promise<CapabilityLeaseRecord> {
  let row: CapabilityLeaseRow;
  try {
    row = await capabilityLeaseRow(input.leaseId, input.userId);
  } catch (error) {
    if (error instanceof CapabilityLeaseNotFoundError) {
      throw new CapabilityLeaseUnavailableError();
    }
    throw error;
  }
  const lease = mapCapabilityLease(row);
  const scopeMatches =
    lease.scope === "account" ||
    (lease.scope === "project" &&
      Boolean(input.projectId) &&
      lease.projectId === input.projectId);
  if (
    lease.capability !== "model.run" ||
    lease.mode !== input.mode ||
    lease.status !== "active" ||
    lease.remainingUses < 1 ||
    !scopeMatches
  ) {
    throw new CapabilityLeaseUnavailableError();
  }
  return lease;
}

const GOAL_TRANSITIONS: Record<GoalStatus, readonly GoalStatus[]> = {
  draft: ["planned", "cancelled"],
  planned: ["draft", "ready", "cancelled"],
  ready: ["planned", "running", "cancelled"],
  running: ["waiting", "verifying", "failed", "cancelled"],
  waiting: ["running", "failed", "cancelled"],
  verifying: ["running", "completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

const TERMINAL_GOAL_STATUSES = new Set<GoalStatus>([
  "completed",
  "failed",
  "cancelled",
]);

function mapGoal(row: GoalRow): GoalRecord {
  return {
    id: row.id,
    title: row.title,
    objective: row.objective,
    definitionOfDone: row.definition_of_done,
    status: row.status,
    progressPercent: Number(row.progress_percent),
    currentStep: row.current_step,
    nextAction: row.next_action,
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

function mapGoalEvent(row: GoalEventRow): GoalEventRecord {
  return {
    id: row.id,
    goalId: row.goal_id,
    runId: row.run_id,
    type: row.event_type,
    fromStatus: row.from_status as GoalStatus | null,
    toStatus: row.to_status as GoalStatus | null,
    progressPercent:
      row.progress_percent === null ? null : Number(row.progress_percent),
    currentStep: row.current_step,
    nextAction: row.next_action,
    note: row.note,
    goalVersion: Number(row.goal_version),
    createdAt: row.created_at,
  };
}

async function goalRow(goalId: string, userId: string): Promise<GoalRow> {
  const row = await database()
    .prepare(
      `SELECT
         id, title, objective, definition_of_done, status, progress_percent,
         current_step, next_action, version, created_at, updated_at, completed_at
       FROM goals
       WHERE id = ? AND user_id = ?`,
    )
    .bind(goalId, userId)
    .first<GoalRow>();
  if (!row) throw new GoalNotFoundError();
  return row;
}

export async function createGoal(input: {
  userId: string;
  title: string;
  objective: string;
  definitionOfDone: string;
}): Promise<GoalRecord> {
  const id = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const timestamp = now();
  await database().batch([
    database()
      .prepare(
        `INSERT INTO goals
          (id, user_id, title, objective, definition_of_done, status,
           progress_percent, current_step, next_action, version,
           created_at, updated_at, completed_at)
         VALUES (?, ?, ?, ?, ?, 'draft', 0, NULL, NULL, 1, ?, ?, NULL)`,
      )
      .bind(
        id,
        input.userId,
        input.title,
        input.objective,
        input.definitionOfDone,
        timestamp,
        timestamp,
      ),
    database()
      .prepare(
        `INSERT INTO goal_events
          (id, goal_id, run_id, user_id, event_type, from_status, to_status,
           progress_percent, current_step, next_action, note, goal_version, created_at)
         VALUES (?, ?, NULL, ?, 'created', NULL, 'draft', 0, NULL, NULL, ?, 1, ?)`,
      )
      .bind(eventId, id, input.userId, "Ziel angelegt.", timestamp),
  ]);
  return mapGoal(await goalRow(id, input.userId));
}

export async function listGoals(
  userId: string,
  selectedGoalId?: string,
): Promise<{
  goals: GoalRecord[];
  active: { goal: GoalRecord; events: GoalEventRecord[] } | null;
}> {
  const result = await database()
    .prepare(
      `SELECT
         id, title, objective, definition_of_done, status, progress_percent,
         current_step, next_action, version, created_at, updated_at, completed_at
       FROM goals
       WHERE user_id = ?
       ORDER BY
         CASE WHEN status IN ('completed', 'failed', 'cancelled') THEN 1 ELSE 0 END,
         updated_at DESC
       LIMIT 50`,
    )
    .bind(userId)
    .all<GoalRow>();
  const goals = (result.results ?? []).map(mapGoal);
  if (!selectedGoalId) return { goals, active: null };

  const selected = await goalRow(selectedGoalId, userId);
  const eventsResult = await database()
    .prepare(
      `SELECT
         id, goal_id, run_id, event_type, from_status, to_status,
         progress_percent, current_step, next_action, note, goal_version, created_at
       FROM goal_events
       WHERE goal_id = ? AND user_id = ?
       ORDER BY created_at DESC
       LIMIT 100`,
    )
    .bind(selectedGoalId, userId)
    .all<GoalEventRow>();
  return {
    goals,
    active: {
      goal: mapGoal(selected),
      events: (eventsResult.results ?? []).map(mapGoalEvent),
    },
  };
}

export async function requireRunnableGoalContext(
  goalId: string,
  userId: string,
): Promise<GoalContext> {
  const goal = mapGoal(await goalRow(goalId, userId));
  if (TERMINAL_GOAL_STATUSES.has(goal.status)) {
    throw new GoalNotRunnableError();
  }
  return {
    id: goal.id,
    title: goal.title,
    objective: goal.objective,
    definitionOfDone: goal.definitionOfDone,
    status: goal.status as GoalContext["status"],
    progressPercent: goal.progressPercent,
    currentStep: goal.currentStep,
    nextAction: goal.nextAction,
    version: goal.version,
  };
}

export async function updateGoal(input: {
  goalId: string;
  userId: string;
  expectedVersion: number;
  status?: GoalStatus;
  progressPercent?: number;
  currentStep?: string | null;
  nextAction?: string | null;
  note?: string;
}): Promise<GoalRecord> {
  const existing = await goalRow(input.goalId, input.userId);
  if (Number(existing.version) !== input.expectedVersion) {
    throw new GoalVersionConflictError();
  }
  const status = input.status ?? existing.status;
  if (
    status !== existing.status &&
    !GOAL_TRANSITIONS[existing.status].includes(status)
  ) {
    throw new GoalTransitionError(existing.status, status);
  }
  const progressPercent =
    status === "completed"
      ? 100
      : (input.progressPercent ?? Number(existing.progress_percent));
  const currentStep =
    input.currentStep === undefined ? existing.current_step : input.currentStep;
  const nextAction = TERMINAL_GOAL_STATUSES.has(status)
    ? null
    : input.nextAction === undefined
      ? existing.next_action
      : input.nextAction;
  const timestamp = now();
  const terminalAt = TERMINAL_GOAL_STATUSES.has(status) ? timestamp : null;
  const nextVersion = input.expectedVersion + 1;
  const eventType: GoalEventType =
    status !== existing.status
      ? "status_changed"
      : input.note &&
          input.progressPercent === undefined &&
          input.currentStep === undefined &&
          input.nextAction === undefined
        ? "note_added"
        : "progress_recorded";
  const [, updateResult] = await database().batch([
    database()
      .prepare(
        `INSERT INTO goal_events
          (id, goal_id, run_id, user_id, event_type, from_status, to_status,
           progress_percent, current_step, next_action, note, goal_version, created_at)
         SELECT ?, id, NULL, user_id, ?, ?, ?, ?, ?, ?, ?, version + 1, ?
         FROM goals
         WHERE id = ? AND user_id = ? AND version = ?`,
      )
      .bind(
        crypto.randomUUID(),
        eventType,
        existing.status,
        status,
        progressPercent,
        currentStep,
        nextAction,
        input.note ?? null,
        timestamp,
        input.goalId,
        input.userId,
        input.expectedVersion,
      ),
    database()
      .prepare(
        `UPDATE goals
         SET status = ?, progress_percent = ?, current_step = ?, next_action = ?,
             version = ?, updated_at = ?, completed_at = ?
         WHERE id = ? AND user_id = ? AND version = ?`,
      )
      .bind(
        status,
        progressPercent,
        currentStep,
        nextAction,
        nextVersion,
        timestamp,
        terminalAt,
        input.goalId,
        input.userId,
        input.expectedVersion,
      ),
  ]);
  const changes = Number(
    (updateResult.meta as { changes?: number } | undefined)?.changes ?? 0,
  );
  if (changes < 1) throw new GoalVersionConflictError();
  return mapGoal(await goalRow(input.goalId, input.userId));
}

export async function reserveDailyUsage(
  userId: string,
  reservedCalls: number,
): Promise<{ requests: number; modelCalls: number }> {
  const requestLimit = readRuntimeInteger(
    "TANKAI_DAILY_REQUEST_LIMIT",
    30,
    1,
    1_000,
  );
  const callLimit = readRuntimeInteger(
    "TANKAI_DAILY_MODEL_CALL_LIMIT",
    120,
    1,
    10_000,
  );
  const day = new Date().toISOString().slice(0, 10);
  const updatedAt = now();
  const row = await database()
    .prepare(
      `INSERT INTO usage_buckets (user_id, day, requests, model_calls, updated_at)
       VALUES (?, ?, 1, ?, ?)
       ON CONFLICT(user_id, day) DO UPDATE SET
         requests = usage_buckets.requests + 1,
         model_calls = usage_buckets.model_calls + excluded.model_calls,
         updated_at = excluded.updated_at
       WHERE usage_buckets.requests < ?
         AND usage_buckets.model_calls + excluded.model_calls <= ?
       RETURNING requests, model_calls`,
    )
    .bind(userId, day, reservedCalls, updatedAt, requestLimit, callLimit)
    .first<UsageRow>();
  if (!row || row.requests > requestLimit || row.model_calls > callLimit) {
    throw new UsageLimitError();
  }
  return { requests: row.requests, modelCalls: row.model_calls };
}

export async function createConversation(
  userId: string,
  firstMessage: string,
): Promise<string> {
  const id = crypto.randomUUID();
  const timestamp = now();
  await database()
    .prepare(
      `INSERT INTO conversations (id, user_id, title, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(id, userId, titleFromMessage(firstMessage), timestamp, timestamp)
    .run();
  return id;
}

export async function requireConversation(
  conversationId: string,
  userId: string,
): Promise<void> {
  const row = await database()
    .prepare("SELECT id FROM conversations WHERE id = ? AND user_id = ?")
    .bind(conversationId, userId)
    .first<{ id: string }>();
  if (!row) throw new ConversationNotFoundError();
}

export async function appendMessage(input: {
  conversationId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  runId?: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  const timestamp = now();
  await database().batch([
    database()
      .prepare(
        `INSERT INTO messages
          (id, conversation_id, user_id, role, content, run_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.conversationId,
        input.userId,
        input.role,
        input.content,
        input.runId ?? null,
        timestamp,
      ),
    database()
      .prepare(
        "UPDATE conversations SET updated_at = ? WHERE id = ? AND user_id = ?",
      )
      .bind(timestamp, input.conversationId, input.userId),
  ]);
  return id;
}

export async function conversationModelHistory(
  conversationId: string,
  userId: string,
  limit = 16,
): Promise<ModelMessage[]> {
  await requireConversation(conversationId, userId);
  const result = await database()
    .prepare(
      `SELECT role, content
       FROM messages
       WHERE conversation_id = ? AND user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .bind(conversationId, userId, limit)
    .all<{ role: "user" | "assistant"; content: string }>();
  return (result.results ?? [])
    .reverse()
    .map((row) => ({ role: row.role, content: row.content }));
}

export async function startRun(input: {
  runId: string;
  conversationId: string;
  userId: string;
  mode: TeamMode;
  promptVersion: string;
  capabilityLeaseId: string;
  goalId?: string;
  projectId?: string;
}): Promise<void> {
  const timestamp = now();
  const leaseEventId = crypto.randomUUID();
  const leaseUpdate = database()
    .prepare(
      `UPDATE capability_leases
       SET remaining_uses = remaining_uses - 1,
           status = CASE
             WHEN remaining_uses = 1 THEN 'depleted'
             ELSE 'active'
           END,
           version = version + 1,
           last_event_id = ?,
           last_used_at = ?,
           updated_at = ?
       WHERE id = ? AND user_id = ? AND capability = 'model.run'
         AND mode = ? AND status = 'active' AND remaining_uses > 0
         AND expires_at > ?
         AND (
           (scope_kind = 'account' AND project_id IS NULL)
           OR
           (scope_kind = 'project' AND project_id = ? AND ? IS NOT NULL)
         )`,
    )
    .bind(
      leaseEventId,
      timestamp,
      timestamp,
      input.capabilityLeaseId,
      input.userId,
      input.mode,
      timestamp,
      input.projectId ?? null,
      input.projectId ?? null,
    );
  const runStatement = database()
    .prepare(
      `INSERT INTO runs
        (id, conversation_id, goal_id, project_id, capability_lease_id,
         user_id, mode, status, prompt_version, model_calls, created_at)
       SELECT ?, ?, ?, ?, id, ?, ?, 'running', ?, 0, ?
       FROM capability_leases
       WHERE id = ? AND user_id = ? AND last_event_id = ?`,
    )
    .bind(
      input.runId,
      input.conversationId,
      input.goalId ?? null,
      input.projectId ?? null,
      input.userId,
      input.mode,
      input.promptVersion,
      timestamp,
      input.capabilityLeaseId,
      input.userId,
      leaseEventId,
    );
  const leaseEventStatement = database()
    .prepare(
      `INSERT INTO capability_lease_events
        (id, lease_id, run_id, user_id, event_type, lease_version,
         remaining_uses, created_at)
       SELECT ?, capability_leases.id, runs.id, capability_leases.user_id,
              'consumed', capability_leases.version,
              capability_leases.remaining_uses, ?
       FROM capability_leases
       INNER JOIN runs
         ON runs.capability_lease_id = capability_leases.id
        AND runs.user_id = capability_leases.user_id
       WHERE capability_leases.id = ? AND capability_leases.user_id = ?
         AND capability_leases.last_event_id = ? AND runs.id = ?`,
    )
    .bind(
      leaseEventId,
      timestamp,
      input.capabilityLeaseId,
      input.userId,
      leaseEventId,
      input.runId,
    );
  const statements: D1PreparedStatement[] = [
    leaseUpdate,
    runStatement,
    leaseEventStatement,
  ];
  if (input.goalId) {
    statements.push(
      database()
        .prepare(
          `INSERT INTO goal_events
            (id, goal_id, run_id, user_id, event_type, from_status, to_status,
             progress_percent, current_step, next_action, note, goal_version, created_at)
           SELECT ?, id, ?, user_id, 'run_started', status, status,
                  progress_percent, current_step, next_action, ?, version, ?
           FROM goals
           WHERE id = ? AND user_id = ?`,
        )
        .bind(
          crypto.randomUUID(),
          input.runId,
          "TankAI-Lauf für dieses Ziel gestartet.",
          timestamp,
          input.goalId,
          input.userId,
        ),
    );
  }
  if (input.projectId) {
    statements.push(
      database()
        .prepare(
          `INSERT INTO project_events
            (id, project_id, document_id, run_id, user_id, event_type,
             project_version, document_version, note, created_at)
           SELECT ?, id, NULL, ?, user_id, 'run_started', version, NULL, ?, ?
           FROM projects
           WHERE id = ? AND user_id = ? AND status = 'active'`,
        )
        .bind(
          crypto.randomUUID(),
          input.runId,
          "TankAI-Lauf mit diesem Projektkontext gestartet.",
          timestamp,
          input.projectId,
          input.userId,
      ),
    );
  }
  const results = await database().batch(statements);
  const changes = Number(
    (results[0].meta as { changes?: number } | undefined)?.changes ?? 0,
  );
  if (changes < 1) throw new CapabilityLeaseUnavailableError();
}

export async function completeRun(input: {
  runId: string;
  userId: string;
  trace: TeamRunTrace;
}): Promise<void> {
  const traceJson = JSON.stringify(input.trace);
  const timestamp = now();
  await database().batch([
    database()
      .prepare(
        `INSERT INTO goal_events
          (id, goal_id, run_id, user_id, event_type, from_status, to_status,
           progress_percent, current_step, next_action, note, goal_version, created_at)
         SELECT ?, goals.id, runs.id, goals.user_id, 'run_completed',
                goals.status, goals.status, goals.progress_percent,
                goals.current_step, goals.next_action, ?, goals.version, ?
         FROM runs
         INNER JOIN goals ON goals.id = runs.goal_id AND goals.user_id = runs.user_id
         WHERE runs.id = ? AND runs.user_id = ? AND runs.status = 'running'`,
      )
      .bind(
        crypto.randomUUID(),
        "TankAI-Lauf abgeschlossen; Zielstatus und Fortschritt bleiben bis zur Bestätigung unverändert.",
        timestamp,
        input.runId,
        input.userId,
      ),
    database()
      .prepare(
        `INSERT INTO project_events
          (id, project_id, document_id, run_id, user_id, event_type,
           project_version, document_version, note, created_at)
         SELECT ?, projects.id, NULL, runs.id, projects.user_id, 'run_completed',
                projects.version, NULL, ?, ?
         FROM runs
         INNER JOIN projects
           ON projects.id = runs.project_id AND projects.user_id = runs.user_id
         WHERE runs.id = ? AND runs.user_id = ? AND runs.status = 'running'`,
      )
      .bind(
        crypto.randomUUID(),
        "TankAI-Lauf mit Projektkontext abgeschlossen; Projektdaten bleiben unverändert.",
        timestamp,
        input.runId,
        input.userId,
      ),
    database()
      .prepare(
        `UPDATE runs
         SET status = 'completed',
             trace_json = ?,
             model_calls = ?,
             elapsed_ms = ?,
             completed_at = ?
         WHERE id = ? AND user_id = ? AND status = 'running'`,
      )
      .bind(
        traceJson,
        input.trace.modelCalls,
        input.trace.elapsedMs,
        timestamp,
        input.runId,
        input.userId,
      ),
  ]);
}

export async function failRun(input: {
  runId: string;
  userId: string;
  errorCode: string;
  elapsedMs: number;
}): Promise<void> {
  const timestamp = now();
  await database().batch([
    database()
      .prepare(
        `INSERT INTO goal_events
          (id, goal_id, run_id, user_id, event_type, from_status, to_status,
           progress_percent, current_step, next_action, note, goal_version, created_at)
         SELECT ?, goals.id, runs.id, goals.user_id, 'run_failed',
                goals.status, goals.status, goals.progress_percent,
                goals.current_step, goals.next_action, ?, goals.version, ?
         FROM runs
         INNER JOIN goals ON goals.id = runs.goal_id AND goals.user_id = runs.user_id
         WHERE runs.id = ? AND runs.user_id = ? AND runs.status = 'running'`,
      )
      .bind(
        crypto.randomUUID(),
        `TankAI-Lauf fehlgeschlagen (${input.errorCode.slice(0, 80)}).`,
        timestamp,
        input.runId,
        input.userId,
      ),
    database()
      .prepare(
        `INSERT INTO project_events
          (id, project_id, document_id, run_id, user_id, event_type,
           project_version, document_version, note, created_at)
         SELECT ?, projects.id, NULL, runs.id, projects.user_id, 'run_failed',
                projects.version, NULL, ?, ?
         FROM runs
         INNER JOIN projects
           ON projects.id = runs.project_id AND projects.user_id = runs.user_id
         WHERE runs.id = ? AND runs.user_id = ? AND runs.status = 'running'`,
      )
      .bind(
        crypto.randomUUID(),
        `TankAI-Lauf mit Projektkontext fehlgeschlagen (${input.errorCode.slice(0, 80)}).`,
        timestamp,
        input.runId,
        input.userId,
      ),
    database()
      .prepare(
        `UPDATE runs
         SET status = 'failed', error_code = ?, elapsed_ms = ?, completed_at = ?
         WHERE id = ? AND user_id = ? AND status = 'running'`,
      )
      .bind(
        input.errorCode,
        input.elapsedMs,
        timestamp,
        input.runId,
        input.userId,
      ),
  ]);
}

export async function listConversationHistory(
  userId: string,
  conversationId?: string,
): Promise<{
  conversations: ConversationHistory["conversation"][];
  active: ConversationHistory | null;
}> {
  const conversationsResult = await database()
    .prepare(
      `SELECT id, title, created_at, updated_at
       FROM conversations
       WHERE user_id = ?
       ORDER BY updated_at DESC
       LIMIT 40`,
    )
    .bind(userId)
    .all<ConversationRow>();
  const conversations = (conversationsResult.results ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
  const selectedId = conversationId ?? conversations[0]?.id;
  if (!selectedId) return { conversations, active: null };
  const selected = conversations.find((item) => item.id === selectedId);
  if (!selected) throw new ConversationNotFoundError();
  const messageResult = await database()
    .prepare(
      `SELECT id, conversation_id, role, content, run_id, created_at
       FROM messages
       WHERE conversation_id = ? AND user_id = ?
       ORDER BY created_at ASC
       LIMIT 200`,
    )
    .bind(selectedId, userId)
    .all<MessageRow>();
  return {
    conversations,
    active: {
      conversation: selected,
      messages: (messageResult.results ?? []).map((row) => ({
        id: row.id,
        role: row.role,
        content: row.content,
        runId: row.run_id,
        createdAt: row.created_at,
      })),
    },
  };
}

export async function saveFeedback(input: {
  runId: string;
  userId: string;
  rating: -1 | 1;
  correction?: string;
}): Promise<{ feedbackId: string; learningCaseId?: string }> {
  const ownedRun = await database()
    .prepare("SELECT id FROM runs WHERE id = ? AND user_id = ? AND status = 'completed'")
    .bind(input.runId, input.userId)
    .first<{ id: string }>();
  if (!ownedRun) throw new ConversationNotFoundError();
  const feedbackId = crypto.randomUUID();
  const timestamp = now();
  const feedbackStatement = database()
    .prepare(
      `INSERT INTO feedback (id, run_id, user_id, rating, correction, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      feedbackId,
      input.runId,
      input.userId,
      input.rating,
      input.correction ?? null,
      timestamp,
    );
  if (input.rating === -1 && input.correction) {
    const learningCaseId = crypto.randomUUID();
    await database().batch([
      feedbackStatement,
      database()
        .prepare(
          `INSERT INTO learning_cases
            (id, feedback_id, run_id, user_id, source, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'corrected-negative-feedback', 'queued', ?, ?)`,
        )
        .bind(
          learningCaseId,
          feedbackId,
          input.runId,
          input.userId,
          timestamp,
          timestamp,
        ),
    ]);
    return { feedbackId, learningCaseId };
  }
  await feedbackStatement.run();
  return { feedbackId };
}

export async function getImprovementStatus(userId: string): Promise<{
  signals: {
    total: number;
    positive: number;
    negative: number;
    corrections: number;
    lastSignalAt: string | null;
  };
  queue: {
    queued: number;
    included: number;
    dismissed: number;
  };
}> {
  const [signals, queue] = await Promise.all([
    database()
      .prepare(
        `SELECT
           COUNT(*) AS total,
           COALESCE(SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END), 0) AS positive,
           COALESCE(SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END), 0) AS negative,
           COALESCE(SUM(CASE WHEN correction IS NOT NULL AND correction <> '' THEN 1 ELSE 0 END), 0) AS corrections,
           MAX(created_at) AS last_signal_at
         FROM feedback
         WHERE user_id = ?`,
      )
      .bind(userId)
      .first<ImprovementSignalRow>(),
    database()
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END), 0) AS queued,
           COALESCE(SUM(CASE WHEN status = 'included' THEN 1 ELSE 0 END), 0) AS included,
           COALESCE(SUM(CASE WHEN status = 'dismissed' THEN 1 ELSE 0 END), 0) AS dismissed
         FROM learning_cases
         WHERE user_id = ?`,
      )
      .bind(userId)
      .first<ImprovementQueueRow>(),
  ]);
  return {
    signals: {
      total: Number(signals?.total ?? 0),
      positive: Number(signals?.positive ?? 0),
      negative: Number(signals?.negative ?? 0),
      corrections: Number(signals?.corrections ?? 0),
      lastSignalAt: signals?.last_signal_at ?? null,
    },
    queue: {
      queued: Number(queue?.queued ?? 0),
      included: Number(queue?.included ?? 0),
      dismissed: Number(queue?.dismissed ?? 0),
    },
  };
}
