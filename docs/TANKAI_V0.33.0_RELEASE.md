# TankAI Web v0.33.0 – begrenzte numerische CSV-Quantile

## Ergebnis

Das bestehende Werkzeug `project.document.inspect` kann gefilterte numerische CSV-Daten mit einer
festen und prüfbaren Interpolationsregel als Quantile ausgeben. Es führt keine Formeln, Makros,
Skripte oder sonstigen Tabelleninhalt aus.

## Vertrag

- Eingabe: `quantiles: [{ "column": "betrag", "probabilities": [0.25, 0.5, 0.75] }]`
- höchstens drei eindeutige Quantilspalten,
- ein bis neun eindeutige Wahrscheinlichkeiten zwischen 0 und 1 je Spalte,
- ausschließlich global homogene Spalten vom Typ `integer` oder `number`,
- Berechnung nach Filtern und unabhängig von Sortierung oder Zeilenausschnitt,
- feste R7-Methode mit Rang `(n - 1) × p`,
- lineare Interpolation zwischen unterem und oberem sortierten Wert,
- explizite Ausgabe von Rang, Indizes und Interpolationsgewicht,
- getrennte Zählung numerischer und leerer Zeilen,
- keine Kombination mit Histogrammen, Häufigkeitsverteilungen oder gruppierten Aggregationen,
- unverändertes Werkzeug-Ausgabelimit von 40.000 Byte.

## Sicherheitsgrenzen

Die bestehende Nutzer-, Projekt-, Dokument- und Tool-Lease-Bindung bleibt aktiv. CSV-Struktur und
Formel-Injection werden vor jeder Abfrage erneut geprüft. Nicht numerische, gemischte, vollständig
leere oder nach Filtern ohne Zahlen verbleibende Spalten sowie ungültige oder doppelte
Wahrscheinlichkeiten werden abgewiesen. Jede Ausgabe behält `executableContentRun: false` und
`factsVerified: false`.

Die Funktion ist rein lesend und benötigt keine Datenbankmigration.
