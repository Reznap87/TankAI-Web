# TankAI Web v0.11.0 – Tool Jobs Release Receipt

Stand: 27. Juli 2026

## Verbindliche Identität

- Produkt: TankAI Web
- Release: 0.11.0
- Masterplan: 2.6.0
- Masterprompt: 2.1.0, unverändert
- Ausbau: fünfte R2-Scheibe – lease-geschützte Werkzeug- und Jobschicht

## Tatsächliche Änderungen

TankAI Web besitzt nun eine D1-persistente Werkzeugschicht, die externe oder riskante Werkzeuge
noch nicht vortäuscht. Die erste freigegebene Ausbaustufe umfasst vier reale, deterministische
Werkzeuge ohne Netzwerkzugriff:

- `text.sha256` – SHA-256 eines Textes mit Zeichen- und Bytezahl,
- `text.analyze` – Zeichen-, Codepoint-, Byte-, Wort- und Zeilenstatistik,
- `json.validate` – sichere JSON-Syntax- und Wurzeltypprüfung ohne Codeausführung,
- `memory.retention` – Anwendung der nutzereigenen Memory-Retention-Regeln.

Jede Ausführung benötigt eine eigene Tool Execution Lease mit exakter Nutzer-, Werkzeug-, Konto-
oder Projekt-, Zeit- und Nutzungsbindung. Der Verbrauch der Freigabe, die Anlage genau eines Jobs
und die initialen Lease-/Job-Receipts werden in einer atomaren Datenbankoperation gekoppelt.

Werkzeugaufträge besitzen:

- den Zustandsautomaten `queued → running → succeeded | failed | cancelled`,
- einen nutzergebundenen Idempotenzschlüssel und SHA-256 der normalisierten Eingabe,
- optimistische Versionen und exklusive Claim-Tokens,
- Fortschritt, Versuchsgrenze, Heartbeat, Verfügbarkeit und Abschlusszeit,
- höchstens drei Ausführungsversuche,
- Wiederaufnahme verwaister Claims nach fünf Minuten,
- append-only Events für Anlage, Claim, Erfolg, Fehler, Retry, Abbruch und Recovery.

Ein identisches Replay desselben Idempotenzschlüssels liefert den vorhandenen Job und verbraucht
keine weitere Lease-Nutzung. Derselbe Schlüssel mit abweichender Freigabe, Projektbindung,
Werkzeugart oder Eingabe wird abgewiesen. Erfolg und Fehler dürfen nur von dem Worker geschrieben
werden, dessen Claim-Token und erwartete Version weiterhin exakt gültig sind.

Die geschützte `/tools`-Oberfläche ermöglicht Werkzeugauswahl, Konto-/Projektbindung,
Einmalfreigabe, Jobanlage, Ausführung, Retry, Abbruch, Claim-Recovery und Einsicht in strukturierte
Resultate. Die öffentliche Statusroute weist ausdrücklich aus, dass nur deterministische
Werkzeuge aktiv sind, kein externer Netzwerkzugriff stattfindet und Fortschrittsstreaming noch
nicht implementiert ist.

## Neue Dateien und Migration

- `lib/tool-runtime.ts`
- `lib/tool-jobs.ts`
- `app/api/tool-leases/route.ts`
- `app/api/tool-jobs/route.ts`
- `app/tools/page.tsx`
- `app/tools/tools-client.tsx`
- `drizzle/0006_patient_tool_jobs.sql`
- `drizzle/meta/0006_snapshot.json`
- `tests/tool-jobs-contract.test.mjs`

## Ausgeführte Prüfungen in diesem Arbeitslauf

- TypeScript-Syntaxprüfung: 45 `.ts`-/`.tsx`-Dateien, 0 Syntaxfehler
- strikte TypeScript-Prüfung der Runtime-, Job-, Lease- und API-Schicht: bestanden
- separate TypeScript-Prüfung der geschützten Werkzeugoberfläche: bestanden
- D1-/SQLite-Migrationen 0000–0006 auf frischer Datenbank: 79 SQL-Schritte bestanden
- Tabellen-, Fremdschlüssel-, Scope-, Tool-, Status-, Größen- und Versionschecks: bestanden
- Source-/Produktverträge für Masterprompt, Masterplan, Memory und Tool Jobs: 14 von 14 bestanden
- funktionale Runtime-Prüfung für SHA-256, Textanalyse, gültiges/ungültiges JSON,
  Memory-Retention-Dispatch und Ablehnung unbekannter Eingabefelder: bestanden
- SQL-Lebenszyklus Lease → Queue → Claim → Success mit Events: bestanden
- Idempotenz-Replay ohne zweiten Nutzungsverbrauch: bestanden
- Claim- und Versionsschutz auch beim Fehlerabschluss: geprüft
- vollständige ZIP-Integritäts- und SHA-256-Prüfung: Bestandteil des externen Release-Receipts

## Externer Prüfblocker

Der vollständige `npm ci`-/Vinext-Lauf konnte in dieser Sitzung nicht erneut abgeschlossen werden.
Der konfigurierte interne npm-Paketproxy antwortete zuvor beim Paket
`zod-validation-error-4.0.2.tgz` mit HTTP 503; ein erneuter Registry-Probe lief in ein Timeout.
Dadurch konnten der komplette Produktionsbuild, ESLint sowie die gerenderten Browser-/Worker-Tests
für v0.11.0 nicht erneut ausgeführt werden.

Das ist kein festgestellter Quellcodefehler. Es ist aber ein offener externer Prüfblocker. Daher
wird für v0.11.0 weder ein erfolgreicher neuer Produktionsbuild noch ein neues Deployment
behauptet.

## Bewusste Grenzen

- Es gibt noch keine Browser-, Code-, Dokument-, Tabellen- oder MCP-Ausführung. Diese Werkzeuge
  werden erst einzeln auf die geprüfte Lease-/Job-Schicht gesetzt.
- Es gibt noch kein Fortschrittsstreaming. Kurze deterministische Jobs springen von Claim zu
  Abschluss; der persistente Fortschrittszustand ist bereits vorhanden.
- Verwaiste Claims werden kontrolliert wieder eingereiht, aber es läuft noch kein dauerhaft
  autonomer externer Queue-Worker.
- Binäre Dateiablage bleibt bis zur bewussten R2-/Kostenfreigabe deaktiviert.
- Allgemeine Export- und Löschpfade für sämtliche Produktdaten sind weiterhin offen.
