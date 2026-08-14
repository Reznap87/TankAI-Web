# TankAI Web v0.32.0 – begrenzte numerische CSV-Histogramme

## Ergebnis

Das bestehende Werkzeug `project.document.inspect` kann gefilterte numerische CSV-Daten als
deterministische Gleichbreitenhistogramme ausgeben. Es werden keine Formeln, Makros, Skripte oder
sonstigen ausführbaren Inhalte gestartet.

## Vertrag

- Eingabe: `histograms: [{ "column": "betrag", "buckets": 6 }]`
- höchstens drei eindeutige Histogrammspalten,
- je Histogramm zwei bis zwölf Buckets,
- nur global homogene Spalten vom Typ `integer` oder `number`,
- Berechnung nach Filtern und unabhängig von Sortierung oder Zeilenausschnitt,
- explizites Minimum, Maximum, Intervallbreite und Grenzverhalten,
- untere Grenze immer inklusiv, obere Grenze nur im letzten Bucket inklusiv,
- getrennte Zählung numerischer und leerer Zeilen,
- konstanter Wertebereich als markierter degenerierter Einzelbucket,
- keine Kombination mit Häufigkeitsverteilungen oder gruppierten Aggregationen,
- unverändertes Werkzeug-Ausgabelimit von 40.000 Byte.

## Sicherheitsgrenzen

Die bestehende Nutzer-, Projekt-, Dokument- und Tool-Lease-Bindung bleibt aktiv. CSV-Struktur und
Formel-Injection werden vor jeder Abfrage erneut geprüft. Nicht numerische, gemischte, vollständig
leere oder nach Filtern ohne Zahlen verbleibende Spalten werden abgewiesen. Jede Ausgabe behält
`executableContentRun: false` und `factsVerified: false`.

Die Funktion ist rein lesend und benötigt keine Datenbankmigration.
