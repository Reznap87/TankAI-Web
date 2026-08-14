# TankAI Web v0.12.0 – Tool Fabric

Statusdatum: 27. Juli 2026

## Umfang

Dieser Release erweitert die in v0.11.0 eingeführte lease-geschützte Jobschicht um drei reale,
begrenzte Werkzeuge. Die vorhandenen D1-Leases, Jobs, Claim-Tokens, Retrygrenzen und append-only
Ereignisse bleiben die Ausführungsbasis.

## Neue Werkzeuge

### `web.fetch`

- genau ein vom Nutzer angegebenes HTTPS-Ziel,
- keine Zugangsdaten in der URL und kein Sonderport,
- direkte IP-Literale, localhost, Einlabel-Intranetnamen und typische lokale Suffixe blockiert,
- Redirectmodus `manual`, höchstens drei Redirects, jedes Folgeziel wird erneut validiert,
- keine Cookies und keine frei wählbaren Request-Header,
- Positivliste für HTML, Klartext, JSON und XML,
- 10.000 ms Laufzeitbudget,
- 28.000 Byte Antwortbudget und 20.000 Zeichen Extraktionsgrenze,
- SHA-256 über die gelesenen Antwortbytes,
- Requested URL, Final URL, Redirectkette, Status, Content-Type und Abrufzeit im Resultat,
- extrahierter Inhalt ist immer `untrusted`,
- bekannte Prompt-Injection-Formulierungen werden nur als Signale gemeldet.

Die syntaktische Hostprüfung ist noch keine vollständige DNS-/IP-Egress-Kontrolle. Vor einer
allgemeinen Netzwerkfreigabe benötigt TankAI einen Egress-Proxy oder eine gleichwertige Policy, die
aufgelöste private, reservierte und Link-Local-Adressen einschließlich DNS-Rebinding blockiert.

### `project.document.inspect`

- ausschließlich Projektfreigabe,
- SQL-Bindung an Datei-ID, Projekt-ID und gesalzene Nutzer-ID,
- Metadaten, Hash, Version, Zeichen-/Wort-/Zeilenzahl, Markdown-Überschriften und begrenzte Vorschau,
- JSON-Wurzeltyp beziehungsweise Syntaxfehler bei JSON-Dateien,
- Prompt-Injection-Signale,
- keine Ausführung von Dateiinhalt.

### `code.patch.inspect`

- ausschließlich textuelle Unified Diffs,
- maximale Eingabe 24.000 UTF-8-Bytes,
- Dateien, Hunks, Additions und Deletions,
- Erkennung von Binärpatches,
- Markierung absoluter, traversierender oder anderweitig unsicherer Pfade,
- keine Patchanwendung,
- keine Codeausführung.

## Werkzeugbudgets und Receipts

Der öffentliche Tool-Katalog enthält für jedes Werkzeug:

- erlaubte Scopes,
- deterministisch oder externe Antwort,
- Netzwerkzugriff ja/nein,
- maximale Eingabe- und Ausgabegröße,
- maximale Laufzeit,
- maximale Netzwerkaufrufe.

Jede erfolgreiche Ausführung speichert neben dem Ergebnis ein Execution Receipt mit beobachteter
Laufzeit, Eingabe-/Ausgabegröße und den geltenden Werkzeuggrenzen. Kontrollierte Werkzeugfehler
verwenden stabile Fehlercodes; unbekannte interne Fehler werden nicht ungefiltert an den Browser
weitergereicht.

## Datenbankmigration

Migration `0007_brisk_tool_fabric.sql` erweitert die Toolnamen-Checks für bestehende Tabellen.
Vorhandene v0.11-Leases, Jobs und Events werden in neue Tabellenformen kopiert und die bisherigen
Indizes werden wiederhergestellt.

Geprüft mit einer frischen SQLite-/D1-kompatiblen Datenbank und vorab angelegten v0.11-Daten:

- 96 Migrationsschritte,
- bestehende Lease erhalten,
- bestehender Job erhalten,
- bestehende Lease-/Job-Events erhalten,
- `web.fetch` als neuer Toolname akzeptiert,
- unbekannter Toolname abgewiesen,
- null `foreign_key_check`-Verstöße.

## Behobener v0.11-Fehler

Das veröffentlichte v0.11-Archiv enthielt in `lib/tool-jobs.ts` eine doppelte lokale
`const db`-Deklaration. v0.12.0 entfernt diesen Syntax-/Typfehler. Außerdem ist die Scope-Prüfung
verschärft: Eine Konto-Lease akzeptiert keinen mitgeschickten Projektbereich; eine Projekt-Lease
akzeptiert nur exakt ihr eigenes Projekt.

## Durchgeführte Prüfungen

- 50 TypeScript-/TSX-Dateien syntaktisch geparst, null Parserfehler,
- strikter Kern-Typecheck für Tool Runtime, Netzwerk, Dokumente, Patch, Fehler und Jobschicht,
- separater strikter TSX-Typecheck der Werkzeugoberfläche,
- öffentliche URL-Blockfälle für HTTP, localhost, IPv4, IPv6, Intranetnamen und Sonderport,
- manueller Redirect mit erneuter Zielvalidierung,
- HTML-Extraktion ohne Scriptinhalt,
- Prompt-Injection-Signalerkennung,
- Content-Type-Block und angekündigtes Größenlimit,
- Unified-Diff-Statistik und Traversal-Markierung,
- Dokumentabfrage mit exakter Nutzer-/Projektbindung und blockiertem Fremdprojekt.

## Integrierter Job-Lebenszyklustest

Die tatsächlichen Quellfunktionen `createToolLease`, `createToolJob` und `executeToolJob` wurden
gegen eine D1-kompatible SQLite-Schicht ausgeführt. Fünf Jobs liefen durch dieselbe
Lease-/Queue-/Claim-Schicht:

- SHA-256 erfolgreich,
- projektgebundene Dokumentinspektion erfolgreich,
- statische Patchinspektion erfolgreich,
- kontrollierter HTTPS-Abruf erfolgreich,
- kontrollierter Netzwerkfehler mit `NETWORK_CONTENT_TYPE_BLOCKED`.

Dabei wurden idempotente Wiederholung ohne zweiten Lease-Verbrauch, exakte Scope-Bindung,
Claim-, Erfolgs- und Fehler-Receipts sowie null Fremdschlüsselverstöße bestätigt.

## Nicht behauptet

- kein vollständiger Vinext-Produktionsbuild dieses Releases,
- kein neues Deployment,
- keine Websuche oder mehrquellige Recherche,
- kein DNS-Rebinding-sicherer Egress,
- keine binäre Dokumentverarbeitung,
- keine Tabellen- oder MCP-Werkzeuge,
- keine Patchanwendung oder Codeausführung,
- kein Fortschrittsstreaming.

Der vollständige npm-Abhängigkeitsaufbau blieb in dieser Arbeitsumgebung durch den externen
Paketabruf blockiert. Deshalb werden Build, Browser-End-to-End-Test und Deployment nicht als
bestanden ausgegeben.
