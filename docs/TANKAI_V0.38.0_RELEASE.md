# TankAI Web v0.38.0 – begrenzte CSV-Regressionsvorhersagen

## Ergebnis

`project.document.inspect` berechnet für ein geprüftes einfaches OLS-Modell bis zu zehn konkrete
Vorhersagen je Spaltenpaar. Inhalte werden dabei weiterhin niemals ausgeführt.

## Vertrag

- Eingabe: `predictionXValues` innerhalb eines Regressionspaars,
- höchstens zehn eindeutige endliche Zahlen,
- Vorhersagegleichung `intercept + slope × x`,
- beobachtetes x-Minimum und x-Maximum in der Ausgabe,
- eindeutige Kennzeichnung als Interpolation, niedrige oder hohe Extrapolation,
- feste Ein-Sigma-Unsicherheitsregel `residual-standard-error-leverage-1sigma`,
- getrennter Standardfehler für mittlere Antwort und neue Einzelbeobachtung,
- keine Umdeutung dieser Standardfehler zu Konfidenzintervallen,
- ausdrücklich undefinierte Unsicherheit ohne positive Residuen-Freiheitsgrade,
- unverändertes 40.000-Byte-Ausgabelimit.

Die Funktion ist rein lesend, mandanten- und dokumentgebunden und benötigt keine Migration.
`executableContentRun: false` und `factsVerified: false` bleiben verbindlich.
