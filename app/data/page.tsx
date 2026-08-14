import type { Metadata } from "next";
import Link from "next/link";
import {
  chatGPTSignOutPath,
  requireChatGPTUser,
} from "@/app/chatgpt-auth";
import { BrandMark } from "@/app/ui";
import DataControlClient from "./data-control-client";

export const metadata: Metadata = {
  title: "Daten & Löschung",
  description:
    "Vollständiger TankAI-Datenexport, kontrollierte Kontolöschung und überprüfbare Löschbelege.",
};

export const dynamic = "force-dynamic";

export default async function DataControlPage() {
  const user = await requireChatGPTUser("/data");
  return (
    <main className="tools-shell data-control-shell">
      <header className="tools-header">
        <Link className="brand compact" href="/" aria-label="TankAI Startseite">
          <BrandMark />
          <span>
            TANK<span>AI</span>
          </span>
        </Link>
        <nav aria-label="Daten-Navigation">
          <Link href="/operations">Operations</Link>
          <Link href="/tools">Werkzeuge</Link>
          <Link href="/tankbench">TankBench</Link>
          <Link href="/app">Arbeitsoberfläche</Link>
          <a href={chatGPTSignOutPath("/")}>Abmelden</a>
        </nav>
      </header>
      <DataControlClient displayName={user.displayName} />
    </main>
  );
}
