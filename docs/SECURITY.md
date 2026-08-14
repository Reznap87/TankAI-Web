# TankAI Web – Sicherheitsstatus v0.26.0

Stand: 28. Juli 2026

## Umgesetzte Grenzen

- Chat-, Goal-, Projekt-, Datei-, Feedback- und Improvement-APIs verlangen serverseitig gelieferte
  ChatGPT-Identität.
- Datenbankzugriffe filtern nach einer gesalzenen, datensparsamen Nutzer-ID.
- Goal-Lese- und Schreibzugriffe prüfen die Nutzerkennung serverseitig; fremde Ziel-IDs liefern
  keinen nutzbaren Datensatz.
- Goal-Mutationen akzeptieren nur den verbindlichen Zustandsautomaten und eine erwartete
  Versionsnummer. Veraltete Paralleländerungen werden mit einem Konflikt abgewiesen.
- Zielstatus, Fortschritt, letzter bestätigter Schritt, nächste sichere Aktion und zugeordnete
  Run-Ereignisse werden als D1-Receipts geführt. Terminale Ziele starten keinen neuen Modelllauf.
- Browserseitige Goal-Mutationen mit abweichendem `Origin` werden verworfen.
- Projekt- und Dateimutationen mit abweichendem `Origin` werden verworfen.
- Jeder Projekt- und Dateizugriff filtert serverseitig nach Nutzer-ID; fremde Projekt- oder
  Datei-IDs werden nicht offengelegt.
- Projektmetadaten und Dateien verwenden erwartete Versionsnummern. Veraltete Schreibversuche
  erzeugen weder neue Dateiversionen noch falsche Projekt-Receipts.
- Archivierte Projekte sperren Dateiänderungen und neue Modellläufe, bis sie mit einer gültigen
  Projektversion wiederhergestellt werden.
- Projektdateien sind auf 20.000 Zeichen und 24.000 Bytes begrenzt. Dateinamen schließen
  Pfadseparatoren und Steuerzeichen aus; JSON-Dateien werden vor Speicherung geparst.
- CSV-Dateien benötigen eine eindeutige Kopfzeile, mindestens eine Datenzeile und eine
  konsistente Spaltenzahl. Komma und Semikolon werden statisch verarbeitet; die Grenze liegt bei
  500 Datenzeilen, 50 Spalten und 2.000 Zeichen je Zelle.
- Spreadsheet-Formel-Injection nach führendem Leerraum wird vor dem Speichern abgewiesen.
  Vorzeichenbehaftete reine Zahlen bleiben Daten. CSV-Formeln, Makros, Scripts und Code werden
  weder ausgewertet noch ausgeführt.
- CSV-Spaltenprofile behandeln ausschließlich leere Zellen als `null` und klassifizieren
  boolesche Werte, Ganzzahlen, Zahlen, ISO-Daten, ISO-Zeitpunkte und Text deterministisch.
  Die Profile sind Beobachtungen über gespeicherte Daten und keine Faktenverifikation.
- CSV-Abfragen sind auf fünf Filter, zwei Sortierungen, acht Ausgabespalten, zehn Ergebniszeilen
  und 160 ausgegebene Zeichen je Zelle begrenzt. Nullwerte bleiben unabhängig von der
  Sortierrichtung zuletzt; Gleichheit und Enthalten verwenden getrimmtes NFKC-Case-Folding.
- Filter und Sortierung laufen nur im validierten In-Memory-Datenraster des nutzer-, projekt- und
  lease-gebundenen `project.document.inspect`-Jobs. Eingabehash, Ausgabegröße, Laufzeit und
  Abschluss werden durch das bestehende Tool-Receipt erfasst; `factsVerified` bleibt `false`.
- Der Datei-API-Körper wird unabhängig von `Content-Length` auf 30.000 UTF-8-Bytes begrenzt;
  unbekannte Felder werden abgewiesen.
- Jede gespeicherte Dateiversion besitzt einen serverseitig berechneten SHA-256-Hash. Die
  Versionshistorie ist append-only und nach Dokument/Version eindeutig.
- D1-Checks erzwingen zusätzlich erlaubte Status-/Dateityp-/Eventwerte, Inhaltslänge,
  UTF-8-Bytezahl und das Format des gespeicherten SHA-256-Hashes.
- Provider-Schlüssel werden ausschließlich aus serverseitigen Laufzeit-Secrets gelesen.
- OpenAI, xAI, Anthropic und Gemini besitzen feste Zieladressen.
- Ein eigener kompatibler Endpunkt muss HTTPS ohne eingebettete Zugangsdaten verwenden.
- Chatinhalt ist auf 12.000 Zeichen, der globale Request-Body auf 32.000 Bytes begrenzt.
- Tagesbudgets begrenzen Anfragen und reservierte Modellaufrufe atomar in D1.
- Modellaufrufe besitzen ein Zeitlimit und festes Ausgabetokenbudget.
- Antworten setzen `nosniff`, `DENY`, Referrer- und Permissions-Policy sowie COOP.
- Next Server Actions sind nicht Teil des Produkts; entsprechende Requests werden verworfen.
- Die ungenutzte dynamische Bildoptimierung ist geschlossen.
- API-Antworten und nicht lesende Requests werden nicht gecacht.
- Fehlermeldungen geben keine Providerantwort oder Zugangsdaten vollständig aus.
- Kandidatenrohteile werden weder im Run-Trace noch im Gesprächsverlauf gespeichert.
- Execution Receipts behaupten keine Faktenverifikation allein aufgrund abgeschlossener
  Modellaufrufe.
- Korrigierte negative Antworten landen nur in einer Lernfallwarteschlange. Sie verändern weder
  den Masterprompt noch Modellgewichte ohne eingefrorenen Eval-Korpus und Promotion Gate.
- Der persistierte Zielkontext wird als nutzerverfasster Datenblock gekennzeichnet; er kann
  Masterprompt, Rechte oder Sicherheitsregeln nicht herabstufen.
