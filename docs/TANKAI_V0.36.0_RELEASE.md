# TankAI Web v0.36.0 – begrenzte CSV-Kovarianz und Korrelation

## Ergebnis

Das Werkzeug `project.document.inspect` berechnet gefilterte Kovarianz und Pearson-Korrelation
für numerische CSV-Spaltenpaare, ohne Tabelleninhalte auszuführen.

## Vertrag

- Eingabe: `relationships: [{ "xColumn": "umsatz", "yColumn": "kosten", "mode": "sample" }]`
- höchstens drei eindeutige geordnete Paare aus verschiedenen Spalten,
- ausschließlich global numerische Spalten,
- Berechnung nach Filtern und unabhängig von Sortierung oder Zeilenausschnitt,
- ausschließlich vollständige Zahlenpaare; keine Imputation,
- separate Zählung ausgeschlossener Paarzeilen und der Nullwerte beider Spalten,
- `population`: Kovarianznenner `N`,
- `sample`: Kovarianznenner `N−1` und mindestens zwei vollständige Paare,
- bivariate numerisch stabile Ein-Pass-Berechnung nach Welford,
- Pearson-Korrelation aus den zentrierten Momenten,
- explizit undefinierte Korrelation bei Nullvarianz,
- unverändertes Werkzeug-Ausgabelimit von 40.000 Byte.

## Sicherheitsgrenzen

Die bestehende Nutzer-, Projekt-, Dokument- und Tool-Lease-Bindung bleibt aktiv. CSV-Struktur und
Formel-Injection werden vor jeder Abfrage geprüft. Nicht numerische, gleiche, unvollständige oder
nicht endliche Paare werden kontrolliert abgewiesen. Beziehungsausgaben werden getrennt von
anderen Verteilungs- und Gruppenausgaben abgefragt. Jede Ausgabe behält
`executableContentRun: false` und `factsVerified: false`.

Die Funktion ist rein lesend und benötigt keine Datenbankmigration.
