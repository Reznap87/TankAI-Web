# TankAI Web

TankAI Web ist die browserbasierte Produktlinie von TankAI: eine
providerunabhängige KI-Runtime, die einen Auftrag plant, spezialisierte Modelle
als Team führt, Ergebnisse gegenprüft und nur eine fertige Antwort ausgibt.

Release: `0.43.0`

Masterprompt: `2.1.0`

Masterplan: `5.3.0`

Runtime: Vinext/React auf Cloudflare Workers, D1, Sign in with ChatGPT

## Implementierter Stand

- öffentliche Produkt- und Benchmarkseite,
- öffentlicher `/api/public-readiness`-Endpunkt mit realen Runtime-Gates und Secret-Redaction,
- externer HTTPS-Deployment-Verifier für DNS, Landingpage, Placeholder-Sperre, Readiness und Auth-Redirect,
- produktiver Cloudflare-Deploymentpfad mit D1-Migration, Secret-Injektion, Worker-Deploy und dauerhaftem Receipt,
- geschützte Arbeitsoberfläche,
- persistente Unterhaltungen, Runs, Quoten und Feedback in D1,
- gesalzene, datensparsame Nutzer-ID,
- Schnellmodus mit einem Modellaufruf,
- Teammodus mit Planner, zwei Spezialisten, Critic und Synthesizer,
- Tiefenmodus mit bis zu drei Spezialisten und zwei Critics,
- Adapter für OpenAI, xAI/Grok, Anthropic, Gemini und einen eigenen
  OpenAI-kompatiblen HTTPS-Endpunkt,
- verbindlicher Masterprompt direkt im produktiven Server-Build,
- Call-, Token-, Zeit-, Eingabe- und Tagesbudgets,
- datensparsamer Run-Trace ohne Candidate-Rohtexte,
- Execution Receipts, die Ablauf, Faktenstatus und Benchmarkstatus trennen,
- Provider-Bereitschaft und unabhängige Modellfamilien als Systemdiagnose,
- korrigierte negative Antworten als referenzierte Lernfälle in D1,
- D1-persistentes Langzeitgedächtnis mit episodischen, semantischen und prozeduralen Einträgen,
- deterministische 192-dimensionale Hash-Embeddings mit serverseitiger Cosine-Suche ohne externen
  Embedding-Zwang,
- nutzer- und optional projektgebundene Memory-Suche mit Zugriffszählern, Relevanzscore und
  Prompt-Injection-Datengrenze,
- automatische Run-Konsolidierung: beobachtete Episoden, vorsichtige semantische Kandidaten und
  erfolgreiche Planner-Muster,
- Feedback-Promotion: positive Bewertungen bestätigen Kandidaten; negative Bewertungen bestreiten
  sie und können eine nutzerbestätigte Korrekturerinnerung erzeugen,
- Hot-/Warm-/Cold-/Deleted-Retention, Ablaufzeiten, Versionsschutz und append-only Memory-Events,
- geschützte Memory-API zum Listen, Bestätigen, Bestreiten, Archivieren, Wiederherstellen und
  Löschen eigener Einträge,
- D1-persistente Tool-Freigaben mit exakter Werkzeug-, Nutzer-, Konto-/Projekt-, Zeit- und
  Nutzungsbindung,
- persistente Werkzeugaufträge mit Idempotenzschlüssel, Eingabehash, Zustandsautomat, Fortschritt,
  Versuchsgrenze, optimistischer Version und append-only Job-Events,
- atomarer Verbrauch einer Tool-Freigabe mit Anlage genau eines Jobs; wiederholte identische
  Anfragen verbrauchen keine zweite Nutzung, abweichende Idempotenz-Replays werden abgewiesen,
- exklusive Claim-Tokens für manuelle Ausführung sowie registrierte Worker-Claims mit 90-Sekunden-Lease,
  Heartbeat-Verlängerung und automatischer Wiederaufnahme,
- sieben reale Werkzeuge: SHA-256, Textanalyse, JSON-Prüfung, Memory-Retention, kontrollierter
  Abruf öffentlicher HTTPS-Seiten, mandanten- und projektgebundene Dokumentprüfung sowie statische
  Prüfung textueller Unified Diffs,
- das HTTPS-Werkzeug erzwingt öffentliche Ziele, manuell revalidierte Redirects, ausgelassene
  Zugangsdaten, erlaubte Text-Content-Types, 10-Sekunden-Laufzeit und 28.000-Byte-Antwortgrenze;
  extrahierte Inhalte bleiben als unvertrauenswürdige Daten markiert,
- eine zentrale, standardmäßig geschlossene Egress-Allowlist autorisiert jeden Zielhost und jeden
  Redirect erneut; eine ergänzende Denylist hat Vorrang und der Policy-Hash wird im Werkzeugergebnis
  nachgewiesen,
- mehrquellige Recherche verarbeitet zwei bis vier ausdrücklich gewählte HTTPS-Quellen mit
  mindestens zwei unterschiedlichen Hosts; jeder Abruf bleibt ein eigener persistenter Tool-Job
  samt Receipt und die Zusammenführung bleibt als nicht verifizierte Quellenbeobachtung markiert,
- authentifiziertes SSE-Fortschrittsstreaming aktualisiert laufende Tool-Jobs aus ihren
  unveränderlichen Events, setzt nach Verbindungsabbruch per Cursor fort und überträgt weder
  Tool-Eingaben noch Tool-Ausgaben,
