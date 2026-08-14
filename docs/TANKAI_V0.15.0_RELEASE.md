# TankAI Web v0.15.0 – Commander Orchestration

## Implementiert

- persistente, nutzer- und optional projektgebundene Commander-Läufe
- automatische Kopplung jedes Commander-Laufs an genau einen ReAct-Lauf
- strukturierte Modellentscheidungen als streng validiertes JSON
- erforderliche `model.run`-Capability-Lease im Teammodus für jeden Commander-Lauf
- atomarer Verbrauch genau einer Modellnutzung pro Entscheidung und pro Critic-Prüfung
- getrennte append-only Receipts für Modellfreigaben und Commander-Ereignisse
- serverseitige Auflösung aktiver Tool-Leases; das Modell erhält und wählt keine Lease-ID
- nicht freigegebene Werkzeugentscheidungen werden verworfen und erzeugen keinen Job
- begrenzte autonome Übergänge pro API-Aufruf
- feste Zyklus-, Modellaufruf-, Critic- und Werkzeugbudgets
- verpflichtende Critic-Prüfung vor jeder finalen Antwort
- abgelehnte finale Kandidaten werden als Feedback in den nächsten Commander-Zyklus übernommen
- vollständiger Stopp ohne Scheinantwort, wenn kein Modellprovider konfiguriert ist
- SHA-256-Hashes der Modellantworten statt gespeicherter Rohantworten
- kurze sichtbare Entscheidungssummaries statt privater Gedankengänge
- append-only Commander-Entscheidungen und Ereignis-Receipts
- geschützte API unter `/api/commander` und Oberfläche unter `/commander`

## Ablauf

```text
Objective + Definition of Done
        ↓
model.run-Freigabe verbrauchen
        ↓
Commander-Modellentscheidung
        ↓
serverseitige Lease-Auflösung
        ↓
ReAct Tool Action → Tool Job → Worker
        ↓
Observation + Hash
        ↓
Commander-Folgeentscheidung
        ↓
finaler Kandidat
        ↓
model.run-Freigabe verbrauchen
        ↓
Critic-Prüfung
   ↙ abgelehnt      ↘ genehmigt
neuer Zyklus       ReAct Final + Abschluss
```

## Sicherheitsgrenzen

Der Commander speichert weder private Reasoning-Tokens noch vollständige Modellrohtexte. Persistiert werden nur kurze Entscheidungssummaries, strukturierte Aktionen, gehashte Nutzlasten, gehashte Modellantworten, Provider-Metadaten, Laufzeiten, Critic-Entscheidungen und Ereignis-Receipts.

Ein Commander-Lauf kann ohne aktive, bereichspassende `model.run`-Teamfreigabe nicht angelegt werden. Jede Modellentscheidung und jede Critic-Prüfung verbraucht atomar genau eine Nutzung; bei abgelaufener, erschöpfter oder widerrufener Freigabe bleiben Commander-Budget und Laufversion unverändert.

Ein Modell kann keine Tool-Freigabe erfinden oder über eine Lease-ID auswählen. TankAI löst die Freigabe ausschließlich aus dem aktiven, nutzer- und projektgebundenen Lease-Bestand auf. Ohne passende Freigabe wird kein Werkzeugauftrag angelegt.

Eine finale Kandidatenantwort wird niemals ungeprüft als Erfolg gespeichert. Fehlt das Budget für die verpflichtende Critic-Prüfung, endet der Lauf mit `budget_exhausted`.

## Verifizierter lokaler Vertrag

- Modellentscheidung und Critic-Prüfung über eine echte aktive `model.run`-Lease
- atomarer Stopp ohne Commander-Budgetverbrauch bei nachträglich ungültiger Modellfreigabe
- Tool-Dispatch über eine echte aktive Lease
- Observation-Synchronisierung aus einem abgeschlossenen Tool Job
- unabhängige Critic-Freigabe vor Abschluss
- Verwerfen und Reparieren einer nicht autorisierten Werkzeugwahl
- ehrlicher `model_unavailable`-Abschluss ohne Provider
- Migration auf frischem D1-kompatiblem SQLite und Fremdschlüsselprüfung
