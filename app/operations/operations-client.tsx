"use client";

import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";

type Policy = {
  id: string; projectId: string; rateLimitPerMinute: number; maxConcurrency: number;
  inflightLeaseSeconds: number; sloWindowMinutes: number; sloMinRequests: number;
  minSuccessRateBps: number; maxP95LatencyMs: number; alertCooldownMinutes: number;
  enabled: boolean; version: number;
};
type Snapshot = {
  requestCount: number; successRateBps: number; p95LatencyMs: number; status: "healthy" | "breached" | "insufficient";
  windowStartedAt: string; windowEndedAt: string;
};
type Alert = {
  id: string; kind: string; status: "open" | "acknowledged" | "resolved"; severity: "warning" | "critical";
  message: string; observedValue: number; thresholdValue: number; version: number; lastSeenAt: string;
};
type DeadLetter = {
  id: string; toolName: string; inputSha256: string; errorCode: string | null; errorMessage: string | null;
  attempt: number; maxAttempts: number; version: number; createdAt: string;
};
type ReplayLease = { id: string; projectId: string | null; scope: "account" | "project"; toolName: string; remainingUses: number; expiresAt: string };
type State = {
  policy: Policy;
  admission: { windowStart: string; requestCount: number; rejectedCount: number; inFlight: number };
  latestSnapshot: Snapshot | null; alerts: Alert[]; deadLetters: DeadLetter[]; replayLeases: ReplayLease[];
  recentEvents: Array<Record<string, unknown>>;
};

const EMPTY_PROJECT = "";
function formatTime(value: unknown): string {
  if (typeof value !== "string") return "—";
  const date = new Date(value); return Number.isNaN(date.valueOf()) ? "—" : date.toLocaleString("de-DE");
}
function alertLabel(kind: string): string {
  return ({ success_rate: "Erfolgsrate", latency: "P95-Latenz", rate_limit: "Rate Limit", concurrency: "Backpressure", dead_letter: "Dead Letter" } as Record<string, string>)[kind] ?? kind;
}

