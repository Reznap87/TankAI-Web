import { currentRuntimeBindings } from "@/lib/request-context";

export const TANKAI_DATA_CONTROL_VERSION = "1.0.0";
export const TANKAI_RELEASE = "0.43.0";
export const DELETION_CONFIRMATION_MINUTES = 30;
export const DELETION_GRACE_HOURS = 24;

const STANDARD_USER_DATASET_NAMES = [
  "capability_lease_events",
  "capability_leases",
  "commander_capability_events",
  "commander_decisions",
  "commander_events",
  "commander_runs",
  "conversations",
  "data_subject_events",
  "data_subject_requests",
  "deployment_admission_buckets",
  "deployment_alerts",
  "deployment_circuit_breakers",
  "deployment_control_events",
  "deployment_events",
  "deployment_inflight_leases",
  "deployment_operations_events",
  "deployment_operations_policies",
  "deployment_release_configs",
  "deployment_request_attempts",
  "deployment_requests",
  "deployment_slo_snapshots",
  "deployment_traffic_overrides",
  "feedback",
  "goal_events",
  "goals",
  "learning_cases",
  "memory_entries",
  "memory_events",
  "messages",
  "project_document_versions",
  "project_documents",
  "project_events",
  "projects",
  "react_events",
  "react_runs",
  "react_steps",
  "runs",
  "tankbench_canary_observations",
  "tankbench_cases",
  "tankbench_events",
  "tankbench_releases",
  "tankbench_results",
  "tankbench_route_events",
  "tankbench_runs",
  "tankbench_suite_executions",
  "tankbench_suites",
  "tool_execution_lease_events",
  "tool_execution_leases",
  "tool_job_events",
  "tool_job_replays",
  "tool_jobs",
  "usage_buckets",
  "worker_agent_events",
  "worker_agents",
] as const;

const RELATED_USER_DATASET_NAME = "tankbench_suite_execution_items" as const;

export const USER_DATASET_NAMES = [
  ...STANDARD_USER_DATASET_NAMES,
  RELATED_USER_DATASET_NAME,
] as const;

export type UserDatasetName = (typeof USER_DATASET_NAMES)[number];

const DELETION_ORDER: readonly UserDatasetName[] = [
  "capability_lease_events",
  "commander_capability_events",
  "commander_decisions",
  "commander_events",
  "data_subject_events",
  "data_subject_requests",
  "deployment_admission_buckets",
  "deployment_alerts",
  "deployment_circuit_breakers",
  "deployment_control_events",
  "deployment_events",
  "deployment_inflight_leases",
  "deployment_operations_events",
  "deployment_request_attempts",
  "deployment_requests",
  "deployment_release_configs",
  "deployment_slo_snapshots",
  "deployment_operations_policies",
  "deployment_traffic_overrides",
  "goal_events",
  "learning_cases",
  "feedback",
  "memory_events",
  "memory_entries",
  "messages",
  "project_document_versions",
  "project_events",
  "project_documents",
  "react_events",
  "react_steps",
  "runs",
  "conversations",
  "goals",
  "tankbench_canary_observations",
  "tankbench_events",
  "tankbench_results",
  "tankbench_route_events",
  "tankbench_releases",
  "tankbench_suite_execution_items",
  "commander_runs",
  "react_runs",
  "tankbench_cases",
  "tankbench_suite_executions",
  "capability_leases",
  "tankbench_runs",
  "tankbench_suites",
  "tool_execution_lease_events",
  "tool_job_events",
  "tool_job_replays",
  "tool_jobs",
  "tool_execution_leases",
  "projects",
  "usage_buckets",
  "worker_agent_events",
  "worker_agents",
] as const;

