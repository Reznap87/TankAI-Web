"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ToolName =
  | "text.sha256"
  | "text.analyze"
  | "json.validate"
  | "memory.retention"
  | "web.fetch"
  | "project.document.inspect"
  | "code.patch.inspect";

type ValueChangeEvent = { target: { value: string } };

type RunStatus =
  | "ready"
  | "running"
  | "waiting_tool"
  | "verifying"
  | "completed"
  | "failed"
  | "cancelled"
  | "budget_exhausted";

interface ReActRun {
  id: string;
  projectId: string | null;
  objective: string;
  definitionOfDone: string;
  status: RunStatus;
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
  updatedAt: string;
}

interface ReActStep {
  id: string;
  sequenceNumber: number;
  status: string;
  decisionSummary: string;
  actionType: "tool" | "final";
  toolName: ToolName | null;
  toolJobId: string | null;
  actionInput: Record<string, unknown> | null;
  observation: Record<string, unknown> | null;
  observationSha256: string | null;
}

interface ReActEvent {
  id: string;
  type: string;
  runVersion: number;
  sequenceNumber: number;
  note: string | null;
  createdAt: string;
}

interface ProjectRecord {
  id: string;
  name: string;
  status: "active" | "archived";
}

interface ToolLease {
  id: string;
  projectId: string | null;
  projectName: string | null;
  scope: "account" | "project";
  toolName: ToolName;
  status: "active" | "revoked" | "depleted" | "expired";
  remainingUses: number;
  expiresAt: string;
}

async function responseJson<T>(response: Response): Promise<T> {
  const value = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(value.error ?? "ReAct-Anfrage fehlgeschlagen.");
  return value;
}

function isTerminal(status: RunStatus): boolean {
  return ["completed", "failed", "cancelled", "budget_exhausted"].includes(status);
}

