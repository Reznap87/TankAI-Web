import { currentRuntimeBindings } from "@/lib/request-context";
import { createToolJob, type ToolJobRecord } from "@/lib/tool-jobs";
import type { ToolName } from "@/lib/tool-runtime";

export type ReActRunStatus =
  | "ready"
  | "running"
  | "waiting_tool"
  | "verifying"
  | "completed"
  | "failed"
  | "cancelled"
  | "budget_exhausted";

export type ReActStepStatus =
  | "waiting_tool"
  | "observed"
  | "completed"
  | "failed";

interface ReActRunRow {
  id: string;
  project_id: string | null;
  objective: string;
  definition_of_done: string;
  status: ReActRunStatus;
  current_step: number;
  max_steps: number;
  model_calls_used: number;
  max_model_calls: number;
  tool_actions_used: number;
  max_tool_actions: number;
  version: number;
  final_answer: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface ReActStepRow {
  id: string;
  run_id: string;
  sequence_number: number;
  status: ReActStepStatus;
  decision_summary: string;
  action_type: "tool" | "final";
  tool_name: ToolName | null;
  tool_job_id: string | null;
  action_input_json: string | null;
  observation_json: string | null;
  observation_sha256: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface ReActEventRow {
  id: string;
  run_id: string;
  step_id: string | null;
  event_type:
    | "created"
    | "decision"
    | "tool_dispatched"
    | "observation"
    | "completed"
    | "failed"
    | "cancelled"
    | "budget_exhausted";
  run_version: number;
  sequence_number: number;
  note: string | null;
  created_at: string;
}

interface WaitingStepRow extends ReActStepRow {
  job_status: "queued" | "running" | "succeeded" | "failed" | "cancelled" | "dead_letter";
  job_output_json: string | null;
  job_error_code: string | null;
  job_error_message: string | null;
  job_attempt: number;
  job_max_attempts: number;
}

export interface ReActRunRecord {
  id: string;
  projectId: string | null;
  objective: string;
  definitionOfDone: string;
  status: ReActRunStatus;
  currentStep: number;
  maxSteps: number;
  modelCallsUsed: number;
  maxModelCalls: number;
  toolActionsUsed: number;
  maxToolActions: number;
  version: number;
  finalAnswer: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface ReActStepRecord {
  id: string;
  runId: string;
  sequenceNumber: number;
  status: ReActStepStatus;
  decisionSummary: string;
  actionType: "tool" | "final";
  toolName: ToolName | null;
  toolJobId: string | null;
  actionInput: Record<string, unknown> | null;
  observation: Record<string, unknown> | null;
  observationSha256: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface ReActEventRecord {
  id: string;
  runId: string;
  stepId: string | null;
  type: ReActEventRow["event_type"];
  runVersion: number;
  sequenceNumber: number;
  note: string | null;
  createdAt: string;
}

export class ReActRuntimeError extends Error {
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
  const db = currentRuntimeBindings().DB;
  if (!db) throw new Error("TankAI D1 ist nicht gebunden.");
  return db;
}

function now(): string {
  return new Date().toISOString();
}

function parseRecord(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : { value: parsed };
  } catch {
    return { raw: value };
  }
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

function mapRun(row: ReActRunRow): ReActRunRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    objective: row.objective,
    definitionOfDone: row.definition_of_done,
    status: row.status,
    currentStep: Number(row.current_step),
    maxSteps: Number(row.max_steps),
    modelCallsUsed: Number(row.model_calls_used),
    maxModelCalls: Number(row.max_model_calls),
    toolActionsUsed: Number(row.tool_actions_used),
    maxToolActions: Number(row.max_tool_actions),
    version: Number(row.version),
    finalAnswer: row.final_answer,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

function mapStep(row: ReActStepRow): ReActStepRecord {
  return {
    id: row.id,
    runId: row.run_id,
    sequenceNumber: Number(row.sequence_number),
    status: row.status,
    decisionSummary: row.decision_summary,
    actionType: row.action_type,
    toolName: row.tool_name,
    toolJobId: row.tool_job_id,
    actionInput: parseRecord(row.action_input_json),
    observation: parseRecord(row.observation_json),
    observationSha256: row.observation_sha256,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

function mapEvent(row: ReActEventRow): ReActEventRecord {
  return {
    id: row.id,
    runId: row.run_id,
    stepId: row.step_id,
    type: row.event_type,
    runVersion: Number(row.run_version),
    sequenceNumber: Number(row.sequence_number),
    note: row.note,
    createdAt: row.created_at,
  };
}

async function runRow(runId: string, userId: string): Promise<ReActRunRow> {
  const row = await database()
    .prepare(
      `SELECT id, project_id, objective, definition_of_done, status,
              current_step, max_steps, model_calls_used, max_model_calls,
              tool_actions_used, max_tool_actions, version, final_answer,
              error_code, error_message, created_at, updated_at, completed_at
       FROM react_runs WHERE id = ? AND user_id = ?`,
    )
    .bind(runId, userId)
    .first<ReActRunRow>();
  if (!row) {
    throw new ReActRuntimeError(
      "Der ReAct-Lauf wurde nicht gefunden.",
      404,
      "REACT_RUN_NOT_FOUND",
    );
  }
  return row;
}

function requiredText(value: string, label: string, maximum: number): string {
  const text = value.trim();
  if (!text || text.length > maximum) {
    throw new ReActRuntimeError(
      `${label} fehlt oder überschreitet ${maximum.toLocaleString("de-DE")} Zeichen.`,
      400,
      "INVALID_REACT_INPUT",
    );
  }
  return text;
}

function integer(value: number, label: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new ReActRuntimeError(
      `${label} muss zwischen ${minimum} und ${maximum} liegen.`,
      400,
      "INVALID_REACT_INPUT",
    );
  }
  return value;
}

export async function createReActRun(input: {
  userId: string;
  projectId?: string;
  objective: string;
  definitionOfDone: string;
  maxSteps: number;
  maxModelCalls: number;
  maxToolActions: number;
}): Promise<ReActRunRecord> {
  const objective = requiredText(input.objective, "Das Ziel", 8_000);
  const definitionOfDone = requiredText(
    input.definitionOfDone,
    "Die Definition of Done",
    4_000,
  );
  const maxSteps = integer(input.maxSteps, "Das Schrittlimit", 1, 32);
  const maxModelCalls = integer(
    input.maxModelCalls,
    "Das Modellaufruflimit",
    1,
    64,
  );
  const maxToolActions = integer(
    input.maxToolActions,
    "Das Werkzeuglimit",
    0,
    32,
  );
  if (input.projectId) {
    const project = await database()
      .prepare("SELECT id FROM projects WHERE id = ? AND user_id = ? AND status = 'active'")
      .bind(input.projectId, input.userId)
      .first<{ id: string }>();
    if (!project) {
      throw new ReActRuntimeError(
        "Das Projekt fehlt, ist archiviert oder gehört nicht zu diesem Nutzer.",
        404,
        "REACT_PROJECT_NOT_FOUND",
      );
    }
  }
  const id = crypto.randomUUID();
  const timestamp = now();
  const results = await database().batch([
    database()
      .prepare(
        `INSERT INTO react_runs
          (id, user_id, project_id, objective, definition_of_done, status,
           current_step, max_steps, model_calls_used, max_model_calls,
           tool_actions_used, max_tool_actions, version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'ready', 0, ?, 0, ?, 0, ?, 1, ?, ?)`,
      )
      .bind(
        id,
        input.userId,
        input.projectId ?? null,
        objective,
        definitionOfDone,
        maxSteps,
        maxModelCalls,
        maxToolActions,
        timestamp,
        timestamp,
      ),
    database()
      .prepare(
        `INSERT INTO react_events
          (id, run_id, user_id, event_type, run_version, sequence_number,
           note, created_at)
         VALUES (?, ?, ?, 'created', 1, 0, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        id,
        input.userId,
        "ReAct-Lauf mit festen Budgets angelegt.",
        timestamp,
      ),
  ]);
  const changes = Number(
    (results[0].meta as { changes?: number } | undefined)?.changes ?? 0,
  );
  if (changes !== 1) {
    throw new ReActRuntimeError(
      "Der ReAct-Lauf konnte nicht angelegt werden.",
      409,
      "REACT_CREATE_CONFLICT",
    );
  }
  return mapRun(await runRow(id, input.userId));
}

async function markBudgetExhausted(
  row: ReActRunRow,
  userId: string,
  reason: string,
): Promise<ReActRunRecord> {
  const timestamp = now();
  const nextVersion = Number(row.version) + 1;
  const results = await database().batch([
    database()
      .prepare(
        `UPDATE react_runs
         SET status = 'budget_exhausted', version = version + 1,
             error_code = 'REACT_BUDGET_EXHAUSTED', error_message = ?,
             updated_at = ?, completed_at = ?
         WHERE id = ? AND user_id = ? AND version = ?
           AND status IN ('ready','running','verifying')`,
      )
      .bind(reason, timestamp, timestamp, row.id, userId, row.version),
    database()
      .prepare(
        `INSERT INTO react_events
          (id, run_id, user_id, event_type, run_version, sequence_number,
           note, created_at)
         SELECT ?, id, user_id, 'budget_exhausted', version, current_step, ?, ?
         FROM react_runs WHERE id = ? AND user_id = ? AND version = ?`,
      )
      .bind(
        crypto.randomUUID(),
        reason,
        timestamp,
        row.id,
        userId,
        nextVersion,
      ),
  ]);
  const changes = Number(
    (results[0].meta as { changes?: number } | undefined)?.changes ?? 0,
  );
  if (changes !== 1) {
    throw new ReActRuntimeError(
      "Der ReAct-Lauf wurde parallel verändert.",
      409,
      "REACT_VERSION_CONFLICT",
    );
  }
  return mapRun(await runRow(row.id, userId));
}

export async function submitReActDecision(input: {
  userId: string;
  runId: string;
  expectedVersion: number;
  decisionSummary: string;
  action:
    | {
        type: "tool";
        leaseId: string;
        toolName: ToolName;
        payload: Record<string, unknown>;
        maxAttempts: number;
      }
    | { type: "final"; answer: string };
}): Promise<{
  run: ReActRunRecord;
  step: ReActStepRecord | null;
  job: ToolJobRecord | null;
  budgetExhausted: boolean;
}> {
  const row = await runRow(input.runId, input.userId);
  if (Number(row.version) !== input.expectedVersion) {
    throw new ReActRuntimeError(
      "Der ReAct-Lauf wurde zwischenzeitlich verändert.",
      409,
      "REACT_VERSION_CONFLICT",
    );
  }
  if (!(["ready", "running", "verifying"] as ReActRunStatus[]).includes(row.status)) {
    throw new ReActRuntimeError(
      "In diesem Zustand kann keine neue ReAct-Entscheidung geschrieben werden.",
      409,
      "REACT_STATE_CONFLICT",
    );
  }
  if (row.current_step >= row.max_steps) {
    return {
      run: await markBudgetExhausted(row, input.userId, "Das ReAct-Schrittlimit ist ausgeschöpft."),
      step: null,
      job: null,
      budgetExhausted: true,
    };
  }
  if (row.model_calls_used >= row.max_model_calls) {
    return {
      run: await markBudgetExhausted(row, input.userId, "Das ReAct-Modellaufruflimit ist ausgeschöpft."),
      step: null,
      job: null,
      budgetExhausted: true,
    };
  }
  if (
    input.action.type === "tool" &&
    row.tool_actions_used >= row.max_tool_actions
  ) {
    return {
      run: await markBudgetExhausted(row, input.userId, "Das ReAct-Werkzeuglimit ist ausgeschöpft."),
      step: null,
      job: null,
      budgetExhausted: true,
    };
  }

  const decisionSummary = requiredText(
    input.decisionSummary,
    "Die Entscheidungszusammenfassung",
    1_000,
  );
  const sequence = Number(row.current_step) + 1;
  const stepId = crypto.randomUUID();
  const timestamp = now();
  const nextVersion = Number(row.version) + 1;

  if (input.action.type === "final") {
    const answer = requiredText(input.action.answer, "Die finale Antwort", 40_000);
    if (new TextEncoder().encode(answer).byteLength > 48_000) {
      throw new ReActRuntimeError(
        "Die finale Antwort überschreitet 48.000 Bytes.",
        400,
        "INVALID_REACT_INPUT",
      );
    }
    const results = await database().batch([
      database()
        .prepare(
          `UPDATE react_runs
           SET status = 'completed', current_step = ?,
               model_calls_used = model_calls_used + 1, version = version + 1,
               final_answer = ?, error_code = NULL, error_message = NULL,
               updated_at = ?, completed_at = ?
           WHERE id = ? AND user_id = ? AND version = ?
             AND status IN ('ready','running','verifying')`,
        )
        .bind(
          sequence,
          answer,
          timestamp,
          timestamp,
          row.id,
          input.userId,
          row.version,
        ),
      database()
        .prepare(
          `INSERT INTO react_steps
            (id, run_id, user_id, sequence_number, status, decision_summary,
             action_type, created_at, updated_at, completed_at)
           SELECT ?, id, user_id, ?, 'completed', ?, 'final', ?, ?, ?
           FROM react_runs WHERE id = ? AND user_id = ? AND version = ?`,
        )
        .bind(
          stepId,
          sequence,
          decisionSummary,
          timestamp,
          timestamp,
          timestamp,
          row.id,
          input.userId,
          nextVersion,
        ),
      database()
        .prepare(
          `INSERT INTO react_events
            (id, run_id, step_id, user_id, event_type, run_version,
             sequence_number, note, created_at)
           SELECT ?, run_id, id, user_id, 'decision', ?, sequence_number, ?, ?
           FROM react_steps WHERE id = ? AND user_id = ?`,
        )
        .bind(
          crypto.randomUUID(),
          nextVersion,
          decisionSummary,
          timestamp,
          stepId,
          input.userId,
        ),
      database()
        .prepare(
          `INSERT INTO react_events
            (id, run_id, step_id, user_id, event_type, run_version,
             sequence_number, note, created_at)
           SELECT ?, run_id, id, user_id, 'completed', ?, sequence_number,
                  'ReAct-Lauf mit finaler Antwort abgeschlossen.', ?
           FROM react_steps WHERE id = ? AND user_id = ?`,
        )
        .bind(
          crypto.randomUUID(),
          nextVersion,
          timestamp,
          stepId,
          input.userId,
        ),
    ]);
    const changes = Number(
      (results[0].meta as { changes?: number } | undefined)?.changes ?? 0,
    );
    if (changes !== 1) {
      throw new ReActRuntimeError(
        "Der ReAct-Lauf wurde parallel verändert.",
        409,
        "REACT_VERSION_CONFLICT",
      );
    }
    const step = await database()
      .prepare(
        `SELECT id, run_id, sequence_number, status, decision_summary,
                action_type, tool_name, tool_job_id, action_input_json,
                observation_json, observation_sha256, created_at, updated_at,
                completed_at
         FROM react_steps WHERE id = ? AND user_id = ?`,
      )
      .bind(stepId, input.userId)
      .first<ReActStepRow>();
    return {
      run: mapRun(await runRow(row.id, input.userId)),
      step: step ? mapStep(step) : null,
      job: null,
      budgetExhausted: false,
    };
  }

  integer(input.action.maxAttempts, "Die maximale Versuchszahl", 1, 3);
  const jobResult = await createToolJob({
    userId: input.userId,
    ...(row.project_id ? { projectId: row.project_id } : {}),
    leaseId: input.action.leaseId,
    toolName: input.action.toolName,
    payload: input.action.payload,
    maxAttempts: input.action.maxAttempts,
    idempotencyKey: `react:${row.id}:${sequence}`,
  });
  const actionInputJson = JSON.stringify(input.action.payload);
  const results = await database().batch([
    database()
      .prepare(
        `UPDATE react_runs
         SET status = 'waiting_tool', current_step = ?,
             model_calls_used = model_calls_used + 1,
             tool_actions_used = tool_actions_used + 1,
             version = version + 1, updated_at = ?
         WHERE id = ? AND user_id = ? AND version = ?
           AND status IN ('ready','running','verifying')`,
      )
      .bind(sequence, timestamp, row.id, input.userId, row.version),
    database()
      .prepare(
        `INSERT INTO react_steps
          (id, run_id, user_id, sequence_number, status, decision_summary,
           action_type, tool_name, tool_job_id, action_input_json,
           created_at, updated_at)
         SELECT ?, id, user_id, ?, 'waiting_tool', ?, 'tool', ?, ?, ?, ?, ?
         FROM react_runs WHERE id = ? AND user_id = ? AND version = ?`,
      )
      .bind(
        stepId,
        sequence,
        decisionSummary,
        input.action.toolName,
        jobResult.job.id,
        actionInputJson,
        timestamp,
        timestamp,
        row.id,
        input.userId,
        nextVersion,
      ),
    database()
      .prepare(
        `INSERT INTO react_events
          (id, run_id, step_id, user_id, event_type, run_version,
           sequence_number, note, created_at)
         SELECT ?, run_id, id, user_id, 'decision', ?, sequence_number, ?, ?
         FROM react_steps WHERE id = ? AND user_id = ?`,
      )
      .bind(
        crypto.randomUUID(),
        nextVersion,
        decisionSummary,
        timestamp,
        stepId,
        input.userId,
      ),
    database()
      .prepare(
        `INSERT INTO react_events
          (id, run_id, step_id, user_id, event_type, run_version,
           sequence_number, note, created_at)
         SELECT ?, run_id, id, user_id, 'tool_dispatched', ?, sequence_number, ?, ?
         FROM react_steps WHERE id = ? AND user_id = ?`,
      )
      .bind(
        crypto.randomUUID(),
        nextVersion,
        `${input.action.toolName} als lease-geschützter Job ${jobResult.job.id} eingereiht.`,
        timestamp,
        stepId,
        input.userId,
      ),
  ]);
  const changes = Number(
    (results[0].meta as { changes?: number } | undefined)?.changes ?? 0,
  );
  if (changes !== 1) {
    throw new ReActRuntimeError(
      "Der ReAct-Lauf wurde parallel verändert; der idempotente Werkzeugjob bleibt nachvollziehbar erhalten.",
      409,
      "REACT_VERSION_CONFLICT",
    );
  }
  const step = await database()
    .prepare(
      `SELECT id, run_id, sequence_number, status, decision_summary,
              action_type, tool_name, tool_job_id, action_input_json,
              observation_json, observation_sha256, created_at, updated_at,
              completed_at
       FROM react_steps WHERE id = ? AND user_id = ?`,
    )
    .bind(stepId, input.userId)
    .first<ReActStepRow>();
  return {
    run: mapRun(await runRow(row.id, input.userId)),
    step: step ? mapStep(step) : null,
    job: jobResult.job,
    budgetExhausted: false,
  };
}

export async function synchronizeReActRun(input: {
  userId: string;
  runId: string;
  expectedVersion: number;
}): Promise<ReActRunRecord> {
  const row = await runRow(input.runId, input.userId);
  if (Number(row.version) !== input.expectedVersion) {
    throw new ReActRuntimeError(
      "Der ReAct-Lauf wurde zwischenzeitlich verändert.",
      409,
      "REACT_VERSION_CONFLICT",
    );
  }
  if (row.status !== "waiting_tool") return mapRun(row);
  const waiting = await database()
    .prepare(
      `SELECT react_steps.id, react_steps.run_id, react_steps.sequence_number,
              react_steps.status, react_steps.decision_summary,
              react_steps.action_type, react_steps.tool_name,
              react_steps.tool_job_id, react_steps.action_input_json,
              react_steps.observation_json, react_steps.observation_sha256,
              react_steps.created_at, react_steps.updated_at,
              react_steps.completed_at, tool_jobs.status AS job_status,
              tool_jobs.output_json AS job_output_json,
              tool_jobs.error_code AS job_error_code,
              tool_jobs.error_message AS job_error_message,
              tool_jobs.attempt AS job_attempt,
              tool_jobs.max_attempts AS job_max_attempts
       FROM react_steps
       INNER JOIN tool_jobs ON tool_jobs.id = react_steps.tool_job_id
       WHERE react_steps.run_id = ? AND react_steps.user_id = ?
         AND react_steps.status = 'waiting_tool'
       ORDER BY react_steps.sequence_number DESC LIMIT 1`,
    )
    .bind(row.id, input.userId)
    .first<WaitingStepRow>();
  if (!waiting) {
    throw new ReActRuntimeError(
      "Der wartende ReAct-Schritt fehlt.",
      409,
      "REACT_STEP_MISSING",
    );
  }
  if (waiting.job_status === "queued" || waiting.job_status === "running") {
    return mapRun(row);
  }
  if (
    waiting.job_status === "failed" &&
    Number(waiting.job_attempt) < Number(waiting.job_max_attempts)
  ) {
    return mapRun(row);
  }

  const timestamp = now();
  const nextVersion = Number(row.version) + 1;
  if (waiting.job_status === "succeeded") {
    const observationJson = waiting.job_output_json ?? "{}";
    const observationSha256 = await sha256(observationJson);
    const results = await database().batch([
      database()
        .prepare(
          `UPDATE react_steps
           SET status = 'observed', observation_json = ?,
               observation_sha256 = ?, updated_at = ?, completed_at = ?
           WHERE id = ? AND user_id = ? AND status = 'waiting_tool'`,
        )
        .bind(
          observationJson,
          observationSha256,
          timestamp,
          timestamp,
          waiting.id,
          input.userId,
        ),
      database()
        .prepare(
          `UPDATE react_runs
           SET status = 'running', version = version + 1, updated_at = ?
           WHERE id = ? AND user_id = ? AND version = ?
             AND status = 'waiting_tool'`,
        )
        .bind(timestamp, row.id, input.userId, row.version),
      database()
        .prepare(
          `INSERT INTO react_events
            (id, run_id, step_id, user_id, event_type, run_version,
             sequence_number, note, created_at)
           SELECT ?, run_id, id, user_id, 'observation', ?, sequence_number,
                  'Werkzeugbeobachtung übernommen und gehasht.', ?
           FROM react_steps WHERE id = ? AND user_id = ? AND status = 'observed'`,
        )
        .bind(
          crypto.randomUUID(),
          nextVersion,
          timestamp,
          waiting.id,
          input.userId,
        ),
    ]);
    const runChanges = Number(
      (results[1].meta as { changes?: number } | undefined)?.changes ?? 0,
    );
    if (runChanges !== 1) {
      throw new ReActRuntimeError(
        "Der ReAct-Lauf wurde parallel verändert.",
        409,
        "REACT_VERSION_CONFLICT",
      );
    }
    return mapRun(await runRow(row.id, input.userId));
  }

  const errorCode = waiting.job_error_code ?? "REACT_TOOL_FAILED";
  const errorMessage = (
    waiting.job_error_message ??
    `Der Werkzeugjob endete mit Status ${waiting.job_status}.`
  ).slice(0, 500);
  const results = await database().batch([
    database()
      .prepare(
        `UPDATE react_steps
         SET status = 'failed', updated_at = ?, completed_at = ?
         WHERE id = ? AND user_id = ? AND status = 'waiting_tool'`,
      )
      .bind(timestamp, timestamp, waiting.id, input.userId),
    database()
      .prepare(
        `UPDATE react_runs
         SET status = 'failed', version = version + 1, error_code = ?,
             error_message = ?, updated_at = ?, completed_at = ?
         WHERE id = ? AND user_id = ? AND version = ?
           AND status = 'waiting_tool'`,
      )
      .bind(
        errorCode,
        errorMessage,
        timestamp,
        timestamp,
        row.id,
        input.userId,
        row.version,
      ),
    database()
      .prepare(
        `INSERT INTO react_events
          (id, run_id, step_id, user_id, event_type, run_version,
           sequence_number, note, created_at)
         SELECT ?, run_id, id, user_id, 'failed', ?, sequence_number, ?, ?
         FROM react_steps WHERE id = ? AND user_id = ? AND status = 'failed'`,
      )
      .bind(
        crypto.randomUUID(),
        nextVersion,
        errorMessage,
        timestamp,
        waiting.id,
        input.userId,
      ),
  ]);
  const runChanges = Number(
    (results[1].meta as { changes?: number } | undefined)?.changes ?? 0,
  );
  if (runChanges !== 1) {
    throw new ReActRuntimeError(
      "Der ReAct-Lauf wurde parallel verändert.",
      409,
      "REACT_VERSION_CONFLICT",
    );
  }
  return mapRun(await runRow(row.id, input.userId));
}

export async function cancelReActRun(input: {
  userId: string;
  runId: string;
  expectedVersion: number;
}): Promise<ReActRunRecord> {
  const row = await runRow(input.runId, input.userId);
  if (Number(row.version) !== input.expectedVersion) {
    throw new ReActRuntimeError(
      "Der ReAct-Lauf wurde zwischenzeitlich verändert.",
      409,
      "REACT_VERSION_CONFLICT",
    );
  }
  if (["completed", "failed", "cancelled", "budget_exhausted"].includes(row.status)) {
    return mapRun(row);
  }
  const timestamp = now();
  const nextVersion = Number(row.version) + 1;
  const results = await database().batch([
    database()
      .prepare(
        `UPDATE react_runs
         SET status = 'cancelled', version = version + 1,
             updated_at = ?, completed_at = ?
         WHERE id = ? AND user_id = ? AND version = ?
           AND status NOT IN ('completed','failed','cancelled','budget_exhausted')`,
      )
      .bind(timestamp, timestamp, row.id, input.userId, row.version),
    database()
      .prepare(
        `INSERT INTO react_events
          (id, run_id, user_id, event_type, run_version, sequence_number,
           note, created_at)
         SELECT ?, id, user_id, 'cancelled', version, current_step,
                'ReAct-Lauf abgebrochen.', ?
         FROM react_runs WHERE id = ? AND user_id = ? AND version = ?`,
      )
      .bind(
        crypto.randomUUID(),
        timestamp,
        row.id,
        input.userId,
        nextVersion,
      ),
  ]);
  const changes = Number(
    (results[0].meta as { changes?: number } | undefined)?.changes ?? 0,
  );
  if (changes !== 1) {
    throw new ReActRuntimeError(
      "Der ReAct-Lauf wurde parallel verändert.",
      409,
      "REACT_VERSION_CONFLICT",
    );
  }
  return mapRun(await runRow(row.id, input.userId));
}

export async function listReActRuns(input: {
  userId: string;
  runId?: string;
}): Promise<{
  runs: ReActRunRecord[];
  selected: {
    run: ReActRunRecord;
    steps: ReActStepRecord[];
    events: ReActEventRecord[];
  } | null;
}> {
  const runsResult = await database()
    .prepare(
      `SELECT id, project_id, objective, definition_of_done, status,
              current_step, max_steps, model_calls_used, max_model_calls,
              tool_actions_used, max_tool_actions, version, final_answer,
              error_code, error_message, created_at, updated_at, completed_at
       FROM react_runs WHERE user_id = ?
       ORDER BY updated_at DESC LIMIT 100`,
    )
    .bind(input.userId)
    .all<ReActRunRow>();
  const runs = (runsResult.results ?? []).map(mapRun);
  if (!input.runId) return { runs, selected: null };
  const selectedRun = mapRun(await runRow(input.runId, input.userId));
  const [stepsResult, eventsResult] = await Promise.all([
    database()
      .prepare(
        `SELECT id, run_id, sequence_number, status, decision_summary,
                action_type, tool_name, tool_job_id, action_input_json,
                observation_json, observation_sha256, created_at, updated_at,
                completed_at
         FROM react_steps WHERE run_id = ? AND user_id = ?
         ORDER BY sequence_number ASC`,
      )
      .bind(input.runId, input.userId)
      .all<ReActStepRow>(),
    database()
      .prepare(
        `SELECT id, run_id, step_id, event_type, run_version,
                sequence_number, note, created_at
         FROM react_events WHERE run_id = ? AND user_id = ?
         ORDER BY created_at ASC`,
      )
      .bind(input.runId, input.userId)
      .all<ReActEventRow>(),
  ]);
  return {
    runs,
    selected: {
      run: selectedRun,
      steps: (stepsResult.results ?? []).map(mapStep),
      events: (eventsResult.results ?? []).map(mapEvent),
    },
  };
}
