"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";

type ReleaseStatus = "candidate" | "canary" | "active" | "rejected" | "rolled_back" | "superseded";
type BreakerState = "closed" | "open" | "half_open";
interface Project { id: string; name: string; status?: string; }
interface Provider { id: string; family: string; name: string; model: string; }
interface Release { id: string; label: string; status: ReleaseStatus; trafficPercent: number; version: number; }
interface Config {
  id: string; releaseId: string; projectId: string; providerId: string; fallbackProviderIds: string[];
  maxOutputTokens: number; failureThreshold: number; recoveryTimeoutSeconds: number;
  halfOpenSuccesses: number; configSha256: string; version: number; updatedAt: string;
}
interface Traffic {
  id: string; projectId: string; canaryReleaseId: string; trafficPercent: number;
  enabled: boolean; version: number; updatedAt: string;
}
interface Circuit {
  id: string; projectId: string; releaseId: string; providerId: string; state: BreakerState;
  consecutiveFailures: number; halfOpenSuccessCount: number; nextProbeAt: string | null;
  lastFailureAt: string | null; version: number; updatedAt: string;
}
interface Metric {
  minutes: number; requests: number; successes: number; failures: number; successRateBps: number;
  p50LatencyMs: number; p95LatencyMs: number; averageLatencyMs: number;
}
interface Attempt {
  ordinal: number; providerId: string; status: "succeeded" | "failed" | "skipped_open" | "unavailable";
  latencyMs: number; errorCode: string | null; createdAt: string;
}
interface Trace {
  id: string; releaseId: string; providerId: string; status: "succeeded" | "failed";
  source: "active" | "canary"; attemptCount: number; latencyMs: number;
  errorCode: string | null; createdAt: string; attempts: Attempt[];
}
interface ControlState {
  providers: Provider[]; releases: Release[]; configs: Config[]; traffic: Traffic | null;
  circuits: Circuit[]; metrics: Metric[]; recentRequests: Trace[];
  recentEvents: Array<Record<string, unknown>>;
}
const EMPTY: ControlState = { providers: [], releases: [], configs: [], traffic: null, circuits: [], metrics: [], recentRequests: [], recentEvents: [] };

async function responseJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : `HTTP ${response.status}`);
  return data as T;
}
function formatTime(value: string | null): string {
  if (!value) return "–";
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
}
function successPercent(bps: number): string { return `${(bps / 100).toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`; }
function windowLabel(minutes: number): string { return minutes === 1440 ? "24 Stunden" : `${minutes} Minuten`; }
function statusLabel(status: string): string {
  return ({ succeeded: "Erfolgreich", failed: "Fehlgeschlagen", skipped_open: "Circuit offen", unavailable: "Nicht verfügbar",
    closed: "Geschlossen", open: "Offen", half_open: "Probe", active: "Aktiv", canary: "Canary", candidate: "Kandidat" } as Record<string, string>)[status] ?? status;
}

