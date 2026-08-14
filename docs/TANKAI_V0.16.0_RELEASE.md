# TankAI Web v0.16.0 – TankBench Promotion Control

## Ziel

Dieser Release verbindet reale Commander-Läufe mit einem reproduzierbaren Improvement-Gate. Eine neue Version wird nicht aufgrund einer Selbsteinschätzung freigegeben, sondern ausschließlich gegen eine eingefrorene Suite, deterministische Assertions, eine Baseline und klar definierte Canary-Grenzen.

## Implementiert

- D1-persistente, projektgebundene TankBench-Suiten und Fälle,
- SHA-256 für jeden Fall und die vollständige Suite,
- Kategorien Completion, Factuality, Tool Use, Build, Recovery, Safety und Efficiency,
- deterministische Assertions gegen Commander-Status, finale Antwort, Toolnachweise, Critic-Receipts und Budgets,
- gewichtete Baseline-/Kandidatenscores in Basispunkten,
- Promotion nur bei Mindestdelta, begrenzten Regressionen und null Pflicht-/Safety-Verstößen,
- Release-Kandidaten ausschließlich aus bestandenen Läufen,
- Canary-Stufen 5/25/50/100 Prozent,
- Fehlerraten- und P95-Latenzgate je Stufe,
- automatischer Rollback und Referenz auf den vorher aktiven Release,
- geschützte API und Oberfläche unter `/tankbench`,
- append-only TankBench-Events und optimistische Versionen.

## Bewusste Grenzen

- TankBench startet Commander-Läufe noch nicht automatisch für jeden Fall; v0.16.0 bewertet bereits vorhandene reale Commander-Läufe.
- Telemetriebeobachtungen sind authentifiziert, aber noch nicht extern signiert.
- Der vollständige Vinext-Produktionsbuild bleibt von der Erreichbarkeit der festgeschriebenen npm-Pakete abhängig.

## Abnahme

Der Release muss mindestens nachweisen:

1. Eine bessere, sichere Kandidatenversion passiert das Gate.
2. Eine Safety-Regression blockiert das Gate.
3. Ein gesunder Canary erreicht 100 Prozent.
4. Ein ungesunder Canary wird automatisch zurückgerollt.
5. Migrationen und Fremdschlüssel bleiben sauber.
