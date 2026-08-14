# TankAI Web v0.28.0 – Public Deployment Pipeline

Statusdatum: 29. Juli 2026

## Gelieferter Produktfortschritt

Dieser Release ersetzt den bislang nur beschriebenen letzten Publish-Schritt durch einen
vollständig ausführbaren Cloudflare-Produktionspfad.

- deterministisch generierte, nicht eingecheckte Wrangler-Produktionskonfiguration
- verpflichtende Validierung einer realen D1-Datenbank-ID
- gebundener Vinext-Worker unter `dist/server/index.js`
- statische Assets unter `dist/client` mit Worker-first-Ausführung
- D1-Bindung `DB` und Migrationen aus `drizzle/`
- geschützte Installation von `TANKAI_ID_SALT` als Cloudflare Secret
- keine automatische Aktivierung von Modellprovider-Schlüsseln
- Lint, Produktionsbuild und vollständige Tests vor jeder Veröffentlichung
- Remote-Migration vor dem Worker-Deploy
- Ermittlung der veröffentlichten HTTPS-Adresse
- anschließende externe Prüfung von DNS, Landingpage, Readiness-Endpunkt und Auth-Schutz
- dauerhaftes Deployment Receipt mit Quellhash und Verification-Hash
- GitHub-Actions-Workflow mit geschützter `production`-Umgebung und serieller Ausführung

## Sicherheitsgrenzen

Die generierte Wrangler-Datei enthält weder den Identity-Salt noch Provider-Schlüssel. Sie wird
mit Dateimodus `0600` erzeugt und nach dem Lauf entfernt. Das Deployment-Skript akzeptiert keine
leere oder syntaktisch ungültige D1-ID und verweigert Identity-Salts unter 32 Zeichen.

Provider-Schlüssel werden bewusst nicht gesetzt. Ein öffentlicher Webrelease kann dadurch online
gehen, während `/api/public-readiness` den Modellpfad weiterhin korrekt als nicht bereit meldet.
Eine spätere Provider-Aktivierung bleibt ein eigener, kontrollierter Secret- und Promotion-Schritt.

## Tatsächlich ausgeführte Prüfung

- Shell-Syntaxprüfung des Deployment-Skripts
- Node-Syntaxprüfung des Konfigurationsgenerators
- Konfigurations- und Source-Contract-Tests
- Prüfung der D1-ID-Validierung
- Prüfung der Domainvalidierung
- Prüfung der Secret-Redaction
- Prüfung des Dateimodus `0600`
- Prüfung, dass der Workflow ausschließlich geschützte Secrets und Variablen referenziert

## Externer Veröffentlichungsblocker

Der produktive Codepfad ist vorhanden, konnte in dieser Laufzeit aber nicht bis Cloudflare
ausgeführt werden. Der verbundene GitHub-Account besitzt keine installierte GitHub-App-Installation
und kein zugängliches Repository. Außerdem sind weder `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`, `TANKAI_D1_DATABASE_ID` noch `TANKAI_ID_SALT` in der Laufzeit vorhanden.
Die bestehende npm-Spiegelung liefert weiterhin benötigte Tarballs nicht aus, weshalb auch der
vollständige Build in dieser Laufzeit nicht erneut ausführbar war.

## Ausführung im berechtigten Zielsystem

Der reale Publish-Befehl lautet:

```bash
npm run deploy:public
```

Er beendet sich vor jeder Hosting- oder Datenbankänderung mit Exitcode 78, solange erforderliche
Cloudflare- und D1-Werte fehlen. Nur ein Lauf mit bestandenem externem Verification Receipt darf
TankAI Web als öffentlich online ausweisen.