const RETENTION_GROUPS = [
  {
    id: "identity-and-usage",
    title: "Nutzung und Kontometadaten",
    datasets: ["usage_buckets"],
    activeRetention: "Während der Kontonutzung",
    deletion: "Sofortige physische Löschung aus der Anwendungsdatenbank",
  },
  {
    id: "conversations-and-feedback",
    title: "Gespräche, Antworten und Feedback",
    datasets: [
      "conversations",
      "messages",
      "runs",
      "feedback",
      "learning_cases",
    ],
    activeRetention: "Bis zur Nutzerlöschung",
    deletion: "Sofortige physische Löschung aus der Anwendungsdatenbank",
  },
  {
    id: "projects-goals-documents",
    title: "Projekte, Ziele und Dokumente",
    datasets: [
      "projects",
      "project_documents",
      "project_document_versions",
      "project_events",
      "goals",
      "goal_events",
    ],
    activeRetention: "Bis zur Nutzerlöschung",
    deletion: "Sofortige physische Löschung aus der Anwendungsdatenbank",
  },
  {
    id: "memory",
    title: "Langzeitgedächtnis",
    datasets: ["memory_entries", "memory_events"],
    activeRetention: "Nach Hot/Warm/Cold-Richtlinie oder bis zur Nutzerlöschung",
    deletion: "Sofortige physische Löschung einschließlich abgeleiteter Vektoren",
  },
  {
    id: "authorization-and-execution",
    title: "Freigaben und Ausführungsbelege",
    datasets: [
      "capability_leases",
      "capability_lease_events",
      "tool_execution_leases",
      "tool_execution_lease_events",
      "tool_jobs",
      "tool_job_events",
      "tool_job_replays",
      "worker_agents",
      "worker_agent_events",
      "react_runs",
      "react_steps",
      "react_events",
      "commander_runs",
      "commander_capability_events",
      "commander_decisions",
      "commander_events",
    ],
    activeRetention: "Bis zur Nutzerlöschung",
    deletion: "Sofortige physische Löschung; flüchtige Claim-Tokens fehlen im Export",
  },
  {
    id: "evaluation-and-deployment",
    title: "TankBench, Deployment und Operations",
    datasets: [
      "tankbench_suites",
      "tankbench_cases",
      "tankbench_runs",
      "tankbench_results",
      "tankbench_releases",
      "tankbench_canary_observations",
      "tankbench_events",
      "tankbench_suite_executions",
      "tankbench_suite_execution_items",
      "tankbench_route_events",
      "deployment_release_configs",
      "deployment_requests",
      "deployment_events",
      "deployment_traffic_overrides",
      "deployment_circuit_breakers",
      "deployment_request_attempts",
      "deployment_control_events",
      "deployment_operations_policies",
      "deployment_admission_buckets",
      "deployment_inflight_leases",
      "deployment_slo_snapshots",
      "deployment_alerts",
      "deployment_operations_events",
    ],
    activeRetention: "Bis zur Nutzerlöschung",
    deletion: "Sofortige physische Löschung aus der Anwendungsdatenbank",
  },
  {
    id: "data-control",
    title: "Export- und Löschaufträge",
    datasets: ["data_subject_requests", "data_subject_events"],
    activeRetention: "Bis zur Nutzerlöschung",
    deletion: "Mit dem Kontodatensatz physisch gelöscht",
  },
] as const satisfies ReadonlyArray<{
  id: string;
  title: string;
  datasets: readonly UserDatasetName[];
  activeRetention: string;
  deletion: string;
}>;

const RETENTION_DATASETS = RETENTION_GROUPS.flatMap((group) => group.datasets);
if (
  new Set(RETENTION_DATASETS).size !== USER_DATASET_NAMES.length ||
  USER_DATASET_NAMES.some((name) => !RETENTION_DATASETS.includes(name))
) {
  throw new Error("TankAI-Datenregister und Aufbewahrungsregister sind nicht deckungsgleich.");
}
if (
  new Set(DELETION_ORDER).size !== USER_DATASET_NAMES.length ||
  USER_DATASET_NAMES.some((name) => !DELETION_ORDER.includes(name))
) {
  throw new Error("TankAI-Datenregister und Löschreihenfolge sind nicht deckungsgleich.");
}

export const DATA_RETENTION_POLICY = {
  version: TANKAI_DATA_CONTROL_VERSION,
  scope: "TankAI-D1-Anwendungsdatenbank",
  deletionGraceHours: DELETION_GRACE_HOURS,
  groups: RETENTION_GROUPS,
  retainedProof: {
    dataset: "data_deletion_receipts",
    fields: [
      "receipt id",
      "report SHA-256",
      "proof SHA-256",
      "aggregate row count",
      "dataset count",
      "software release",
      "completion time",
    ],
    userIdentifierStored: false,
    userContentStored: false,
    retention: "Unbefristeter, nicht mit einer Nutzerkennung verknüpfter Integritätsbeleg",
  },
  externalBoundaries: [
    {
      system: "Edge-, Sicherheits- und Deployment-Logs des Hosting-Anbieters",
      coveredByReceipt: false,
      statement:
        "Diese v0.24-Löschung beweist ausschließlich den Zustand der TankAI-Anwendungsdatenbank.",
    },
    {
      system: "Backups und Disaster-Recovery-Kopien des Hosting-Anbieters",
      coveredByReceipt: false,
      statement:
        "Eine Löschfortpflanzung in plattformverwaltete Sicherungen wird von TankAI v0.24 nicht behauptet.",
    },
    {
      system: "Externe Modellanbieter",
      coveredByReceipt: false,
      statement:
        "Providerseitige Aufbewahrung unterliegt deren Verträgen; sie wird nicht durch einen D1-Beleg vorgetäuscht.",
    },
  ],
} as const;

