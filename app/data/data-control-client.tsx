"use client";

import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type DataRequest = {
  id: string;
  type: "export" | "deletion";
  status:
    | "requested"
    | "scheduled"
    | "executing"
    | "completed"
    | "cancelled"
    | "failed";
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
};

type RetentionGroup = {
  id: string;
  title: string;
  datasets: string[];
  activeRetention: string;
  deletion: string;
};

type DataControlState = {
  contractVersion: string;
  release: string;
  accountFrozen: boolean;
  activeDeletion: DataRequest | null;
  requests: DataRequest[];
  retentionPolicy: {
    version: string;
    scope: string;
    deletionGraceHours: number;
    groups: RetentionGroup[];
    retainedProof: {
      dataset: string;
      fields: string[];
      userIdentifierStored: boolean;
      userContentStored: boolean;
      retention: string;
    };
    externalBoundaries: Array<{
      system: string;
      coveredByReceipt: boolean;
      statement: string;
    }>;
  };
  exportContract: {
    datasetCount: number;
    snapshot: string;
    perDatasetSha256: boolean;
    payloadSha256: boolean;
    ephemeralCredentialsExported: boolean;
  };
};

type Verification = {
  valid: boolean;
  receiptId: string;
  reportSha256?: string;
  proofSha256?: string;
  deletedRowCount?: number;
  datasetCount?: number;
  softwareRelease?: string;
  completedAt?: string;
  scope?: string;
  externalSystemsCovered?: boolean;
  statement?: string;
};

function formatTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "—"
    : date.toLocaleString("de-DE");
}

function statusLabel(status: DataRequest["status"]): string {
  return (
    {
      requested: "Bestätigung offen",
      scheduled: "Widerrufsfrist",
      executing: "Löschung läuft",
      completed: "Abgeschlossen",
      cancelled: "Abgebrochen",
      failed: "Fehlgeschlagen",
    } as Record<DataRequest["status"], string>
  )[status];
}

function fileNameFrom(response: Response, fallback: string): string {
  const header = response.headers.get("content-disposition") ?? "";
  const match = /filename="([^"]+)"/iu.exec(header);
  return match?.[1] ?? fallback;
}

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? "Datenaktion fehlgeschlagen.";
  } catch {
    return "Datenaktion fehlgeschlagen.";
  }
}