export default function ReActClient({ displayName }: { displayName: string }) {
  const [runs, setRuns] = useState<ReActRun[]>([]);
  const [selected, setSelected] = useState<{
    run: ReActRun;
    steps: ReActStep[];
    events: ReActEvent[];
  } | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [leases, setLeases] = useState<ToolLease[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [objective, setObjective] = useState("");
  const [definitionOfDone, setDefinitionOfDone] = useState("");
  const [projectId, setProjectId] = useState("");
  const [decisionSummary, setDecisionSummary] = useState("");
  const [decisionType, setDecisionType] = useState<"tool" | "final">("tool");
  const [leaseId, setLeaseId] = useState("");
  const [payload, setPayload] = useState("{}");
  const [finalAnswer, setFinalAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (runId?: string) => {
    const query = runId ? `?runId=${encodeURIComponent(runId)}` : "";
    const [runData, projectData, leaseData] = await Promise.all([
      responseJson<{
        runs: ReActRun[];
        selected: { run: ReActRun; steps: ReActStep[]; events: ReActEvent[] } | null;
      }>(await fetch(`/api/react-runs${query}`, { cache: "no-store" })),
      responseJson<{ projects: ProjectRecord[] }>(
        await fetch("/api/projects", { cache: "no-store" }),
      ),
      responseJson<{ leases: ToolLease[] }>(
        await fetch("/api/tool-leases", { cache: "no-store" }),
      ),
    ]);
    setRuns(runData.runs);
    setSelected(runData.selected);
    setProjects(projectData.projects.filter((project) => project.status === "active"));
    setLeases(leaseData.leases);
  }, []);

  useEffect(() => {
    void load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "ReAct-Daten konnten nicht geladen werden.");
    });
  }, [load]);

  useEffect(() => {
    if (!selectedRunId) {
      setSelected(null);
      return;
    }
    void load(selectedRunId).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Der ReAct-Lauf konnte nicht geladen werden.");
    });
  }, [load, selectedRunId]);

  const activeLeases = useMemo(() => {
    if (!selected) return [];
    const timestamp = Date.now();
    return leases.filter(
      (lease) =>
        lease.status === "active" &&
        lease.remainingUses > 0 &&
        Date.parse(lease.expiresAt) > timestamp &&
        ((selected.run.projectId === null && lease.scope === "account") ||
          (selected.run.projectId !== null &&
            lease.scope === "project" &&
            lease.projectId === selected.run.projectId)),
    );
  }, [leases, selected]);

  const selectedLease = activeLeases.find((lease) => lease.id === leaseId) ?? null;

  useEffect(() => {
    if (!activeLeases.some((lease) => lease.id === leaseId)) {
      setLeaseId(activeLeases[0]?.id ?? "");
    }
  }, [activeLeases, leaseId]);

  async function createRun() {
    setBusy(true);
    setError("");
    try {
      const value = await responseJson<{ run: ReActRun }>(
        await fetch("/api/react-runs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...(projectId ? { projectId } : {}),
            objective,
            definitionOfDone,
            maxSteps: 12,
            maxModelCalls: 12,
            maxToolActions: 8,
          }),
        }),
      );
      setObjective("");
      setDefinitionOfDone("");
      setSelectedRunId(value.run.id);
      await load(value.run.id);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Der ReAct-Lauf konnte nicht angelegt werden.");
    } finally {
      setBusy(false);
    }
  }

  async function patch(body: Record<string, unknown>) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await responseJson(
        await fetch("/api/react-runs", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            runId: selected.run.id,
            expectedVersion: selected.run.version,
            ...body,
          }),
        }),
      );
      setDecisionSummary("");
      setFinalAnswer("");
      await load(selected.run.id);
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "Der ReAct-Lauf konnte nicht aktualisiert werden.");
    } finally {
      setBusy(false);
    }
  }

  async function decide() {
    if (!selected) return;
    if (decisionType === "final") {
      await patch({
        action: "decide",
        decisionSummary,
        decision: { type: "final", answer: finalAnswer },
      });
      return;
    }
    if (!selectedLease) {
      setError("Für diesen Lauf fehlt eine passende aktive Tool-Freigabe.");
      return;
    }
    let parsedPayload: Record<string, unknown>;
    try {
      const value = JSON.parse(payload) as unknown;
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
      parsedPayload = value as Record<string, unknown>;
    } catch {
      setError("Die Werkzeugnutzlast ist kein JSON-Objekt.");
      return;
    }
    await patch({
      action: "decide",
      decisionSummary,
      decision: {
        type: "tool",
        leaseId: selectedLease.id,
        toolName: selectedLease.toolName,
        payload: parsedPayload,
        maxAttempts: 3,
      },
    });
  }

  return (
    <section className="tools-workspace react-workspace">
      <div className="tools-intro">
        <p className="section-kicker">TANKAI REACT ORCHESTRATOR · V0.14</p>
        <h1>Reasoning, Aktion und Beobachtung für {displayName}</h1>
        <p>
          Gespeichert werden kurze Entscheidungszusammenfassungen, freigegebene
          Werkzeugaktionen, Beobachtungen, Budgets und Receipts – keine privaten
          Gedankengänge.
        </p>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="react-grid">
        <article className="tool-composer react-panel">
          <h2>Neuen Lauf anlegen</h2>
          <label>
            Projektbereich
            <select value={projectId} onChange={(event: ValueChangeEvent) => setProjectId(event.target.value)}>
              <option value="">Konto – ohne Projekt</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          <label>
            Ziel
            <textarea value={objective} maxLength={8000} onChange={(event: ValueChangeEvent) => setObjective(event.target.value)} />
          </label>
          <label>
            Definition of Done
            <textarea value={definitionOfDone} maxLength={4000} onChange={(event: ValueChangeEvent) => setDefinitionOfDone(event.target.value)} />
          </label>
          <button disabled={busy || !objective.trim() || !definitionOfDone.trim()} onClick={() => void createRun()}>
            ReAct-Lauf anlegen
          </button>
        </article>

        <article className="tool-composer react-panel">
          <h2>Vorhandene Läufe</h2>
          <label>
            Lauf
            <select value={selectedRunId} onChange={(event: ValueChangeEvent) => setSelectedRunId(event.target.value)}>
              <option value="">Lauf auswählen</option>
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.status} · {run.objective.slice(0, 70)}
                </option>
              ))}
            </select>
          </label>
          {selected ? (
            <div className="react-budget">
              <span>Schritte {selected.run.currentStep}/{selected.run.maxSteps}</span>
              <span>Entscheidungen {selected.run.modelCallsUsed}/{selected.run.maxModelCalls}</span>
              <span>Werkzeuge {selected.run.toolActionsUsed}/{selected.run.maxToolActions}</span>
              <span>Version {selected.run.version}</span>
            </div>
          ) : null}
        </article>
      </div>

      {selected ? (
        <>
          <article className="tool-composer react-panel">
            <h2>Nächste Entscheidung</h2>
            <p><strong>Status:</strong> {selected.run.status}</p>
            <label>
              Kurze Entscheidungszusammenfassung
              <textarea
                value={decisionSummary}
                maxLength={1000}
                disabled={isTerminal(selected.run.status) || selected.run.status === "waiting_tool"}
                onChange={(event: ValueChangeEvent) => setDecisionSummary(event.target.value)}
              />
            </label>
            <label>
              Aktion
              <select
                value={decisionType}
                disabled={isTerminal(selected.run.status) || selected.run.status === "waiting_tool"}
                onChange={(event: ValueChangeEvent) => setDecisionType(event.target.value as "tool" | "final")}
              >
                <option value="tool">Werkzeug ausführen</option>
                <option value="final">Finale Antwort</option>
              </select>
            </label>
            {decisionType === "tool" ? (
              <>
                <label>
                  Aktive Tool-Freigabe
                  <select value={leaseId} onChange={(event: ValueChangeEvent) => setLeaseId(event.target.value)}>
                    <option value="">Freigabe auswählen</option>
                    {activeLeases.map((lease) => (
                      <option key={lease.id} value={lease.id}>
                        {lease.toolName} · {lease.remainingUses} Nutzungen
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  JSON-Nutzlast
                  <textarea value={payload} onChange={(event: ValueChangeEvent) => setPayload(event.target.value)} />
                </label>
              </>
            ) : (
              <label>
                Finale Antwort
                <textarea value={finalAnswer} maxLength={40000} onChange={(event: ValueChangeEvent) => setFinalAnswer(event.target.value)} />
              </label>
            )}
            <div className="tool-job-actions">
              <button
                disabled={
                  busy ||
                  isTerminal(selected.run.status) ||
                  selected.run.status === "waiting_tool" ||
                  !decisionSummary.trim() ||
                  (decisionType === "tool" ? !selectedLease : !finalAnswer.trim())
                }
                onClick={() => void decide()}
              >
                Entscheidung schreiben
              </button>
              <button
                disabled={busy || selected.run.status !== "waiting_tool"}
                onClick={() => void patch({ action: "sync" })}
              >
                Werkzeugbeobachtung synchronisieren
              </button>
              <button
                disabled={busy || isTerminal(selected.run.status)}
                onClick={() => void patch({ action: "cancel" })}
              >
                Lauf abbrechen
              </button>
            </div>
          </article>

          {selected.run.finalAnswer ? (
            <div className="tool-result">
              <strong>Finale Antwort</strong>
              <pre>{selected.run.finalAnswer}</pre>
            </div>
          ) : null}

          {selected.run.errorMessage ? (
            <p className="form-error">{selected.run.errorCode}: {selected.run.errorMessage}</p>
          ) : null}

          <div className="react-grid">
            <div className="tool-result">
              <strong>ReAct-Schritte</strong>
              <pre>{JSON.stringify(selected.steps, null, 2)}</pre>
            </div>
            <div className="tool-result">
              <strong>Append-only Receipts</strong>
              <pre>{JSON.stringify(selected.events, null, 2)}</pre>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
