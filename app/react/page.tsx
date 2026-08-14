import type { Metadata } from "next";
import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { BrandMark } from "@/app/ui";
import ReActClient from "./react-client";

export const metadata: Metadata = {
  title: "ReAct Orchestrator",
  description: "Budgetierte Reasoning-Action-Observation-Läufe mit Tool-Jobs und Receipts.",
};

export const dynamic = "force-dynamic";

export default async function ReActPage() {
  const user = await requireChatGPTUser("/react");
  return (
    <main className="tools-shell">
      <header className="tools-header">
        <Link className="brand compact" href="/" aria-label="TankAI Startseite">
          <BrandMark />
          <span>TANK<span>AI</span></span>
        </Link>
        <nav aria-label="ReAct-Navigation">
          <Link href="/commander">Commander</Link>
          <Link href="/tools">Werkzeuge</Link>
          <Link href="/tankbench">TankBench</Link>
          <Link href="/deployment">Deployment</Link>
          <Link href="/workers">Worker</Link>
          <Link href="/app">Arbeitsoberfläche</Link>
          <a href={chatGPTSignOutPath("/")}>Abmelden</a>
        </nav>
      </header>
      <ReActClient displayName={user.displayName} />
    </main>
  );
}
