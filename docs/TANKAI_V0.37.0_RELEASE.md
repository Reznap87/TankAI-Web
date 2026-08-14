# TankAI Web v0.37.0 – begrenzte einfache lineare CSV-Regression

## Ergebnis

Das Werkzeug `project.document.inspect` passt gefilterte numerische CSV-Spaltenpaare per Ordinary
Least Squares an, ohne Tabelleninhalte auszuführen.

## Vertrag

- Eingabe: `regressions: [{ "xColumn": "anzahl", "yColumn": "betrag" }]`
- höchstens drei eindeutige geordnete Paare aus verschiedenen Spalten,
- ausschließlich global numerische Spalten,
- Berechnung nach Filtern und unabhängig von Sortierung oder Zeilenausschnitt,
- ausschließlich vollständige Zahlenpaare; keine Imputation,
- Gleichung `y = intercept + slope × x`,
- stabile bivariate Welford-Momente als OLS-Basis,
- mindestens zwei Paare und Sperre bei Nullvarianz von x,
- `R²` ausdrücklich undefiniert bei Nullvarianz von y,
- Residuen-MSE und Residualstandardfehler mit Freiheitsgraden `n−2`,
- beide Residuenfehlerwerte ausdrücklich undefiniert bei `n≤2`,
- höchstens 20 zeilenbezogene Residuen pro Paar mit Trunkierungsnachweis,
- unverändertes Werkzeug-Ausgabelimit von 40.000 Byte.

## Sicherheitsgrenzen

Die bestehende Nutzer-, Projekt-, Dokument- und Tool-Lease-Bindung bleibt aktiv. CSV-Struktur und
Formel-Injection werden vor jeder Abfrage geprüft. Nicht numerische, gleiche, unvollständige,
degenerierte oder nicht endliche Paare werden kontrolliert abgewiesen. Regression wird getrennt
von anderen Analyseausgaben abgefragt. Jede Ausgabe behält `executableContentRun: false` und
`factsVerified: false`.

Die Funktion ist rein lesend und benötigt keine Datenbankmigration.
