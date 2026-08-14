# TankAI Web v0.14.0 – ReAct Orchestrator

## Implementiert

- persistente, nutzer- und optional projektgebundene ReAct-Läufe
- Zustände `ready`, `running`, `waiting_tool`, `verifying`, `completed`, `failed`, `cancelled` und `budget_exhausted`
- harte Grenzen für Schritte, Modellentscheidungen und Werkzeugaktionen
- kurze Entscheidungszusammenfassungen statt gespeicherter privater Gedankengänge
- Werkzeugaktionen ausschließlich über bestehende Tool-Leases und idempotente Tool-Jobs
- Übernahme erfolgreicher Werkzeugausgaben als gehashte Beobachtung
- optimistische Versionskontrolle gegen parallele Entscheidungen
- append-only Events für Decision, Action, Observation, Abschluss, Fehler, Abbruch und Budgetstopp
- geschützte ReAct-API und Bedienoberfläche unter `/react`

## Ausführungsmodell

```text
Objective + Definition of Done
        ↓
Decision summary
        ↓
Tool action ──→ Tool Job / Worker
        ↓               ↓
waiting_tool ← Observation + SHA-256
        ↓
Next decision or final answer
```

Ein ReAct-Schritt ist kein freier Hintergrundprozess. Er wird nur durch eine versionierte Entscheidung fortgesetzt. Externe Aktionen benötigen eine passende Nutzer-/Projektfreigabe und bleiben innerhalb der Tool-Fabric-Budgets.

## Sicherheitsgrenzen

TankAI speichert keine privaten Reasoning-Tokens oder Chain-of-Thought-Protokolle. Persistiert werden nur eine knappe, für den Nutzer sichtbare Entscheidungsbegründung, die freigegebene Aktion, die beobachtete Werkzeugausgabe, deren Hash und unveränderliche Ereignis-Receipts.

Ein ausgeschöpftes Budget beendet den Lauf terminal. Werkzeugfehler werden erst übernommen, wenn der Job keine kontrollierte Wiederholung mehr offen hat.
