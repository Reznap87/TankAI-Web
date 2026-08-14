# TankAI Web v0.34.0 – begrenzte numerische CSV-Ausreißer

## Ergebnis

Das Werkzeug `project.document.inspect` erkennt in gefilterten numerischen CSV-Daten Ausreißer
nach einer festen, prüfbaren Tukey-IQR-Regel. Tabelleninhalte werden dabei niemals ausgeführt.

## Vertrag

- Eingabe: `outliers: [{ "column": "betrag" }]`
- höchstens drei eindeutige Ausreißerspalten,
- ausschließlich global homogene Spalten vom Typ `integer` oder `number`,
- Berechnung nach Filtern und unabhängig von Sortierung oder Zeilenausschnitt,
- R7-Quartile mit `IQR = Q3 - Q1`,
- untere Fence `Q1 - 1,5 × IQR`, obere Fence `Q3 + 1,5 × IQR`,
- nur Werte strikt außerhalb der Fences sind Ausreißer,
- explizite Quartile, IQR, Fences und Trefferrichtung,
- höchstens 20 deterministisch sortierte Treffer je Spalte,
- Gesamt-, Ausgabe- und Trunkierungszähler,
- unverändertes Werkzeug-Ausgabelimit von 40.000 Byte.

## Sicherheitsgrenzen

Die bestehende Nutzer-, Projekt-, Dokument- und Tool-Lease-Bindung bleibt aktiv. CSV-Struktur und
Formel-Injection werden vor jeder Abfrage erneut geprüft. Nicht numerische, gemischte, vollständig
leere oder nach Filtern ohne Zahlen verbleibende Spalten sowie nicht endliche IQR-Grenzen werden
abgewiesen. Ausreißer werden getrennt von anderen Verteilungsarten und gruppierten Aggregationen
abgefragt. Jede Ausgabe behält `executableContentRun: false` und `factsVerified: false`.

Die Funktion ist rein lesend und benötigt keine Datenbankmigration.