- vollständiger JSON-Nutzerexport über 55 explizit registrierte D1-Datenmengen mit Zeilenzahl,
  SHA-256 je Datenmenge, Gesamt-Hash und klar ausgewiesener Redaction flüchtiger Zugangswerte,
- zweistufige Löschung mit individueller Bestätigungsphrase, zentral eingefrorenem Konto,
  24-Stunden-Widerrufsfrist, atomarer Löschtransaktion und anschließender Nullprüfung jeder
  registrierten Datenmenge,
- anonymisierter, später überprüfbarer Löschbeleg ohne Nutzer-ID oder Nutzerinhalt; Hosting-Logs,
  Backups und externe Provider werden ausdrücklich nicht als mitgelöscht behauptet,
- CSV-Tabellendokumente mit Komma- oder Semikolontrennung, eindeutiger Kopfzeile, konsistenter
  Spaltenzahl sowie festen Zeilen-, Spalten- und Zellgrenzen,
- statische Formel-Injection-Sperre für CSV-Zellen; Zahlen mit Vorzeichen bleiben Daten, Formeln
  und anweisungsartige Tabellenzellen werden weder ausgewertet noch ausgeführt,
- die Dokumentprüfung bindet jede Datei an Nutzer und Projekt, führt keinen Inhalt aus und meldet
  Struktur, Hash, JSON-/CSV-Zustand und Prompt-Injection-Signale,
- die Patchprüfung zählt Dateien, Hunks, Additions und Deletions, blockiert unsichere Pfade und führt
  weder Patch noch Code aus,
- geschützte Werkzeugoberfläche zum Freigeben, Anlegen, Ausführen, Wiederholen und Abbrechen
  nutzereigener Jobs einschließlich Werkzeugbudgets und Projektdateiauswahl,
- persistente ReAct-Läufe mit explizitem Zustandsautomaten für `ready`, `running`,
  `waiting_tool`, `completed`, Fehler, Abbruch und Budgetstopp,
- harte Schritt-, Modellentscheidungs- und Werkzeugbudgets mit terminalem
  `budget_exhausted` statt unkontrollierter Schleifen,
- kurze auditierbare Entscheidungszusammenfassungen statt gespeicherter privater
  Gedankengänge, lease-geschützte Tool-Aktionen und gehashte Beobachtungen,
- optimistische ReAct-Versionen, idempotente Werkzeugdispatches und append-only
  Decision-/Action-/Observation-/Completion-Receipts,
- geschützte ReAct-Oberfläche zum Anlegen, Fortsetzen, Synchronisieren und
  kontrollierten Abschließen eigener Läufe,
- persistente Commander-Läufe, die strukturierte ReAct-Entscheidungen automatisch erzeugen,
  jeden Commander- und Critic-Modellaufruf atomar über eine aktive `model.run`-Teamfreigabe autorisieren,
  aktive Tool-Leases ausschließlich serverseitig auflösen und nicht freigegebene Aktionen verwerfen,
- verpflichtende Critic-Prüfung jeder finalen Kandidatenantwort; abgelehnte Kandidaten fließen als
  sichtbares Feedback in den nächsten Zyklus, ohne private Gedankengänge oder Modellrohtexte zu speichern,
- feste Commander-Zyklus-, Modell-, Review- und Toolbudgets sowie ehrlicher `model_unavailable`-
  Abschluss statt simulierter Autonomie,
- eingefrorene und SHA-256-gehashte TankBench-Suiten mit 1 bis 200 deterministischen Fällen,
- Auswertung realer Commander-Läufe gegen Status-, Antwort-, Werkzeug-, Critic- und Budget-Assertions,
- gewichteter Baseline-/Kandidatenvergleich mit hartem Mindestdelta, Regressionsgrenze und null
  tolerierten Pflicht- oder Safety-Verstößen,
- Release-Kandidaten ausschließlich aus bestandenen TankBench-Läufen,
- geschützte React Deployment Control Plane mit 5-Sekunden-Live-Refresh, 15-/60-Minuten- und 24-Stunden-Metriken,
- releasegebundene Primär-/Fallback-Ketten mit maximal vier serverseitig konfigurierten Providern,
- persistente Circuit Breaker mit `closed`, `open` und `half_open`, konfigurierbarer Fehlergrenze, Recovery-Zeit und Probe-Erfolgen,
- versioniertes manuelles Canary-Traffic-Shifting von 0 bis 100 Prozent ohne Umgehung der TankBench-Promotion,
- gehashte Request-Traces mit einzelnen Provider-Versuchen; Prompt- und Antwortklartext werden nicht in Deployment-Receipts gespeichert,
- atomare Admission Control vor Routing und Providerarbeit mit Minutenlimit, maximaler Parallelität
  und selbstbereinigenden persistenten In-flight-Leases,
- persistente SLO-Snapshots aus realen Deployment-Requests, deduplizierte Success-/Latency-Alerts,
  Bestätigung, Recovery-Auflösung und konfigurierbare Cooldowns,
- kontrollierter Dead-Letter-Replay nur als neuer Job und nur nach atomarem Verbrauch einer neuen,
  passenden Tool Execution Lease,
- redigierter Operations-Audit-Export mit Hashes, Zuständen, Metriken und Receipts, jedoch ohne
  Prompt-, Antwort- oder Tool-Eingabeklartext,
- Canary-Stufen mit 5, 25, 50 und 100 Prozent Traffic, P95-/Fehlerraten-Gates sowie
  automatischem Rollback auf den vorher aktiven Release,