- Persistierte Projektdateien werden als `UNTRUSTED_PROJECT_CONTEXT_JSON` eingebunden.
  Anweisungsartig formulierter Dateiinhalt bleibt Dateninhalt und ist Masterprompt,
  Sicherheitsregeln und aktuellem Nutzerauftrag untergeordnet. Das reduziert
  Prompt-Injection-Risiko, ersetzt aber kein unabhängiges Red Team.
- Jeder neue Modelllauf benötigt eine serverseitig gespeicherte Capability Lease für
  `model.run`. Die Lease ist an die gesalzene Nutzer-ID, genau einen Teammodus und
  wahlweise das Konto oder genau einen Projektbereich gebunden.
- Eine Lease gilt zwischen 15 Minuten und 24 Stunden und erlaubt höchstens 1 bis 20 Nutzungen.
  Die Weboberfläche erteilt standardmäßig nur eine einstündige Einmalfreigabe.
- Die Anlage wird durch einen bedingten D1-Insert auf höchstens 20 gleichzeitig aktive Leases
  begrenzt, sodass auch parallele Anfragen das Nutzerlimit nicht überschreiten.
- Die Lease-API akzeptiert höchstens 8.000 UTF-8-Bytes pro Mutation und prüft die tatsächlichen
  Bytes auch dann, wenn der Client keinen `Content-Length`-Header sendet.
- Fremde, abgelaufene, erschöpfte, widerrufene, modusfalsche oder projektfalsche Leases werden
  vor Quotenreservierung, Gesprächsanlage und Provideraufruf abgewiesen.
- Lease-Verbrauch und Run-Anlage erfolgen in derselben D1-Batch-Grenze. Eine eindeutige
  Ereigniskennung verhindert, dass ein Run ohne den zugehörigen Verbrauch oder ein
  Verbrauchs-Receipt ohne den zugehörigen Run entsteht.
- Erteilung, Verbrauch und Widerruf erzeugen append-only Receipts. Widerrufe verwenden eine
  erwartete Version; veraltete Paralleländerungen werden abgewiesen.
- `runs.capability_lease_id` belegt, welche Freigabe einen neuen Modelllauf autorisiert hat.
  Historische Runs vor v0.9.0 bleiben aus Migrationsgründen als ausdrücklich ältere
  Datensätze ohne Lease-Referenz erhalten.
- Memory-Einträge werden bei jeder Lese-, Recall-, Feedback- und Zustandsoperation nach der
  gesalzenen Nutzer-ID gefiltert. Projekt-Memory wird zusätzlich an genau die nutzereigene
  Projekt-ID gebunden.
- D1-Checks erzwingen Memory-Typ, Verifikationszustand, Retention-Klasse, Confidence-Bereich,
  Inhalts-/Bytegrenze, SHA-256-Format, 192 Embedding-Dimensionen, Zugriffszähler und Version.
- Der lokale Embedder benötigt keinen externen Schlüssel und sendet Memory-Inhalte an keinen
  zusätzlichen Embedding-Dienst. Das Modell ist deterministisch und dient Retrieval, nicht
  Tatsachenverifikation.
- Recalled Memory wird als `UNTRUSTED_RECALLED_MEMORY_JSON` eingebunden. Anweisungen in gespeicherten
  Einträgen bleiben Daten; aktuelle Nutzeranfrage, Rechte, Sicherheitsregeln und Masterprompt haben
  Vorrang.
- Automatisch konsolidierte Semantic-/Procedural-Einträge beginnen als `candidate`. Sie werden nicht
  allein wegen eines erfolgreichen Modelllaufs zu bestätigten Fakten.
- Positive Nutzerbewertung kann rungebundene Kandidaten bestätigen. Negative Bewertung bestreitet
  sie; eine ausdrückliche Nutzerkorrektur wird getrennt als bestätigter Eintrag mit Provenienz
  gespeichert.
- Recall erzeugt Zugriffszähler und append-only Events. Manuelle Zustandsänderungen verwenden eine
  erwartete Version; veraltete Paralleländerungen werden abgewiesen.
- Retention verschiebt inaktive Einträge von Hot nach Warm oder Cold. Ablauf und ausdrückliche
  Löschung setzen den Eintrag auf `revoked/deleted`, leeren den Inhalt und entfernen das aktive
  Embedding aus dem Suchraum.
- Werkzeugausführung verwendet eine eigene `tool_execution_leases`-Schicht. Jede Freigabe ist an
  die gesalzene Nutzer-ID, exakt einen Toolnamen, einen Konto- oder Projektbereich, eine Ablaufzeit
  und höchstens 1 bis 20 Nutzungen gebunden.
- Projektgebundene Tool-Freigaben und Jobs benötigen einen aktiven, nutzereigenen Projektbereich.
  Das kontoübergreifende oder projektfalsche Verwenden einer Lease wird vor Jobanlage blockiert.
- Tool-Lease-Verbrauch, Jobanlage, Verbrauchs-Receipt und initiales Job-Receipt liegen in einer
  D1-Batch-Grenze. Ein Job kann nicht ohne die zugehörige Freigabe entstehen.
- Ein nutzergebundener Idempotenzschlüssel verhindert Doppelanlage. Der serverseitige SHA-256 der
  normalisierten Eingabe bindet den Schlüssel an Tool, Lease, Projekt und Inhalt; abweichende
  Wiederverwendung wird als Konflikt abgewiesen.
- Ein Job darf nur aus `queued` mit der erwarteten Version und einem neuen, zufälligen Claim-Token
  nach `running` wechseln. Abschluss und Fehler schreiben nur bei exakt passendem Claim und
  passender Version.
- Verwaiste `running`-Claims werden erst nach fünf Minuten, nur innerhalb derselben Nutzer-ID und
  nur unterhalb der Versuchsgrenze wieder eingereiht. Jeder Recovery-Schritt erzeugt ein Event.
- Tool-Eingaben sind auf 24.000 UTF-8-Bytes, Ausgaben auf 48.000 Bytes und Aufträge auf höchstens
  drei Versuche begrenzt. D1-Checks erzwingen Toolnamen, Status, Version, Fortschritt und Hashformat.
