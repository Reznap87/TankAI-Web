# TankAI Web v0.18.0 – Deployment Controller

v0.18.0 bindet freigegebene TankBench-Releases an konkrete, serverseitig konfigurierte Modellprovider und schließt den produktiven Requestpfad.

## Umgesetzt

- releasegebundene Provider-Konfiguration mit SHA-256-Hash,
- Begrenzung der Ausgabetokens je Release,
- stabiles Active-/Canary-Routing über gehashte Routing-IDs,
- echte Provider-Aufrufe,
- gehashte Request- und Response-Receipts,
- direkte Übergabe von Erfolg, Fehler und Latenz an TankBench,
- automatische Canary-Promotion beziehungsweise Rollback über bestehende Gates.

## Sicherheitsgrenze

API-Schlüssel verbleiben ausschließlich in Server-Secrets. Request-Receipts speichern keine Prompt- oder Antwortklartexte.
