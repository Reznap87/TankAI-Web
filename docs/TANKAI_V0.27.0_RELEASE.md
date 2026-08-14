# TankAI Web v0.27.0 – Public Release Readiness

Statusdatum: 28. Juli 2026

## Gelieferter Produktfortschritt

Der Webkern weist seine tatsächliche Laufzeitbereitschaft jetzt öffentlich und
maschinenlesbar aus, ohne einen privaten Checkpoint oder eine externe
Hosting-Freigabe als öffentlich live zu behaupten.

- öffentlicher, nicht zwischengespeicherter Endpunkt `/api/public-readiness`
- reale Prüfung von D1-Bindung, Identity-Salt, Modellprovider und Egress-Allowlist
- keine Ausgabe von Secret-Namen, Secret-Werten, Nutzerkennungen oder internen Daten
- getrennte Zustände für Webruntime, Anwendungsbereitschaft, Modellpfad und externe Zielgruppe
- `publiclyReachable: null`, solange DNS, HTTPS und Hosting-Zielgruppe nicht extern geprüft wurden
- Landingpage zeigt keine statischen Claims `SYSTEM ONLINE` oder `CORE ONLINE` mehr
- geschützte Arbeitsoberfläche bezeichnet nur die tatsächlich authentifizierte Sitzung als aktiv
- ausführbarer externer Prüfer für DNS, HTTPS-Landingpage, Readiness-API und Auth-Redirect
- DNS-Fehler erzeugen ein strukturiertes, fehlgeschlagenes Verification Receipt

## Tatsächlich ausgeführte Prüfung

Die neuen isolierten Tests prüfen:

- fehlende und vollständige Runtimekonfiguration,
- Secret-Redaction,
- leere Providerwerte,
- erfolgreiche externe Deploymentprüfung mit kontrollierten HTTP-Antworten,
- HTTPS-Zwang,
- Blockade von Placeholder-/Coming-soon-Inhalten,
- strukturiertes DNS-Blocker-Receipt,
- Entfernung der unbestätigten Online-Claims aus Landingpage und Arbeitsoberfläche.

Der externe Prüfer wurde zusätzlich gegen die zuvor genannte Adresse
`https://tankai-web.tankonthatrack.chatgpt.site` ausgeführt. Die Prüfung endete
mit `passed: false`, `blockedBy: public_dns` und einem DNS-Auflösungsfehler. Damit
ist die Adresse in diesem Release ausdrücklich **nicht als öffentlich live
verifiziert**.

## Veröffentlichungsgrenze

Die Anwendung kann die Zielgruppe einer ChatGPT Site nicht aus ihrer eigenen
Runtime ändern oder verifizieren. Der letzte Publish-Schritt benötigt einen
berechtigten Hosting-Account mit aktivierter öffentlicher Veröffentlichung.
Diese Laufzeit besitzt weder eine verbundene GitHub-Installation mit Repository
noch Cloudflare-/Sites-Zugangsdaten. Deshalb wurde keine öffentliche Freigabe,
kein Provider-Secret und keine kostenpflichtige Aktion ausgelöst.

## Nächster Gate

1. berechtigten Hosting-Account oder ein bestehendes Deployment-Repository verbinden,
2. Build und Migrationen im Zielhost ausführen,
3. Zielgruppe auf öffentlich setzen,
4. `npm run verify:public -- https://<öffentliche-adresse>` ausführen,
5. nur bei vollständig bestandenem Receipt die Adresse als öffentlich live ausweisen.