- v0.12.0 erweitert die deterministische Basis um genau drei begrenzte Werkzeuge. `web.fetch`
  akzeptiert nur HTTPS ohne Zugangsdaten oder Sonderport, blockiert IP-Literale sowie lokale und
  typische Intranetnamen, folgt höchstens drei Redirects im manuellen Modus und validiert jedes Ziel
  erneut. Cookies und frei wählbare Request-Header sind nicht erlaubt.
- `web.fetch` verarbeitet nur HTML, Klartext, JSON und XML, stoppt nach 10 Sekunden oder 28.000
  Antwortbytes, speichert Quell-URL, finale URL, Abrufzeit, Content-Type, Redirectkette und SHA-256
  und kennzeichnet extrahierten Text ausdrücklich als `untrusted`. Prompt-Injection-Erkennung ist
  nur ein Warnsignal und kein Beweis für sichere Inhalte.
- Die Hostnamenprüfung verhindert direkte lokale/IP-Ziele, ersetzt aber keine DNS- und
  IP-basierte Egress-Policy. Vor allgemeiner Netzwerkfreigabe ist ein kontrollierter Egress-Proxy
  oder eine gleichwertige Auflösung mit Blockierung privater, reservierter und Link-Local-Netze
  gegen DNS-Rebinding Pflicht.
- v0.21.0 ergänzt davor eine zentrale Anwendungspolicy: Ohne
  `TANKAI_EGRESS_ALLOWED_HOSTS` ist `web.fetch` vollständig geschlossen. Exakte Hosts und
  ausdrückliche Wildcard-Subdomains werden vor dem ersten Request und nach jedem Redirect erneut
  geprüft; `TANKAI_EGRESS_DENIED_HOSTS` hat Vorrang. Das Werkzeugergebnis enthält nur den
  Policy-Hash und die passende Regel, keine vollständige Konfigurationsliste.
- v0.22.0 führt Mehrquellen-Recherche nicht als privilegiertes neues Netzwerkwerkzeug ein.
  Stattdessen benötigt jede der zwei bis vier Quellen eine eigene, explizit verbrauchte
  `web.fetch`-Nutzung und erzeugt einen nutzergebundenen dauerhaften Job mit Receipt. Doppelte URLs
  und Recherchen mit nur einem Host werden abgewiesen. Aggregierte Excerpts sind begrenzt,
  Prompt-Injection-Signale bleiben sichtbar und der gesamte Recherchebund trägt ausdrücklich
  `unverified-source-observations`; erfolgreiche Abrufe bestätigen keine Tatsachen.
- v0.23.0 streamt Tool-Fortschritt nur nach ChatGPT-Authentifizierung und exakter
  nutzergebundener Jobprüfung. Der SSE-Endpunkt liest ausschließlich Event- und
  Ausführungsstatusfelder; `input_json`, `output_json`, Eingabehash und Idempotenzschlüssel werden
  nicht selektiert oder übertragen. Cursor bestehen nur aus validierter Jobversion und Event-UUID.
  Das Streamfenster ist auf 15 Sekunden begrenzt, Heartbeats enthalten keine Daten und terminale
  Jobs schließen sofort. Jeder Datenframe trägt `executionStatusOnly: true` und
  `factsVerified: false`.
- v0.24.0 registriert alle 55 nutzerbezogenen D1-Datenmengen explizit. Der Export liest sie in
  einem transaktionalen Batch, hasht jede Datenmenge und den Gesamtinhalt und redigiert
  `claim_token` sowie Worker-Token-Hashes. Andere Nutzerkennungen werden durch feste
  `user_id`-Filter beziehungsweise eine nutzergebundene Join-Bedingung ausgeschlossen.
- Datenaktionen verlangen Authentifizierung und Same-Origin. Der JSON-Körper ist unabhängig von
  `Content-Length` auf 4.096 Bytes begrenzt; unbekannte Aktionsfelder werden abgewiesen.
- Ein Löschauftrag friert über die zentrale Authentifizierung alle gewöhnlichen TankAI-APIs ein.
  Bestätigung benötigt eine individuelle, nur gehasht gespeicherte Phrase; anschließend gilt eine
  24-Stunden-Widerrufsfrist. Aktive Modell-, Tool-, ReAct-, Commander-, TankBench- oder
  Deployment-Arbeit blockiert die Löschung.
- Die endgültige Löschung verwendet eine feste, referenzsichere Reihenfolge in einer
  D1-Transaktion. Danach werden alle 55 Datenmengen erneut gezählt. Ein Beleg wird nur bei
  vollständig leerem nutzereigenem Datensatz ausgegeben.
- Der dauerhaft verbleibende Löschbeleg speichert keine Nutzer-ID, E-Mail oder Nutzerinhalte,
  sondern ausschließlich Receipt-ID, Report-/Proof-Hash, Summenzahlen, Release und Abschlusszeit.
  Seine Prüfung bestätigt ausschließlich die TankAI-D1-Anwendungsdatenbank. Edge- und
  Sicherheitslogs, plattformverwaltete Backups sowie externe Modellanbieter sind ausdrücklich
  nicht abgedeckt.
- `project.document.inspect` bindet die SQL-Abfrage gleichzeitig an Datei-ID, Projekt-ID und
  Nutzer-ID. Es gibt nur begrenzte Vorschau- und Strukturdaten zurück und führt keine Dateiinhalte
  aus. `code.patch.inspect` analysiert ausschließlich Text-Diffs, markiert Pfadtraversal und
  Binärpatches und wendet keine Änderung an.
- `eval`, `new Function`, Shell, allgemeines Dateisystem, Codeausführung, automatische Websuche,
  weitergehende Tabellenaggregation, binäre Dokumentkonvertierung und MCP bleiben gesperrt, bis
  jeweils eigene Isolation, Rechte,
  Netzwerk-, Größen-, Kosten- und Receipt-Grenzen implementiert sind.

## Abhängigkeitsprüfung