export default function DeploymentClient({ displayName }: { displayName: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [state, setState] = useState<ControlState>(EMPTY);
  const [releaseId, setReleaseId] = useState("");
  const [providerId, setProviderId] = useState("");
  const [fallbackProviderIds, setFallbackProviderIds] = useState<string[]>([]);
  const [maxOutputTokens, setMaxOutputTokens] = useState(2048);
  const [failureThreshold, setFailureThreshold] = useState(3);
  const [recoveryTimeoutSeconds, setRecoveryTimeoutSeconds] = useState(60);
  const [halfOpenSuccesses, setHalfOpenSuccesses] = useState(1);
  const [trafficPercent, setTrafficPercent] = useState(5);
  const [routingKey, setRoutingKey] = useState("control-plane-preview");
  const [instructions, setInstructions] = useState("Antworte präzise und überprüfbar.");
  const [prompt, setPrompt] = useState("Melde den Zustand dieses Deployment-Pfads in einem Satz.");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    const payload = await responseJson<{ projects: Project[] }>(await fetch("/api/projects", { cache: "no-store" }));
    const active = (payload.projects ?? []).filter((project) => project.status !== "archived");
    setProjects(active);
    setProjectId((current) => current || active[0]?.id || "");
  }, []);
  const loadState = useCallback(async (selectedProjectId: string) => {
    if (!selectedProjectId) { setState(EMPTY); return; }
    const payload = await responseJson<ControlState>(await fetch(`/api/deployment?projectId=${encodeURIComponent(selectedProjectId)}`, { cache: "no-store" }));
    setState(payload); setLastUpdated(new Date().toISOString());
  }, []);

  useEffect(() => { void loadProjects().catch((reason) => setError(reason instanceof Error ? reason.message : "Projekte konnten nicht geladen werden.")); }, [loadProjects]);
  useEffect(() => {
    if (!projectId) return;
    void loadState(projectId).catch((reason) => setError(reason instanceof Error ? reason.message : "Deployment-Zustand konnte nicht geladen werden."));
    const timer = window.setInterval(() => void loadState(projectId).catch(() => undefined), 5_000);
    return () => window.clearInterval(timer);
  }, [loadState, projectId]);

  const selectableReleases = useMemo(() => state.releases.filter((release) => ["candidate", "canary", "active"].includes(release.status)), [state.releases]);
  const selectedRelease = useMemo(() => selectableReleases.find((release) => release.id === releaseId) ?? null, [releaseId, selectableReleases]);
  const selectedConfig = useMemo(() => state.configs.find((config) => config.releaseId === releaseId) ?? null, [releaseId, state.configs]);
  const canaryRelease = useMemo(() => state.releases.find((release) => release.status === "canary") ?? null, [state.releases]);
  const releaseName = useCallback((id: string) => state.releases.find((release) => release.id === id)?.label ?? id.slice(0, 8), [state.releases]);
  const providerName = useCallback((id: string) => state.providers.find((provider) => provider.id === id)?.name ?? id, [state.providers]);

  useEffect(() => {
    if (!selectableReleases.some((release) => release.id === releaseId)) setReleaseId(selectableReleases[0]?.id ?? "");
  }, [releaseId, selectableReleases]);
  useEffect(() => {
    if (selectedConfig) {
      setProviderId(selectedConfig.providerId); setFallbackProviderIds(selectedConfig.fallbackProviderIds);
      setMaxOutputTokens(selectedConfig.maxOutputTokens); setFailureThreshold(selectedConfig.failureThreshold);
      setRecoveryTimeoutSeconds(selectedConfig.recoveryTimeoutSeconds); setHalfOpenSuccesses(selectedConfig.halfOpenSuccesses);
    } else {
      setProviderId(state.providers[0]?.id ?? ""); setFallbackProviderIds([]);
    }
  }, [selectedConfig, state.providers]);
  useEffect(() => {
    if (state.traffic?.enabled) setTrafficPercent(state.traffic.trafficPercent);
    else if (canaryRelease) setTrafficPercent(canaryRelease.trafficPercent);
  }, [canaryRelease, state.traffic]);

  async function action(work: () => Promise<void>) {
    setBusy(true); setError("");
    try { await work(); if (projectId) await loadState(projectId); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Aktion fehlgeschlagen."); }
    finally { setBusy(false); }
  }
  async function configure() {
    if (!releaseId || !providerId) return;
    await action(async () => {
      await responseJson(await fetch("/api/deployment", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "configure", releaseId, providerId, fallbackProviderIds, maxOutputTokens,
          failureThreshold, recoveryTimeoutSeconds, halfOpenSuccesses,
          ...(selectedConfig ? { expectedVersion: selectedConfig.version } : {}) }) }));
    });
  }
  async function setTraffic() {
    if (!canaryRelease) return;
    await action(async () => {
      await responseJson(await fetch("/api/deployment", { method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "set_traffic", projectId, releaseId: canaryRelease.id, trafficPercent,
          ...(state.traffic ? { expectedVersion: state.traffic.version } : {}) }) }));
    });
  }
  async function clearTraffic() {
    if (!state.traffic) return;
    await action(async () => {
      await responseJson(await fetch("/api/deployment", { method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "clear_traffic", projectId, expectedVersion: state.traffic?.version }) }));
    });
  }
  async function resetCircuit(circuit: Circuit) {
    await action(async () => {
      await responseJson(await fetch("/api/deployment", { method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "reset_breaker", releaseId: circuit.releaseId, providerId: circuit.providerId, expectedVersion: circuit.version }) }));
    });
  }
  async function execute() {
    await action(async () => {
      const response = await responseJson<{ releaseId: string; providerId: string; text: string; latencyMs: number; source: string; attemptCount: number }>(
        await fetch("/api/deployment", { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "execute", projectId, routingKey, instructions,
            messages: [{ role: "user", content: prompt }], maxOutputTokens: 1024, responseFormat: "text" }) }),
      );
      setResult(`${response.text}\n\nRelease ${releaseName(response.releaseId)} · ${providerName(response.providerId)} · ${response.attemptCount} Versuch(e) · ${response.latencyMs} ms`);
    });
  }
  function toggleFallback(id: string) {
    setFallbackProviderIds((current) => current.includes(id) ? current.filter((entry) => entry !== id) : current.length < 3 ? [...current, id] : current);
  }

  return (
    <section className="deployment-control-plane">
      <div className="deployment-hero">
        <div>
          <p className="section-kicker">REACT CONTROL PLANE · V0.20.0</p>
          <h1>Produktive KI-Routen sichtbar und kontrollierbar.</h1>
          <p>{displayName}: React zeigt Live-Metriken und Request-Traces, steuert Canary-Traffic und konfiguriert ausfallsichere Provider-Ketten ohne geheime Schlüssel im Browser.</p>
        </div>
        <div className="deployment-live" aria-live="polite"><span className="live-dot" />Live · {formatTime(lastUpdated)}</div>
      </div>

      {error ? <div className="tools-error">{error}</div> : null}
      <div className="deployment-project-bar">
        <label>Projekt<select value={projectId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setProjectId(event.target.value)}>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select></label>
        <span>{state.providers.length} Provider · {state.releases.length} Releases · {state.recentRequests.length} Traces</span>
      </div>

      <div className="deployment-metrics">
        {state.metrics.map((metric) => <article key={metric.minutes} className="metric-card">
          <p>{windowLabel(metric.minutes)}</p><strong>{successPercent(metric.successRateBps)}</strong>
          <span>{metric.requests} Requests · P95 {metric.p95LatencyMs} ms</span>
        </article>)}
        <article className="metric-card metric-card-accent"><p>Routing</p><strong>{state.traffic?.enabled ? `${state.traffic.trafficPercent} %` : "AUTO"}</strong>
          <span>{canaryRelease ? `${canaryRelease.label} · TankBench ${canaryRelease.trafficPercent} %` : "Kein Canary aktiv"}</span></article>
      </div>

      <div className="deployment-grid">
        <article className="deployment-panel deployment-config-panel">
          <div className="panel-heading"><div><p>01 · RELEASE ROUTE</p><h2>Provider-Kette</h2></div><span>{selectedConfig ? `v${selectedConfig.version}` : "neu"}</span></div>
          <label>Release<select value={releaseId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setReleaseId(event.target.value)}>
            {selectableReleases.map((release) => <option key={release.id} value={release.id}>{release.label} · {statusLabel(release.status)}</option>)}
          </select></label>
          <label>Primärer Provider<select value={providerId} onChange={(event: ChangeEvent<HTMLSelectElement>) => { setProviderId(event.target.value); setFallbackProviderIds((current) => current.filter((id) => id !== event.target.value)); }}>
            {state.providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name} · {provider.model}</option>)}
          </select></label>
          <fieldset className="fallback-fieldset"><legend>Fallback-Reihenfolge · maximal 3</legend>
            {state.providers.filter((provider) => provider.id !== providerId).map((provider) => <label key={provider.id} className="fallback-option">
              <input type="checkbox" checked={fallbackProviderIds.includes(provider.id)} onChange={() => toggleFallback(provider.id)} />
              <span>{fallbackProviderIds.includes(provider.id) ? `${fallbackProviderIds.indexOf(provider.id) + 1}. ` : ""}{provider.name}<small>{provider.model}</small></span>
            </label>)}
          </fieldset>
          <div className="compact-form-grid">
            <label>Max. Tokens<input type="number" min={64} max={32768} value={maxOutputTokens} onChange={(event: ChangeEvent<HTMLInputElement>) => setMaxOutputTokens(Number(event.target.value))} /></label>
            <label>Fehlergrenze<input type="number" min={1} max={20} value={failureThreshold} onChange={(event: ChangeEvent<HTMLInputElement>) => setFailureThreshold(Number(event.target.value))} /></label>
            <label>Recovery Sekunden<input type="number" min={5} max={3600} value={recoveryTimeoutSeconds} onChange={(event: ChangeEvent<HTMLInputElement>) => setRecoveryTimeoutSeconds(Number(event.target.value))} /></label>
            <label>Probe-Erfolge<input type="number" min={1} max={10} value={halfOpenSuccesses} onChange={(event: ChangeEvent<HTMLInputElement>) => setHalfOpenSuccesses(Number(event.target.value))} /></label>
          </div>
          <button className="primary-button" disabled={busy || !selectedRelease || !providerId} onClick={() => void configure()}>Provider-Route speichern</button>
          {selectedConfig ? <code className="config-hash">SHA-256 {selectedConfig.configSha256}</code> : null}
        </article>

        <article className="deployment-panel">
          <div className="panel-heading"><div><p>02 · TRAFFIC</p><h2>Canary verschieben</h2></div><span>{state.traffic?.enabled ? "MANUELL" : "TANKBENCH"}</span></div>
          {canaryRelease ? <>
            <div className="traffic-readout"><strong>{trafficPercent} %</strong><span>{canaryRelease.label}</span></div>
            <input className="traffic-range" aria-label="Canary-Traffic" type="range" min={0} max={100} step={5} value={trafficPercent} onChange={(event: ChangeEvent<HTMLInputElement>) => setTrafficPercent(Number(event.target.value))} />
            <div className="traffic-presets">{[0, 5, 25, 50, 100].map((value) => <button key={value} onClick={() => setTrafficPercent(value)}>{value} %</button>)}</div>
            <button className="primary-button" disabled={busy} onClick={() => void setTraffic()}>Traffic atomar setzen</button>
            <button disabled={busy || !state.traffic?.enabled} onClick={() => void clearTraffic()}>TankBench-Automatik verwenden</button>
            <p className="panel-note">Das manuelle Prozent ändert keine Promotion. Safety- und Gesundheitsgates bleiben aktiv.</p>
          </> : <div className="empty-state">Kein Release befindet sich im Canary-Status.</div>}
        </article>

        <article className="deployment-panel deployment-test-panel">
          <div className="panel-heading"><div><p>03 · LIVE REQUEST</p><h2>Route prüfen</h2></div><span>ECHTER PROVIDER</span></div>
          <label>Routing-ID<input value={routingKey} onChange={(event: ChangeEvent<HTMLInputElement>) => setRoutingKey(event.target.value)} /></label>
          <label>Systemanweisung<textarea rows={3} value={instructions} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setInstructions(event.target.value)} /></label>
          <label>Nutzereingabe<textarea rows={5} value={prompt} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setPrompt(event.target.value)} /></label>
          <button className="primary-button" disabled={busy || !projectId || !routingKey || !prompt} onClick={() => void execute()}>Produktiven Request ausführen</button>
          <pre className="deployment-result">{result || "Antwort und tatsächlich gewählte Route erscheinen hier."}</pre>
        </article>
      </div>

      <section className="deployment-panel deployment-breakers">
        <div className="panel-heading"><div><p>04 · CIRCUIT BREAKERS</p><h2>Provider-Gesundheit</h2></div><span>{state.circuits.filter((circuit) => circuit.state !== "closed").length} auffällig</span></div>
        <div className="breaker-grid">{state.circuits.length ? state.circuits.map((circuit) => <article key={circuit.id} className={`breaker-card breaker-${circuit.state}`}>
          <div><span className="status-pill">{statusLabel(circuit.state)}</span><h3>{providerName(circuit.providerId)}</h3><p>{releaseName(circuit.releaseId)}</p></div>
          <dl><div><dt>Fehlerfolge</dt><dd>{circuit.consecutiveFailures}</dd></div><div><dt>Nächste Probe</dt><dd>{formatTime(circuit.nextProbeAt)}</dd></div></dl>
          <button disabled={busy || circuit.state === "closed" && circuit.consecutiveFailures === 0} onClick={() => void resetCircuit(circuit)}>Zurücksetzen</button>
        </article>) : <div className="empty-state">Circuit-Zustände entstehen beim ersten produktiven Provider-Aufruf.</div>}</div>
      </section>

      <section className="deployment-panel deployment-traces">
        <div className="panel-heading"><div><p>05 · REQUEST TRACES</p><h2>Letzte produktive Ausführungen</h2></div><span>Hashes statt Inhalte</span></div>
        <div className="trace-list">{state.recentRequests.length ? state.recentRequests.map((trace) => <details key={trace.id} className={`trace-row trace-${trace.status}`}>
          <summary><span className="trace-status">{statusLabel(trace.status)}</span><strong>{providerName(trace.providerId)}</strong><span>{releaseName(trace.releaseId)}</span><span>{trace.source}</span><span>{trace.attemptCount} Versuch(e)</span><span>{trace.latencyMs} ms</span><time>{formatTime(trace.createdAt)}</time></summary>
          <div className="attempt-list">{trace.attempts.map((attempt) => <div key={`${trace.id}-${attempt.ordinal}`}>
            <span>#{attempt.ordinal}</span><strong>{providerName(attempt.providerId)}</strong><span>{statusLabel(attempt.status)}</span><span>{attempt.latencyMs} ms</span><code>{attempt.errorCode ?? "OK"}</code>
          </div>)}</div>
        </details>) : <div className="empty-state">Noch keine produktiven Request-Receipts vorhanden.</div>}</div>
      </section>
    </section>
  );
}
