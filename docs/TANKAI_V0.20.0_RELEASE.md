# TankAI Web v0.20.0 – Reliability & Operations

v0.20.0 schützt den produktiven Deployment-Pfad vor Überlast und macht seinen Betriebszustand dauerhaft, auswertbar und reparierbar.

## Admission Control

- projektgebundene Requests-pro-Minute-Grenze,
- maximale Zahl gleichzeitig laufender produktiver Requests,
- persistente In-flight-Leases mit begrenzter Laufzeit,
- Bereinigung verwaister Leases nach abgebrochenen oder verlorenen Requests,
- Ablehnung vor Routing und Providerarbeit, damit keine unnötigen Providerkosten entstehen.

Die Standardrichtlinie verwendet 60 Requests pro Minute, vier parallele Requests und 180 Sekunden In-flight-Lease. Alle Werte sind versioniert konfigurierbar.

## SLOs und Alerting

- SLO-Fenster aus realen `deployment_requests`,
- Mindestzahl von Beobachtungen,
- Erfolgsrate in Basispunkten,
- P95-Latenz,
- Zustände `healthy`, `breached` und `insufficient`,
- deduplizierte Alerts für Erfolgsrate, Latenz, Rate Limit, Concurrency und Dead Letter,
- Bestätigung, Cooldown und automatische Auflösung bei Recovery.

## Dead-Letter-Replay

Ein Dead-Letter-Job wird nicht mutiert oder zurückgesetzt. Der Replay:

1. prüft Nutzer, Projekt, Werkzeug und terminalen Zustand,
2. verlangt eine neue aktive, passende Tool Execution Lease,
3. verbraucht genau eine Lease-Nutzung atomar,
4. erzeugt einen neuen Job im Zustand `queued`,
5. speichert die Replay-Verknüpfung und append-only Receipts.

## Redigierter Audit-Export

Der JSON-Export enthält Richtlinien, Admission-Zähler, SLO-Snapshots, Alerts, Dead-Letter-Metadaten, Replay-Verknüpfungen und Operations-Events. Nicht enthalten sind Prompttexte, Providerantworten und Tool-Eingaben im Klartext.

## Oberfläche und API

- React-Control-Plane: `/operations`
- API: `/api/operations`
- Richtlinieneditor, Live-Zustand, Alertbestätigung, Dead-Letter-Replay und Audit-Download
- 5-Sekunden-Refresh ohne undeduplizierte Alert-Eventflut

## Datenbank

Migration `0015_reliability_operations.sql` ergänzt sieben Tabellen. Der vollständige frische Datenbankstand umfasst 227 Migrationsschritte. Das Upgrade von v0.19.0 erhält vorhandene Deployment-Konfigurationen, Requests, Attempts und Events.

## Verifikationsgrenze

Quell-, Runtime-, Migrations- und Strict-Type-Prüfungen werden im Build Receipt dokumentiert. Ein vollständiger Vinext-Produktionsbuild wird nur dann als bestanden ausgewiesen, wenn alle festgeschriebenen Pakete tatsächlich installiert und das Produktionsartefakt erfolgreich validiert wurden.