Der produktive Abhängigkeitsbaum wurde auf Next.js 16.2.12 aktualisiert. PostCSS 8.5.23 und
Sharp 0.35.0 werden als geprüfte Sicherheitsüberschreibungen festgesetzt. Danach meldet
`npm audit --omit=dev --audit-level=high` **0 bekannte Schwachstellen**.

Die Cloudflare-Buildwerkzeuge stehen auf `@cloudflare/vite-plugin` 1.47.0 und
Wrangler 4.114.0. Das einzige kompatible Patchupdate dieses Releases hebt
`@eslint/eslintrc` von 3.3.5 auf 3.3.6. Der anschließend frisch abgefragte
vollständige Entwicklungs-, Peer- und Buildbaum meldet 21 Advisory-Einträge:
17 hoch, 4 moderat und 0 kritisch. Die Einträge liegen in Werkzeugketten um
ESLint, `minimatch`/`brace-expansion` und Drizzle Kit/`esbuild`. npm bietet für
den installierten Baum keinen weiteren kompatiblen In-Range-Fix; die
verbleibenden Vorschläge verlangen inkompatible Hauptversions- oder
Rückwärtswechsel und wurden deshalb nicht mit `--force` aktiviert. Diese Pakete
sind keine normalen Produktabhängigkeiten, wirken aber am Build mit. Builds
bleiben deshalb isoliert und reproduzierbar; Lockfile, Paketintegrität, Tests
und Artefaktvalidierung sind Pflicht.

Ein leerer npm-Produktionsaudit ist kein Beweis, dass keine unbekannte oder anwendungsspezifische
Schwachstelle existiert.

Vor einer allgemeinen kostenpflichtigen Freigabe bleiben deshalb Pflicht:

1. auf eine vom Hosting-Stack freigegebene reparierte Version aktualisieren,
2. unabhängiger Penetrationstest,
3. Prompt-Injection-, Auth-, Mandanten- und Quoten-Red-Team,
4. Backup- und Recovery-Löschfortpflanzung außerhalb der TankAI-D1-Anwendungsdatenbank,
5. Backup- und Recovery-Test,
6. Content-Security-Policy nach Prüfung aller produktiven Scriptpfade.

Der aktuelle private Release ist ein überprüfbarer Webkern, keine abgeschlossene
Produktionshärtung.


## Worker Runtime v0.13.0

Worker-Tokens werden nur einmal ausgegeben und ausschließlich gehasht gespeichert. Claims sind an Worker-ID, zufälligen Claim-Token und Ablaufzeit gebunden. Draining stoppt neue Claims; Widerruf beendet künftige Authentifizierung. Abgelaufene Claims werden kontrolliert neu eingereiht oder terminal als Dead Letter abgeschlossen.


## ReAct Orchestrator v0.14.0

ReAct-Läufe sind serverseitig nach Nutzer und optional Projekt getrennt. Jede Mutation benötigt die erwartete Laufversion. Werkzeugaktionen verwenden ausschließlich bestehende Tool-Leases und idempotente Tool-Jobs; der ReAct-Lauf selbst umgeht keine Tool-, Netzwerk- oder Worker-Grenze.

Persistiert werden nur kurze Entscheidungssummaries, Aktionen, Beobachtungen, Hashes und Events. Private Reasoning-Tokens und Chain-of-Thought werden nicht gespeichert. Schritt-, Modellentscheidungs- und Werkzeugbudgets besitzen harte D1-Checks. Ein ausgeschöpftes Budget endet terminal als `budget_exhausted`.


## Commander Orchestration v0.15.0

- Jeder Lauf referenziert eine aktive `model.run`-Capability-Lease im Modus `team`; jede Decision- und Review-Anfrage verbraucht atomar eine Nutzung.
- Der Capability-Verbrauch wird sowohl in der allgemeinen Lease-Historie als auch in `commander_capability_events` mit Lease-Version und Restnutzungen protokolliert.
- Schlägt der Capability-Verbrauch fehl, bleiben Commander-Version, Zyklen- und Modellbudget unverändert.
- Modellentscheidungen werden als streng begrenztes JSON validiert; unbekannte Felder oder Werkzeuge werden verworfen.
- Das Modell erhält keine Tool-Lease-ID. Nur der Server löst eine aktive, nicht abgelaufene, nutzer- und projektpassende Lease auf.
- Nicht autorisierte Werkzeugwahlen erzeugen keinen Tool Job und werden als `decision_rejected` protokolliert.
- Jede finale Kandidatenantwort benötigt ein Critic-Gate. Ohne Review-Budget gibt es keinen Erfolgsstatus.
- Rohantworten der Modelle werden nicht persistiert; gespeichert werden SHA-256, Provider-Metadaten, Laufzeit und strukturierte Zusammenfassungen.
- Projekt-, Memory- und Tool-Beobachtungen bleiben unvertrauenswürdige Daten und können den Masterprompt oder Sicherheitsvertrag nicht überschreiben.
- Ohne konfigurierten Provider endet der Lauf terminal mit `model_unavailable`; es wird keine Demo- oder Fallback-Antwort erzeugt.


## TankBench Improvement Control v0.16.0

- Benchmark-Suiten werden in einem Schritt vollständig angelegt, eingefroren und über SHA-256 gebunden; nachträgliche Fallmutation ist nicht vorgesehen.
- Fallauswertungen lesen ausschließlich nutzer- und projektgleiche Commander-/ReAct-Receipts. Fremde oder projektabweichende Läufe werden abgewiesen.
- Assertions sind auf eine feste Allowlist begrenzt: Status, enthaltene/ausgeschlossene Antwortfragmente, Modell-/Review-/Tool-/Zyklusbudgets, Toolnachweise, Critic-Freigabe und verworfene Entscheidungen.
- Eine Promotion benötigt das konfigurierte Mindestdelta, höchstens die erlaubte Regressionszahl sowie null Pflicht- und Safety-Verstöße.
- Releases können ausschließlich aus bestandenen TankBench-Läufen entstehen.
- Canary-Stufen sind fest auf 5, 25, 50 und 100 Prozent begrenzt. Jede Stufe benötigt eine Mindestzahl neuer Beobachtungen.
- Überschreitet eine Stufe Fehlerrate oder P95-Latenz, wird der Kandidat automatisch auf null Traffic gesetzt und auf den vorher aktiven Release referenziert.
- Alle Suite-, Lauf-, Ergebnis-, Canary- und Rollback-Mutationen sind nutzergebunden, versionsgeschützt und über append-only Events nachvollziehbar.
- Offene Grenze: Beobachtungen werden derzeit über eine authentifizierte API angenommen; kryptografisch signierte Telemetrie und unabhängige Produktions-Metrikquellen folgen vor öffentlichem Rollout.

