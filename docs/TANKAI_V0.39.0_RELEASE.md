# TankAI Web v0.39.0 – begrenzte CSV-Regressionsintervalle

Datum: 13. August 2026  
Masterplan: 4.9.0  
Masterprompt: 2.1.0 (unverändert)

## Reale Produktscheibe

`project.document.inspect` akzeptiert für jedes begrenzte OLS-Regressionspaar optional
`intervalConfidenceLevel` mit genau `0.9`, `0.95` oder `0.99`. Für jeden angeforderten
Vorhersage-x-Wert werden ein zweiseitiges Konfidenzintervall der mittleren Antwort und ein
zweiseitiges Prognoseintervall einer neuen Beobachtung berechnet.

Der Kritikalwert stammt aus der Student-t-Verteilung mit `n−2` Freiheitsgraden. Die Runtime
berechnet das Quantil deterministisch über die regularisierte unvollständige Betafunktion und eine
fest begrenzte Bisektion. Ohne positive Freiheitsgrade bleiben Kritikalwert und Intervalle
ausdrücklich undefiniert; eine Normalverteilungsnäherung wird nicht vorgetäuscht.

## Grenzen und Sicherheit

- höchstens drei Regressionspaare und zehn eindeutige endliche Vorhersagewerte je Paar,
- Konfidenzstufe nur aus der festen Allowlist und nur zusammen mit Vorhersagewerten,
- Blockade aller nicht endlichen Kritikalwerte, Margen und Intervallgrenzen,
- unveränderte Formel-Injection-, Nutzer-, Projekt-, Dokument- und Tool-Lease-Bindung,
- rein lesender Lauf mit `executableContentRun: false` und `factsVerified: false`,
- keine Provider-Secrets, keine Modellgewichte und keine Trainingsdatenänderung.

## Rückweg

Der vorherige bestätigte Stand ist TankAI Web v0.38.0. Ein Rollback setzt ausschließlich den
vorherigen privaten Sites-Checkpoint ein; Datenmigrationen sind nicht betroffen.
