# TankAI Web v0.22.0 – Multi-Source Research

Datum: 28. Juli 2026

## Tatsächlicher Umfang

- authentifizierte Recherche-API und sichtbare Rechercheoberfläche,
- zwei bis vier explizit angegebene HTTPS-Quellen mit mindestens zwei unterschiedlichen Hosts,
- ein persistenter, idempotenter `web.fetch`-Job pro Quelle,
- eigener Lease-Verbrauch und unveränderliche Tool-Events pro Quellenabruf,
- vollständiger, partieller oder fehlgeschlagener Bundle-Status,
- begrenzte Excerpts mit finaler URL, SHA-256, Bytezahl und Prompt-Injection-Signalen,
- Status- und Masterplandokumentation auf v0.22.0 beziehungsweise 3.2.0 fortgeschrieben.

## Reality Contract

Die Funktion entdeckt keine Quellen automatisch und behauptet keine inhaltliche Verifikation.
Jeder Recherchebund trägt `unverified-source-observations`. Ohne erlaubte Hosts in
`TANKAI_EGRESS_ALLOWED_HOSTS` bleiben alle Netzwerkabrufe weiterhin vor dem ersten Request
geschlossen. Der DNS-Rebinding-Schutz über einen kontrollierten Resolver oder Egress-Proxy ist
weiter offen.

Der Masterprompt blieb unverändert. Es wurden keine Provider-Secrets aktiviert, keine
Modellgewichte verändert und keine privaten Inhalte als Trainingsdaten verwendet.

## Sicherheitsgrenzen

- gleiche URL-, Hostform-, Redirect-, Zeit-, Typ-, Größen- und Egress-Grenzen wie `web.fetch`,
- mindestens zwei unterschiedliche Hosts,
- maximal vier Quellen,
- maximal 1.600 Zeichen Excerpt je Quelle im aggregierten Response,
- Same-Origin-Schreibschutz und serverseitige ChatGPT-Identität,
- optionale Projektbindung wird serverseitig gegen den Eigentümer geprüft,
- Idempotenzschlüssel bindet jeden Quellenjob stabil an seine Position im Bundle.