export default function DataControlClient({
  displayName,
}: {
  displayName: string;
}) {
  const [state, setState] = useState<DataControlState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [receiptId, setReceiptId] = useState("");
  const [reportSha256, setReportSha256] = useState("");
  const [verification, setVerification] = useState<Verification | null>(null);
  const [clock, setClock] = useState(() => Date.now());

  const load = useCallback(async () => {
    const response = await fetch("/api/data-control", { cache: "no-store" });
    const payload = (await response.json()) as DataControlState & {
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error ?? "Datenstatus konnte nicht geladen werden.");
    }
    setState(payload);
    setError("");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Datenstatus konnte nicht geladen werden.",
        ),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  async function postJson<T>(body: Record<string, unknown>): Promise<T> {
    const response = await fetch("/api/data-control", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(await errorMessage(response));
    return (await response.json()) as T;
  }

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Datenaktion fehlgeschlagen.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function downloadExport() {
    await run(async () => {
      const response = await fetch("/api/data-control", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "export" }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      saveBlob(
        await response.blob(),
        fileNameFrom(response, "tankai-user-data.json"),
      );
      setNotice("Vollständiger D1-Datenexport mit SHA-256-Manifest erzeugt.");
      await load();
    });
  }

  async function requestDeletion() {
    await run(async () => {
      const request = await postJson<DataRequest>({
        action: "request_deletion",
      });
      setConfirmation("");
      setNotice(
        "Löschauftrag angelegt. Das Konto ist bis Bestätigung oder Abbruch eingefroren.",
      );
      await load();
      if (request.confirmationPhrase) setConfirmation("");
    });
  }

  async function confirmDeletion(request: DataRequest) {
    await run(async () => {
      await postJson<DataRequest>({
        action: "confirm_deletion",
        requestId: request.id,
        expectedVersion: request.version,
        confirmationPhrase: confirmation,
      });
      setConfirmation("");
      setNotice(
        `Löschung bestätigt. Die ${state?.retentionPolicy.deletionGraceHours ?? 24}-Stunden-Widerrufsfrist läuft.`,
      );
      await load();
    });
  }

  async function cancelDeletion(request: DataRequest) {
    await run(async () => {
      await postJson<DataRequest>({
        action: "cancel_deletion",
        requestId: request.id,
        expectedVersion: request.version,
      });
      setConfirmation("");
      setNotice("Löschauftrag abgebrochen. Das Konto ist wieder freigegeben.");
      await load();
    });
  }

  async function executeDeletion(request: DataRequest) {
    await run(async () => {
      const response = await fetch("/api/data-control", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "execute_deletion",
          requestId: request.id,
          expectedVersion: request.version,
        }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      saveBlob(
        await response.blob(),
        fileNameFrom(response, "tankai-deletion-receipt.json"),
      );
      setNotice(
        "TankAI-Anwendungsdaten gelöscht und Löschbeleg heruntergeladen.",
      );
      await load();
    });
  }

  async function verifyReceipt() {
    await run(async () => {
      const result = await postJson<Verification>({
        action: "verify_deletion_receipt",
        receiptId,
        reportSha256,
      });
      setVerification(result);
      setNotice(
        result.valid
          ? "Der Löschbeleg stimmt mit dem gespeicherten Integritätsbeleg überein."
          : "Kein passender Integritätsbeleg gefunden.",
      );
    });
  }

  const active = state?.activeDeletion ?? null;
  const readyToExecute = Boolean(
    active?.status === "scheduled" &&
      active.executeAfter &&
      Date.parse(active.executeAfter) <= clock,
  );
  const exportRequests = useMemo(
    () => state?.requests.filter((request) => request.type === "export") ?? [],
    [state],
  );

  return (
    <section className="data-control">
      <header className="data-control-hero">
        <div>
          <p className="section-kicker">DATA CONTROL · V0.24.0</p>
          <h1>Daten besitzen. Export prüfen. Löschung beweisen.</h1>
          <p>
            {displayName}: TankAI exportiert den vollständigen registrierten
            D1-Kontodatensatz, hasht jede Datenmenge einzeln und löscht erst nach
            klarer Bestätigung plus Widerrufsfrist.
          </p>
        </div>
        <div className={state?.accountFrozen ? "data-state frozen" : "data-state"}>
          <span className="live-dot" />
          {state?.accountFrozen ? "KONTO EINGEFROREN" : "KONTO AKTIV"}
        </div>
      </header>

      {error ? <p className="tools-error">{error}</p> : null}
      {notice ? <p className="operations-notice">{notice}</p> : null}

      <section className="data-metrics">
        <article>
          <span>Register</span>
          <strong>{state?.exportContract.datasetCount ?? "—"}</strong>
          <small>Datenmengen explizit erfasst</small>
        </article>
        <article>
          <span>Integrität</span>
          <strong>SHA-256</strong>
          <small>Pro Datenmenge + Gesamtdatei</small>
        </article>
        <article>
          <span>Widerruf</span>
          <strong>{state?.retentionPolicy.deletionGraceHours ?? 24} h</strong>
          <small>Vor endgültiger Löschung</small>
        </article>
        <article>
          <span>Externe Systeme</span>
          <strong>0 behauptet</strong>
          <small>Keine falsche Löschzusage</small>
        </article>
      </section>

      <div className="data-control-grid">
        <article className="deployment-panel data-export-panel">
          <div className="panel-heading">
            <div>
              <p>01 · PORTABILITÄT</p>
              <h2>Vollständiger Nutzerexport</h2>
            </div>
            <span>SINGLE SNAPSHOT</span>
          </div>
          <p>
            Enthält Gespräche, Projekte, Dokumente, Gedächtnis, Freigaben,
            Werkzeugläufe, TankBench- und Operationsbelege. Flüchtige
            Zugangstokens werden nicht exportiert und im Manifest ausgewiesen.
          </p>
          <ul className="data-check-list">
            <li>Transaktionaler D1-Lese-Snapshot</li>
            <li>Zeilenzahl und SHA-256 je Datenmenge</li>
            <li>Gesamt-Hash und Export-Receipt</li>
            <li>Klare Grenze zu Hosting- und Providerdaten</li>
          </ul>
          <button
            className="primary-button"
            disabled={busy || Boolean(state?.accountFrozen)}
            onClick={() => void downloadExport()}
          >
            JSON-Export erzeugen
          </button>
          {exportRequests[0] ? (
            <div className="data-last-receipt">
              <span>Letzter Export</span>
              <strong>{formatTime(exportRequests[0].completedAt)}</strong>
              <code>{exportRequests[0].payloadSha256}</code>
            </div>
          ) : null}
        </article>

        <article className="deployment-panel data-delete-panel">
          <div className="panel-heading">
            <div>
              <p>02 · LÖSCHUNG</p>
              <h2>Kontodatensatz löschen</h2>
            </div>
            <span>2 SCHRITTE + 24 H</span>
          </div>
          {!active ? (
            <>
              <p>
                Der Auftrag stoppt neue TankAI-Aktionen. Erst nach Eingabe einer
                individuellen Phrase beginnt die 24-Stunden-Widerrufsfrist.
              </p>
              <button
                className="danger-button"
                disabled={busy}
                onClick={() => void requestDeletion()}
              >
                Löschauftrag anlegen
              </button>
            </>
          ) : (
            <div className="deletion-flow">
              <div className={`deletion-status status-${active.status}`}>
                <span>{statusLabel(active.status)}</span>
                <strong>{active.id}</strong>
                <small>Version {active.version}</small>
              </div>
              {active.status === "requested" ? (
                <>
                  <p>
                    Tippe die Phrase exakt ein. Gültig bis{" "}
                    <strong>{formatTime(active.confirmBy)}</strong>.
                  </p>
                  <code className="confirmation-phrase">
                    {active.confirmationPhrase}
                  </code>
                  <label>
                    Bestätigungsphrase
                    <input
                      value={confirmation}
                      autoComplete="off"
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setConfirmation(event.target.value)
                      }
                    />
                  </label>
                  <div className="data-actions">
                    <button
                      className="danger-button"
                      disabled={
                        busy ||
                        confirmation.trim() !== active.confirmationPhrase
                      }
                      onClick={() => void confirmDeletion(active)}
                    >
                      Löschung bestätigen
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void cancelDeletion(active)}
                    >
                      Auftrag abbrechen
                    </button>
                  </div>
                </>
              ) : null}
              {active.status === "scheduled" ? (
                <>
                  <p>
                    Endgültige Ausführung ab{" "}
                    <strong>{formatTime(active.executeAfter)}</strong>. Bis
                    dahin kann der Auftrag vollständig abgebrochen werden.
                  </p>
                  <div className="data-actions">
                    <button
                      className="danger-button"
                      disabled={busy || !readyToExecute}
                      onClick={() => void executeDeletion(active)}
                    >
                      Jetzt endgültig löschen
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void cancelDeletion(active)}
                    >
                      Auftrag abbrechen
                    </button>
                  </div>
                </>
              ) : null}
              {active.status === "executing" ? (
                <p>Die atomare Löschung wird abgeschlossen und geprüft.</p>
              ) : null}
            </div>
          )}
        </article>
      </div>

      <section className="deployment-panel retention-panel">
        <div className="panel-heading">
          <div>
            <p>03 · AUFBEWAHRUNGSREGISTER</p>
            <h2>Was TankAI speichert und wie es gelöscht wird</h2>
          </div>
          <span>POLICY {state?.retentionPolicy.version ?? "—"}</span>
        </div>
        <div className="retention-grid">
          {state?.retentionPolicy.groups.map((group) => (
            <article key={group.id}>
              <span>{group.datasets.length} DATENMENGEN</span>
              <h3>{group.title}</h3>
              <p>{group.activeRetention}</p>
              <small>{group.deletion}</small>
            </article>
          ))}
        </div>
        <div className="external-boundaries">
          <h3>Ehrliche Beweisgrenze</h3>
          {state?.retentionPolicy.externalBoundaries.map((boundary) => (
            <article key={boundary.system}>
              <strong>{boundary.system}</strong>
              <span>Nicht vom D1-Löschbeleg abgedeckt</span>
              <p>{boundary.statement}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="deployment-panel receipt-verifier">
        <div className="panel-heading">
          <div>
            <p>04 · RECEIPT VERIFIER</p>
            <h2>Löschbeleg prüfen</h2>
          </div>
          <span>KEINE NUTZERKENNUNG GESPEICHERT</span>
        </div>
        <div className="receipt-form">
          <label>
            Receipt-ID
            <input
              value={receiptId}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setReceiptId(event.target.value)
              }
            />
          </label>
          <label>
            Report SHA-256
            <input
              value={reportSha256}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setReportSha256(event.target.value.trim().toLowerCase())
              }
            />
          </label>
          <button
            disabled={
              busy ||
              receiptId.trim().length !== 36 ||
              reportSha256.trim().length !== 64
            }
            onClick={() => void verifyReceipt()}
          >
            Beleg prüfen
          </button>
        </div>
        {verification ? (
          <div
            className={
              verification.valid
                ? "verification-result valid"
                : "verification-result invalid"
            }
          >
            <strong>
              {verification.valid
                ? "Integritätsbeleg gültig"
                : "Beleg nicht bestätigt"}
            </strong>
            <span>
              {verification.valid
                ? `${verification.deletedRowCount} Zeilen · ${verification.datasetCount} Datenmengen · ${formatTime(verification.completedAt ?? null)}`
                : verification.statement}
            </span>
          </div>
        ) : null}
      </section>
    </section>
  );
}
