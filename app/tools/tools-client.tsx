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
type ToolScope = "account" | "project";
type LeaseStatus = "active" | "revoked" | "depleted" | "expired";
type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled" | "dead_letter";

interface ToolDefinition {
  name: ToolName;
  title: string;
  description: string;
  scopes: ToolScope[];
  deterministic: boolean;
  externalNetwork: boolean;
  maximumInputBytes: number;
  maximumOutputBytes: number;
  maximumDurationMs: number;
  maximumNetworkRequests: number;
}

interface ToolLease {
  id: string;
  projectId: string | null;
  projectName: string | null;
  scope: ToolScope;
  toolName: ToolName;
  status: LeaseStatus;
  maxUses: number;
  remainingUses: number;
  version: number;
  expiresAt: string;
}

interface ToolJob {
  id: string;
  projectId: string | null;
  leaseId: string;
  toolName: ToolName;
  status: JobStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  errorCode: string | null;
  errorMessage: string | null;
  progressPercent: number;
  attempt: number;
  maxAttempts: number;
  version: number;
  createdAt: string;
  completedAt: string | null;
}

interface ProjectRecord {
  id: string;
  name: string;
  status: "active" | "archived";
}

interface ProjectDocumentMetadata {
  id: string;
  name: string;
  kind: "markdown" | "text" | "json" | "csv";
  version: number;
  sizeBytes: number;
}

interface ResearchBundle {
  query: string;
  status: "complete" | "partial" | "failed";
  verificationStatus: "unverified-source-observations";
  sourceCount: number;
  successfulSourceCount: number;
  failedSourceCount: number;
  distinctHostCount: number;
  createdAt: string;
  sources: Array<{
    ordinal: number;
    jobId: string;
    status: JobStatus;
    requestedUrl: string;
    finalUrl: string | null;
    title: string | null;
    excerpt: string | null;
    sha256: string | null;
    bytesRead: number | null;
    truncated: boolean;
    promptInjectionSignals: string[];
    errorCode: string | null;
    errorMessage: string | null;
    untrusted: true;
  }>;
}

interface ToolProgressMessage {
  job: {
    id: string;
    status: JobStatus;
    progressPercent: number;
    attempt: number;
    maxAttempts: number;
    version: number;
    errorCode: string | null;
    errorMessage: string | null;
    completedAt: string | null;
  };
  terminal: boolean;
  executionStatusOnly: true;
  factsVerified: false;
}

async function responseJson<T>(response: Response): Promise<T> {
  const value = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(value.error ?? "TankAI konnte die Werkzeuganfrage nicht abschließen.");
  }
  return value;
}

function statusLabel(status: JobStatus): string {
  return {
    queued: "Wartet",
    running: "Läuft",
    succeeded: "Erfolgreich",
    failed: "Fehlgeschlagen",
    cancelled: "Abgebrochen",
    dead_letter: "Dead Letter",
  }[status];
}

function inputLabel(toolName: ToolName): string {
  if (toolName === "web.fetch") return "Externe HTTPS-Adresse";
  if (toolName === "code.patch.inspect") return "Unified Diff";
  if (toolName === "json.validate") return "JSON";
  return "Eingabe";
}

function inputPlaceholder(toolName: ToolName): string {
  if (toolName === "web.fetch") return "https://example.com/quelle";
  if (toolName === "code.patch.inspect") return "diff --git a/datei.ts b/datei.ts\n...";
  if (toolName === "json.validate") return '{\n  "status": "ok"\n}';
  return "Text einfügen";
}