## Suite Runner und Traffic Routing v0.17.0

- Baseline und Kandidat verwenden getrennte, serverseitig validierte `model.run`-Freigaben.
- Der Runner kann keine Modell- oder Toolfreigabe erfinden.
- Ausführungselemente sind nutzer-, projekt-, Suite- und Fallgebunden.
- Fortschritt wird versioniert; parallele Änderungen werden als Konflikt abgewiesen.
- Routing verwendet einen stabilen SHA-256-Bucket und ausschließlich `active`-/`canary`-Releases.
- Jede Auswahl erzeugt ein unveränderliches Receipt ohne Speicherung des Klartext-Routing-Schlüssels.

## Deployment Controller v0.18.0

- Nur TankBench-Releases im Zustand `candidate`, `canary` oder `active` erhalten eine Deployment-Konfiguration.
- Provider-IDs werden ausschließlich gegen die serverseitig tatsächlich konfigurierten Provider aufgelöst. API-Schlüssel und Endpunkte werden nicht an den Browser ausgegeben.
- Routing-IDs, Requests und Antworten werden in Deployment-Receipts ausschließlich als SHA-256 gespeichert. Klartextantworten werden nur im aktuellen authentifizierten Response zurückgegeben.
- Produktive Canary-Aufrufe schreiben reale Erfolgs-, Fehler- und Latenzbeobachtungen in die bestehenden TankBench-Gates.

## React Deployment Control Plane v0.19.0

- Die React-Seite `/deployment` ist authentifiziert und lädt ausschließlich nutzer- und projektgebundene Releases, Konfigurationen, Circuits, Metriken und Traces.
- Mutationen verlangen Same-Origin und optimistische Versionen. Veraltete Traffic-, Konfigurations- oder Circuit-Änderungen werden abgewiesen.
- Eine Provider-Kette enthält genau einen Primärprovider und höchstens drei eindeutige Fallbacks. Alle IDs müssen beim Speichern serverseitig konfiguriert sein.
- Einzelne Providerfehler werden als begrenzte Attempt-Receipts protokolliert. Die Kette endet beim ersten Erfolg oder nach höchstens vier Versuchen.
- Circuit Breaker besitzen die Zustände `closed`, `open` und `half_open`. Ein offener Circuit blockiert Aufrufe bis zum serverseitigen Probezeitpunkt. `half_open` lässt genau einen Probeversuch gleichzeitig zu.
- Fehlergrenze, Recovery-Zeit und benötigte Probe-Erfolge sind releasegebunden und Teil des gehashten Konfigurationsstands.
- Manuelles Canary-Traffic-Shifting ist ausschließlich für den aktuellen Canary desselben Projekts erlaubt. Es ändert keinen Release- oder Promotion-Status und kann versioniert an die TankBench-Automatik zurückgegeben werden.
- Live-Metriken werden aus gespeicherten Request-Receipts berechnet. Prompt- und Antwortklartext werden weder für Metriken noch für Traces persistiert.
- Ein manueller Circuit-Reset erzeugt ein append-only Control-Event und setzt nur den exakt versionierten, nutzereigenen Circuit zurück.


## Reliability & Operations v0.20.0

- Jeder produktive Deployment-Request passiert vor Routing und Providerarbeit eine atomare, projektgebundene Admission-Prüfung.
- Minutenfenster und In-flight-Zähler werden in D1 geführt. Überschreitungen enden mit eindeutigen `429`- beziehungsweise `503`-Fehlercodes, bevor Providerkosten entstehen.
- In-flight-Leases besitzen eine begrenzte Laufzeit. Verwaiste Leases werden serverseitig bereinigt und als Operations-Receipt dokumentiert.
- SLO-Snapshots werden ausschließlich aus realen nutzer- und projektgebundenen Deployment-Receipts berechnet. Erfolgsrate und P95-Latenz verwenden konfigurierbare Mindestmengen und Schwellen.
- Aktive Alerts sind nach Projekt und Signal dedupliziert. Unveränderte Werte erzeugen innerhalb des Cooldowns keine Eventflut; Recovery löst den bestehenden Alert nachvollziehbar auf.
- Dead-Letter-Replay verändert den ursprünglichen Job nicht. Er erzeugt einen neuen Job und erfordert den atomaren Verbrauch einer neuen, aktiven und zum Werkzeug sowie Projekt passenden Tool Execution Lease.
- Der Operations-Audit-Export enthält nur Hashes, Statuswerte, Metriken, Alertzustände, Replay-Verknüpfungen und append-only Events. Prompt-, Providerantwort- und Tool-Eingabeklartext werden nicht exportiert.
- Operations-Mutationen verlangen Authentifizierung, Same-Origin und erwartete Versionen. Projektfremde Richtlinien, Alerts, Jobs oder Leases werden abgewiesen.
- Offene Grenze: globale Multi-Region-Admission und eine unabhängige externe Telemetrie-/Alert-Senke sind noch nicht implementiert.


## Öffentliche Release-Verifikation (v0.27.0)

- `/api/public-readiness` ist absichtlich öffentlich, gibt aber nur boolesche
  Konfigurationszustände, Release-/Contract-Versionen und feste Blockercodes aus.
- Secret-Werte, Nutzerkennungen, Providerantworten, Prompts, Datenbankinhalte und
  interne Hosting-Tokens werden nicht ausgegeben.
