# TankAI Web v0.41.0 – begrenzte CSV-Einflussdiagnostik

Datum: 13. August 2026  
Masterplan: 5.1.0  
Masterprompt: 2.1.0 (unverändert)

## Reale Produktscheibe

`project.document.inspect` ergänzt jedes mathematisch definierte OLS-Residuum um seine
Cook-Distanz. Für die einfache lineare Regression mit zwei geschätzten Parametern gilt:

`Dᵢ = rᵢ² × hᵢ / (2 × (1−hᵢ))`

Dabei ist `rᵢ` das intern studentisierte Residuum und `hᵢ` das Hat-Matrix-Leverage. Die Antwort
weist Methode, die feste Schwellenregel `4/n` und den konkreten Schwellenwert aus.

## Grenzen und Sicherheit

- höchstens drei Regressionspaare und 20 zeilenstabile Residuen je Paar,
- Cook-Distanz bleibt `null`, wenn die zugrunde liegende Residualdiagnostik undefiniert ist,
- negative, nicht endliche und überlaufende Werte werden vollständig blockiert,
- Undefiniertheitsgründe erscheinen nur bei undefinierten Werten; das maximale Ergebnis bleibt
  unter dem festen 40.000-Byte-Werkzeugbudget,
- keine automatische Ursachen-, Fakten-, Lösch-, Trainings- oder Modellentscheidung,
- unveränderte Formel-Injection-, Nutzer-, Projekt-, Dokument- und Tool-Lease-Bindung,
- keine Provider-Secrets, Modellgewichte oder Trainingsdatenänderung.

## Rückweg

Der vorherige bestätigte Stand ist TankAI Web v0.40.0. Ein Rollback setzt ausschließlich den
vorherigen privaten Sites-Checkpoint ein; Datenmigrationen sind nicht betroffen.