export default function ToolsClient({ displayName }: { displayName: string }) {
  const [catalog, setCatalog] = useState<ToolDefinition[]>([]);
  const [leases, setLeases] = useState<ToolLease[]>([]);
  const [jobs, setJobs] = useState<ToolJob[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [documents, setDocuments] = useState<ProjectDocumentMetadata[]>([]);
  const [toolName, setToolName] = useState<ToolName>("text.sha256");
  const [scope, setScope] = useState<ToolScope>("account");
  const [projectId, setProjectId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [csvQuery, setCsvQuery] = useState("");
  const [text, setText] = useState("");
  const [researchQuery, setResearchQuery] = useState("");
  const [researchUrls, setResearchUrls] = useState("");
  const [researchResult, setResearchResult] = useState<ResearchBundle | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [leaseData, jobData, projectData] = await Promise.all([
      responseJson<{ leases: ToolLease[]; catalog: ToolDefinition[] }>(
        await fetch("/api/tool-leases", { cache: "no-store" }),
      ),
      responseJson<{ jobs: ToolJob[]; catalog: ToolDefinition[] }>(
        await fetch("/api/tool-jobs", { cache: "no-store" }),
      ),
      responseJson<{ projects: ProjectRecord[] }>(
        await fetch("/api/projects", { cache: "no-store" }),
      ),
    ]);
    setLeases(leaseData.leases);
    setCatalog(leaseData.catalog.length ? leaseData.catalog : jobData.catalog);
    setJobs(jobData.jobs);
    setProjects(projectData.projects.filter((project) => project.status === "active"));
  }, []);

  const loadDocuments = useCallback(async (selectedProjectId: string) => {
    if (!selectedProjectId) {
      setDocuments([]);
      setDocumentId("");
      return;
    }
    const data = await responseJson<{
      active: { documents: ProjectDocumentMetadata[] } | null;
    }>(
      await fetch(`/api/projects?projectId=${encodeURIComponent(selectedProjectId)}`, {
        cache: "no-store",
      }),
    );
    const nextDocuments = data.active?.documents ?? [];
    setDocuments(nextDocuments);
    setDocumentId((current) =>
      nextDocuments.some((document) => document.id === current)
        ? current
        : nextDocuments[0]?.id ?? "",
    );
  }, []);

  useEffect(() => {
    void load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Werkzeugstatus konnte nicht geladen werden.");
    });
  }, [load]);

  useEffect(() => {
    void loadDocuments(projectId).catch((loadError) => {
      setDocuments([]);
      setDocumentId("");
      setError(loadError instanceof Error ? loadError.message : "Projektdateien konnten nicht geladen werden.");
    });
  }, [loadDocuments, projectId]);

  const definition = useMemo(
    () => catalog.find((candidate) => candidate.name === toolName),
    [catalog, toolName],
  );

  useEffect(() => {
    if (definition && !definition.scopes.includes(scope)) {
      setScope(definition.scopes[0] ?? "account");
      setProjectId("");
    }
  }, [definition, scope]);

  useEffect(() => {
    setText("");
    setCsvQuery("");
    if (toolName !== "project.document.inspect") setDocumentId("");
  }, [toolName]);

  const activeLease = useMemo(() => {
    const timestamp = Date.now();
    return leases.find(
      (lease) =>
        lease.toolName === toolName &&
        lease.status === "active" &&
        lease.remainingUses > 0 &&
        Date.parse(lease.expiresAt) > timestamp &&
        lease.scope === scope &&
        (scope === "account" || lease.projectId === projectId),
    );
  }, [leases, projectId, scope, toolName]);

  const normalizedResearchUrls = useMemo(
    () =>
      researchUrls
        .split(/\r?\n/u)
        .map((value) => value.trim())
        .filter(Boolean),
    [researchUrls],
  );

  const activeResearchLease = useMemo(() => {
    return leases.find(
      (lease) =>
        lease.toolName === "web.fetch" &&
        lease.status === "active" &&
        lease.remainingUses >= normalizedResearchUrls.length &&
        lease.scope === scope &&
        (scope === "account" || lease.projectId === projectId),
    );
  }, [leases, normalizedResearchUrls.length, projectId, scope]);

  const researchReady =
    researchQuery.trim().length > 0 &&
    normalizedResearchUrls.length >= 2 &&
    normalizedResearchUrls.length <= 4 &&
    (scope === "account" || Boolean(projectId));

  const streamingJobId =
    jobs.find((job) => job.status === "queued" || job.status === "running")?.id ?? null;

  useEffect(() => {
    if (!streamingJobId) return;
    const source = new EventSource(
      `/api/tool-jobs/stream?jobId=${encodeURIComponent(streamingJobId)}`,
    );
    const receive = (event: Event) => {
      if (!(event instanceof MessageEvent) || typeof event.data !== "string") return;
      try {
        const message = JSON.parse(event.data) as ToolProgressMessage;
        if (
          !message ||
          message.executionStatusOnly !== true ||
          message.factsVerified !== false ||
          message.job?.id !== streamingJobId
        ) {
          return;
        }
        setJobs((current) =>
          current.map((job) =>
            job.id === message.job.id ? { ...job, ...message.job } : job),
        );
        if (message.terminal) void load().catch(() => undefined);
      } catch {
        // Invalid stream frames never change local job state.
      }
    };
    source.addEventListener("snapshot", receive);
    source.addEventListener("progress", receive);
    return () => source.close();
  }, [load, streamingJobId]);

  const inputReady = useMemo(() => {
    if (scope === "project" && !projectId) return false;
    if (toolName === "memory.retention") return true;
    if (toolName === "project.document.inspect") return Boolean(documentId);
    return Boolean(text.trim());
  }, [documentId, projectId, scope, text, toolName]);

  async function createLease() {
    setBusy(true);
    setError("");
    try {
      await responseJson(
        await fetch("/api/tool-leases", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            toolName,
            scope,
            ...(scope === "project" ? { projectId } : {}),
            maxUses: 1,
            durationMinutes: 60,
          }),
        }),
      );
      await load();
    } catch (leaseError) {
      setError(leaseError instanceof Error ? leaseError.message : "Tool-Freigabe konnte nicht erstellt werden.");
    } finally {
      setBusy(false);
    }
  }

  async function createResearchLease() {
    if (!researchReady) return;
    setBusy(true);
    setError("");
    try {
      await responseJson(
        await fetch("/api/tool-leases", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            toolName: "web.fetch",
            scope,
            ...(scope === "project" ? { projectId } : {}),
            maxUses: normalizedResearchUrls.length,
            durationMinutes: 60,
          }),
        }),
      );
      await load();
    } catch (leaseError) {
      setError(
        leaseError instanceof Error
          ? leaseError.message
          : "Recherchefreigabe konnte nicht erstellt werden.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function runResearch() {
    if (!activeResearchLease || !researchReady) return;
    setBusy(true);
    setError("");
    setResearchResult(null);
    try {
      const result = await responseJson<{ research: ResearchBundle }>(
        await fetch("/api/research", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            leaseId: activeResearchLease.id,
            ...(scope === "project" ? { projectId } : {}),
            query: researchQuery,
            urls: normalizedResearchUrls,
            idempotencyKey: crypto.randomUUID(),
          }),
        }),
      );
      setResearchResult(result.research);
      await load();
    } catch (researchError) {
      setError(
        researchError instanceof Error
          ? researchError.message
          : "Mehrquellen-Recherche konnte nicht abgeschlossen werden.",
      );
      await load().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  function inputPayload(): Record<string, unknown> {
    if (toolName === "memory.retention") return {};
    if (toolName === "web.fetch") return { url: text };
    if (toolName === "project.document.inspect") {
      if (!csvQuery.trim()) return { documentId };
      return { documentId, csvQuery: JSON.parse(csvQuery) as unknown };
    }
    if (toolName === "code.patch.inspect") return { patch: text };
    return { text };
  }

  async function createJob() {
    if (!activeLease || !inputReady) return;
    setBusy(true);
    setError("");
    try {
      const result = await responseJson<{ job: ToolJob }>(
        await fetch("/api/tool-jobs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "create",
            leaseId: activeLease.id,
            toolName,
            ...(scope === "project" ? { projectId } : {}),
            input: inputPayload(),
            idempotencyKey: crypto.randomUUID(),
            maxAttempts: 2,
          }),
        }),
      );
      await responseJson(
        await fetch("/api/tool-jobs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "execute",
            jobId: result.job.id,
            expectedVersion: result.job.version,
          }),
        }),
      );
      await load();
    } catch (jobError) {
      setError(jobError instanceof Error ? jobError.message : "Werkzeugauftrag konnte nicht ausgeführt werden.");
      await load().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function recoverJobs() {
    setBusy(true);
    setError("");
    try {
      await responseJson(
        await fetch("/api/tool-jobs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "recover" }),
        }),
      );
      await load();
    } catch (recoverError) {
      setError(recoverError instanceof Error ? recoverError.message : "Verwaiste Claims konnten nicht geprüft werden.");
    } finally {
      setBusy(false);
    }
  }

  async function updateJob(job: ToolJob, action: "execute" | "retry" | "cancel") {
    setBusy(true);
    setError("");
    try {
      const result = await responseJson<{ job: ToolJob }>(
        await fetch("/api/tool-jobs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, jobId: job.id, expectedVersion: job.version }),
        }),
      );
      if (action === "retry") {
        await responseJson(
          await fetch("/api/tool-jobs", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              action: "execute",
              jobId: result.job.id,
              expectedVersion: result.job.version,
            }),
          }),
        );
      }
      await load();
    } catch (jobError) {
      setError(jobError instanceof Error ? jobError.message : "Werkzeugauftrag konnte nicht geändert werden.");
      await load().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="tools-workspace">
      <div className="tools-intro">
        <p className="section-kicker">TANKAI TOOL FABRIC · V0.15</p>
        <h1>Reale Werkzeuge, enge Budgets und überprüfbare Ausführung.</h1>
        <p>
          Angemeldet als {displayName}. Netzwerkdaten und Projektdateien bleiben ausdrücklich
          unvertrauenswürdig. Kein Dateiinhalt und kein Code-Patch wird automatisch ausgeführt.
        </p>
      </div>

      {error ? <div className="tools-error" role="alert">{error}</div> : null}

      <div className="tools-grid">
        <article className="tool-control-card">
          <h2>Neuer Werkzeugauftrag</h2>
          <label>
            Werkzeug
            <select value={toolName} onChange={(event: { target: { value: string } }) => setToolName(event.target.value as ToolName)}>
              {catalog.map((tool) => <option key={tool.name} value={tool.name}>{tool.title}</option>)}
            </select>
          </label>
          <p className="tool-description">{definition?.description}</p>

          {definition ? (
            <div className="tool-policy-grid" aria-label="Werkzeugbudget">
              <span>{definition.deterministic ? "Deterministisch" : "Externe Antwort"}</span>
              <span>{definition.externalNetwork ? "Netzwerk aktiv" : "Ohne Netzwerk"}</span>
              <span>{definition.maximumDurationMs.toLocaleString("de-DE")} ms</span>
              <span>{definition.maximumOutputBytes.toLocaleString("de-DE")} B Ausgabe</span>
            </div>
          ) : null}

          <div className="scope-row">
            {definition?.scopes.map((candidate) => (
              <button
                key={candidate}
                type="button"
                className={scope === candidate ? "active" : ""}
                onClick={() => setScope(candidate)}
              >
                {candidate === "account" ? "Konto" : "Projekt"}
              </button>
            ))}
          </div>

          {scope === "project" ? (
            <label>
              Projekt
              <select value={projectId} onChange={(event: { target: { value: string } }) => setProjectId(event.target.value)}>
                <option value="">Projekt wählen</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label>
          ) : null}

          {toolName === "project.document.inspect" ? (
            <>
              <label>
                Projektdatei
                <select value={documentId} onChange={(event: { target: { value: string } }) => setDocumentId(event.target.value)}>
                  <option value="">Datei wählen</option>
                  {documents.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.name} · {document.kind} · v{document.version}
                    </option>
                  ))}
                </select>
              </label>
              {documents.find((document) => document.id === documentId)?.kind === "csv" ? (
                <label>
                  Optionale CSV-Abfrage
                  <textarea
                    rows={8}
                    value={csvQuery}
                    onChange={(event: { target: { value: string } }) => setCsvQuery(event.target.value)}
                    placeholder={'{\n  "columns": ["name", "betrag"],\n  "filters": [],\n  "sort": [],\n  "aggregates": [],\n  "groupBy": [],\n  "frequencies": [],\n  "histograms": [],\n  "quantiles": [],\n  "outliers": [],\n  "dispersion": [],\n  "relationships": [],\n  "regressions": [{"xColumn": "anzahl", "yColumn": "betrag", "predictionXValues": [1.5, 4], "intervalConfidenceLevel": 0.95}],\n  "limit": 10\n}'}
                  />
                  <span className="field-hint">
                    Leer lassen für ein reines Profil. Höchstens 5 Filter, 2 Sortierungen,
                    8 Spalten, 10 Ergebniszeilen, 8 numerische Aggregationen, 3 Häufigkeitsspalten
                    mit je 10 Buckets, 3 numerische Histogramme mit 2 bis 12 expliziten Intervallen
                    oder 3 Quantilspalten mit je 9 Wahrscheinlichkeiten nach R7 oder 3 numerische
                    Ausreißerspalten nach Tukey-IQR (R7-Quartile, Faktor 1,5, höchstens 20 Treffer je Spalte)
                    oder 3 Streuungsspalten, 3 numerische Beziehungspaare mit explizitem Modus population oder sample
                    oder 3 OLS-Regressionspaare mit höchstens 20 Residuen und 10 Vorhersagen je Paar.
                    Gruppierung und Verteilungsarten werden getrennt abgefragt. Keine Formel- oder Codeausführung.
                  </span>
                </label>
              ) : null}
            </>
          ) : null}

          {toolName !== "memory.retention" && toolName !== "project.document.inspect" ? (
            <label>
              {inputLabel(toolName)}
              <textarea
                rows={toolName === "web.fetch" ? 3 : 11}
                value={text}
                onChange={(event: { target: { value: string } }) => setText(event.target.value)}
                placeholder={inputPlaceholder(toolName)}
              />
            </label>
          ) : null}

          <div className="tool-lease-status">
            {activeLease ? (
              <span>Freigabe aktiv · {activeLease.remainingUses} Nutzung · bis {new Date(activeLease.expiresAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>
            ) : (
              <span>Keine passende aktive Tool-Freigabe.</span>
            )}
          </div>

          {activeLease ? (
            <button
              className="primary-button"
              type="button"
              disabled={busy || !inputReady}
              onClick={() => void createJob()}
            >
              {busy ? "Ausführung läuft …" : "Auftrag anlegen und ausführen"}
            </button>
          ) : (
            <button
              className="primary-button"
              type="button"
              disabled={busy || (scope === "project" && !projectId)}
              onClick={() => void createLease()}
            >
              {busy ? "Freigabe wird erstellt …" : "1 Nutzung für 60 Minuten freigeben"}
            </button>
          )}
        </article>

        <section className="tool-job-list" aria-label="Werkzeugaufträge">
          <div className="tool-job-list-header">
            <div>
              <p className="section-kicker">PERSISTENTE JOB QUEUE</p>
              <h2>Letzte Aufträge</h2>
            </div>
            <div className="tool-header-actions">
              <span className={`tool-stream-status ${streamingJobId ? "active" : ""}`}>
                {streamingJobId ? "Live-Fortschritt aktiv" : "Live-Stream bereit"}
              </span>
              <button type="button" disabled={busy} onClick={() => void recoverJobs()}>Claims prüfen</button>
              <button type="button" disabled={busy} onClick={() => void load()}>Aktualisieren</button>
            </div>
          </div>
          {jobs.length === 0 ? <p className="tool-empty">Noch kein Werkzeugauftrag.</p> : null}
          {jobs.map((job) => (
            <article className={`tool-job-card ${job.status}`} key={job.id}>
              <div className="tool-job-title">
                <div>
                  <strong>{catalog.find((tool) => tool.name === job.toolName)?.title ?? job.toolName}</strong>
                  <span>{new Date(job.createdAt).toLocaleString("de-DE")}</span>
                </div>
                <b>{statusLabel(job.status)}</b>
              </div>
              <div className="tool-progress"><i style={{ width: `${job.progressPercent}%` }} /></div>
              <p>Versuch {job.attempt} von {job.maxAttempts} · Version {job.version}</p>
              {job.output ? <pre>{JSON.stringify(job.output, null, 2)}</pre> : null}
              {job.errorMessage ? <div className="tool-job-error">{job.errorCode}: {job.errorMessage}</div> : null}
              <div className="tool-job-actions">
                {job.status === "queued" ? (
                  <>
                    <button type="button" disabled={busy} onClick={() => void updateJob(job, "execute")}>Ausführen</button>
                    <button type="button" disabled={busy} onClick={() => void updateJob(job, "cancel")}>Abbrechen</button>
                  </>
                ) : null}
                {job.status === "failed" && job.attempt < job.maxAttempts ? (
                  <button type="button" disabled={busy} onClick={() => void updateJob(job, "retry")}>Erneut ausführen</button>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      </div>

      <article className="tool-control-card research-card">
        <p className="section-kicker">MEHRQUELLEN-RECHERCHE · V0.22</p>
        <h2>Getrennte Quellen abrufen, ohne Fakten vorzutäuschen.</h2>
        <p className="tool-description">
          Zwei bis vier ausdrücklich gewählte HTTPS-Quellen werden als eigene, dauerhafte
          Werkzeugaufträge verarbeitet. Die Auszüge bleiben unvertrauenswürdige Beobachtungen;
          TankAI kennzeichnet sie nicht automatisch als bestätigte Fakten.
        </p>
        <label>
          Recherchefrage
          <input
            value={researchQuery}
            maxLength={500}
            onChange={(event: { target: { value: string } }) =>
              setResearchQuery(event.target.value)}
            placeholder="Welche Aussagen stimmen zwischen den Quellen überein?"
          />
        </label>
        <label>
          2–4 HTTPS-Quellen, eine pro Zeile
          <textarea
            rows={5}
            value={researchUrls}
            onChange={(event: { target: { value: string } }) =>
              setResearchUrls(event.target.value)}
            placeholder={"https://quelle-a.example/artikel\nhttps://quelle-b.example/bericht"}
          />
        </label>
        <div className="tool-lease-status">
          {activeResearchLease ? (
            <span>
              Recherchefreigabe aktiv · {normalizedResearchUrls.length} getrennte Abrufe
            </span>
          ) : (
            <span>
              Erfordert {Math.max(2, normalizedResearchUrls.length)} explizite Web-Nutzungen.
            </span>
          )}
        </div>
        {activeResearchLease ? (
          <button
            className="primary-button"
            type="button"
            disabled={busy || !researchReady}
            onClick={() => void runResearch()}
          >
            {busy ? "Quellen werden verarbeitet …" : "Recherche ausführen"}
          </button>
        ) : (
          <button
            className="primary-button"
            type="button"
            disabled={busy || !researchReady}
            onClick={() => void createResearchLease()}
          >
            {busy ? "Freigabe wird erstellt …" : "Quellenabrufe für 60 Minuten freigeben"}
          </button>
        )}

        {researchResult ? (
          <section className="research-results" aria-live="polite">
            <h3>
              {researchResult.successfulSourceCount} von {researchResult.sourceCount} Quellen
              abgerufen
            </h3>
            <p>
              Status: {researchResult.status} · {researchResult.distinctHostCount} Hosts ·
              nicht verifizierte Quellenbeobachtungen
            </p>
            {researchResult.sources.map((source) => (
              <article className={`tool-job-card ${source.status}`} key={source.jobId}>
                <strong>{source.ordinal}. {source.title ?? source.requestedUrl}</strong>
                <p>{source.finalUrl ?? source.requestedUrl}</p>
                {source.excerpt ? <pre>{source.excerpt}</pre> : null}
                {source.sha256 ? <small>SHA-256: {source.sha256}</small> : null}
                {source.promptInjectionSignals.length > 0 ? (
                  <div className="tool-job-error">
                    Prompt-Injection-Signale: {source.promptInjectionSignals.join(", ")}
                  </div>
                ) : null}
                {source.errorMessage ? (
                  <div className="tool-job-error">
                    {source.errorCode}: {source.errorMessage}
                  </div>
                ) : null}
              </article>
            ))}
          </section>
        ) : null}
      </article>
    </section>
  );
}