- dauerhafte Worker-Identitäten mit einmalig ausgegebenem Token, gespeicherten SHA-256-Hashes,
  Aktiv-/Draining-/Widerrufszustand und nutzergebundener Bearer-API,
- automatische Retry-Verzögerung, monotone Fortschrittsereignisse und terminaler Dead-Letter-Zustand
  nach ausgeschöpften Versuchen,
- langlebige, nutzereigene Ziele mit Definition of Done, Zustandsautomat,
  Fortschritt, letztem bestätigten Schritt und nächster sicherer Aktion,
- unveränderliche Zielereignisse und optimistische Versionen gegen verlorene
  Paralleländerungen,
- Wiederaufnahme des bestätigten Zielstands über Browser- und Worker-Neustarts,
- serverseitige Bindung eines ausgewählten Zielkontexts an echte Teamläufe,
- nutzereigene Projektbereiche mit Aktiv-/Archivzustand und optimistischen
  Projektversionen,
- dauerhaft gespeicherte Text-, Markdown-, JSON- und CSV-Dateien mit SHA-256,
  Größenlimit und unveränderlicher Versionshistorie,
- serverseitige Bindung eines ausgewählten Projektbereichs an echte Teamläufe;
  Dateiinhalte bleiben ausdrücklich unvertrauenswürdige Daten,
- archivierte Projektbereiche sperren Dateiänderungen und neue Läufe,
- D1-persistente Capability Leases für Modellläufe mit Nutzer-, Modus-, Konto-/
  Projekt-, Zeit- und Nutzungsgrenzen,
- atomare Bindung jeder verbrauchten Freigabe an genau einen Run mit
  unveränderlichen Erteilungs-, Verbrauchs- und Widerrufs-Receipts,
- UI-Steuerung für eine standardmäßig einstündige Einmalfreigabe; fremde,
  abgelaufene, erschöpfte, widerrufene oder unpassende Freigaben erreichen
  keinen Provider,
- ausführbarer TankBench-Promotion-Entscheider mit harten Sicherheits-, Qualitäts-,
  Kosten- und Latenzgrenzen,
- ehrlicher Konfigurationsfehler statt fester Demoantwort,
- Migration, Build-, Produkt-, Auth- und Orchestrierungsprüfungen.

Der Code ist ein echter Modell-Orchestrator. Ohne mindestens ein
serverseitiges Provider-Secret bleibt die Eingabe absichtlich gesperrt.

## Architektur

```text
Browser
  └─ Sign in with ChatGPT
      └─ TankAI API
          ├─ Commander / Planner
          ├─ Model Mesh
          │   ├─ OpenAI Responses
          │   ├─ xAI / Grok
          │   ├─ Anthropic
          │   ├─ Gemini
          │   └─ eigener kompatibler Endpunkt
          ├─ Specialists
          ├─ Critic
          ├─ Synthesizer
          └─ D1: Conversations, Runs, Goals, Projekte, Dateiversionen,
                 Capability Leases, Memory, Tool Leases, Tool Jobs, Worker, ReAct,
                 Commander, TankBench, Canary, Deployment, Admission, SLO, Alerts,
                 Replays, Datenaufträge, Löschbelege, Receipts, Feedback
```

## Verbindliche Dokumente