- Die Anwendung behauptet ihre öffentliche Erreichbarkeit nicht selbst. DNS,
  HTTPS und Hosting-Zielgruppe werden ausschließlich durch den externen
  Deployment-Verifier bestätigt.
- `/app` bleibt für anonyme externe Aufrufe durch Sign in with ChatGPT geschützt.
- Der Prüfer blockiert Nicht-HTTPS-Ziele und Landingpages mit Placeholder- oder
  Coming-soon-Sprache.


## Öffentliche Deployment-Pipeline (v0.28.0)

- Die Produktionskonfiguration wird aus validierten Laufzeitwerten erzeugt, mit Modus `0600`
  geschrieben und nach dem Deployment entfernt.
- D1-ID, Workername, Datenbankname und optionale Custom Domain werden syntaktisch geprüft.
- `TANKAI_ID_SALT` wird ausschließlich über `wrangler secret put` übertragen und erscheint weder
  in der generierten Konfiguration noch im Deployment Receipt.
- Provider-Schlüssel werden durch diesen Workflow nicht automatisch gesetzt.
- Vor Migration und Deployment müssen Lint, Produktionsbuild und Tests bestehen.
- Nach dem Deploy müssen öffentliche DNS-Auflösung, HTTPS-Landingpage, Readiness-Endpunkt und der
  anonyme Auth-Redirect bestehen.
- Das Receipt enthält nur Statuswerte, Zeitpunkte, Zieladresse und Hashes; keine Zugangsdaten.

## Typgesicherte CSV-Aggregationen (v0.29.0)

- Aggregationen laufen nur auf bereits statisch validierten CSV-Daten und nach erneuter
  Formel-Injection-Prüfung.
- Höchstens acht eindeutige Spalten-/Operationspaare sind erlaubt; unbekannte Felder und
  Operationen werden vor Ausführung abgewiesen.
- Summe, Minimum, Maximum und Mittelwert akzeptieren nur global rein numerische oder vollständig
  leere Spalten. Gemischte Text-/Zahlenspalten werden nicht teilweise ausgewertet.
- Leere Zellen werden als Nullwerte gezählt und aus der Berechnung ausgeschlossen.
- Kompensierte Summierung und eine feste Ausgabepräzision von 15 signifikanten Stellen verhindern
  instabile Binär-Gleitkommaartefakte; nicht endliche Ergebnisse werden abgewiesen.
- Aggregationen bleiben nutzer-, projekt-, dokument- und Lease-gebunden, führen weder Formeln noch
  Code aus und bestätigen die Wahrheit der Quelldaten nicht.

## Begrenzte gruppierte CSV-Aggregationen (v0.30.0)

- Gruppierung ist auf zwei eindeutige Spalten und acht ausgegebene Gruppen begrenzt.
- Sie erfolgt ausschließlich auf den bereits gefilterten, statisch validierten CSV-Zeilen.
- Gruppenschlüssel werden NFKC-normalisiert und für den Vergleich groß-/kleinschreibungsunabhängig
  behandelt; leere Schlüssel bilden eine explizite Nullgruppe.
- Schlüssel oberhalb der sicheren Ausgabelänge werden abgewiesen, damit getrennte Gruppen nicht
  durch gekürzte Anzeige identisch erscheinen.
- Gesamtzahl, ausgegebene Zahl und abgeschnittene Zahl der Gruppen werden getrennt ausgewiesen;
  die feste Ausgabegrenze wird nicht als vollständiges Ergebnis dargestellt.
- Alle bestehenden Typ-, Zahlenbereichs-, Formel-Injection-, Eigentums- und Lease-Prüfungen
  gelten unverändert für jede Gruppe.

## Typgesicherte CSV-Häufigkeitsverteilungen (v0.31.0)

- Höchstens drei eindeutige Spalten und zehn ausgegebene Buckets je Spalte sind erlaubt.
- Verteilungen werden ausschließlich nach den bestehenden Filtern auf bereits statisch
  validierten CSV-Zeilen berechnet.
- Gemischte Spaltentypen werden abgewiesen; Zahlen und Boolesche Werte werden als typisierte
  Werte ausgegeben, Nullwerte bleiben explizit.
- Textidentitäten sind NFKC-normalisiert und groß-/kleinschreibungsunabhängig; der erste sichere
  Anzeigenwert bleibt erhalten.
- Gesamt-, Ausgabe- und Restzähler verhindern, dass begrenzte Buckets als vollständige Verteilung
  erscheinen.
- Überlange Textwerte werden abgewiesen. Gruppierung und Häufigkeitsverteilung dürfen wegen des
  festen Werkzeugbudgets nicht in derselben Abfrage kombiniert werden.
- Formel-Injection-, Eigentums-, Projekt-, Dokument- und Lease-Prüfungen gelten unverändert.

## Begrenzte numerische CSV-Histogramme (v0.32.0)

- Höchstens drei eindeutige Spalten und zwei bis zwölf Buckets pro Histogramm sind erlaubt.
- Nur global homogene numerische Spalten werden verarbeitet; gemischte, textuelle und vollständig
  leere Spalten werden abgewiesen.
- Minimum, Maximum, Intervallbreite und jede Intervallgrenze werden explizit ausgegeben; das
  Maximum wird ausschließlich dem letzten, oben inklusiven Bucket zugeordnet.
- Nullwerte werden getrennt gezählt. Konstante Daten erzeugen einen markierten degenerierten
  Einzelbucket und keine erfundenen Bereiche.
- Histogramme, Häufigkeiten und gruppierte Aggregationen dürfen wegen des festen Ausgabebudgets
  nicht in derselben Abfrage kombiniert werden.
- Formel-Injection-, Eigentums-, Projekt-, Dokument- und Lease-Prüfungen gelten unverändert.

## Begrenzte numerische CSV-Quantile (v0.33.0)

- Höchstens drei eindeutige Spalten und ein bis neun eindeutige Wahrscheinlichkeiten zwischen
  0 und 1 je Spalte sind zulässig.
- Nur global homogene numerische Spalten werden verarbeitet; gemischte, textuelle, vollständig
  leere oder nach Filtern zahlenlose Spalten werden abgewiesen.
