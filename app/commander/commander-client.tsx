"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";

type CommanderStatus =
  | "ready"
  | "running"
  | "waiting_tool"
  | "reviewing"
  | "completed"
  | "failed"
  | "cancelled"
  | "budget_exhausted"
  | "model_unavailable";

interface Project {
  id: string;
  name: string;
}

interface CapabilityLease {
  id: string;
  capability: "model.run";
  mode: "fast" | "team" | "deep";
  scope: "account" | "project";
  projectId: string | null;
  projectName: string | null;
  status: "active" | "depleted" | "revoked" | "expired";
  remainingUses: number;
  maxUses: number;
  version: number;
  expiresAt: string;
}

interface CommanderRun {
  id: string;
  reactRunId: string;
  projectId: string | null;
  capabilityLeaseId: string;
  status: CommanderStatus;
  cycleCount: number;
  maxCycles: number;
  modelCallsUsed: number;
  maxModelCalls: number;
  reviewCallsUsed: number;
  maxReviewCalls: number;
  version: number;
  finalAnswer: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

interface CommanderSelection {
  run: CommanderRun;
  react: {
    run: {
      objective: string;
      definitionOfDone: string;
      status: string;
      currentStep: number;
      maxSteps: number;
      toolActionsUsed: number;
      maxToolActions: number;
    };
    steps: unknown[];
  };
  decisions: unknown[];
  modelLeaseEvents: unknown[];
  events: unknown[];
}

async function responseJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `HTTP ${response.status}`);
  }
  return data as T;
}

function isTerminal(status: CommanderStatus): boolean {
  return ["completed", "failed", "cancelled", "budget_exhausted", "model_unavailable"].includes(status);
}

