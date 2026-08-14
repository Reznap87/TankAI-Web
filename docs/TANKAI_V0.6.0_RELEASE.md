# TankAI Web v0.6.0 – Release Receipt

Datum: 26. Juli 2026

## Reifegrad

TankAI Web v0.6.0 ist ein privat produktiv bereitstellbarer Webkern mit echter
Multi-Modell-Orchestrierung. Ohne serverseitigen Providerzugang bleibt die Eingabe absichtlich
gesperrt. Dieser Release ist kein selbst trainiertes Tank-Core-Grundmodell und veröffentlicht
keinen unbelegten Vergleichssieg.

## Neu in v0.6.0

- Masterprompt 2.1.0 trennt Ausführungsabschluss, Faktenverifikation und Benchmarknachweis.
- Jeder Teamlauf erzeugt ein maschinenlesbares Execution Receipt.
- Die Oberfläche bezeichnet abgeschlossene Abläufe nicht mehr pauschal als „VERIFIED“.
- TankBench 1.0 besitzt acht gewichtete Dimensionen und sieben ausführbare Promotion Gates.
- Ein SHA-256-Fingerprint bindet Vergleiche an einen eingefrorenen Korpus.
- Die authentifizierte Promotion-API blockiert unsichere oder regressive Candidates.
- Korrigiertes negatives Feedback erzeugt einen referenzierten Lernfall in D1.
- Die Improvement-API zeigt Lernsignale und Warteschlange, ohne automatische Selbstmutation.
- Die Provider-Diagnose trennt Modellzugang, Rollenabdeckung und unabhängige Modellfamilien.

## Verifikation

- Produktionsbuild: erfolgreich
- Artefaktvalidierung: erfolgreich
- ESLint: erfolgreich
- automatisierte Produkt- und Runtime-Prüfungen: 9 von 9 erfolgreich
- D1-Migration für `learning_cases`: erzeugt und geprüft
- `git diff --check`: erfolgreich
- Produktionsabhängigkeiten: 0 bekannte npm-Advisories bei
  `npm audit --omit=dev --audit-level=high`

Der vollständige Entwicklungsbaum enthält weiterhin bekannte Advisories ohne nicht-brechenden
Gesamtfix. Details und Betriebsgrenzen stehen in `docs/SECURITY.md`.

## Noch blockiert

1. Ein Provider-Secret muss sicher als Hosting-Laufzeitvariable aktiviert werden.
2. Danach ist ein echter End-to-End-Lauf mit Kosten- und Quotenprüfung nötig.
3. Öffentlicher Zugriff benötigt eine bewusste Freigabe sowie Missbrauchs-, Kosten- und
   Sicherheitskontrollen.
4. Tank Router, Tank Critic und Tank Core sind Modellprogramme, noch keine trainierten und
   veröffentlichten eigenen Checkpoints.
