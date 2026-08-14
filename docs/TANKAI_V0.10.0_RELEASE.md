# TankAI Web v0.10.0 – Memory Mesh Release Receipt

Stand: 27. Juli 2026

## Verbindliche Identität

- Produkt: TankAI Web
- Release: 0.10.0
- Masterplan: 2.5.0
- Masterprompt: 2.1.0, unverändert
- Ausbau: vierte R2-Scheibe – nutzereigenes Langzeitgedächtnis

## Tatsächliche Änderungen

TankAI Web besitzt nun ein D1-persistentes Langzeitgedächtnis mit drei Klassen:

- **episodisch:** beobachtete Nutzeranfrage und Endantwort eines abgeschlossenen Runs,
- **semantisch:** deterministisch extrahierte, zunächst unbestätigte Wissenskandidaten,
- **prozedural:** wiederverwendbare Planner-Muster aus vollständigen, nicht degradierten Teamläufen.

Jeder Eintrag besitzt Nutzer-ID, optional exakte Projektbindung, Run-/Goal-Provenienz,
SHA-256, Confidence, Verifikationsstatus, Retention-Klasse, Zugriffszähler, Version und ein
192-dimensionales quantisiertes Hash-Embedding. Recall berechnet Cosine-Relevanz ausschließlich
innerhalb des eigenen Konto- und gegebenenfalls Projektbereichs.

Automatisch erzeugte Semantic-/Procedural-Einträge beginnen als `candidate`; ein erfolgreicher
Modelllauf wird nicht mit Faktenverifikation verwechselt. Positive Nutzerbewertung bestätigt
rungebundene Kandidaten. Negative Bewertung bestreitet sie; eine ausdrückliche Korrektur kann als
separater `confirmed`-Eintrag gespeichert werden.

Hot-/Warm-/Cold-/Deleted-Retention, Ablauf, manuelle Bestätigung, Bestreitung, Archivierung,
Wiederherstellung und Löschung erzeugen versionierte oder append-only Zustände. Recalled Memory wird
als unvertrauenswürdiger Datenblock unterhalb von Masterprompt, Rechten und aktueller Anfrage in die
Runtime eingespeist.

## Neue Dateien und Migration

- `lib/memory-embedding.ts`
- `lib/memory-store.ts`
- `app/api/memory/route.ts`
- `drizzle/0005_calm_memory_mesh.sql`
- `drizzle/meta/0005_snapshot.json`
- `tests/memory-contract.test.mjs`

## Ausgeführte Prüfungen in diesem Arbeitslauf

- TypeScript-Syntaxprüfung aller `.ts`/`.tsx`-Dateien: bestanden
- strikte TypeScript-Prüfung der Memory-, Runtime-, Datenbank- und API-Schicht mit lokalen
  Cloudflare-D1-Typstubs: bestanden
- D1-/SQLite-Migrationen 0000–0005 auf frischer Datenbank: 63 SQL-Schritte bestanden
- Memory-Tabellen, Fremdschlüssel, Scope- und Eventtyp-Checks: bestanden
- sieben Source-/Produktverträge für Memory und Masterplan: 7 von 7 bestanden
- versionierte, atomare Feedback- und Retention-Receipts: geprüft
- 192-dimensionale Embedding-Erzeugung und Base64-Roundtrip: bestanden
- Relevanztest: verwandter Text höher bewertet als fachfremder Text: bestanden

## Externer Prüfblocker

Der vollständige `npm ci`-Lauf konnte in dieser Sitzung nicht abgeschlossen werden, weil der
interne Paketproxy beim Paket `zod-validation-error-4.0.2.tgz` mit HTTP 503 antwortete. Dadurch
konnten der komplette Vinext-Produktionsbuild, ESLint und die bestehenden Browser-/Worker-Tests in
diesem Arbeitslauf nicht erneut ausgeführt werden. Der Fehler trat beim Abhängigkeitsdownload auf;
er ist kein festgestellter Quellcode- oder Testfehler.

## Bewusste Grenzen

- Der lokale Hash-Embedder ist robust, deterministisch und kostenfrei, aber kein Ersatz für ein
  trainiertes semantisches Embedding-Modell. Die Schnittstelle bleibt austauschbar.
- Cold Storage bleibt in D1 markiert; eine externe R2-Auslagerung wird erst nach ausdrücklicher
  Binding- und Kostenfreigabe aktiviert.
- Es gibt noch keinen allgemeinen Datenexport/Löschworkflow für alle Produktdaten. Einzelne
  Memory-Einträge können bereits gelöscht werden.
- Memory verbessert Kontextkontinuität; es beweist keine inhaltliche Richtigkeit.