type RequestStatus =
  | "requested"
  | "scheduled"
  | "executing"
  | "completed"
  | "cancelled"
  | "failed";

type DataSubjectRequestRow = {
  id: string;
  request_type: "export" | "deletion";
  status: RequestStatus;
  manifest_sha256: string | null;
  payload_sha256: string | null;
  dataset_count: number | null;
  row_count: number | null;
  confirmation_hint: string | null;
  confirm_by: string | null;
  execute_after: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
};

type DeletionReceiptRow = {
  id: string;
  report_sha256: string;
  proof_sha256: string;
  deleted_row_count: number;
  dataset_count: number;
  software_release: string;
  completed_at: string;
};

type DatasetDefinition = {
  name: UserDatasetName;
  selectSql: string;
  countSql: string;
  deleteSql: string;
  redactedFields: readonly string[];
};

export interface DataSubjectRequestRecord {
  id: string;
  type: "export" | "deletion";
  status: RequestStatus;
  manifestSha256: string | null;
  payloadSha256: string | null;
  datasetCount: number | null;
  rowCount: number | null;
  confirmationPhrase: string | null;
  confirmBy: string | null;
  executeAfter: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
}

export class DataControlError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = code;
  }
}

function database(): D1Database {
  const value = currentRuntimeBindings().DB;
  if (!value) throw new Error("TankAI D1 ist nicht gebunden.");
  return value;
}

function now(): string {
  return new Date().toISOString();
}

function addMinutes(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}

function addHours(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function changes(result: D1Result<unknown>): number {
  return Number((result.meta as { changes?: number } | undefined)?.changes ?? 0);
}

function quoteIdentifier(value: string): string {
  if (!/^[a-z][a-z0-9_]*$/u.test(value)) {
    throw new Error("Ungültiger interner Tabellenname.");
  }
  return `"${value}"`;
}

function datasetDefinition(name: UserDatasetName): DatasetDefinition {
  if (name === RELATED_USER_DATASET_NAME) {
    return {
      name,
      selectSql: `SELECT item.* FROM "tankbench_suite_execution_items" item
        INNER JOIN "tankbench_suite_executions" execution ON execution.id=item.execution_id
        WHERE execution.user_id=? ORDER BY item.rowid`,
      countSql: `SELECT COUNT(*) AS total FROM "tankbench_suite_execution_items" item
        INNER JOIN "tankbench_suite_executions" execution ON execution.id=item.execution_id
        WHERE execution.user_id=?`,
      deleteSql: `DELETE FROM "tankbench_suite_execution_items"
        WHERE execution_id IN (SELECT id FROM "tankbench_suite_executions" WHERE user_id=?)`,
      redactedFields: [],
    };
  }
  const table = quoteIdentifier(name);
  const redactedFields =
    name === "tool_jobs"
      ? ["claim_token"]
      : name === "worker_agents"
        ? ["token_sha256"]
        : [];
  return {
    name,
    selectSql: `SELECT * FROM ${table} WHERE user_id=? ORDER BY rowid`,
    countSql: `SELECT COUNT(*) AS total FROM ${table} WHERE user_id=?`,
    deleteSql: `DELETE FROM ${table} WHERE user_id=?`,
    redactedFields,
  };
}

const DATASETS = USER_DATASET_NAMES.map(datasetDefinition);
const DATASET_BY_NAME = new Map(DATASETS.map((item) => [item.name, item]));

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalValue(entry)]),
    );
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeConfirmation(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleUpperCase("de-DE");
}

function mapRequest(row: DataSubjectRequestRow): DataSubjectRequestRecord {
  return {
    id: row.id,
    type: row.request_type,
    status: row.status,
    manifestSha256: row.manifest_sha256,
    payloadSha256: row.payload_sha256,
    datasetCount:
      row.dataset_count === null ? null : Number(row.dataset_count),
    rowCount: row.row_count === null ? null : Number(row.row_count),
    confirmationPhrase:
      row.request_type === "deletion" &&
      row.status === "requested" &&
      row.confirmation_hint
        ? `TANKAI LÖSCHEN ${row.confirmation_hint}`
        : null,
    confirmBy: row.confirm_by,
    executeAfter: row.execute_after,
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
  };
}

function redactRows(
  definition: DatasetDefinition,
  rows: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  if (definition.redactedFields.length === 0) return rows;
  return rows.map((row) => {
    const safe = { ...row };
    for (const field of definition.redactedFields) {
      if (safe[field] !== null && safe[field] !== undefined) {
        safe[field] = "[REDACTED_EPHEMERAL_CREDENTIAL]";
      }
    }
    return safe;
  });
}