export default function CommanderClient({ displayName }: { displayName: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [capabilityLeases, setCapabilityLeases] = useState<CapabilityLease[]>([]);
  const [runs, setRuns] = useState<CommanderRun[]>([]);
  const [selected, setSelected] = useState<CommanderSelection | null>(null);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [capabilityLeaseId, setCapabilityLeaseId] = useState("");
  const [objective, setObjective] = useState("");
  const [definitionOfDone, setDefinitionOfDone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (runId?: string) => {
    const [commanderData, projectData, leaseData] = await Promise.all([
      responseJson<{ runs: CommanderRun[]; selected: CommanderSelection | null }>(
        await fetch(`/api/commander${runId ? `?runId=${encodeURIComponent(runId)}` : ""}`, { cache: "no-store" }),
      ),
      responseJson<{ projects: Project[] }>(await fetch("/api/projects", { cache: "no-store" })),
      responseJson<{ leases: CapabilityLease[] }>(await fetch("/api/capability-leases", { cache: "no-store" })),
    ]);
    setRuns(commanderData.runs);
    setSelected(commanderData.selected);
    setProjects(projectData.projects ?? []);
    setCapabilityLeases(leaseData.leases ?? []);
  }, []);

  useEffect(() => {
    void load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Commander-Daten konnten nicht geladen werden.");
    });
  }, [load]);

  useEffect(() => {
    if (!selectedRunId) {
      setSelected(null);
      return;
    }
    void load(selectedRunId).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Der Commander-Lauf konnte nicht geladen werden.");
    });
  }, [load, selectedRunId]);

  const eligibleCapabilityLeases = useMemo(
    () => capabilityLeases.filter((lease) =>
      lease.capability === "model.run"
      && lease.mode === "team"
      && lease.status === "active"
      && lease.remainingUses >= 16
      && (lease.scope === "account" || (Boolean(projectId) && lease.projectId === projectId)),
    ),
    [capabilityLeases, projectId],
  );

  useEffect(() => {
    if (!eligibleCapabilityLeases.some((lease) => lease.id === capabilityLeaseId)) {
      setCapabilityLeaseId(eligibleCapabilityLeases[0]?.id ?? "");
    }
  }, [capabilityLeaseId, eligibleCapabilityLeases]);

  const terminal = selected ? isTerminal(selected.run.status) : false;
  const progress = useMemo(() => {
    if (!selected) return 0;
    return Math.min(100, Math.round((selected.run.cycleCount / selected.run.maxCycles) * 100));
  }, [selected]);

  async function createModelLease() {
    setBusy(true);
    setError("");
    try {
      const result = await responseJson<{ lease: CapabilityLease }>(
        await fetch("/api/capability-leases", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            capability: "model.run",
            mode: "team",
            scope: projectId ? "project" : "account",
            ...(projectId ? { projectId } : {}),
            maxUses: 20,
            durationMinutes: 60,
          }),
        }),
      );
      setCapabilityLeaseId(result.lease.id);
      await load();
    } catch (leaseError) {
      setError(leaseError instanceof Error ? leaseError.message : "Die model.run-Freigabe konnte nicht erstellt werden.");
    } finally {
      setBusy(false);
    }
  }

  async function createRun() {
    setBusy(true);
    setError("");
    try {
      const result = await responseJson<{ run: CommanderRun }>(
        await fetch("/api/commander", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            capabilityLeaseId,
            ...(projectId ? { projectId } : {}),
            objective,
            definitionOfDone,
            maxCycles: 12,
            maxModelCalls: 16,
            maxReviewCalls: 6,
            maxToolActions: 8,
          }),
        }),
      );
      setObjective("");
      setDefinitionOfDone("");
      setSelectedRunId(result.run.id);
      await load(result.run.id);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Der Commander-Lauf konnte nicht angelegt werden.");
    } finally {
      setBusy(false);
    }
  }

  async function patch(action: "advance" | "cancel") {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await responseJson(
        await fetch("/api/commander", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action,
            runId: selected.run.id,
            expectedVersion: selected.run.version,
            ...(action === "advance" ? { maxTransitions: 4 } : {}),
          }),
        }),
      );
      await load(selected.run.id);
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "Der Commander-Lauf konnte nicht aktualisiert werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="tools-workspace react-workspace commander-workspace">
      <div className="tools-intro">
        <p className="section-kicker">TANKAI COMMANDER · V0.15</p>
        <h1>Autonome, geprüfte Ausführung für {displayName}</h1>
        <p>
          Der Commander erzeugt strukturierte ReAct-Entscheidungen, löst passende Tool-Leases
          serverseitig auf und schließt erst nach einer Critic-Prüfung ab. Private Gedankengänge
          werden nicht gespeichert.
        </p>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="react-grid">
        <article className="tool-composer react-panel">
          <h2>Neuen Commander-Lauf anlegen</h2>
          <label>
            Projektbereich
            <select value={projectId} onChange={(event: ChangeEvent<HTMLSelectElement>) => { setProjectId(event.target.value); setCapabilityLeaseId(""); }}>
              <option value="">Konto – ohne Projekt</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          <label>
            model.run-Teamfreigabe
            <select value={capabilityLeaseId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setCapabilityLeaseId(event.target.value)}>
              <option value="">Freigabe auswählen</option>
              {eligibleCapabilityLeases.map((lease) => (
                <option key={lease.id} value={lease.id}>
                  {lease.scope === "project" ? lease.projectName ?? "Projekt" : "Konto"} · {lease.remainingUses}/{lease.maxUses} Nutzungen
                </option>
              ))}
            </select>
          </label>
          <button type="button" disabled={busy} onClick={() => void createModelLease()}>
            Neue Teamfreigabe mit 20 Nutzungen
          </button>
          <p className="tool-note">Jede Commander-Entscheidung und jede Critic-Prüfung verbraucht genau eine model.run-Nutzung.</p>
          <label>
            Ziel
            <textarea value={objective} maxLength={8000} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setObjective(event.target.value)} />
          </label>
          <label>
            Definition of Done
            <textarea value={definitionOfDone} maxLength={4000} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setDefinitionOfDone(event.target.value)} />
          </label>
          <button disabled={busy || !capabilityLeaseId || !objective.trim() || !definitionOfDone.trim()} onClick={() => void createRun()}>
            Commander-Lauf anlegen
          </button>
        </article>

        <article className="tool-composer react-panel">
          <h2>Vorhandene Läufe</h2>
          <label>
            Lauf
            <select value={selectedRunId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setSelectedRunId(event.target.value)}>
              <option value="">Lauf auswählen</option>
              {runs.map((run) => (
                <option key={run.id} value={run.id}>{run.status} · {run.id.slice(0, 8)}</option>
              ))}
            </select>
          </label>
          {selected ? (
            <div className="react-budget">
              <span>Zyklen {selected.run.cycleCount}/{selected.run.maxCycles}</span>
              <span>Modellaufrufe {selected.run.modelCallsUsed}/{selected.run.maxModelCalls}</span>
              <span>Prüfungen {selected.run.reviewCallsUsed}/{selected.run.maxReviewCalls}</span>
              <span>ReAct {selected.react.run.currentStep}/{selected.react.run.maxSteps}</span>
              <span>Modellfreigabe {selected.run.capabilityLeaseId.slice(0, 8)}</span>
              <span>Version {selected.run.version}</span>
            </div>
          ) : null}
        </article>
      </div>

      {selected ? (
        <>
          <article className="tool-composer react-panel">
            <h2>Commander-Steuerung</h2>
            <p><strong>Status:</strong> {selected.run.status}</p>
            <p><strong>Ziel:</strong> {selected.react.run.objective}</p>
            <p><strong>Definition of Done:</strong> {selected.react.run.definitionOfDone}</p>
            <div className="commander-progress" aria-label={`Commander-Fortschritt ${progress} Prozent`}>
              <div style={{ width: `${progress}%` }} />
            </div>
            <div className="tool-job-actions">
              <button disabled={busy || terminal} onClick={() => void patch("advance")}>
                Autonom fortsetzen
              </button>
              <button disabled={busy || terminal} onClick={() => void patch("cancel")}>
                Lauf abbrechen
              </button>
            </div>
          </article>

          {selected.run.finalAnswer ? (
            <div className="tool-result">
              <strong>Geprüfte finale Antwort</strong>
              <pre>{selected.run.finalAnswer}</pre>
            </div>
          ) : null}

          {selected.run.errorMessage ? (
            <p className="form-error">{selected.run.errorCode}: {selected.run.errorMessage}</p>
          ) : null}

          <div className="react-grid">
            <div className="tool-result">
              <strong>Commander-Entscheidungen</strong>
              <pre>{JSON.stringify(selected.decisions, null, 2)}</pre>
            </div>
            <div className="tool-result">
              <strong>Modellfreigabe-Verbrauch</strong>
              <pre>{JSON.stringify(selected.modelLeaseEvents, null, 2)}</pre>
            </div>
            <div className="tool-result">
              <strong>Commander-Receipts</strong>
              <pre>{JSON.stringify(selected.events, null, 2)}</pre>
            </div>
          </div>
          <div className="tool-result">
            <strong>Gekoppelter ReAct-Verlauf</strong>
            <pre>{JSON.stringify(selected.react.steps, null, 2)}</pre>
          </div>
        </>
      ) : null}
    </section>
  );
}
