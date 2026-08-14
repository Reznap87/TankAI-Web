# TankAI Web v0.42.0 – begrenzte CSV-PRESS-Diagnostik

Datum: 13. August 2026  
Masterplan: 5.2.0  
Masterprompt: 2.1.0 (unverändert)

## Reale Produktscheibe

`project.document.inspect` ergänzt jedes zurückgegebene OLS-Residuum um sein Leave-one-out-
PRESS-Residuum `eᵢ / (1−hᵢ)`. Die PRESS-Quadratsumme wird über alle vollständigen Zahlenpaare
berechnet. Das vorhergesagte Bestimmtheitsmaß folgt verbindlich `R²_pred = 1 − PRESS/SST` und darf
negativ sein.

## Grenzen und Sicherheit

- höchstens drei Regressionspaare, zehn Vorhersagen und 20 zeilenstabile Residuen je Paar,
- Leverage eins macht PRESS und vorhergesagtes R² mit `unit-leverage` undefiniert,
- Antwort-Nullvarianz macht vorhergesagtes R² mit `zero-response-variance` undefiniert,
- nicht endliche und überlaufende Werte blockieren die vollständige Abfrage,
- bei Regression werden höchstens fünf gewöhnliche Tabellenzeilen gleichzeitig ausgegeben; die
  effektive Grenze bleibt im Policy-Objekt sichtbar,
- das maximale Drei-Paar-Ergebnis bleibt unter dem festen 40.000-Byte-Werkzeugbudget,
- keine automatische Ursachen-, Fakten-, Lösch-, Trainings- oder Modellentscheidung,
- unveränderte Formel-Injection-, Nutzer-, Projekt-, Dokument- und Tool-Lease-Bindung,
- keine Provider-Secrets, Modellgewichte oder Trainingsdatenänderung.

## Rückweg

Der vorherige bestätigte Stand ist TankAI Web v0.41.0. Ein Rollback setzt ausschließlich den
vorherigen privaten Sites-Checkpoint ein; Datenmigrationen sind nicht betroffen.