async function selectAllUserDatasets(
  userId: string,
): Promise<Array<{
  definition: DatasetDefinition;
  rows: Array<Record<string, unknown>>;
}>> {
  const results = await database().batch(
    DATASETS.map((definition) =>
      database().prepare(definition.selectSql).bind(userId),
    ),
  );
  return results.map((result, index) => ({
    definition: DATASETS[index],
    rows: redactRows(
      DATASETS[index],
      ((result as D1Result<Record<string, unknown>>).results ??
        []) as Array<Record<string, unknown>>,
    ),
  }));
}

async function countAllUserDatasets(
  userId: string,
): Promise<Record<UserDatasetName, number>> {
  const results = await database().batch(
    DATASETS.map((definition) =>
      database().prepare(definition.countSql).bind(userId),
    ),
  );
  return Object.fromEntries(
    results.map((result, index) => {
      const row = (
        (result as D1Result<{ total: number }>).results ?? []
      )[0];
      return [DATASETS[index].name, Number(row?.total ?? 0)];
    }),
  ) as Record<UserDatasetName, number>;
}

async function activeWork(userId: string, timestamp: string) {
  const definitions = [
    {
      label: "Modellläufe",
      sql: "SELECT COUNT(*) AS total FROM runs WHERE user_id=? AND status='running'",
      binds: [userId],
    },
    {
      label: "Werkzeugjobs",
      sql: "SELECT COUNT(*) AS total FROM tool_jobs WHERE user_id=? AND status IN ('queued','running')",
      binds: [userId],
    },
    {
      label: "ReAct-Läufe",
      sql: `SELECT COUNT(*) AS total FROM react_runs WHERE user_id=?
        AND status IN ('ready','running','waiting_tool','verifying')`,
      binds: [userId],
    },
    {
      label: "Commander-Läufe",
      sql: `SELECT COUNT(*) AS total FROM commander_runs WHERE user_id=?
        AND status IN ('ready','running','waiting_tool','reviewing')`,
      binds: [userId],
    },
    {
      label: "TankBench-Ausführungen",
      sql: `SELECT COUNT(*) AS total FROM tankbench_suite_executions WHERE user_id=?
        AND status IN ('queued','running','waiting')`,
      binds: [userId],
    },
    {
      label: "Produktive In-flight-Leases",
      sql: "SELECT COUNT(*) AS total FROM deployment_inflight_leases WHERE user_id=? AND expires_at>?",
      binds: [userId, timestamp],
    },
  ] as const;
  const results = await database().batch(
    definitions.map((entry) =>
      database().prepare(entry.sql).bind(...entry.binds),
    ),
  );
  return definitions
    .map((entry, index) => ({
      label: entry.label,
      count: Number(
        ((results[index] as D1Result<{ total: number }>).results ?? [])[0]
          ?.total ?? 0,
      ),
    }))
    .filter((entry) => entry.count > 0);
}

async function requestRow(
  userId: string,
  requestId: string,
): Promise<DataSubjectRequestRow> {
  const row = await database()
    .prepare(
      "SELECT * FROM data_subject_requests WHERE id=? AND user_id=? LIMIT 1",
    )
    .bind(requestId, userId)
    .first<DataSubjectRequestRow>();
  if (!row) {
    throw new DataControlError(
      "Datenauftrag nicht gefunden.",
      404,
      "DATA_REQUEST_NOT_FOUND",
    );
  }
  return row;
}

async function ensureNoActiveDeletion(userId: string): Promise<void> {
  const existing = await database()
    .prepare(
      `SELECT id FROM data_subject_requests WHERE user_id=? AND request_type='deletion'
       AND status IN ('requested','scheduled','executing') LIMIT 1`,
    )
    .bind(userId)
    .first<{ id: string }>();
  if (existing) {
    throw new DataControlError(
      "Vor dem Export muss der aktive Löschauftrag abgebrochen oder abgeschlossen werden.",
      423,
      "ACCOUNT_DATA_FROZEN",
    );
  }
}

export async function listDataControlState(userId: string) {
  const rows = await database()
    .prepare(
      `SELECT * FROM data_subject_requests WHERE user_id=?
       ORDER BY created_at DESC LIMIT 30`,
    )
    .bind(userId)
    .all<DataSubjectRequestRow>();
  const requests = (rows.results ?? []).map(mapRequest);
  return {
    contractVersion: TANKAI_DATA_CONTROL_VERSION,
    release: TANKAI_RELEASE,
    accountFrozen: requests.some(
      (request) =>
        request.type === "deletion" &&
        ["requested", "scheduled", "executing"].includes(request.status),
    ),
    activeDeletion:
      requests.find(
        (request) =>
          request.type === "deletion" &&
          ["requested", "scheduled", "executing"].includes(request.status),
      ) ?? null,
    requests,
    retentionPolicy: DATA_RETENTION_POLICY,
    exportContract: {
      datasetCount: USER_DATASET_NAMES.length,
      snapshot: "single-transactional-D1-batch",
      perDatasetSha256: true,
      payloadSha256: true,
      ephemeralCredentialsExported: false,
    },
  };
}

