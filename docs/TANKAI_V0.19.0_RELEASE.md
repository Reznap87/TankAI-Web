# TankAI Web v0.19.0 – React Deployment Control Plane

v0.19.0 macht den Deployment Controller als echte React-Control-Plane bedienbar und ergänzt ausfallsichere Provider-Routen.

## React-Oberfläche

Die geschützte Seite `/deployment` bietet:

- Projekt- und Release-Auswahl,
- Primärprovider plus bis zu drei geordnete Fallbacks,
- Token-, Fehler-, Recovery- und Half-open-Konfiguration,
- Live-Metriken für 15 Minuten, 60 Minuten und 24 Stunden,
- manuelles Canary-Traffic-Shifting von 0 bis 100 Prozent,
- Rückgabe der Traffic-Steuerung an TankBench,
- produktive Testrequests,
- Circuit-Breaker-Status und manuellen Reset,
- Request-Traces mit einzelnen Provider-Versuchen.

## Provider-Fallback

Jeder produktive Request arbeitet eine serverseitig gehashte Provider-Kette ab. Nicht konfigurierte Provider werden als `unavailable` protokolliert. Offene Circuit Breaker werden als `skipped_open` übersprungen. Der erste erfolgreiche Provider beendet die Kette.

## Circuit Breaker

- `closed`: normaler Betrieb,
- `open`: Requests werden bis zum nächsten Probezeitpunkt übersprungen,
- `half_open`: genau ein Wiederherstellungsversuch ist freigegeben.

Fehlergrenze, Recovery-Zeit und benötigte Probe-Erfolge sind releasegebunden. Zustandsänderungen verwenden optimistische Versionen und append-only Control-Events.

## Traffic Control

Manuelle Canary-Prozente sind projekt- und releasegebunden, versioniert und verändern keinen Promotion-Status. Beim Deaktivieren gilt wieder die automatische TankBench-Stufe.

## Datenschutz

Request- und Routing-Inhalte werden nur als SHA-256 gespeichert. Antwortklartext wird an den authentifizierten Aufrufer zurückgegeben, aber nicht in den Deployment-Traces persistiert.

## Verifikation

- vollständiger Fallback-Lifecycle mit echtem D1-kompatiblem SQLite,
- Öffnen, Überspringen und Zurücksetzen von Circuit Breakern,
- versioniertes Traffic-Shifting und Rückkehr zur Automatik,
- einzelne Request-Attempts und Foreign-Key-Integrität,
- bestehende Commander-, ReAct-, TankBench-, Worker-, Tool- und Memory-Verträge.

## Abschließender Prüfnachweis

- 59 von 59 nicht buildabhängigen Vertrags- und Laufzeittests bestanden,
- 69 TypeScript-/TSX-/MTS-Dateien ohne Transpile-Syntaxfehler,
- isolierte Strict-Typechecks für Runtime, API und React-UI bestanden,
- 210 SQL-Migrationsschritte auf einer frischen Datenbank bestanden,
- verlustfreies Upgrade eines befüllten v0.18-Deployment-Datenstands bestanden,
- 0 Fremdschlüsselverletzungen,
- Installationsskripte im Release ausführbar (`0755`).

Der vollständige Vinext-Produktionsbuild wurde nicht ausgeführt, weil der vorab
integritätsgeprüfte Paketdownload am konfigurierten npm-Gateway mit HTTP 503
scheiterte (`npm run install:ci`, Exit 22). Ein erfolgreicher Produktionsbuild
oder ein Deployment wird daher nicht behauptet.