- `docs/TANKAI_MASTERPROMPT.md` – operative Verfassung, vom Build direkt geladen
- `docs/TANKAI_MASTERPLAN.md` – Produkt-, Lern- und eigene Modellstrategie
- `docs/SECURITY.md` – umgesetzte Grenzen und offene Härtung
- `docs/TANKAI_V0.20.0_RELEASE.md` – Admission Control, SLOs, Alerts, Dead-Letter-Replay und Audit-Export
- `docs/TANKAI_V0.21.0_RELEASE.md` – deny-by-default Egress-Policy und nachgeholter Produktionsbuild
- `docs/TANKAI_V0.22.0_RELEASE.md` – mehrquellige Recherche mit Einzel-Receipts und unverifizierter Evidenzgrenze
- `docs/TANKAI_V0.23.0_RELEASE.md` – nutzergebundenes SSE-Fortschrittsstreaming ohne Tool-Payloads
- `docs/TANKAI_V0.24.0_RELEASE.md` – vollständiger Datenexport, zweistufige Löschung und anonymisierte Löschbelege
- `docs/TANKAI_V0.25.0_RELEASE.md` – statisch geprüfte CSV-Tabellendokumente ohne Formel- oder Codeausführung
- `docs/TANKAI_V0.26.0_RELEASE.md` – deterministische CSV-Profile sowie begrenztes Filtern und Sortieren mit Tool-Receipt
- `docs/TANKAI_V0.28.0_RELEASE.md` – produktiver Cloudflare-Deploymentpfad mit Migration, Live-Prüfung und Receipt
- `docs/TANKAI_V0.29.0_RELEASE.md` – typgesicherte, begrenzte CSV-Aggregationen ohne Formel- oder Codeausführung
- `docs/TANKAI_V0.30.0_RELEASE.md` – deterministisch begrenzte gruppierte CSV-Aggregationen
- `docs/TANKAI_V0.31.0_RELEASE.md` – typgesicherte CSV-Häufigkeitsverteilungen mit expliziter Restzählung
- `docs/TANKAI_V0.32.0_RELEASE.md` – begrenzte numerische CSV-Histogramme mit expliziten Intervallen
- `docs/TANKAI_V0.33.0_RELEASE.md` – begrenzte numerische CSV-Quantile nach R7
- `docs/TANKAI_V0.34.0_RELEASE.md` – begrenzte numerische CSV-Ausreißer nach Tukey-IQR
- `docs/TANKAI_V0.35.0_RELEASE.md` – numerische CSV-Streuungsstatistik mit explizitem Nenner
- `docs/TANKAI_V0.36.0_RELEASE.md` – paarweise CSV-Kovarianz und Pearson-Korrelation
- `docs/TANKAI_V0.37.0_RELEASE.md` – einfache lineare CSV-Regression mit Residuenregel
- `docs/TANKAI_V0.38.0_RELEASE.md` – begrenzte Regressionsvorhersagen mit Reichweiten- und Unsicherheitsregel
- `docs/TANKAI_V0.39.0_RELEASE.md` – zweiseitige Regressionsintervalle mit expliziter Student-t-Regel
- `docs/TANKAI_V0.40.0_RELEASE.md` – Leverage und intern studentisierte Regressionsresiduen
- `docs/TANKAI_V0.41.0_RELEASE.md` – Cook-Distanz mit fester Einfluss-Schwellenregel
- `docs/TANKAI_V0.42.0_RELEASE.md` – PRESS-Residuen und vorhergesagtes R² mit festen Undefiniertheitsregeln
- `docs/TANKAI_V0.43.0_RELEASE.md` – extern studentisierte Residuen mit gelöschter Varianzschätzung
- `docs/TANKAI_V0.27.0_RELEASE.md` – ehrliche Public-Release-Bereitschaft und externer Deployment-Verifier
- `docs/TANKAI_V0.19.0_RELEASE.md` – React Control Plane, Provider-Fallback, Circuit Breaker und Traffic-Shifting
- `docs/TANKAI_V0.18.0_RELEASE.md` – produktiver Deployment Controller und Request-Receipts
- `docs/TANKAI_V0.17.0_RELEASE.md` – automatischer Suite Runner und stabiles Traffic Routing
- `docs/TANKAI_V0.16.0_RELEASE.md` – eingefrorene TankBench-Suiten, Promotion-Gates, Canary und Rollback
- `docs/TANKAI_V0.15.0_RELEASE.md` – autonome Commander-Orchestrierung mit serverseitiger Lease-Auflösung und Critic-Gate
- `docs/TANKAI_V0.14.0_RELEASE.md` – historische ReAct-Orchestrierung mit Budgets, Tool-Beobachtungen und Receipts
- `docs/TANKAI_V0.13.0_RELEASE.md` – historische Worker Runtime
- `docs/TANKAI_V0.12.0_RELEASE.md` – historische Tool Fabric mit HTTPS-, Dokument- und Patchgrenzen
- `docs/TANKAI_V0.11.0_RELEASE.md` – historische Tool-Job-Basisschicht
- `docs/TANKAI_V0.10.0_RELEASE.md` – historischer Memory-Ausbau
- `docs/TANKAI_V0.9.0_RELEASE.md` – historischer Capability-Lease-Release

## Lokaler Start

Voraussetzungen:

- Node.js `>=22.13.0`
- Linux mit `flock`, `curl` und GNU `timeout`

```bash
npm ci
cp .env.example .env
npm run dev
```

Für lokale API-Aufrufe muss der vorgeschaltete Entwicklungszugang die
Authentifizierungsheader liefern. API-Schlüssel gehören ausschließlich in
`.env` oder die geschützten Hosting-Laufzeitvariablen, nie in Quellcode,
Browserstorage oder Git.

## Laufzeitvariablen

Pflicht für Nutzer-APIs:

- `TANKAI_ID_SALT` – geheimes, zufälliges Salt für die datensparsame Nutzer-ID

Mindestens ein Modellzugang:

- `OPENAI_API_KEY`
- oder `XAI_API_KEY` und `XAI_MODEL`
- oder `ANTHROPIC_API_KEY` und `ANTHROPIC_MODEL`
- oder `GEMINI_API_KEY` und `GEMINI_MODEL`
- oder `CUSTOM_AI_API_KEY`, `CUSTOM_AI_MODEL` und
  `CUSTOM_AI_CHAT_COMPLETIONS_URL`

Optionale Budgets und OpenAI-Rollenmodelle sind vollständig in `.env.example`
aufgeführt.

## Prüfung

```bash
npm run db:generate
npm run lint
npm test
npm run validate:artifact
```

`npm test` baut das Worker-Artefakt und prüft Produktinhalt, Sicherheitsheader,
ehrlichen Providerstatus, anonyme API-Sperre, Masterprompt/Masterplan,
Mandantentrennung, Zielzustände, Zielversionen, Projektarchivierung,
Dateiversionen, Hashintegrität, Prompt-Injection-Datengrenzen für Projekte und Memory,
Capability-Lease-Bereichsgrenzen, Einmalverbrauch, Widerruf, Memory-Schema, Embedding-
Roundtrip, Retention-Verträge, Tool-Lease-Scope, idempotente Jobanlage, Claim-Tokens, Retry, ReAct-Zustände, Schritt-/Modell-/Werkzeugbudgets, gehashte Beobachtungen, ReAct-Versionen und Receipts, Commander-Zyklen, atomaren `model.run`-Freigabeverbrauch, serverseitige Tool-Lease-Auflösung, Critic-Gates, Modellantwort-Hashes, eingefrorene TankBench-Suiten, deterministische Commander-Assertions, gewichtete Promotion-Gates, Canary-Stufen und automatischen Rollback, Worker-Registrierung, Token-Hashing, Parallelitätsgrenzen,
Claim-Leases, monotone Heartbeats, Backoff, Dead Letter, Stale-Recovery, öffentliche HTTPS-Zielregeln, Redirect-Revalidierung, Content-Type-/Größenlimits,
Projektdatei-Mandantentrennung, statische Patchpfade und den vollständigen
Planner-Specialist-Critic-Synthesizer-Pfad mit kontrollierten Providerantworten.
Zusätzlich werden das vollständige 55-Datenmengen-Register, Exporthashes,
Credential-Redaction, Mandantentrennung, Lösch-Widerrufsfrist, atomare
Gesamtlöschung, Nullprüfung und anonymisierte Receipt-Verifikation ausgeführt.

