# TankAI Web v0.21.0 – Egress Policy Enforcement

Datum: 28. Juli 2026

## Tatsächlicher Umfang

- höchste bestätigte Library-Baseline v0.20.0 in den Site-Checkout übernommen,
- zwei bislang unentdeckte Builddefekte der v0.20.0-API behoben: falsches `lib/http`-Modul und
  falscher Auth-Import,
- hartcodierte Node-22-TypeScript-Testimporte auf den projektgebundenen Lockfile-Compiler umgestellt,
- zentrale `web.fetch`-Egress-Policy mit deny-by-default Verhalten,
- exakte Host- und Wildcard-Subdomain-Allowlist,
- vorrangige Denylist,
- erneute Egress-Prüfung jedes Redirectziels,
- gehashter Policy-Nachweis im Werkzeugergebnis,
- Status-, Sicherheits-, Masterplan- und Produktdokumentation fortgeschrieben.

## Reality Contract

Ohne `TANKAI_EGRESS_ALLOWED_HOSTS` verlässt kein `web.fetch`-Request die Anwendung. Die neue
Policy ist eine echte Anwendungsgrenze, aber kein Ersatz für DNS-Auflösung mit Prüfung der
resultierenden IP-Adressen. Allgemeiner Netzwerkzugriff bleibt deshalb gesperrt, bis ein
kontrollierter Resolver oder Egress-Proxy private, reservierte und Link-Local-Netze auch gegen
DNS-Rebinding blockiert.

Der Masterprompt blieb unverändert. Es wurden keine Provider-Secrets aktiviert, keine
Modellgewichte verändert und keine privaten Inhalte als Trainingsdaten verwendet.

## Verifikation

| Gate | Ergebnis |
| --- | --- |
| Drizzle-Generierung | keine Schemaänderung; Metadaten auf aktuelle 50-Tabellen-Baseline repariert |
| Lint | Exit 0; 0 Fehler, 32 bekannte React-/Baseline-Warnungen |
| Produktionsbuild | bestanden; 23 API-/Produkt-Routen, Worker-Artefakt validiert |
| Tests | 86/86 bestanden |
| Migrations-Upgrades | v0.15→TankBench, v0.18→Control Plane und v0.19→Operations bestanden |
| Produktionsabhängigkeiten | 0 bekannte Schwachstellen |
| Vollständiger Buildbaum | 21 bekannte Dev-/Build-Advisories, davon 17 hoch und 4 moderat; 0 kritisch |
| Secret-Wertmuster | 0 Treffer im bereinigten Quellstand |
| Masterprompt-Integrität | SHA-256 `8c38193b6bb0ab460035c3e6a1ef04e53f88201c6fb63440866945b93c8de5e1` unverändert |
| Site-Zugriff | `custom`, ausschließlich bisheriger Eigentümer, keine Gruppen |

Der exakte Commit und die Archivhashes stehen im externen Build Receipt des geprüften Checkpoints.
