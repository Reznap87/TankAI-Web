# TankAI Web v0.43.0 – begrenzte extern studentisierte CSV-Residuen

Datum: 13. August 2026  
Masterplan: 5.3.0  
Masterprompt: 2.1.0 (unverändert)

## Reale Produktscheibe

`project.document.inspect` berechnet für jedes zurückgegebene OLS-Residuum die nach Ausschluss
dieser Zeile geschätzte Fehlervarianz und daraus das extern studentisierte Residuum:

`SSE_(i) = SSE − eᵢ²/(1−hᵢ)`  
`s²_(i) = SSE_(i)/(n−3)`  
`tᵢ = eᵢ/(s_(i) × sqrt(1−hᵢ))`

Die Methode und die feste Diagnosegrenze `|tᵢ| > 2` sind maschinenlesbar.

## Grenzen und Sicherheit

- höchstens drei Regressionspaare, zehn Vorhersagen und 20 zeilenstabile Residuen je Paar,
- Leverage eins, fehlende gelöschte Freiheitsgrade und Fehlervarianz null bleiben mit getrenntem
  Grund undefiniert,
- kleine Rundungsreste werden nur innerhalb einer skalierten Toleranz als null behandelt,
- negative, nicht endliche und überlaufende Werte blockieren die vollständige Abfrage,
- die transitive Produktionsbindung `nanoid` wurde von 3.3.17 auf die gepatchte 3.3.18
  angehoben; die anschließende Produktionsabhängigkeitsprüfung meldet null bekannte Funde,
- Regressionsantworten geben keine zusätzlichen gewöhnlichen Tabellenzeilen aus und weisen die
  effektive Grenze im Policy-Objekt aus,
- das maximale Drei-Paar-Ergebnis bleibt unter dem festen 40.000-Byte-Werkzeugbudget,
- keine automatische Ursachen-, Fakten-, Lösch-, Trainings- oder Modellentscheidung,
- unveränderte Formel-Injection-, Nutzer-, Projekt-, Dokument- und Tool-Lease-Bindung,
- keine Provider-Secrets, Modellgewichte oder Trainingsdatenänderung.

## Rückweg

Der vorherige bestätigte Stand ist TankAI Web v0.42.0. Ein Rollback setzt ausschließlich den
vorherigen privaten Sites-Checkpoint ein; Datenmigrationen sind nicht betroffen.
