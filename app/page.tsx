import Link from "next/link";
import { ArrowIcon, BrandMark, CheckIcon } from "@/app/ui";
import { evaluatePublicReadiness } from "@/lib/public-readiness";
import { currentRuntimeBindings } from "@/lib/request-context";

export const dynamic = "force-dynamic";

const corrections = [
  "Keine erfundenen Aktionen: Jede Handlung braucht ein Receipt.",
  "Kein Endlos-Plan: Nach dem Vertrag entsteht der erste echte Meilenstein.",
  "Kein blindes Selbstlernen: Golden-Evals, Canary und Rollback sind Pflicht.",
  "Kein Anbieter besitzt den Kern: Modelle bleiben austauschbar.",
];

const systemNodes = [
  { code: "01", title: "Commander", copy: "hält Ziel, Rechte und Definition of Done" },
  { code: "02", title: "Model Mesh", copy: "routet passende KI-Familien nach Messwerten" },
  { code: "03", title: "Critic Layer", copy: "sucht Fehler, Lücken und unbelegte Claims" },
  { code: "04", title: "Memory", copy: "speichert Herkunft, Gültigkeit und Konflikte" },
];

function statusLabel(value: boolean): string {
  return value ? "BEREIT" : "BLOCKIERT";
}

export default function Home() {
  const readiness = evaluatePublicReadiness(currentRuntimeBindings());

  const runtimeChecks = [
    {
      label: "D1-Datenbank",
      ready: readiness.services.databaseBinding,
    },
    {
      label: "Nutzertrennung",
      ready: readiness.services.identitySalt,
    },
    {
      label: "Modellprovider",
      ready: readiness.services.modelProvider,
    },
    {
      label: "Öffentliche Adresse",
      ready: false,
      external: true,
    },
  ];

  return (
    <main className="site-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="TankAI Startseite">
          <BrandMark />
          <span>TANK<span>AI</span></span>
        </Link>
        <nav className="top-nav" aria-label="Hauptnavigation">
          <a href="#system">System</a>
          <Link href="/benchmark">Benchmark</Link>
          <Link href="/commander">Commander</Link>
          <Link href="/tankbench">TankBench</Link>
          <Link href="/operations">Operations</Link>
          <Link href="/data">Daten</Link>
          <Link href="/tools">Werkzeuge</Link>
          <Link className="nav-cta" href="/app">
            TankAI öffnen <ArrowIcon />
          </Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="live-dot" />
            WEB RUNTIME · V0.43
          </div>
          <h1>
            Eine KI.
            <br />
            <span>Ein Team dahinter.</span>
          </h1>
          <p className="hero-lead">
            TankAI führt spezialisierte Modelle, Werkzeuge und Prüfschritte in
            einer mandantengetrennten Webanwendung zusammen. Laufzeitstatus,
            Konfigurationsblocker und externe Veröffentlichung werden getrennt
            ausgewiesen — ohne einen privaten Checkpoint als öffentlich live
            auszugeben.
          </p>
          <div className="hero-actions">
            <Link className="primary-button" href="/app">
              Arbeitsoberfläche starten <ArrowIcon />
            </Link>
            <Link className="text-link" href="/api/public-readiness">
              Maschinenlesbaren Status öffnen
            </Link>
          </div>
          <div className="truth-strip">
            <span>Keine Simulation</span>
            <span>Mandantentrennung</span>
            <span>Ausführung mit Receipts</span>
          </div>
        </div>

        <div className="system-visual" aria-label="TankAI Laufzeit- und Veröffentlichungsstatus">
          <div className="visual-topline">
            <span>TANKAI CORE</span>
            <span className="core-state">WEB RUNTIME ONLINE</span>
          </div>
          <div className="core-orbit">
            <div className="orbit-ring orbit-one" />
            <div className="orbit-ring orbit-two" />
            <div className="core-emblem">
              <BrandMark />
              <strong>CORE</strong>
              <small>v2.1</small>
            </div>
            <span className="orbit-node node-a">PLAN</span>
            <span className="orbit-node node-b">ROUTE</span>
            <span className="orbit-node node-c">VERIFY</span>
            <span className="orbit-node node-d">LEARN</span>
          </div>
          <div className="runtime-readiness">
            {runtimeChecks.map((check) => (
              <div key={check.label}>
                <span>{check.label}</span>
                <strong className={check.ready ? "ready" : "blocked"}>
                  {check.external ? "EXTERN ZU PRÜFEN" : statusLabel(check.ready)}
                </strong>
              </div>
            ))}
          </div>
          <div className="visual-foot">
            <span>RUNTIME-AUSFÜHRUNG VERIFIZIERT</span>
            <span>ÖFFENTLICHE ERREICHBARKEIT NICHT RUNTIME-VERIFIZIERBAR</span>
          </div>
        </div>
      </section>

      <section className="proof-band" aria-label="Produktprinzipien">
        <div>
          <span className="proof-number">01</span>
          <strong>Web zuerst</strong>
          <p>HTTPS, Identität und persistente Runs sind Teil des Kerns.</p>
        </div>
        <div>
          <span className="proof-number">02</span>
          <strong>Team statt Monokultur</strong>
          <p>Planner, Spezialisten, Critic und Synthesizer mit harten Budgets.</p>
        </div>
        <div>
          <span className="proof-number">03</span>
          <strong>Beweis statt Behauptung</strong>
          <p>„Besser“ gilt nur pro Version und eingefrorenem Benchmark.</p>
        </div>
      </section>

      <section className="system-section" id="system">
        <div className="section-intro">
          <p className="section-kicker">DAS SYSTEM</p>
          <h2>Nicht noch ein Chat-Wrapper.</h2>
          <p>
            Die Intelligenz liegt nicht in einem einzelnen Modellnamen. Sie
            liegt in Zielkontrolle, Routing, Werkzeugen, Gedächtnis,
            Gegenprüfung und einer Lernschleife, die Regressionen blockiert.
          </p>
        </div>
        <div className="node-grid">
          {systemNodes.map((node) => (
            <article key={node.code}>
              <span>{node.code}</span>
              <h3>{node.title}</h3>
              <p>{node.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="correction-section">
        <div>
          <p className="section-kicker">AUS FEHLERN GEBAUT</p>
          <h2>Die bekannten Schwächen moderner Assistenten sind Baufehler — keine Naturgesetze.</h2>
        </div>
        <div className="correction-list">
          {corrections.map((item) => (
            <div key={item}>
              <CheckIcon />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <div>
          <span className="section-kicker">PRODUKTIVER KERN</span>
          <h2>Gib nicht einem Modell die Aufgabe. Gib TankAI das Ziel.</h2>
        </div>
        <Link className="primary-button light" href="/app">
          TankAI öffnen <ArrowIcon />
        </Link>
      </section>

      <footer className="site-footer">
        <div className="brand compact">
          <BrandMark />
          <span>TANK<span>AI</span></span>
        </div>
        <p>Web-native Multi-KI-Orchestrierung · Release 0.43.0 · Masterprompt 2.1.0</p>
        <div>
          <Link href="/benchmark">Messstandard</Link>
          <Link href="/data">Datenkontrolle</Link>
        </div>
      </footer>
    </main>
  );
}
