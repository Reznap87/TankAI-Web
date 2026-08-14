# TankAI Web v0.35.0 – begrenzte numerische CSV-Streuungsstatistik

## Ergebnis

Das Werkzeug `project.document.inspect` berechnet gefilterte numerische CSV-Streuungswerte mit
einer festen, prüfbaren Nennerregel. Tabelleninhalte werden niemals ausgeführt.

## Vertrag

- Eingabe: `dispersion: [{ "column": "betrag", "mode": "sample" }]`
- höchstens drei eindeutige Streuungsspalten,
- ausschließlich global homogene Spalten vom Typ `integer` oder `number`,
- Berechnung nach Filtern und unabhängig von Sortierung oder Zeilenausschnitt,
- `population`: Varianznenner `N`,
- `sample`: Varianznenner `N−1` und mindestens zwei Zahlen,
- numerisch stabile Ein-Pass-Berechnung nach Welford,
- explizite Ausgabe von Modus, Nenner, Mittelwert, Varianz, Standardabweichung, Minimum, Maximum
  und Spannweite,
- getrennte Zählung numerischer und leerer Zeilen,
- unverändertes Werkzeug-Ausgabelimit von 40.000 Byte.

## Sicherheitsgrenzen

Die bestehende Nutzer-, Projekt-, Dokument- und Tool-Lease-Bindung bleibt aktiv. CSV-Struktur und
Formel-Injection werden vor jeder Abfrage erneut geprüft. Nicht numerische, gemischte, vollständig
leere oder nach Filtern ohne Zahlen verbleibende Spalten sowie nicht endliche Zwischen- oder
Endergebnisse werden abgewiesen. Streuungsstatistik wird getrennt von anderen Verteilungsarten und
gruppierten Aggregationen abgefragt. Jede Ausgabe behält `executableContentRun: false` und
`factsVerified: false`.

Die Funktion ist rein lesend und benötigt keine Datenbankmigration.