export default function OperationsClient({ displayName }: { displayName: string }) {
  const [projectId, setProjectId] = useState(EMPTY_PROJECT);
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [form, setForm] = useState<Policy | null>(null);
  const [replayLeaseByJob, setReplayLeaseByJob] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!projectId.trim()) return;
    try {
      const response = await fetch(`/api/operations?projectId=${encodeURIComponent(projectId.trim())}`, { cache: "no-store" });
      const payload = await response.json() as State & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Operations-Status konnte nicht geladen werden.");
      setState(payload); setForm(payload.policy); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Operations-Status konnte nicht geladen werden."); }
  }, [projectId]);

  useEffect(() => { if (!projectId.trim()) return; void load(); const timer = setInterval(() => void load(), 5_000); return () => clearInterval(timer); }, [load, projectId]);

  async function mutate(method: "POST" | "PATCH", body: Record<string, unknown>): Promise<Record<string, unknown>> {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/operations", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as Record<string, unknown> & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Operations-Aktion fehlgeschlagen.");
      await load(); return payload;
    } finally { setBusy(false); }
  }

  async function savePolicy() {
    if (!form) return;
    try { await mutate("POST", { action: "configure", projectId, rateLimitPerMinute: form.rateLimitPerMinute, maxConcurrency: form.maxConcurrency, inflightLeaseSeconds: form.inflightLeaseSeconds, sloWindowMinutes: form.sloWindowMinutes, sloMinRequests: form.sloMinRequests, minSuccessRateBps: form.minSuccessRateBps, maxP95LatencyMs: form.maxP95LatencyMs, alertCooldownMinutes: form.alertCooldownMinutes, enabled: form.enabled, expectedVersion: form.version }); setNotice("Operations-Richtlinie atomar aktualisiert."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Richtlinie konnte nicht gespeichert werden."); }
  }
  async function evaluate() {
    try { await mutate("POST", { action: "evaluate", projectId }); setNotice("SLO-Fenster neu ausgewertet."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "SLO-Auswertung fehlgeschlagen."); }
  }
  async function acknowledge(alert: Alert) {
    try { await mutate("PATCH", { action: "acknowledge_alert", projectId, alertId: alert.id, expectedVersion: alert.version }); setNotice("Alert bestätigt."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Alert konnte nicht bestätigt werden."); }
  }
  async function replay(job: DeadLetter) {
    const leaseId = replayLeaseByJob[job.id];
    if (!leaseId) { setError("Für den Replay muss eine passende aktive Tool-Freigabe gewählt werden."); return; }
    try { const payload = await mutate("POST", { action: "replay_dead_letter", projectId, sourceJobId: job.id, leaseId, expectedVersion: job.version }); setNotice(`Replay ${String(payload.replayJobId ?? "") } wurde eingereiht.`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Dead-Letter-Replay fehlgeschlagen."); }
  }
  async function downloadAudit() {
    if (!projectId.trim()) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/operations?projectId=${encodeURIComponent(projectId.trim())}&export=1`, { cache: "no-store" });
      if (!response.ok) { const payload = await response.json() as { error?: string }; throw new Error(payload.error ?? "Audit-Export fehlgeschlagen."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = url; link.download = `tankai-operations-audit-${projectId.trim()}.json`; document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      setNotice("Redigierter Audit-Export erzeugt."); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Audit-Export fehlgeschlagen."); }
    finally { setBusy(false); }
  }

  const openAlerts = useMemo(() => state?.alerts.filter((alert) => alert.status !== "resolved") ?? [], [state]);
  const rateUsage = state && form ? Math.min(100, Math.round(state.admission.requestCount / Math.max(1, form.rateLimitPerMinute) * 100)) : 0;

  return <section className="operations-control-plane">
    <header className="operations-hero">
      <div><p className="section-kicker">RELIABILITY & OPERATIONS · V0.20.0</p><h1>Last begrenzen. SLOs beweisen. Fehler reparieren.</h1>
        <p>Admission Control schützt den Providerpfad vor Überlast. Persistente SLO-Snapshots und deduplizierte Alerts zeigen den realen Gesundheitszustand. Dead Letters werden nur mit einer neuen, passenden Tool-Freigabe erneut ausgeführt.</p></div>
      <div className="deployment-live"><span className="live-dot" />{displayName} · 5-Sekunden-Takt</div>
    </header>

    <div className="deployment-project-bar"><label>Projekt-ID<input value={projectId} placeholder="Projekt-UUID" onChange={(event: ChangeEvent<HTMLInputElement>) => setProjectId(event.target.value)} /></label><button className="primary-button" disabled={!projectId.trim() || busy} onClick={() => void load()}>Status laden</button></div>
    {error ? <p className="tools-error">{error}</p> : null}{notice ? <p className="operations-notice">{notice}</p> : null}

    {state && form ? <>
      <section className="operations-metrics">
        <article><p>Admission-Fenster</p><strong>{state.admission.requestCount} / {form.rateLimitPerMinute}</strong><span>{rateUsage} % · {state.admission.rejectedCount} abgewiesen</span></article>
        <article><p>In-flight</p><strong>{state.admission.inFlight} / {form.maxConcurrency}</strong><span>Lease {form.inflightLeaseSeconds} Sekunden</span></article>
        <article className={`operations-health health-${state.latestSnapshot?.status ?? "insufficient"}`}><p>SLO</p><strong>{state.latestSnapshot ? `${(state.latestSnapshot.successRateBps / 100).toFixed(2)} %` : "—"}</strong><span>P95 {state.latestSnapshot?.p95LatencyMs ?? 0} ms · {state.latestSnapshot?.status ?? "noch nicht gemessen"}</span></article>
        <article><p>Offene Signale</p><strong>{openAlerts.length}</strong><span>{state.deadLetters.length} Dead Letter</span></article>
      </section>

      <div className="operations-grid">
        <article className="deployment-panel operations-policy-panel"><div className="panel-heading"><div><p>01 · ADMISSION & SLO</p><h2>Operations-Richtlinie</h2></div><span>VERSION {form.version}</span></div>
          <div className="operations-form-grid">
            <label>Requests / Minute<input type="number" value={form.rateLimitPerMinute} onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, rateLimitPerMinute: Number(e.target.value) })} /></label>
            <label>Max. gleichzeitig<input type="number" value={form.maxConcurrency} onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, maxConcurrency: Number(e.target.value) })} /></label>
            <label>In-flight-Lease s<input type="number" value={form.inflightLeaseSeconds} onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, inflightLeaseSeconds: Number(e.target.value) })} /></label>
            <label>SLO-Fenster min<input type="number" value={form.sloWindowMinutes} onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, sloWindowMinutes: Number(e.target.value) })} /></label>
            <label>Min. Requests<input type="number" value={form.sloMinRequests} onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, sloMinRequests: Number(e.target.value) })} /></label>
            <label>Erfolgsrate bps<input type="number" value={form.minSuccessRateBps} onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, minSuccessRateBps: Number(e.target.value) })} /></label>
            <label>Max. P95 ms<input type="number" value={form.maxP95LatencyMs} onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, maxP95LatencyMs: Number(e.target.value) })} /></label>
            <label>Alert-Cooldown min<input type="number" value={form.alertCooldownMinutes} onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, alertCooldownMinutes: Number(e.target.value) })} /></label>
          </div>
          <label className="operations-toggle"><input type="checkbox" checked={form.enabled} onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, enabled: e.target.checked })} /><span>Admission Control aktiv</span></label>
          <div className="operations-actions"><button className="primary-button" disabled={busy} onClick={() => void savePolicy()}>Richtlinie speichern</button><button disabled={busy} onClick={() => void evaluate()}>SLO jetzt auswerten</button><button disabled={busy} onClick={() => void downloadAudit()}>Audit exportieren</button></div>
        </article>

        <article className="deployment-panel"><div className="panel-heading"><div><p>02 · ALERTS</p><h2>Aktive Signale</h2></div><span>{openAlerts.length} AKTIV</span></div>
          <div className="operations-alert-list">{state.alerts.length ? state.alerts.map((alert) => <article key={alert.id} className={`operations-alert alert-${alert.severity} alert-${alert.status}`}>
            <div><span>{alertLabel(alert.kind)}</span><strong>{alert.severity}</strong></div><p>{alert.message}</p><small>{alert.observedValue} / Schwelle {alert.thresholdValue} · {formatTime(alert.lastSeenAt)}</small>
            {alert.status === "open" ? <button disabled={busy} onClick={() => void acknowledge(alert)}>Bestätigen</button> : <em>{alert.status}</em>}
          </article>) : <div className="empty-state">Keine Alerts vorhanden.</div>}</div>
        </article>
      </div>

      <section className="deployment-panel operations-deadletters"><div className="panel-heading"><div><p>03 · DEAD LETTER QUEUE</p><h2>Kontrollierter Replay</h2></div><span>NEUE LEASE PFLICHT</span></div>
        <div className="deadletter-list">{state.deadLetters.length ? state.deadLetters.map((job) => {
          const matching = state.replayLeases.filter((lease) => lease.toolName === job.toolName && (lease.scope === "account" || lease.projectId === projectId));
          return <article key={job.id}><div><span className="status-pill">{job.toolName}</span><strong>{job.errorCode ?? "DEAD_LETTER"}</strong><p>{job.errorMessage ?? "Kein Klartextfehler gespeichert."}</p><code>{job.inputSha256}</code></div>
            <div><label>Neue Tool-Freigabe<select value={replayLeaseByJob[job.id] ?? ""} onChange={(e: ChangeEvent<HTMLSelectElement>) => setReplayLeaseByJob({ ...replayLeaseByJob, [job.id]: e.target.value })}><option value="">Freigabe wählen</option>{matching.map((lease) => <option key={lease.id} value={lease.id}>{lease.id.slice(0, 8)} · {lease.remainingUses} Nutzung(en) · {lease.scope}</option>)}</select></label><button disabled={busy || !replayLeaseByJob[job.id]} onClick={() => void replay(job)}>Als neuen Job einreihen</button></div>
          </article>;
        }) : <div className="empty-state">Keine Dead-Letter-Aufträge im Projekt.</div>}</div>
      </section>

      <section className="deployment-panel operations-events"><div className="panel-heading"><div><p>04 · OPERATIONS RECEIPTS</p><h2>Letzte Zustandsänderungen</h2></div><span>APPEND ONLY</span></div>
        <div>{state.recentEvents.length ? state.recentEvents.map((event, index) => <article key={`${String(event.created_at)}-${index}`}><strong>{String(event.event_type ?? "event")}</strong><span>{String(event.note ?? "")}</span><time>{formatTime(event.created_at)}</time></article>) : <div className="empty-state">Noch keine Operations-Events.</div>}</div>
      </section>
    </> : <div className="empty-state operations-empty">Projekt-ID eintragen, um die Operations-Control-Plane zu laden.</div>}
  </section>;
}
