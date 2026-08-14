# TankAI Web v0.7.0 – Release Receipt

Datum: 26. Juli 2026

## Reifegrad

TankAI Web v0.7.0 ist der erste private Webrelease mit dauerhaft
wiederaufnehmbarer Zielkontrolle. Der bestätigte Zielstand überlebt Browser- und
Worker-Neustarts und kann einem echten Teamlauf serverseitig zugeordnet werden.
Die asynchrone automatische Fortsetzung offener Werkzeugjobs gehört noch nicht
zu diesem Release.

Der verbindliche Masterprompt bleibt unverändert auf 2.1.0. TankAI hat weder
Prompt noch Modellgewichte automatisch verändert. Der Masterplan 2.2.0
dokumentiert ausschließlich den geprüften R2-Projektfortschritt.

## Neu in v0.7.0

- Authentifizierte Nutzer können langlebige Ziele mit Zielbeschreibung und
  Definition of Done anlegen.
- D1 speichert Status, Fortschritt, letzten bestätigten Schritt, nächste sichere
  Aktion, Versionsnummer und Terminalzeit.
- Der verbindliche Zustandsautomat erlaubt nur:
  `draft → planned → ready → running → waiting → verifying → completed | failed | cancelled`.
- Jede Anlage, Status-/Fortschrittsänderung und jeder zugeordnete Run erzeugt
  ein dauerhaftes Goal Event.
- Optimistische Versionsprüfung blockiert verlorene parallele Änderungen; ein
  abgewiesener veralteter Schreibversuch erzeugt kein falsches Event.
- Jede Datenbankabfrage prüft die serverseitig ermittelte, datensparsame
  Nutzerkennung.
- Terminale Ziele können keinen neuen Modelllauf starten.
- Der ausgewählte Zielkontext wird als nutzerverfasster D1-Datenblock an Planner,
  Spezialisten, Critics und Synthesizer übergeben, ohne Masterprompt oder Rechte
  verändern zu dürfen.
- Die geschützte Weboberfläche bietet Zielanlage, Zielauswahl, Fortschritts- und
  Statuspflege, letzte Receipts und das Abwählen eines Zielkontexts.
- `runs.goal_id` verbindet Ausführung und Ziel; Kandidatenrohteile und
  Provider-Secrets werden weiterhin nicht gespeichert.

## Datenmigration

Migration `0002_chief_namorita.sql` erstellt `goals` und `goal_events`, ergänzt
die optionale Goal-Referenz in `runs` und legt Eigentums-, Status-, Zeit- und
Run-Indizes an. Die vollständige Migrationskette 0000–0002 wurde gegen eine
frische lokale D1-Instanz ausgeführt. Die Fremdschlüsselregeln wurden
anschließend geprüft:

- Zielereignis → Ziel: `ON DELETE CASCADE`
- Zielereignis → Run: `ON DELETE SET NULL`
- Run → Ziel: `ON DELETE SET NULL`

## Verifikation

- Produktionsbuild: erfolgreich
- Artefaktvalidierung: erfolgreich
- ESLint: erfolgreich
- automatisierte Produkt-, Auth-, Goal-, Mandanten-, Runtime- und
  Promotion-Prüfungen: 12 von 12 erfolgreich
- lokale D1-Migrationskette 0000–0002: alle 24 Statements erfolgreich
- `git diff --check`: erfolgreich
- Secret-Pattern-Prüfung im Releasebaum: keine Treffer
- Produktionsabhängigkeiten: 0 bekannte npm-Advisories bei
  `npm audit --omit=dev --audit-level=high`

Der vollständige Entwicklungs- und Buildbaum enthält weiterhin 26 bekannte
Advisories, davon 22 hoch und keine kritisch. Sie liegen in der isolierten
Werkzeugkette; Details und Härtungsgrenzen stehen in `docs/SECURITY.md`.

## Offene Grenzen und nächster Schritt

1. Ein Provider-Secret ist nicht aktiviert; deshalb bleibt Modellinferenz
   ehrlich gesperrt.
2. Nach bewusster Secret-Freigabe ist ein echter End-to-End-Lauf mit Zielbindung,
   Kosten- und Quotenprüfung abzunehmen.
3. R2 bleibt für Datei- und Projektbereiche, Capability Leases, Browser-/Code-/
   Dokumentwerkzeuge, Job-Queue, Fortschrittsstreaming, Export und Löschung offen.
4. Öffentlicher oder erweiterter Zugriff wurde nicht freigegeben und bleibt
   unverändert gesperrt.
