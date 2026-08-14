# TankAI Web v0.23.0 – Tool Progress Streaming

Datum: 28. Juli 2026

## Tatsächlicher Umfang

- authentifizierter SSE-Endpunkt für genau einen nutzereigenen Tool-Job,
- Live-Fortschritt in der geschützten Werkzeugoberfläche,
- resumierbarer Cursor aus Jobversion und Event-ID,
- Auswertung des standardisierten `Last-Event-ID`-Headers,
- 15-Sekunden-Streamfenster, Heartbeats und kontrollierte Wiederverbindung,
- unmittelbarer Abschluss bei terminalen Jobs,
- reale Laufzeittests für SSE-Frames und Cursorvalidierung,
- Status-, Sicherheits- und Masterplandokumentation auf v0.23.0 beziehungsweise 3.3.0.

## Reality Contract

Der Stream zeigt Ausführungsfortschritt. Er verifiziert keine Tatsachen. Jeder Datenframe enthält
`executionStatusOnly: true` und `factsVerified: false`.

Der Masterprompt blieb unverändert. Es wurden keine Provider-Secrets aktiviert, keine
Modellgewichte verändert und keine privaten Inhalte als Trainingsdaten verwendet.

## Sicherheitsgrenzen

- serverseitige Identität und nutzergebundene Jobabfrage vor Streameröffnung,
- keine Tool-Eingabe, Tool-Ausgabe, Idempotenzschlüssel oder Eingabehashes im Stream,
- UUID-validierte Job-ID,
- validierter, längenbegrenzter Cursor,
- `Cache-Control: no-store, no-transform`,
- Heartbeat-Kommentare ohne Nutzdaten,
- begrenzte Streamdauer und Wiederverbindungsintervall,
- Streamabbruch beendet weitere Abfragen.
