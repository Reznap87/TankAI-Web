# TankAI Web v0.24.0 – Data Control

Statusdatum: 28. Juli 2026

## Gelieferter Produktfortschritt

TankAI Web besitzt jetzt einen realen, geschützten Datenkontrollpfad unter
`/data`:

- vollständiger JSON-Export über 55 explizit registrierte nutzerbezogene
  D1-Datenmengen,
- Zeilenzahl und SHA-256 je Datenmenge sowie Manifest- und Gesamt-Hash,
- Redaction flüchtiger Job-Claim-Tokens und gespeicherter Worker-Token-Hashes,
- zweistufiger Löschauftrag mit individueller Bestätigungsphrase,
- zentrale Sperre aller gewöhnlichen TankAI-Aktionen während des Auftrags,
- 24-Stunden-Widerrufsfrist vor der endgültigen Ausführung,
- atomare Löschung in referenzsicherer Reihenfolge,
- Nullprüfung aller registrierten Datenmengen nach der Transaktion,
- anonymisierter, später überprüfbarer Löschbeleg ohne Nutzerkennung oder
  Nutzerinhalt.

## Sicherheitsvertrag

- Authentifizierung und Same-Origin sind für jede Datenmutation Pflicht.
- Anfragekörper sind unabhängig von `Content-Length` auf 4.096 Bytes begrenzt.
- Unbekannte Aktionsfelder werden abgewiesen.
- Aktive Modell-, Tool-, ReAct-, Commander-, TankBench- und
  Deployment-Ausführungen blockieren eine Löschung.
- Andere Mandanten werden bei Export und Löschung nicht berührt.
- Ein D1-Löschbeleg wird erst nach vollständiger Nullprüfung ausgegeben.

Der Beleg gilt ausschließlich für die TankAI-D1-Anwendungsdatenbank. Er
behauptet keine Löschung von Hosting-/Sicherheitslogs, plattformverwalteten
Backups oder Daten externer Modellanbieter.

## Datenmodell

Migration `0016_cultured_next_avengers.sql` ergänzt:

- `data_subject_requests` für Export- und Löschzustände,
- `data_subject_events` für unveränderliche Zustandsbelege,
- `data_deletion_receipts` für nicht rückverfolgbare Integritätsbelege.

Ein partieller eindeutiger Index lässt je Nutzer höchstens einen aktiven
Löschauftrag zu. Checks erzwingen Zustände, Versionen, Hashformate und
Lösch-/Exportinvarianten.

## Prüfung

Die Release-Abnahme umfasst:

- Registry-Abgleich gegen alle realen nutzerbezogenen Tabellen,
- Exporthashes und Credential-Redaction,
- Fremdmandantenisolation,
- falsche Bestätigungsphrase und aktive Widerrufsfrist,
- vollständige Löschung und Postcondition-Nullprüfung,
- anonymisierte Receipt-Verifikation,
- Foreign-Key-Integrität,
- authentifizierte Datenoberfläche und ehrlichen öffentlichen Status,
- alle bestehenden Produkt-, Runtime-, Sicherheits- und Regressionstests,
- Lint, Produktionsbuild, Artefaktprüfung, frische Migration und
  Abhängigkeitsaudit.

Die exakten finalen Ergebnisse und die Commit-/Archivhashes stehen im
separaten Build Receipt des unveränderlichen Releaseartefakts.

## Unveränderte Grenzen

- Masterprompt 2.1.0 und Modellgewichte bleiben unverändert.
- Kein Provider-Secret wurde aktiviert.
- Keine öffentliche oder zusätzliche Nutzerfreigabe wurde eingerichtet.
- Ausführungsabschluss bleibt von Faktenverifikation getrennt.
- Resolver/Egress-Proxy gegen DNS-Rebinding, Binärspeicher und externe
  Backup-Löschfortpflanzung bleiben offene Infrastruktur-Gates.
