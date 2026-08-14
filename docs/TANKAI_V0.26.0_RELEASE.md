# TankAI Web v0.26.0 – Deterministic CSV Query

Statusdatum: 28. Juli 2026

## Gelieferter Produktfortschritt

Das vorhandene, lease-geschützte Werkzeug `project.document.inspect` kann
CSV-Dokumente jetzt nicht nur strukturell prüfen, sondern als statische Tabelle
profilieren, filtern und sortieren.

- Null-, Nichtnull- und Eindeutigkeitszahl je Spalte
- Typzahlen für Boolean, Integer, Number, ISO-Date, ISO-DateTime und Text
- nachvollziehbarer abgeleiteter Spaltentyp oder `mixed`
- höchstens fünf Filter und zwei Sortierschlüssel
- höchstens acht Ausgabespalten und zehn Ergebniszeilen
- höchstens 160 ausgegebene Zeichen je Zelle
- stabile Reihenfolge über die ursprüngliche CSV-Zeilennummer
- Quellzeile jeder zurückgegebenen Zeile sichtbar

## Vergleichsvertrag

- Leere Zellen gelten als `null`; der Text `null` bleibt Text.
- Text wird getrimmt, mit NFKC normalisiert und ohne Beachtung der
  Groß-/Kleinschreibung verglichen.
- Numerische Operatoren wirken nur auf eindeutig erkannte Zahlen.
- ISO-Daten und ISO-Zeitpunkte werden nur in expliziten Formaten erkannt.
- Nullwerte stehen bei auf- und absteigender Sortierung zuletzt.
- Gleiche Sortierwerte bleiben durch die ursprüngliche Zeilennummer stabil.

## Sicherheitsvertrag

- Die CSV wird vor jeder Abfrage erneut vollständig strukturell geprüft.
- Erkannte Spreadsheet-Formel-Injection stoppt die Abfrage.
- Keine Tabellenformel, kein Makro, Script oder Code wird ausgeführt.
- Datei, Projekt, Nutzer und Tool-Lease bleiben serverseitig gebunden.
- Unbekannte Query-Felder, Operatoren und übergroße Abfragen werden abgewiesen.
- Werkzeuglaufzeit, Eingabe- und Ausgabegröße werden im bestehenden
  Execution Receipt ausgewiesen.
- `factsVerified` bleibt ausdrücklich `false`: Das Receipt beweist die
  Ausführung der statischen Operation, nicht die Wahrheit der Tabellendaten.

## Datenmodell

Es ist keine neue Persistenztabelle erforderlich. Abfragen bleiben
deterministische, unverändernde Operationen auf der bereits versionierten
CSV-Datei. Dadurch entstehen weder versteckte abgeleitete Daten noch ein
zusätzlicher Lösch- oder Migrationspfad.

## Unveränderte Grenzen

- Masterprompt 2.1.0 und Modellgewichte bleiben unverändert.
- Kein Provider-Secret wurde aktiviert.
- Keine öffentliche oder zusätzliche Nutzerfreigabe wurde eingerichtet.
- Keine kostenpflichtige Aktion wurde ausgelöst.
- Resolver/Egress-Proxy, Binärspeicher und externe
  Backup-Löschfortpflanzung bleiben Infrastruktur-Gates.

Die finalen Testzahlen, Commit-ID und Archivprüfsumme stehen im separaten Build
Receipt des unveränderlichen Releaseartefakts.
