# TankAI Web v0.13.0 – Worker Runtime

## Implementiert

- dauerhafte, nutzergebundene Worker-Identitäten
- einmalig angezeigte 256-Bit-Tokens; gespeichert wird nur SHA-256
- Zustände `active`, `draining`, `revoked`
- Bearer-authentifizierte Worker-API
- konkurrenzbegrenzte Job-Claims mit 90-Sekunden-Lease
- monotone Job-Heartbeats und Fortschrittsereignisse
- automatische Wiederaufnahme abgelaufener Claims
- exponentieller Retry-Backoff
- terminaler Zustand `dead_letter` nach ausgeschöpften Versuchen
- append-only Worker- und Job-Receipts mit Worker-Zuordnung

## Sicherheitsgrenzen

Ein Worker kann ausschließlich Jobs desselben TankAI-Nutzers beanspruchen. Ein Job-Heartbeat
oder Abschluss benötigt gleichzeitig Worker-ID, Job-ID, geheimen Claim-Token, laufenden Status
und eine noch gültige Claim-Lease. Widerrufene Worker-Tokens authentifizieren nicht mehr.

Die bestehende Tool Fabric bleibt unverändert begrenzt. v0.13.0 führt insbesondere keine freie
Shell-, Repository- oder Server-Codeausführung ein.