export async function createUserDataExport(input: {
  userId: string;
  email: string;
}) {
  await ensureNoActiveDeletion(input.userId);
  const requestId = crypto.randomUUID();
  const generatedAt = now();
  const selected = await selectAllUserDatasets(input.userId);
  const datasets: Record<string, Array<Record<string, unknown>>> = {};
  const manifestDatasets: Array<{
    name: UserDatasetName;
    rows: number;
    sha256: string;
    redactedFields: readonly string[];
  }> = [];
  let rowCount = 0;
  for (const entry of selected) {
    datasets[entry.definition.name] = entry.rows;
    rowCount += entry.rows.length;
    manifestDatasets.push({
      name: entry.definition.name,
      rows: entry.rows.length,
      sha256: await sha256(canonicalJson(entry.rows)),
      redactedFields: entry.definition.redactedFields,
    });
  }
  const manifestCore = {
    version: TANKAI_DATA_CONTROL_VERSION,
    generatedAt,
    snapshot: "single-transactional-D1-batch",
    datasetCount: manifestDatasets.length,
    rowCount,
    datasets: manifestDatasets,
  };
  const manifestSha256 = await sha256(canonicalJson(manifestCore));
  const payloadCore = {
    format: "tankai-user-data-export",
    version: TANKAI_DATA_CONTROL_VERSION,
    productRelease: TANKAI_RELEASE,
    generatedAt,
    subject: {
      email: input.email,
      stableUserId: input.userId,
    },
    scope: {
      included: "TankAI-D1-Anwendungsdatenbank",
      externalSystemsCovered: false,
      statement:
        "Der Export enthält die registrierten TankAI-Anwendungsdaten. Externe Hosting- und Providerdaten sind nicht enthalten.",
    },
    retentionPolicy: DATA_RETENTION_POLICY,
    manifest: {
      ...manifestCore,
      sha256: manifestSha256,
    },
    datasets,
  };
  const payloadSha256 = await sha256(canonicalJson(payloadCore));
  const result = await database().batch([
    database()
      .prepare(
        `INSERT INTO data_subject_requests
         (id,user_id,request_type,status,manifest_sha256,payload_sha256,dataset_count,row_count,
          confirmation_sha256,confirmation_hint,confirm_by,execute_after,version,created_at,updated_at,
          completed_at,cancelled_at)
         VALUES (?,?,'export','completed',?,?,?,?,NULL,NULL,NULL,NULL,1,?,?,?,NULL)`,
      )
      .bind(
        requestId,
        input.userId,
        manifestSha256,
        payloadSha256,
        manifestDatasets.length,
        rowCount,
        generatedAt,
        generatedAt,
        generatedAt,
      ),
    database()
      .prepare(
        `INSERT INTO data_subject_events
         (id,request_id,user_id,event_type,request_version,evidence_sha256,created_at)
         VALUES (?,?,?,'export_completed',1,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        requestId,
        input.userId,
        payloadSha256,
        generatedAt,
      ),
  ]);
  if (changes(result[0]) !== 1 || changes(result[1]) !== 1) {
    throw new DataControlError(
      "Der Exportbeleg konnte nicht atomar gespeichert werden.",
      500,
      "EXPORT_RECEIPT_FAILED",
    );
  }
  return {
    fileName: `tankai-user-data-${generatedAt.slice(0, 10)}-${requestId}.json`,
    payload: {
      ...payloadCore,
      receipt: {
        id: requestId,
        type: "export",
        manifestSha256,
        payloadSha256,
        hashing:
          "SHA-256 über kanonisches JSON des Dokuments ohne dieses receipt-Feld",
      },
    },
  };
}

export async function createDeletionRequest(userId: string) {
  const timestamp = now();
  const running = await activeWork(userId, timestamp);
  if (running.length > 0) {
    throw new DataControlError(
      `Löschauftrag blockiert: ${running.map((item) => `${item.label} (${item.count})`).join(", ")}.`,
      409,
      "ACTIVE_WORK_BLOCKS_DELETION",
    );
  }
  const existing = await database()
    .prepare(
      `SELECT * FROM data_subject_requests WHERE user_id=? AND request_type='deletion'
       AND status IN ('requested','scheduled','executing') LIMIT 1`,
    )
    .bind(userId)
    .first<DataSubjectRequestRow>();
  if (existing) return mapRequest(existing);

  const id = crypto.randomUUID();
  const hint = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  const confirmationPhrase = `TANKAI LÖSCHEN ${hint}`;
  const confirmationSha256 = await sha256(
    normalizeConfirmation(confirmationPhrase),
  );
  const confirmBy = addMinutes(timestamp, DELETION_CONFIRMATION_MINUTES);
  const results = await database().batch([
    database()
      .prepare(
        `INSERT INTO data_subject_requests
         (id,user_id,request_type,status,manifest_sha256,payload_sha256,dataset_count,row_count,
          confirmation_sha256,confirmation_hint,confirm_by,execute_after,version,created_at,updated_at,
          completed_at,cancelled_at)
         VALUES (?,?,'deletion','requested',NULL,NULL,NULL,NULL,?,?,?,NULL,1,?,?,NULL,NULL)`,
      )
      .bind(
        id,
        userId,
        confirmationSha256,
        hint,
        confirmBy,
        timestamp,
        timestamp,
      ),
    database()
      .prepare(
        `INSERT INTO data_subject_events
         (id,request_id,user_id,event_type,request_version,evidence_sha256,created_at)
         VALUES (?,?,?,'deletion_requested',1,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        id,
        userId,
        confirmationSha256,
        timestamp,
      ),
  ]);
  if (changes(results[0]) !== 1 || changes(results[1]) !== 1) {
    throw new DataControlError(
      "Der Löschauftrag konnte nicht atomar angelegt werden.",
      409,
      "DELETION_REQUEST_CONFLICT",
    );
  }
  return mapRequest((await requestRow(userId, id))!);
}

export async function confirmDeletionRequest(input: {
  userId: string;
  requestId: string;
  confirmationPhrase: string;
  expectedVersion: number;
}) {
  const row = await requestRow(input.userId, input.requestId);
  const timestamp = now();
  if (row.request_type !== "deletion" || row.status !== "requested") {
    throw new DataControlError(
      "Dieser Löschauftrag kann nicht bestätigt werden.",
      409,
      "DELETION_STATE_CONFLICT",
    );
  }
  if (row.version !== input.expectedVersion) {
    throw new DataControlError(
      "Der Löschauftrag wurde parallel verändert.",
      409,
      "DELETION_VERSION_CONFLICT",
    );
  }
  if (!row.confirm_by || row.confirm_by <= timestamp) {
    throw new DataControlError(
      "Die Bestätigungsfrist ist abgelaufen. Brich den Auftrag ab und lege einen neuen an.",
      409,
      "DELETION_CONFIRMATION_EXPIRED",
    );
  }
  const normalized = normalizeConfirmation(input.confirmationPhrase);
  if ((await sha256(normalized)) !== row.confirmation_sha256) {
    throw new DataControlError(
      "Die Bestätigungsphrase stimmt nicht.",
      400,
      "DELETION_CONFIRMATION_MISMATCH",
    );
  }
  const running = await activeWork(input.userId, timestamp);
  if (running.length > 0) {
    throw new DataControlError(
      `Bestätigung blockiert: ${running.map((item) => `${item.label} (${item.count})`).join(", ")}.`,
      409,
      "ACTIVE_WORK_BLOCKS_DELETION",
    );
  }
  const executeAfter = addHours(timestamp, DELETION_GRACE_HOURS);
  const nextVersion = row.version + 1;
  const results = await database().batch([
    database()
      .prepare(
        `UPDATE data_subject_requests SET status='scheduled',execute_after=?,
         version=version+1,updated_at=? WHERE id=? AND user_id=? AND request_type='deletion'
         AND status='requested' AND version=?`,
      )
      .bind(
        executeAfter,
        timestamp,
        row.id,
        input.userId,
        row.version,
      ),
    database()
      .prepare(
        `INSERT INTO data_subject_events
         (id,request_id,user_id,event_type,request_version,evidence_sha256,created_at)
         SELECT ?,?,?,'deletion_scheduled',?,?,? WHERE changes()=1`,
      )
      .bind(
        crypto.randomUUID(),
        row.id,
        input.userId,
        nextVersion,
        await sha256(executeAfter),
        timestamp,
      ),
  ]);
  if (changes(results[0]) !== 1 || changes(results[1]) !== 1) {
    throw new DataControlError(
      "Der Löschauftrag wurde parallel verändert.",
      409,
      "DELETION_VERSION_CONFLICT",
    );
  }
  return mapRequest(await requestRow(input.userId, row.id));
}

export async function cancelDeletionRequest(input: {
  userId: string;
  requestId: string;
  expectedVersion: number;
}) {
  const row = await requestRow(input.userId, input.requestId);
  if (
    row.request_type !== "deletion" ||
    !["requested", "scheduled"].includes(row.status)
  ) {
    throw new DataControlError(
      "Dieser Löschauftrag kann nicht abgebrochen werden.",
      409,
      "DELETION_STATE_CONFLICT",
    );
  }
  if (row.version !== input.expectedVersion) {
    throw new DataControlError(
      "Der Löschauftrag wurde parallel verändert.",
      409,
      "DELETION_VERSION_CONFLICT",
    );
  }
  const timestamp = now();
  const nextVersion = row.version + 1;
  const results = await database().batch([
    database()
      .prepare(
        `UPDATE data_subject_requests SET status='cancelled',cancelled_at=?,
         version=version+1,updated_at=? WHERE id=? AND user_id=? AND request_type='deletion'
         AND status IN ('requested','scheduled') AND version=?`,
      )
      .bind(
        timestamp,
        timestamp,
        row.id,
        input.userId,
        row.version,
      ),
    database()
      .prepare(
        `INSERT INTO data_subject_events
         (id,request_id,user_id,event_type,request_version,evidence_sha256,created_at)
         SELECT ?,?,?,'deletion_cancelled',?,NULL,? WHERE changes()=1`,
      )
      .bind(
        crypto.randomUUID(),
        row.id,
        input.userId,
        nextVersion,
        timestamp,
      ),
  ]);
  if (changes(results[0]) !== 1 || changes(results[1]) !== 1) {
    throw new DataControlError(
      "Der Löschauftrag wurde parallel verändert.",
      409,
      "DELETION_VERSION_CONFLICT",
    );
  }
  return mapRequest(await requestRow(input.userId, row.id));
}

export async function executeDeletionRequest(input: {
  userId: string;
  requestId: string;
  expectedVersion: number;
}) {
  const row = await requestRow(input.userId, input.requestId);
  const timestamp = now();
  if (row.request_type !== "deletion" || row.status !== "scheduled") {
    throw new DataControlError(
      "Dieser Löschauftrag ist nicht zur Ausführung freigegeben.",
      409,
      "DELETION_STATE_CONFLICT",
    );
  }
  if (row.version !== input.expectedVersion) {
    throw new DataControlError(
      "Der Löschauftrag wurde parallel verändert.",
      409,
      "DELETION_VERSION_CONFLICT",
    );
  }
  if (!row.execute_after || row.execute_after > timestamp) {
    throw new DataControlError(
      `Die Widerrufsfrist läuft bis ${row.execute_after ?? "unbekannt"}.`,
      409,
      "DELETION_GRACE_PERIOD_ACTIVE",
    );
  }
  const running = await activeWork(input.userId, timestamp);
  if (running.length > 0) {
    throw new DataControlError(
      `Löschung blockiert: ${running.map((item) => `${item.label} (${item.count})`).join(", ")}.`,
      409,
      "ACTIVE_WORK_BLOCKS_DELETION",
    );
  }
  const executingVersion = row.version + 1;
  const startResults = await database().batch([
    database()
      .prepare(
        `UPDATE data_subject_requests SET status='executing',version=version+1,updated_at=?
         WHERE id=? AND user_id=? AND request_type='deletion' AND status='scheduled'
         AND version=? AND execute_after<=?`,
      )
      .bind(
        timestamp,
        row.id,
        input.userId,
        row.version,
        timestamp,
      ),
    database()
      .prepare(
        `INSERT INTO data_subject_events
         (id,request_id,user_id,event_type,request_version,evidence_sha256,created_at)
         SELECT ?,?,?,'deletion_executing',?,NULL,? WHERE changes()=1`,
      )
      .bind(
        crypto.randomUUID(),
        row.id,
        input.userId,
        executingVersion,
        timestamp,
      ),
  ]);
  if (changes(startResults[0]) !== 1 || changes(startResults[1]) !== 1) {
    throw new DataControlError(
      "Der Löschauftrag wurde parallel verändert.",
      409,
      "DELETION_VERSION_CONFLICT",
    );
  }

  const counts = await countAllUserDatasets(input.userId);
  const deletedRowCount = Object.values(counts).reduce(
    (sum, value) => sum + value,
    0,
  );
  const receiptId = crypto.randomUUID();
  const completedAt = now();
  const reportCore = {
    format: "tankai-deletion-report",
    version: TANKAI_DATA_CONTROL_VERSION,
    productRelease: TANKAI_RELEASE,
    receiptId,
    completedAt,
    scope: "TankAI-D1-Anwendungsdatenbank",
    result: {
      status: "application-data-deleted",
      deletedRowCount,
      datasetCount: USER_DATASET_NAMES.length,
      datasets: DELETION_ORDER.map((name) => ({
        name,
        deletedRows: counts[name],
      })),
    },
    retainedProof: DATA_RETENTION_POLICY.retainedProof,
    externalBoundaries: DATA_RETENTION_POLICY.externalBoundaries,
  };
  const reportSha256 = await sha256(canonicalJson(reportCore));
  const proofSha256 = await sha256(
    `tankai-deletion-proof-v1:${receiptId}:${reportSha256}:${completedAt}`,
  );

  try {
    const deleteStatements = DELETION_ORDER.map((name) => {
      const definition = DATASET_BY_NAME.get(name);
      if (!definition) throw new Error(`Fehlende Löschdefinition: ${name}`);
      return database().prepare(definition.deleteSql).bind(input.userId);
    });
    await database().batch([
      ...deleteStatements,
      database()
        .prepare(
          `INSERT INTO data_deletion_receipts
           (id,report_sha256,proof_sha256,deleted_row_count,dataset_count,software_release,completed_at)
           VALUES (?,?,?,?,?,?,?)`,
        )
        .bind(
          receiptId,
          reportSha256,
          proofSha256,
          deletedRowCount,
          USER_DATASET_NAMES.length,
          TANKAI_RELEASE,
          completedAt,
        ),
    ]);
  } catch (error) {
    await database()
      .prepare(
        `UPDATE data_subject_requests SET status='failed',version=version+1,updated_at=?
         WHERE id=? AND user_id=? AND status='executing'`,
      )
      .bind(now(), row.id, input.userId)
      .run();
    throw new DataControlError(
      "Die atomare Löschung ist fehlgeschlagen; der Auftrag wurde gestoppt.",
      500,
      error instanceof Error
        ? "DELETION_TRANSACTION_FAILED"
        : "DELETION_FAILED",
    );
  }

  const remainingCounts = await countAllUserDatasets(input.userId);
  const remaining = Object.entries(remainingCounts).filter(
    ([, value]) => value !== 0,
  );
  const storedReceipt = await database()
    .prepare(
      "SELECT * FROM data_deletion_receipts WHERE id=? AND report_sha256=?",
    )
    .bind(receiptId, reportSha256)
    .first<DeletionReceiptRow>();
  if (remaining.length > 0 || !storedReceipt) {
    throw new DataControlError(
      "Die Löschung konnte nach der Ausführung nicht vollständig verifiziert werden.",
      500,
      "DELETION_POSTCONDITION_FAILED",
    );
  }
  return {
    fileName: `tankai-deletion-receipt-${receiptId}.json`,
    report: {
      ...reportCore,
      integrity: {
        reportSha256,
        proofSha256,
        hashing:
          "reportSha256 hasht das kanonische JSON dieses Dokuments ohne integrity-Feld.",
      },
      verification: {
        endpoint: "/api/data-control",
        action: "verify_deletion_receipt",
        required: ["receiptId", "reportSha256"],
      },
    },
  };
}

export async function verifyDeletionReceipt(input: {
  receiptId: string;
  reportSha256: string;
}) {
  if (!/^[0-9a-f-]{36}$/iu.test(input.receiptId)) {
    throw new DataControlError(
      "Receipt-ID ist ungültig.",
      400,
      "INVALID_RECEIPT_ID",
    );
  }
  if (!/^[0-9a-f]{64}$/u.test(input.reportSha256)) {
    throw new DataControlError(
      "Report-Hash ist ungültig.",
      400,
      "INVALID_REPORT_HASH",
    );
  }
  const row = await database()
    .prepare(
      "SELECT * FROM data_deletion_receipts WHERE id=? AND report_sha256=? LIMIT 1",
    )
    .bind(input.receiptId, input.reportSha256)
    .first<DeletionReceiptRow>();
  if (!row) {
    return {
      valid: false,
      receiptId: input.receiptId,
      statement: "Kein passender TankAI-Löschbeleg gefunden.",
    };
  }
  const expectedProof = await sha256(
    `tankai-deletion-proof-v1:${row.id}:${row.report_sha256}:${row.completed_at}`,
  );
  const valid = expectedProof === row.proof_sha256;
  return {
    valid,
    receiptId: row.id,
    reportSha256: row.report_sha256,
    proofSha256: row.proof_sha256,
    deletedRowCount: Number(row.deleted_row_count),
    datasetCount: Number(row.dataset_count),
    softwareRelease: row.software_release,
    completedAt: row.completed_at,
    scope: "TankAI-D1-Anwendungsdatenbank",
    externalSystemsCovered: false,
  };
}