## Reifegrenze

TankAI Web `0.30.0` ist der implementierte, aber extern noch nicht öffentlich verifizierte Webkern mit dauerhaft wiederaufnehmbarer
Zielkontrolle, versionierten Projektbereichen und begrenzten
Ausführungsfreigaben, noch nicht das abgeschlossene Gesamtprodukt. Ein eigener
TankAI-Modellcheckpoint entsteht nach den
Datenherkunfts-, Trainings-, Eval-, Sicherheits- und Promotion-Gates im
Masterplan. Bis dahin bezeichnet sich TankAI korrekt als Orchestrierungssystem
mit angebundenen Grundmodellen.

## v0.18.0 – Deployment Controller

Releasegebundene Provider-Konfiguration, stabiles produktives Routing, append-only Request-Receipts und direkte Canary-Gesundheitsmetriken sind unter `/api/deployment` verfügbar.

## v0.19.0 – React Deployment Control Plane

Die geschützte React-Oberfläche unter `/deployment` stellt die produktive Control Plane bereit:

- Live-Metriken für 15 Minuten, 60 Minuten und 24 Stunden,
- gehashte Request-Traces mit einzelnen Provider-Versuchen,
- geordnete Primär-/Fallback-Ketten mit maximal vier Providern,
- persistente Circuit Breaker mit `closed`, `open` und `half_open`,
- atomarer manueller Canary-Traffic von 0 bis 100 Prozent,
- Rückkehr zur automatischen TankBench-Steuerung,
- reale Testrequests ohne Speicherung von Prompt- oder Antwortklartext in Traces.



## v0.20.0 – Reliability & Operations

Die geschützte Operations-Control-Plane unter `/operations` schützt und überwacht den produktiven Pfad:

- atomare Requests-pro-Minute- und Concurrency-Admission vor Routing und Providerarbeit,
- persistente In-flight-Leases mit Ablaufbereinigung nach unterbrochenen Requests,
- SLO-Snapshots aus realen Deployment-Receipts mit Erfolgsrate und P95-Latenz,
- deduplizierte Alerts mit Bestätigung, Cooldown und nachvollziehbarer Recovery-Auflösung,
- Dead-Letter-Replay ausschließlich als neuer Job mit neuer passender Tool Execution Lease,
- redigierter JSON-Audit-Export ohne Prompt-, Antwort- oder Tool-Eingabeklartext,
- React-Dashboard mit 5-Sekunden-Refresh, Richtlinieneditor, Alertsteuerung und Replay-Workflow.

## v0.21.0 – Egress Policy Enforcement

`web.fetch` ist jetzt standardmäßig vollständig geschlossen. Erst
`TANKAI_EGRESS_ALLOWED_HOSTS` erlaubt exakte Hosts oder ausdrücklich markierte
Wildcard-Subdomains. `TANKAI_EGRESS_DENIED_HOSTS` hat Vorrang. Dieselbe Policy
wird vor dem ersten Request und nach jedem Redirect erneut erzwungen; das Ergebnis
enthält den Policy-Hash und die passende Allow-Regel. DNS-/IP-Auflösung gegen
Rebinding bleibt bis zu einem kontrollierten Resolver oder Egress-Proxy bewusst
als separates Produktions-Gate offen.

## v0.22.0 – Multi-Source Research

Unter `/tools` verarbeitet TankAI zwei bis vier ausdrücklich angegebene
HTTPS-Quellen mit mindestens zwei unterschiedlichen Hosts. Jeder Abruf besitzt
eine eigene Freigabenutzung, einen persistenten Job und ein Receipt. Die
Ergebnisübersicht zeigt begrenzte Excerpts, Provenienz-Hashes, Teilfehler und
Prompt-Injection-Signale. Sie kennzeichnet den Bundle-Status ausdrücklich als
nicht verifizierte Quellenbeobachtung; ein erfolgreicher Abruf ist keine
Faktenbestätigung.

## v0.23.0 – Tool Progress Streaming

Laufende Werkzeugaufträge aktualisieren sich unter `/tools` jetzt über einen
authentifizierten SSE-Livestream. Der Stream setzt mit Jobversion und Event-ID
fort, sendet Heartbeats und verbindet sich nach einem begrenzten Fenster
kontrolliert neu. Er enthält ausschließlich Ausführungsstatus und unveränderliche
Job-Events – keine Tool-Eingaben oder -Ausgaben. Ein erfolgreicher Job setzt
`factsVerified` weiterhin ausdrücklich auf `false`.

## v0.24.0 – Data Control