- Die R7-Regel `(n - 1) × p` ist fest verdrahtet. Rang, Indexgrenzen und Interpolationsgewicht
  werden ausgegeben, damit kein stiller Methodenwechsel möglich ist.
- Die gewichtete Interpolation vermeidet eine unnötig überlaufende Differenz bei extremen
  endlichen Gegenwerten; nicht endliche Resultate werden dennoch vollständig blockiert.
- Quantile, Histogramme, Häufigkeiten und gruppierte Aggregationen dürfen wegen des festen
  Ausgabebudgets nicht in derselben Abfrage kombiniert werden.
- Formel-Injection-, Eigentums-, Projekt-, Dokument- und Lease-Prüfungen gelten unverändert.

## Begrenzte numerische CSV-Ausreißer (v0.34.0)

- Höchstens drei eindeutige global numerische Spalten werden je Abfrage geprüft.
- Die Methode ist fest auf Tukey-IQR mit R7-Quartilen und Faktor 1,5 gesetzt; ein stiller
  Methoden- oder Faktorwechsel ist ausgeschlossen.
- Leere, gemischte, textuelle oder nach Filtern zahlenlose Spalten sowie nicht endliche
  Quartile, IQRs oder Fences werden abgewiesen.
- Nur Werte strikt außerhalb der ausgewiesenen Fences gelten als Ausreißer.
- Höchstens 20 deterministisch sortierte Treffer je Spalte werden ausgegeben; Gesamt-, Ausgabe-
  und Trunkierungszähler legen die Begrenzung offen.
- Ausreißer werden nicht mit Quantilen, Histogrammen, Häufigkeitsverteilungen oder gruppierten
  Aggregationen kombiniert, damit das feste Ausgabebudget erhalten bleibt.
- Formel-Injection-, Eigentums-, Projekt-, Dokument- und Lease-Prüfungen gelten unverändert.

## Begrenzte numerische CSV-Streuungsstatistik (v0.35.0)

- Höchstens drei eindeutige global numerische Spalten werden je Abfrage verarbeitet.
- Der Aufrufer muss Grundgesamtheit (`N`) oder Stichprobe (`N−1`) ausdrücklich wählen; Modus und
  verwendeter Nenner sind Bestandteil des Ergebnisses.
- Stichproben mit weniger als zwei numerischen Werten werden abgewiesen.
- Der Welford-Algorithmus vermeidet die instabile Differenz großer Quadratsummen; nicht endliche
  Zwischenergebnisse und Resultate werden dennoch vollständig blockiert.
- Leere, gemischte, textuelle oder nach Filtern zahlenlose Spalten werden abgewiesen.
- Streuungsstatistik wird nicht mit anderen Verteilungsarten oder gruppierten Aggregationen
  kombiniert, damit das feste Ausgabebudget erhalten bleibt.
- Formel-Injection-, Eigentums-, Projekt-, Dokument- und Lease-Prüfungen gelten unverändert.

## Begrenzte numerische CSV-Kovarianz/Korrelation (v0.36.0)

- Höchstens drei eindeutige geordnete Paare aus jeweils zwei verschiedenen numerischen Spalten.
- Ausschließlich vollständige Zahlenpaare werden verwendet; Nullzeilen werden vollständig und
  separat gezählt, nicht stillschweigend ersetzt oder imputiert.
- Grundgesamtheit (`N`) oder Stichprobe (`N−1`) muss ausdrücklich gewählt werden.
- Eine bivariate Welford-Berechnung vermeidet instabile Differenzen großer Produktsummen.
- Nicht endliche Zwischenwerte, Kovarianzen oder Korrelationen werden blockiert.
- Nullvarianz erzeugt eine ausdrücklich undefinierte Korrelation statt `NaN`, Unendlich oder Null.
- Kovarianz/Korrelation wird nicht mit anderen Verteilungsarten oder gruppierten Aggregationen
  kombiniert, damit das feste Ausgabebudget erhalten bleibt.
- Formel-Injection-, Eigentums-, Projekt-, Dokument- und Lease-Prüfungen gelten unverändert.

## Begrenzte einfache lineare CSV-Regression (v0.37.0)

- Höchstens drei eindeutige geordnete Paare aus verschiedenen global numerischen Spalten.
- Nur vollständige Zahlenpaare werden verwendet; Nullwerte und ausgeschlossene Zeilen bleiben
  sichtbar und werden nicht imputiert.
- Nullvarianz der erklärenden x-Spalte blockiert das Modell als mathematisch degeneriert.
- Die OLS-Gleichung ist verbindlich `y = intercept + slope × x`; x und y dürfen nicht vertauscht
  oder als symmetrische Beziehung ausgegeben werden.
- `R²` bleibt bei Nullvarianz der y-Spalte ausdrücklich undefiniert.
- Residuen-MSE und Residualstandardfehler verwenden `n−2`; ohne positive Freiheitsgrade bleiben
  sie ausdrücklich undefiniert.
- Höchstens 20 Residuen je Paar werden zeilenstabil ausgegeben; Gesamt-, Ausgabe- und
  Trunkierungszähler legen die Begrenzung offen.
- Nicht endliche Zwischen- oder Endergebnisse werden blockiert. Regression wird nicht mit
  Verteilungs-, Beziehungs- oder Gruppenausgaben kombiniert.
- Formel-Injection-, Eigentums-, Projekt-, Dokument- und Lease-Prüfungen gelten unverändert.

## Begrenzte CSV-Regressionsvorhersagen (v0.38.0)

- Pro Regressionspaar werden höchstens zehn eindeutige endliche x-Werte akzeptiert.
- Jede Vorhersage wird anhand des beobachteten x-Minimums und x-Maximums ausdrücklich als
  Interpolation oder als niedrige/hohe Extrapolation markiert.
- Es werden keine Konfidenzintervalle vorgetäuscht. Die Ausgabe enthält genau die fest definierte
  Ein-Sigma-Regel aus Residualstandardfehler und Leverage für mittlere Antwort und neue Beobachtung.
