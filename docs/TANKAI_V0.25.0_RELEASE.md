# TankAI Web v0.25.0 – Safe CSV Tables

Statusdatum: 28. Juli 2026

## Gelieferter Produktfortschritt

TankAI-Projektbereiche unterstützen jetzt reale, versionierte
CSV-Tabellendokumente:

- Dateityp `csv` in aktueller Datei und vollständiger Versionshistorie,
- eigener statischer Parser für Komma- und Semikolontrennung,
- Anführungszeichen, maskierte Quotes und mehrzeilige Zellen,
- eindeutige Kopfzeile und konsistente Spaltenzahl,
- höchstens 500 Datenzeilen, 50 Spalten und 2.000 Zeichen je Zelle,
- allgemeine Dateigrenze weiterhin 20.000 Zeichen beziehungsweise 24.000
  UTF-8-Bytes,
- SHA-256, optimistische Versionen und unveränderliche Projekt-Receipts,
- statische CSV-Analyse im vorhandenen lease-geschützten
  `project.document.inspect`-Werkzeug.

## Sicherheitsvertrag

- Spreadsheet-Formel-Injection mit `=`, `@` oder nicht numerischen
  `+`-/`-`-Präfixen wird nach führendem Leerraum blockiert.
- Reine vorzeichenbehaftete Zahlen bleiben zulässige Daten.
- Steuerzeichen, leere Zeilen, doppelte oder leere Spaltennamen,
  ungeschlossene Quotes und uneinheitliche Zeilen werden abgewiesen.
- Formeln, Makros, Scripts und Code werden nicht ausgeführt.
- CSV bleibt im Modellkontext unter der bestehenden
  `UNTRUSTED_PROJECT_CONTEXT_JSON`-Grenze.
- Datei-API-Körper werden auch ohne `Content-Length` tatsächlich gemessen;
  unbekannte Felder werden verworfen.
- Nutzer- und Projektbindung gelten unverändert für Lesen, Schreiben,
  Versionierung und Werkzeugprüfung.

## Datenmigration

Migration `0017_lovely_hawkeye.sql` erweitert die Dateityp-Checks von
`project_documents` und `project_document_versions` um `csv`.

Beide Tabellen werden bei deaktivierten Fremdschlüsseln vollständig kopiert.
Die Fremdschlüsselprüfung wird erst nach beiden Umbauten wieder aktiviert.
Damit bleiben bestehende aktuelle Dateien und historische Versionen erhalten.

## Prüfung

Die Release-Abnahme umfasst:

- Parserfälle für Komma, Semikolon, Quotes und mehrzeilige Zellen,
- Formel-Injection einschließlich führender Steuer-/Leerzeichen,
- gültige negative und positive Zahlen,
- Zeilen-, Spalten-, Zell- und Steuerzeichenlimits,
- ungültige Struktur und doppelte Header,
- Upgrade einer befüllten v0.24-Datenbank ohne Datenverlust,
- D1-Checks für erlaubte und abgewiesene Dateitypen,
- authentifizierte, Same-Origin-gebundene und bytebegrenzte Datei-API,
- Tool-Inspektion ohne `eval`, `Function`, Shell, WebAssembly oder
  Codeausführung,
- sämtliche bestehenden Produkt-, Runtime-, Migrations- und
  Regressionstests.

Die finalen Zahlen, Commit-ID und Archivprüfsumme stehen im separaten Build
Receipt des unveränderlichen Releaseartefakts.

## Unveränderte Grenzen

- Masterprompt 2.1.0 und Modellgewichte bleiben unverändert.
- Kein Provider-Secret wurde aktiviert.
- Keine öffentliche oder zusätzliche Nutzerfreigabe wurde eingerichtet.
- Ausführungsabschluss bleibt von Faktenverifikation getrennt.
- Resolver/Egress-Proxy gegen DNS-Rebinding, Binärspeicher und externe
  Backup-Löschfortpflanzung bleiben offene Infrastruktur-Gates.