Unter `/data` kann der angemeldete Eigentümer seinen registrierten
TankAI-D1-Datensatz als JSON exportieren. Der Export bindet 55 Datenmengen an
ein Manifest, führt Zeilenzahl und SHA-256 je Datenmenge auf und redigiert
flüchtige Worker- und Job-Zugangswerte.

Die Löschung verlangt eine individuelle Phrase und eine 24-stündige
Widerrufsfrist. Während des aktiven Auftrags sperrt die zentrale
Authentifizierung alle gewöhnlichen TankAI-Aktionen. Die Ausführung löscht die
registrierten Daten atomar, prüft jede Datenmenge anschließend auf null und
bewahrt ausschließlich einen anonymisierten Integritätsbeleg auf. Der Beleg
beweist den Zustand der TankAI-Anwendungsdatenbank, nicht die Löschung von
Hosting-Logs, Plattformbackups oder externen Providerdaten.

## v0.25.0 – Safe CSV Tables

Projektbereiche akzeptieren jetzt versionierte CSV-Tabellendokumente. Ein
eigener Parser verarbeitet Komma- und Semikolontrennung,
Anführungszeichen und mehrzeilige Zellen ohne fremde Parserbibliothek und ohne
Ausführung.

Vor dem Speichern werden Kopfzeile, Spaltenkonsistenz, Steuerzeichen sowie
Zeilen-, Spalten- und Zellgrenzen geprüft. Tabellenzellen, die als
Spreadsheet-Formeln interpretiert werden könnten, werden abgewiesen. Das
lease-geschützte Dokumentwerkzeug meldet die statische CSV-Struktur und führt
weder Formeln noch Code aus.

## v0.26.0 – Deterministic CSV Query

Das lease-geschützte Dokumentwerkzeug erstellt für CSV-Spalten statische
Null-, Typ- und Eindeutigkeitsprofile. Eine optionale JSON-Abfrage kann Daten
mit höchstens fünf Filtern und zwei stabilen Sortierungen untersuchen. Die
Ausgabe bleibt auf acht Spalten, zehn Zeilen und 160 Zeichen pro Zelle
begrenzt.

Textvergleiche sind als getrimmter NFKC-Vergleich mit Case-Folding
festgeschrieben; numerische Vergleiche verwenden nur eindeutig erkannte
Zahlen. Leere Zellen gelten für das Profil als `null` und werden beim Sortieren
zuletzt eingeordnet. Das Ergebnis trägt ein Tool-Receipt, setzt
`factsVerified` aber weiterhin auf `false` und führt weder Tabellenformeln noch
Code aus.


## v0.27.0 – Public Release Readiness

`/api/public-readiness` meldet ausschließlich tatsächliche Laufzeitgates und
kennzeichnet die externe Hosting-Zielgruppe als nicht aus der Runtime
verifizierbar. Die Landingpage enthält keine statischen `SYSTEM ONLINE`- oder
`CORE ONLINE`-Claims mehr.

Nach einem echten Publish prüft der folgende Befehl die öffentliche Adresse:

```bash
npm run verify:public -- "$TANKAI_PUBLIC_URL"
```

Der Prüfer verlangt HTTPS, öffentliche DNS-Auflösung, eine echte TankAI-Landingpage
ohne Placeholder-Sprache, den Readiness-Endpunkt und einen Auth-Redirect für
`/app`. Ein fehlgeschlagener Gate erzeugt ein maschinenlesbares Receipt und
beendet den Prozess mit einem Fehlercode.


## v0.28.0 – Public Deployment Pipeline

Der folgende Befehl führt im berechtigten Cloudflare-Zielsystem den vollständigen Publish-Lauf aus:

```bash
npm run deploy:public
```

Der Lauf validiert alle erforderlichen Kontowerte, führt Lint, Produktionsbuild und Tests aus,
wendet die D1-Migrationen remote an, installiert ausschließlich den Identity-Salt als Secret,
veröffentlicht den Worker und prüft die resultierende HTTPS-Adresse extern. Modellprovider-Secrets
werden nicht automatisch aktiviert. Ein erfolgreicher Lauf erzeugt
`deployment-receipts/TankAI-Web-v0.36.0_PUBLIC_DEPLOYMENT_RECEIPT.json`.

Die dazugehörige GitHub Action liegt unter `.github/workflows/deploy-public.yml` und verlangt eine
geschützte `production`-Umgebung. Ohne reale Cloudflare-, D1- und Identity-Werte beendet sich der
Lauf vor jeder externen Änderung.

## v0.29.0 – typgesicherte CSV-Aggregationen

`project.document.inspect` kann nach denselben begrenzten Filtern bis zu acht Aggregationen
ausführen: Summe, Minimum, Maximum und Mittelwert. Aggregierbar sind ausschließlich vollständig
numerische oder leere Spalten. Leere Zellen werden gezählt und ausgeschlossen; gemischte Spalten,
doppelte Operationen und nicht endliche Ergebnisse werden abgewiesen. Die Ausgabe bleibt
deterministisch begrenzt, führt keine Tabellenformel und keinen Code aus und kennzeichnet die
Tabellenwerte weiterhin mit `factsVerified: false`.

## v0.30.0 – begrenzte gruppierte CSV-Aggregationen