- Ohne positive Residuen-Freiheitsgrade bleiben Unsicherheitswerte ausdrücklich undefiniert.
- Überläufe, nicht endliche Werte, doppelte Werte und Überschreitung des Mengenlimits werden
  vollständig abgewiesen.
- Formel-Injection-, Eigentums-, Projekt-, Dokument-, Lease- und Ausgabebudget-Prüfungen bleiben
  unverändert.

## Begrenzte CSV-Regressionsintervalle (v0.39.0)

- Es sind ausschließlich die expliziten Konfidenzstufen 90 %, 95 % und 99 % zulässig.
- Intervallberechnung verwendet die Residuen-Freiheitsgrade `n−2` und einen zweiseitigen
  Student-t-Kritikalwert; eine Normalverteilungsnäherung wird nicht stillschweigend eingesetzt.
- Ohne positive Freiheitsgrade werden keine Intervalle erzeugt und der Grund bleibt sichtbar.
- Kritikalwerte, Margen und Intervallgrenzen müssen endlich bleiben; Überläufe blockieren die
  vollständige Abfrage.
- Intervalle erfordern bereits begrenzte Vorhersagewerte und erweitern weder Datenzugriff noch
  Seiteneffekte.

## Begrenzte CSV-Regressionsdiagnostik (v0.40.0)

- Leverage wird ausschließlich aus der gebundenen OLS-Stichprobe berechnet und auf `[0,1]`
  validiert; nicht endliche oder numerisch unzulässige Ergebnisse blockieren die Abfrage.
- Intern studentisierte Residuen verwenden den bereits ausgewiesenen Residualstandardfehler und
  `sqrt(1−hᵢ)`; es gibt keine externe Ausführung oder Datenweitergabe.
- Fehlende Freiheitsgrade, Standardfehler null und Leverage eins erzeugen `null` plus expliziten
  Grund statt `NaN`, Unendlich oder einer erfundenen Kennzahl.
- Schwellen `4/n` und `|rᵢ| > 2` sind maschinenlesbare Diagnosehilfen, keine verifizierten Fakten
  oder automatische Lösch-, Trainings- oder Modellentscheidungen.
- Die bestehenden Formel-Injection-, Eigentums-, Projekt-, Dokument-, Lease-, Residuen- und
  Ausgabebudget-Sperren bleiben unverändert.

## Begrenzte CSV-Einflussdiagnostik (v0.41.0)

- Cook-Distanz wird ausschließlich aus bereits validiertem Leverage und intern studentisiertem
  Residuum berechnet; es entsteht kein neuer Datenzugriff oder externer Seiteneffekt.
- Die feste Schwelle `4/n` bleibt Diagnosehilfe. Sie löst keine automatische Datenlöschung,
  Trainingsaufnahme, Modelländerung oder Faktenbehauptung aus.
- Ist die zugrunde liegende Residualdiagnostik undefiniert, bleibt Cook-Distanz `null`; der
  vorhandene maschinenlesbare Grund bleibt erhalten.
- Negative, nicht endliche oder überlaufende Distanzen blockieren die vollständige Abfrage.
- Undefiniertheitsgründe werden bei definierten Werten ausgelassen, um das feste 40.000-Byte-
  Ausgabebudget ohne Kürzung der bisherigen Residuenmenge einzuhalten.

## Begrenzte CSV-PRESS-Diagnostik (v0.42.0)

- PRESS-Residuen werden ausschließlich aus bereits gebundenen OLS-Residuen und validiertem
  Leverage berechnet; es entsteht kein neuer Datenzugriff oder externer Seiteneffekt.
- Die PRESS-Summe verwendet alle vollständigen Paare, während die sichtbare Residuenliste bei 20
  bleibt; Gesamt-, Ausgabe- und Trunkierungszähler verhindern eine falsche Vollständigkeitsannahme.
- Leverage eins und Antwort-Nullvarianz erzeugen explizite Undefiniertheitsgründe statt `NaN`,
  Unendlich oder erfundener Kennzahlen.
- Negatives vorhergesagtes R² bleibt als ehrliches Diagnosesignal erhalten und löst keine
  automatische Lösch-, Trainings-, Modell- oder Faktenentscheidung aus.
- Regressionsantworten begrenzen die gleichzeitig zurückgegebenen gewöhnlichen Tabellenzeilen auf
  fünf und weisen diese effektive Grenze im Policy-Objekt aus; das 40.000-Byte-Budget bleibt unter
  maximaler Paar-, Vorhersage- und Residuenlast geprüft.

## Begrenzte extern studentisierte Residuen (v0.43.0)

- Die gelöschte Fehlervarianz wird ausschließlich aus der bereits gebundenen OLS-Stichprobe,
  validiertem Leverage und Residuum berechnet; es entsteht kein neuer Zugriff oder Seiteneffekt.
- Leverage eins, fehlende gelöschte Freiheitsgrade und eine gelöschte Fehlervarianz null werden
  als getrennte Undefiniertheitsgründe ausgegeben statt durch `NaN` oder Unendlich ersetzt.
- Eine skalierte Rundungstoleranz darf nur winzige SSE-Reste auf null setzen. Materiell negative,
  nicht endliche oder überlaufende Zwischenwerte blockieren die vollständige Abfrage.
- Die Schwelle `|tᵢ| > 2` ist ausschließlich eine Diagnosehilfe und löst keine automatische
  Lösch-, Trainings-, Modell-, Ursachen- oder Faktenentscheidung aus.
- Bei Regression beträgt die zusätzliche gewöhnliche Tabellenzeilenausgabe null; die effektive
  Grenze steht im Policy-Objekt. Das maximale Drei-Paar-Ergebnis bleibt mit allen bisherigen
  Vorhersagen und Residuen unter 40.000 Byte.
- Die transitive Produktionsbindung `nanoid` ist auf 3.3.18 angehoben, nachdem 3.3.17 durch ein
  neues Advisory als betroffen erkannt wurde; der Produktionsbaum wird danach erneut geprüft.
