# TankAI Web v0.9.0 – Release Receipt

Datum: 26. Juli 2026

## Reifegrad

TankAI Web v0.9.0 ist der dritte private R2-Webrelease. Er ergänzt langlebige
Ziele und versionierte Projektbereiche um serverseitig durchgesetzte Capability
Leases. Ein neuer Modelllauf ist damit nicht mehr allein durch eine
authentifizierte Anfrage autorisiert: Er benötigt eine aktive, passende und
noch nicht erschöpfte Freigabe für `model.run`.

Der verbindliche Masterprompt bleibt unverändert auf 2.1.0. TankAI hat weder
Prompt noch Modellgewichte automatisch verändert. Masterplan 2.4.0
dokumentiert ausschließlich den geprüften R2-Produktfortschritt.

## Neu in v0.9.0

- Authentifizierte Nutzer können zeitlich und mengenmäßig begrenzte
  `model.run`-Freigaben erteilen, auflisten und widerrufen.
- Jede Lease ist an die serverseitig abgeleitete Nutzer-ID, genau einen
  Teammodus und wahlweise das Konto oder einen nutzereigenen aktiven
  Projektbereich gebunden.
- Gültigkeitszeiten liegen zwischen 15 Minuten und 24 Stunden; eine Lease
  erlaubt 1 bis 20 Nutzungen. Die Weboberfläche erteilt standardmäßig eine
  einstündige Einmalfreigabe.
- Ein bedingter D1-Insert begrenzt auch parallele Anlagen auf höchstens 20
  gleichzeitig aktive Freigaben pro Nutzer.
- Die Lease-API prüft ihr 8.000-Byte-Limit am tatsächlichen UTF-8-Inhalt und
  damit auch ohne vom Client gelieferten `Content-Length`-Header.
- Fremde, abgelaufene, erschöpfte, widerrufene, modusfalsche und
  projektfalsche Leases werden vor Quotenreservierung, Gesprächsanlage,
  Nutzernachricht und Provideraufruf abgewiesen.
- Erteilung, Verbrauch und Widerruf erzeugen unveränderliche
  `capability_lease_events`. Widerrufe sind durch die erwartete Lease-Version
  gegen parallele veraltete Änderungen geschützt.
- Lease-Verbrauch und Run-Anlage erfolgen in derselben D1-Batch-Grenze. Run,
  Lease und Verbrauchs-Receipt teilen eine eindeutige Ereigniskennung.
- Der letzte erlaubte Verbrauch setzt die Lease atomar auf `depleted`;
  Wiederholungen können keinen zweiten Lauf autorisieren.
- `runs.capability_lease_id` belegt die konkrete Freigabe jedes neuen Laufs.
  Ältere Runs bleiben als ausdrücklich historische Datensätze ohne
  nachträglich erfundene Lease-Zuordnung erhalten.
- Die geschützte Weboberfläche zeigt Modus, Geltungsbereich, Ablauf,
  Restnutzungen und Widerruf. Ohne passende Lease bleibt die Sendeaktion
  gesperrt.
- Der Providerstatus wird vor der Lease geprüft. Ohne Server-Secret entsteht
  deshalb weder eine unnötige Freigabe-Nutzung noch eine behauptete
  Modellantwort.
- Binäre R2-Ablage wurde nicht aktiviert; das R2-Binding bleibt ohne bewusste
  Kosten- und Betriebsfreigabe leer.

## Datenmigration

Migration `0004_complete_rawhide_kid.sql` erstellt
`capability_leases` und `capability_lease_events`, ergänzt die optionale
Lease-Referenz in `runs` und legt Nutzer-, Status-, Ablauf-, Projekt-, Run- und
Ereignisindizes an.

Die vollständige Migrationskette 0000–0004 wurde gegen eine frische lokale
D1-Instanz ausgeführt:

- 0000: 12 Schema-SQL-Schritte
- 0001: 3 Schema-SQL-Schritte
- 0002: 9 Schema-SQL-Schritte
- 0003: 18 Schema-SQL-Schritte
- 0004: 10 Schema-SQL-Schritte
- Gesamt: 52 Schema-SQL-Schritte

Wrangler bestätigte zusätzlich je Migration den eigenen
Migrationsbuchhaltungsschritt und führte damit 57 Befehle vollständig aus.

Ein tatsächlicher D1-Verbrauchstest bestätigte für eine Einmalfreigabe:

- Lease-Status nach Verbrauch: `depleted`
- Restnutzungen: 0
- Lease-Version: 2
- angelegte Runs: 1
- Lease-Ereignisse: 2
- erneuter bedingter Verbrauch: keine Zustandsänderung und kein zweiter Run

Eine absichtlich inkonsistente Konto-Lease mit Projekt-ID wurde von
`capability_leases_scope_check` mit einem D1-Constraint-Fehler abgewiesen.
Ein tatsächlicher Grenztest legte 20 aktive Leases an; der identische
bedingte Insert für Lease 21 erzeugte keinen Datensatz. Das Ergebnis blieb bei
20 aktiven und 0 überzähligen Freigaben.

## Verifikation

- Produktionsbuild: erfolgreich
- Artefaktvalidierung: erfolgreich
- ESLint: erfolgreich, keine Warnungen
- automatisierte Produkt-, Auth-, Origin-, Goal-, Projekt-, Datei-, Mandanten-,
  Lease-, Versions-, Replay-, Runtime- und Promotion-Prüfungen: 17 von 17
  erfolgreich
- lokale D1-Migrationskette 0000–0004: alle 52 Schema-SQL-Schritte plus fünf
  Migrationsbuchungen erfolgreich
- tatsächliche D1-Verbrauchs-, Erschöpfungs-, Replay-, 20-Lease-Grenz- und
  Constraint-Prüfung: erfolgreich
- `git diff --check`: erfolgreich
- verbindlicher Masterprompt gegenüber dem bestätigten Ausgangsstand:
  unverändert
- Secret-Pattern-Prüfung im Releasebaum und Clientartefakt: keine Treffer
- Produktionsabhängigkeiten: 0 bekannte npm-Advisories bei
  `npm audit --omit=dev --audit-level=high`

Das einzige kompatible Sicherheitsupdate hebt `@eslint/eslintrc` von 3.3.5 auf
3.3.6. Der vollständige Entwicklungs-, Peer- und Buildbaum enthält danach 21
bekannte Advisories: 17 hoch, 4 moderat und 0 kritisch. Sie verbleiben in der
isolierten ESLint-/Drizzle-Werkzeugkette; npm bietet im installierten Baum
keinen weiteren kompatiblen In-Range-Fix. Erzwungene Restpfade würden
inkompatible Hauptversions- oder Rückwärtswechsel auslösen und wurden nicht
aktiviert. Die Härtungsgrenzen stehen in `docs/SECURITY.md`.

## Offene Grenzen und nächster Schritt

1. Ein Provider-Secret ist nicht aktiviert; deshalb bleibt Modellinferenz
   ehrlich gesperrt.
2. Nach bewusster Secret-Freigabe ist ein echter End-to-End-Lauf mit Ziel-,
   Projekt- und Lease-Bindung, Kosten- und Quotenprüfung abzunehmen.
3. Die höchste offene R2-Funktion bleibt binäre Dateiablage. Sie setzt eine
   bewusste R2-Binding- und Kostenfreigabe voraus.
4. Danach folgen lease-geschützte Browser-, Code-, Dokument-, Tabellen- und
   MCP-Werkzeuge, Job-Queue, Fortschrittsstreaming, Export und Löschung.
5. Öffentlicher oder erweiterter Zugriff wurde nicht freigegeben und bleibt
   unverändert gesperrt.