`project.document.inspect` gruppiert gefilterte CSV-Zeilen auf Wunsch nach höchstens zwei
Spalten und berechnet je Gruppe dieselben typgesicherten Aggregationen. Die Ausgabe enthält
höchstens acht deterministisch geordnete Gruppen; `totalGroups`, `returnedGroups` und
`truncatedGroups` machen die feste Grenze explizit. Gruppenschlüssel bleiben
Formel-Injection-geprüft, ausgabebegrenzt und an dieselbe Nutzer-, Projekt-, Dokument- und
Tool-Lease-Kette gebunden.

## v0.31.0 – typgesicherte CSV-Häufigkeitsverteilungen

`project.document.inspect` kann nach den vorhandenen Filtern für höchstens drei homogene
CSV-Spalten Häufigkeitsverteilungen erzeugen. Pro Spalte werden höchstens zehn Buckets nach
Häufigkeit und anschließend stabilem Typwert ausgegeben. `distinctValues`, `returnedBuckets`,
`truncatedBuckets`, `returnedRows` und `otherRows` machen jede Begrenzung explizit. Zahlen und
Boolesche Werte werden typisiert zusammengeführt, Text normalisiert verglichen und gemischte
Spalten vollständig abgewiesen. Gruppierte Aggregationen und Häufigkeitsverteilungen bleiben
getrennte Abfragen, damit das feste 40.000-Byte-Werkzeugbudget garantiert bleibt.

## v0.32.0 – begrenzte numerische CSV-Histogramme

`project.document.inspect` erzeugt nach den vorhandenen Filtern Histogramme für höchstens drei
global numerische CSV-Spalten. Jede Abfrage verlangt zwischen zwei und zwölf Buckets. Minimum,
Maximum, Intervallbreite und die inklusive beziehungsweise exklusive Behandlung jeder Grenze
werden explizit ausgegeben. Nullwerte werden getrennt gezählt; nicht numerische, gemischte oder
nach Filtern leere Spalten werden vollständig abgewiesen. Konstante Werte ergeben ehrlich einen
einzigen degenerierten Bucket statt erfundener Intervalle. Histogramme, Häufigkeiten und
gruppierte Aggregationen bleiben getrennte Abfragen, damit das Werkzeugbudget garantiert bleibt.

## v0.33.0 – begrenzte numerische CSV-Quantile

`project.document.inspect` berechnet nach den bestehenden Filtern für höchstens drei global
numerische Spalten jeweils bis zu neun eindeutige Quantilwahrscheinlichkeiten. Die verbindliche
R7-Regel verwendet den Rang `(n - 1) × p` und lineare Interpolation zwischen den benachbarten
sortierten Werten. Wahrscheinlichkeit, Rang, Indexgrenzen, Interpolationsgewicht und Ergebnis
werden explizit ausgegeben. Nullwerte werden getrennt gezählt; leere, gemischte, textuelle oder
nach Filtern zahlenlose Spalten werden abgewiesen. Quantile, Histogramme, Häufigkeiten und
gruppierte Aggregationen bleiben getrennte Abfragen, damit das feste Werkzeugbudget erhalten bleibt.

## v0.34.0 – begrenzte numerische CSV-Ausreißer

`project.document.inspect` erkennt nach den bestehenden Filtern Ausreißer in höchstens drei
global numerischen Spalten. Die feste Tukey-Regel verwendet R7-Quartile und den Faktor 1,5:
Werte unter `Q1 - 1,5 × IQR` oder über `Q3 + 1,5 × IQR` gelten als Ausreißer. Quartile, IQR,
beide Fences und die Richtung jedes Treffers werden explizit ausgegeben. Je Spalte erscheinen
höchstens 20 deterministisch sortierte Treffer; Gesamt-, Ausgabe- und Trunkierungszähler verhindern
eine unvollständige Darstellung als vollständiges Ergebnis. Ausreißer, Quantile, Histogramme,
Häufigkeiten und gruppierte Aggregationen bleiben getrennte Abfragen.

## v0.35.0 – begrenzte numerische CSV-Streuungsstatistik

`project.document.inspect` berechnet nach den bestehenden Filtern für höchstens drei global
numerische Spalten Mittelwert, Varianz, Standardabweichung, Minimum, Maximum und Spannweite.
Der Aufruf muss `population` mit Nenner `N` oder `sample` mit Nenner `N−1` ausdrücklich wählen;
der tatsächlich verwendete Nenner wird ausgegeben. Die Berechnung verwendet den numerisch stabilen
Welford-Algorithmus und weist nicht endliche Zwischenergebnisse oder Resultate ab. Stichproben
benötigen mindestens zwei Zahlen. Streuungsstatistik und andere Verteilungsarten oder gruppierte
Aggregationen bleiben getrennte Abfragen.

## v0.36.0 – begrenzte CSV-Kovarianz und Pearson-Korrelation

`project.document.inspect` berechnet nach den vorhandenen Filtern für höchstens drei numerische
Spaltenpaare Kovarianz und Pearson-Korrelation. Nur Zeilen mit zwei vorhandenen Zahlen bilden ein
Paar; ausgeschlossene Nullzeilen und die Nullzahlen beider Spalten werden explizit ausgegeben.
Der Aufruf wählt `population` (`N`) oder `sample` (`N−1`). Eine stabile bivariate
Welford-Berechnung blockiert nicht endliche Ergebnisse. Bei Nullvarianz wird die Korrelation
ausdrücklich als undefiniert ausgegeben. Beziehungen bleiben von anderen Verteilungs- und
Gruppenausgaben getrennt.

## v0.37.0 – begrenzte einfache lineare CSV-Regression

