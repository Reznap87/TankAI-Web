import type { Metadata } from "next";
import Link from "next/link";
import { ArrowIcon, BrandMark, CheckIcon } from "@/app/ui";
import {
  TANKBENCH_CONTRACT_VERSION,
  TANKBENCH_DIMENSIONS,
  TANKBENCH_PROMOTION_RULES,
} from "@/lib/tankbench";

export const metadata: Metadata = {
  title: "Messstandard",
  description:
    "Der verbindliche TankBench-Standard für überprüfbare TankAI-Vergleiche.",
};

export default function BenchmarkPage() {
  return (
    <main className="benchmark-shell">
      <header className="site-header inner-header">
        <Link className="brand" href="/" aria-label="TankAI Startseite">
          <BrandMark />
          <span>TANK<span>AI</span></span>
        </Link>
        <nav className="top-nav" aria-label="Hauptnavigation">
          <Link href="/">Start</Link>
          <Link className="nav-cta" href="/app">
            TankAI öffnen <ArrowIcon />
          </Link>
        </nav>
      </header>

      <section className="benchmark-hero">
        <p className="eyebrow">
          TANKBENCH · VERTRAG {TANKBENCH_CONTRACT_VERSION}
        </p>
        <h1>„Besser“ ist kein Slogan. Es ist ein reproduzierbarer Befund.</h1>
        <p>
          TankAI darf Überlegenheit nur für eine klar benannte Version,
          Aufgabenklasse, Testmenge und Zeit behaupten. Dieselben Aufgaben,
          vergleichbare Budgets und unabhängige Bewertung sind Pflicht.
        </p>
      </section>

      <section className="benchmark-rule">
        <span>HARTES GATE</span>
        <h2>Ein kritischer Sicherheitsverstoß sperrt den Sieg — auch bei höherem Durchschnitt.</h2>
      </section>

      <section className="dimension-section">
        <div className="section-intro">
          <p className="section-kicker">ACHT DIMENSIONEN</p>
          <h2>Qualität wird nicht auf Eloquenz reduziert.</h2>
        </div>
        <div className="dimension-grid">
          {TANKBENCH_DIMENSIONS.map((dimension, index) => (
            <article key={dimension.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{dimension.label}</h3>
                <p>
                  {dimension.description} · Gewicht{" "}
                  {Math.round(dimension.weight * 100)} %
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="benchmark-process">
        <div>
          <p className="section-kicker">VERGLEICHSVERTRAG</p>
          <h2>Vor dem ersten Modelllauf eingefroren.</h2>
        </div>
        <div className="process-list">
          {[
            "Repräsentativer Korpus und vollständiger Dataset-Fingerprint",
            "Gleiche Aufgaben, Zeitgrenzen, Werkzeuge und Kostenbudgets",
            "Unabhängige Referenzen und Richter",
            "Alle Fehlversuche, Unsicherheit und Rohmetriken sichtbar",
            "Keine nachträgliche Fallauswahl zugunsten des Candidates",
            "Reproduzierbares Receipt mit Version und Datum",
          ].map((item) => (
            <div key={item}>
              <CheckIcon />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="benchmark-process">
        <div>
          <p className="section-kicker">PROMOTION GATE</p>
          <h2>Ein Candidate ersetzt den Kern nur, wenn jedes Gate besteht.</h2>
        </div>
        <div className="process-list">
          {TANKBENCH_PROMOTION_RULES.map((item) => (
            <div key={item}>
              <CheckIcon />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="benchmark-footer">
        <p>
          Aktuell ist kein öffentlicher Vergleich freigegeben. Bis ein Vergleich
          alle Gates erfüllt, beschreibt TankAI seine Fähigkeiten konkret — und
          nennt sich nicht die beste KI.
        </p>
        <Link className="primary-button" href="/app">
          Arbeitsoberfläche öffnen <ArrowIcon />
        </Link>
      </section>
    </main>
  );
}
