import type { Metadata } from "next";
import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { BrandMark } from "@/app/ui";
import CommanderClient from "./commander-client";

export const metadata: Metadata = {
  title: "Commander",
  description: "Autonome, budgetierte Commander-Orchestrierung über ReAct, Tool-Leases und Critic-Prüfung.",
};

export const dynamic = "force-dynamic";

export default async function CommanderPage() {
  const user = await requireChatGPTUser("/commander");
  return (
    <main className="tools-shell">
      <header className="tools-header">
        <Link className="brand compact" href="/" aria-label="TankAI Startseite">
          <BrandMark />
          <span>TANK<span>AI</span></span>
        </Link>
        <nav aria-label="Commander-Navigation">
          <Link href="/react">ReAct</Link>
          <Link href="/tools">Werkzeuge</Link>
          <Link href="/tankbench">TankBench</Link>
          <Link href="/deployment">Deployment</Link>
          <Link href="/workers">Worker</Link>
          <Link href="/app">Arbeitsoberfläche</Link>
          <a href={chatGPTSignOutPath("/")}>Abmelden</a>
        </nav>
      </header>
      <CommanderClient displayName={user.displayName} />
    </main>
  );
}
