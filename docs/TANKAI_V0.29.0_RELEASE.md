# TankAI Web v0.29.0 – typgesicherte CSV-Aggregationen

TankAI Web erweitert `project.document.inspect` um echte, deterministische Aggregationen auf
versionierten CSV-Projektdateien. Die Operationen laufen auf der bereits eigentümer-, projekt-,
dokument- und Tool-Lease-gebundenen Werkzeugschicht.

## Verhalten

- bis zu acht eindeutige Aggregationen pro Abfrage,
- Operationen `sum`, `minimum`, `maximum` und `average`,
- vorhandene Filter bestimmen die aggregierte Zeilenmenge,
- Sortierung, Offset und Ergebnislimit verändern die Aggregation nicht,
- ausschließlich rein numerische oder vollständig leere Spalten,
- leere Zellen werden gezählt, aber nicht als Null in die Rechnung aufgenommen,
- gemischte Spalten und nicht endliche Ergebnisse werden abgewiesen,
- kompensierte Summierung und 15 signifikante Ausgabestellen,
- keine Formel-, Makro-, Script- oder Codeausführung,
- `factsVerified: false` trennt belegte Ausführung von der Wahrheit der Quelldaten.

## Persistenz

Die Scheibe liest die unveränderte aktuelle CSV-Dokumentversion. Es wird keine neue Tabelle und
keine Datenmigration benötigt.

## Verbleibende externe Grenze

Die öffentliche Cloudflare-Veröffentlichung bleibt ohne berechtigten Zielaccount, D1-ID,
API-Token und Identity-Salt blockiert. Provider-Secrets wurden nicht aktiviert.
