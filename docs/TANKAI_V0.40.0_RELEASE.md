# TankAI Web v0.40.0 – begrenzte CSV-Regressionsdiagnostik

Datum: 13. August 2026  
Masterplan: 5.0.0  
Masterprompt: 2.1.0 (unverändert)

## Reale Produktscheibe

`project.document.inspect` ergänzt jedes der höchstens 20 zurückgegebenen OLS-Residuen um das
Hat-Matrix-Leverage `hᵢ = 1/n + (xᵢ−x̄)²/Sxx` und, sofern definiert, das intern studentisierte
Residuum `eᵢ / (s × sqrt(1−hᵢ))`.

Die Antwort nennt die feste High-Leverage-Schwelle `4/n` (doppeltes mittleres Leverage bei zwei
Regressionsparametern) und die feste Auffälligkeitsschwelle `|rᵢ| > 2`. Schwellen bleiben
Diagnosehilfen; `factsVerified` bleibt ausdrücklich `false`.

## Grenzen und Sicherheit

- höchstens drei Regressionspaare und 20 zeilenstabile Residuen je Paar,
- unverändertes Werkzeug-Ausgabebudget unter 40.000 Byte am maximalen Testfall,
- Leverage validiert und auf den mathematisch zulässigen Bereich `[0,1]` normalisiert,
- `null` plus Grund bei fehlenden Freiheitsgraden, Standardfehler null oder Leverage eins,
- vollständige Blockade nicht endlicher diagnostischer Werte,
- unveränderte Formel-Injection-, Nutzer-, Projekt-, Dokument- und Tool-Lease-Bindung,
- keine Provider-Secrets, Modellgewichte oder Trainingsdatenänderung.

## Rückweg

Der vorherige bestätigte Stand ist TankAI Web v0.39.0. Ein Rollback setzt ausschließlich den
vorherigen privaten Sites-Checkpoint ein; Datenmigrationen sind nicht betroffen.
