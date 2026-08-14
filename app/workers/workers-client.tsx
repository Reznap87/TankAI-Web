"use client";

import { useCallback, useEffect, useState } from "react";

type WorkerStatus = "active" | "draining" | "revoked";

interface WorkerRecord {
  id: string;
  name: string;
  status: WorkerStatus;
  maxConcurrency: number;
  version: number;
  lastSeenAt: string | null;
  createdAt: string;
}

interface WorkerEvent {
  id: string;
  workerId: string;
  type: string;
  workerVersion: number;
  note: string | null;
  createdAt: string;
}

async function responseJson<T>(response: Response): Promise<T> {
  const value = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(value.error ?? "Worker-Anfrage fehlgeschlagen.");
  }
  return value;
}

export default function WorkersClient({ displayName }: { displayName: string }) {
  const [workers, setWorkers] = useState<WorkerRecord[]>([]);
  const [events, setEvents] = useState<WorkerEvent[]>([]);
  const [name, setName] = useState("TankAI Worker");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const value = await responseJson<{
      workers: WorkerRecord[];
      events: WorkerEvent[];
    }>(await fetch("/api/workers", { cache: "no-store" }));
    setWorkers(value.workers);
    setEvents(value.events);
  }, []);

  useEffect(() => {
    void load().catch((loadError) => {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Workerstatus konnte nicht geladen werden.",
      );
    });
  }, [load]);

  async function register() {
    setBusy(true);
    setError("");
    setToken("");
    try {
      const value = await responseJson<{ token: string }>(
        await fetch("/api/workers", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, maxConcurrency: 1 }),
        }),
      );
      setToken(value.token);
      await load();
    } catch (registerError) {
      setError(
        registerError instanceof Error
          ? registerError.message
          : "Worker konnte nicht registriert werden.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function update(worker: WorkerRecord, status: WorkerStatus) {
    setBusy(true);
    setError("");
    try {
      await responseJson(
        await fetch("/api/workers", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            workerId: worker.id,
            expectedVersion: worker.version,
            status,
          }),
        }),
      );
      await load();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Workerstatus konnte nicht geändert werden.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="tools-workspace">
      <div className="tools-intro">
        <p className="section-kicker">TANKAI WORKER RUNTIME · V0.13</p>
        <h1>Persistente Worker für {displayName}</h1>
        <p>
          Worker-Tokens werden nur einmal angezeigt. In der Datenbank liegt
          ausschließlich ihr SHA-256-Hash.
        </p>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="tool-composer">
        <label>
          Worker-Name
          <input
            value={name}
            maxLength={80}
            onChange={(event: { target: { value: string } }) =>
              setName(event.target.value)
            }
          />
        </label>
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={() => void register()}
        >
          Worker registrieren
        </button>
      </div>

      {token ? (
        <div className="tool-result">
          <strong>
            Token – jetzt sicher speichern, später nicht erneut abrufbar
          </strong>
          <pre>{token}</pre>
        </div>
      ) : null}

      <div className="tool-job-list">
        {workers.map((worker) => (
          <article className="tool-job-card" key={worker.id}>
            <div>
              <strong>{worker.name}</strong>
              <span>
                {worker.status} · Parallelität {worker.maxConcurrency} · zuletzt{" "}
                {worker.lastSeenAt ?? "nie"}
              </span>
            </div>
            <div className="tool-job-actions">
              {worker.status === "active" ? (
                <button
                  disabled={busy}
                  onClick={() => void update(worker, "draining")}
                >
                  Draining
                </button>
              ) : null}
              {worker.status === "draining" ? (
                <button
                  disabled={busy}
                  onClick={() => void update(worker, "active")}
                >
                  Aktivieren
                </button>
              ) : null}
              {worker.status !== "revoked" ? (
                <button
                  disabled={busy}
                  onClick={() => void update(worker, "revoked")}
                >
                  Widerrufen
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      <div className="tool-result">
        <strong>Letzte Worker-Receipts</strong>
        <pre>{JSON.stringify(events.slice(0, 20), null, 2)}</pre>
      </div>
    </section>
  );
}
