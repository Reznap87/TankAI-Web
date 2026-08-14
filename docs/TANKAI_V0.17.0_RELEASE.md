# TankAI Web v0.17.0 – Automatic Suite Runner & Traffic Router

v0.17.0 schließt die operative Lücke zwischen TankBench, Commander und Canary-Routing.

## Suite Runner

- erzeugt pro eingefrorenem Fall genau einen Baseline- und einen Kandidatenlauf,
- bindet beide Varianten an getrennte `model.run`-Capability-Leases,
- verwendet reale Commander-Läufe statt synthetischer Scores,
- übernimmt terminale Commander-Ergebnisse automatisch in TankBench,
- wertet den TankBench-Lauf nach dem letzten Paar automatisch aus,
- speichert Cursor, Fortschritt, Version und Fehlerzustand persistent.

## Traffic Router

- wählt nur Releases mit Status `active` oder `canary`,
- bildet aus Projekt und Routing-Key einen stabilen SHA-256-Bucket von 0 bis 99,
- hält eine Routing-ID während einer Canary-Stufe konsistent,
- verwendet den Canary nur innerhalb seines freigegebenen Traffic-Anteils,
- schreibt jede Auswahl als append-only Routing-Receipt.

## Grenzen

Der Suite Runner benötigt konfigurierte Modellprovider und ausreichende Capability-Leases. Ohne Provider stoppt der gekoppelte Commander ehrlich mit `model_unavailable`. Der Router verändert keine Releasezustände; Promotion, Canary-Fortschritt und Rollback bleiben Aufgabe der bestehenden TankBench-Gates.