`project.document.inspect` passt nach den bestehenden Filtern für höchstens drei numerische
Spaltenpaare die Gleichung `y = intercept + slope × x` per Ordinary Least Squares an. Nur
vollständige Zahlenpaare werden verwendet. Nullwerte beider Spalten, ausgeschlossene Paarzeilen,
Steigung, Achsenabschnitt, Mittelwerte und `R²` werden explizit ausgegeben. Nullvarianz der
x-Spalte blockiert die Regression; bei konstanter y-Spalte bleibt `R²` ausdrücklich undefiniert.
Residualquadratsumme, Freiheitsgrade `n−2`, mittleres Residuenquadrat und Residualstandardfehler
folgen einer festen Regel. Für `n=2` werden die letzten beiden Werte nicht erfunden. Höchstens
20 zeilenbezogene Residuen je Paar werden ausgegeben und jede Kürzung wird ausgewiesen.

## v0.38.0 – begrenzte CSV-Regressionsvorhersagen

Jedes Regressionspaar kann bis zu zehn eindeutige endliche x-Werte vorhersagen. Die Ausgabe
kennzeichnet Werte innerhalb der beobachteten x-Spanne als Interpolation und Werte unterhalb oder
oberhalb ausdrücklich als niedrige beziehungsweise hohe Extrapolation. Die Unsicherheit ist keine
erfundene Konfidenzaussage: ausgegeben werden genau ein Standardfehler der mittleren Antwort und
ein Standardfehler einer neuen Beobachtung nach der festen Residualfehler-/Leverage-Regel. Ohne
positive Residuen-Freiheitsgrade bleiben beide Werte ausdrücklich undefiniert.

## v0.39.0 – begrenzte CSV-Regressionsintervalle

Regressionsvorhersagen können optional genau eine explizite Konfidenzstufe von 90 %, 95 % oder
99 % anfordern. TankAI berechnet den zweiseitigen Kritikalwert aus der Student-t-Verteilung mit
den Residuen-Freiheitsgraden `n−2` und gibt sowohl das Konfidenzintervall der mittleren Antwort als
auch das Prognoseintervall einer neuen Beobachtung aus. Ohne angeforderte Stufe oder ohne positive
Freiheitsgrade bleiben Intervalle samt maschinenlesbarem Grund undefiniert. Das Mengen- und
40.000-Byte-Ausgabebudget sowie alle bestehenden Eigentums- und Injection-Sperren bleiben erhalten.

## v0.40.0 – begrenzte CSV-Regressionsdiagnostik

Jedes zurückgegebene Residuum enthält sein Hat-Matrix-Leverage und – sofern mathematisch
definiert – sein intern studentisiertes Residuum. Die Ausgabe nennt die feste High-Leverage-Regel
`hᵢ > 4/n` und die feste Residuenregel `|rᵢ| > 2`, trifft daraus aber keine automatische
Ursachen- oder Faktenbehauptung. Fehlende Freiheitsgrade, Residualstandardfehler null und Leverage
eins bleiben als ausdrücklich undefinierte Zustände sichtbar. Die bestehenden Paar-, Residuen-
und 40.000-Byte-Grenzen bleiben erhalten.

## v0.41.0 – begrenzte CSV-Einflussdiagnostik

Jedes mathematisch definierte OLS-Residuum enthält zusätzlich seine Cook-Distanz. Die Methode
verwendet zwei geschätzte Regressionsparameter und weist die feste Schwelle `Dᵢ > 4/n`
maschinenlesbar aus. Ist das zugrunde liegende studentisierte Residuum undefiniert, bleibt auch
Cook-Distanz `null`; der genaue bestehende Grund bleibt am Residuum sichtbar. Die Kennzahl ist
eine Diagnosehilfe und keine automatische Ursachen-, Lösch-, Trainings- oder Faktenentscheidung.

## v0.42.0 – begrenzte CSV-PRESS-Diagnostik

Jedes zurückgegebene OLS-Residuum enthält zusätzlich sein Leave-one-out-PRESS-Residuum
`eᵢ / (1−hᵢ)`. Die PRESS-Quadratsumme wird über alle vollständigen Zahlenpaare gebildet und das
vorhergesagte `R²` als `1 − PRESS/SST` ausgegeben. Leverage eins und Antwort-Nullvarianz bleiben
als getrennte maschinenlesbare Undefiniertheitsgründe sichtbar. Bei Regressionsabfragen sinkt die
gleichzeitige gewöhnliche Tabellenzeilenausgabe auf fünf; die effektive Policy wird ausgegeben und
das bestehende 40.000-Byte-Werkzeugbudget bleibt auch bei drei maximalen Paaren erhalten.

## v0.43.0 – begrenzte extern studentisierte CSV-Residuen

Jedes zurückgegebene OLS-Residuum enthält – sofern mathematisch definiert – sein extern
studentisiertes Residuum. Die Fehlervarianz wird dafür nach Ausschluss genau dieser Zeile mit
`n−3` Freiheitsgraden neu geschätzt. Leverage eins, fehlende gelöschte Freiheitsgrade und ein
gelöschter Residualstandardfehler von null bleiben getrennte maschinenlesbare Zustände. Die feste
Diagnosegrenze ist `|tᵢ| > 2`. Regressionsantworten enthalten keine parallelen gewöhnlichen
Tabellenzeilen mehr; alle bisherigen Diagnose- und Vorhersagegrenzen bleiben erhalten und der
Maximaltest bleibt unter 40.000 Byte.
