# TankAI Web v0.8.0 – Release Receipt

Datum: 26. Juli 2026

## Reifegrad

TankAI Web v0.8.0 ist der zweite private R2-Webrelease. Er ergänzt die
wiederaufnehmbare Zielkontrolle um echte nutzereigene Projektbereiche und
versionierte Textdateien. Projekte, aktuelle Dateiinhalte, jede frühere
Dateiversion, Integritätshashes und Run-Zuordnungen werden dauerhaft in D1
gespeichert.

Der verbindliche Masterprompt bleibt unverändert auf 2.1.0. TankAI hat weder
Prompt noch Modellgewichte automatisch verändert. Masterplan 2.3.0
dokumentiert ausschließlich den geprüften R2-Produktfortschritt.

## Neu in v0.8.0

- Authentifizierte Nutzer können Projektbereiche anlegen, auswählen,
  bearbeiten, archivieren und wiederherstellen.
- Jeder Projektbereich besitzt eine optimistische Metadatenversion, eine
  separate Inhaltsrevision und unveränderliche Ereignis-Receipts.
- Text-, Markdown- und JSON-Dateien werden mit Name, Typ, Inhalt, Bytezahl,
  Version und serverseitigem SHA-256 gespeichert.
- Jede Anlage und Änderung erzeugt eine vollständige append-only
  Dateiversion. Veraltete Schreibversuche erzeugen keine falsche Version und
  kein falsches Event.
- Dateinamen schließen Pfadseparatoren und Steuerzeichen aus. Eine Datei ist
  auf 20.000 Zeichen und 24.000 Bytes begrenzt; JSON-Inhalt muss parsebar sein.
- Jede Projekt-, Datei-, Versions- und Ereignisabfrage filtert nach der
  serverseitig ermittelten datensparsamen Nutzer-ID.
- Archivierte Projekte sperren Dateiänderungen und neue Teamläufe.
- `runs.project_id` verbindet Ausführung und Projekt. Start, Abschluss und
  Fehlschlag erzeugen Projekt-Receipts.
- Ein ausgewählter Projektbereich wird serverseitig unter einem harten
  Kontextlimit an Planner, Spezialisten, Critics und Synthesizer übergeben.
  Ausgelassene Dateien werden explizit benannt.
- Persistierte Dateien werden als `UNTRUSTED_PROJECT_CONTEXT_JSON`
  gekennzeichnet. Anweisungsartig formulierter Dateiinhalt bleibt Dateninhalt
  und kann Masterprompt, Rechte, Sicherheitsregeln oder den aktuellen Auftrag
  nicht herabstufen.
- Die geschützte Weboberfläche bietet Projektauswahl, Dateiübersicht,
  Dateieditor, Versionsmetadaten, Archivschutz und Projektkontext pro Lauf.
- Binäre R2-Ablage wurde nicht aktiviert; das R2-Binding bleibt ohne bewusste
  Kosten- und Betriebsfreigabe leer.

## Datenmigration

Migration `0003_safe_ezekiel.sql` erstellt `projects`,
`project_documents`, `project_document_versions` und `project_events`, ergänzt
die optionale Projektreferenz in `runs` und legt Eigentums-, Zeit-, Namens-,
Versions- und Run-Indizes an.

Die vollständige Migrationskette 0000–0003 wurde gegen eine frische lokale
D1-Instanz ausgeführt:

- 0000: 12 SQL-Schritte
- 0001: 3 SQL-Schritte
- 0002: 9 SQL-Schritte
- 0003: 18 SQL-Schritte
- Gesamt: 42 SQL-Schritte

Die geprüften Fremdschlüsselregeln:

- Projektdatei → Projekt: `ON DELETE CASCADE`
- Dateiversion → Datei: `ON DELETE CASCADE`
- Dateiversion → Projekt: `ON DELETE CASCADE`
- Projektereignis → Projekt: `ON DELETE CASCADE`
- Projektereignis → Datei/Run: `ON DELETE SET NULL`
- Run → Projekt: `ON DELETE SET NULL`

Ein tatsächlicher Insert-/Delete-Test bestätigte, dass das Löschen des
Testprojekts zugehörige Datei und Dateiversion kaskadierend entfernt. Ein
absichtlich falscher Bytezähler wurde von
`project_documents_size_check` mit `SQLITE_CONSTRAINT_CHECK` abgewiesen.

## Verifikation

- Produktionsbuild: erfolgreich
- Artefaktvalidierung: erfolgreich
- ESLint: erfolgreich, keine Warnungen
- automatisierte Produkt-, Auth-, Origin-, Goal-, Projekt-, Datei-, Mandanten-,
  Versions-, Archiv-, Runtime- und Promotion-Prüfungen: 15 von 15 erfolgreich
- lokale D1-Migrationskette 0000–0003: alle 42 SQL-Schritte erfolgreich
- Fremdschlüssel-, Index-, Inhaltsintegritäts- und Cascade-Prüfung: erfolgreich
- `git diff --check`: erfolgreich
- Secret-Pattern-Prüfung im Releasebaum: keine Treffer
- Produktionsabhängigkeiten: 0 bekannte npm-Advisories bei
  `npm audit --omit=dev --audit-level=high`

Die Cloudflare-Buildwerkzeuge wurden kompatibel aktualisiert. Der vollständige
Entwicklungs- und Buildbaum enthält danach 13 bekannte Advisories: 9 hoch,
4 moderat und 0 kritisch. Sie verbleiben in der isolierten ESLint-/Drizzle-
Werkzeugkette; die von npm angebotenen Restpfade verlangen inkompatible
Hauptversions- oder Rückwärtswechsel. Die Härtungsgrenzen stehen in
`docs/SECURITY.md`.

## Offene Grenzen und nächster Schritt

1. Ein Provider-Secret ist nicht aktiviert; deshalb bleibt Modellinferenz
   ehrlich gesperrt.
2. Nach bewusster Secret-Freigabe ist ein echter End-to-End-Lauf mit Ziel- und
   Projektbindung, Kosten- und Quotenprüfung abzunehmen.
3. R2 bleibt für bewusst freigegebene binäre Ablage, Capability Leases,
   Browser-/Code-/Dokument-/Tabellen-/MCP-Werkzeuge, Job-Queue,
   Fortschrittsstreaming, Export und Löschung offen.
4. Öffentlicher oder erweiterter Zugriff wurde nicht freigegeben und bleibt
   unverändert gesperrt.
