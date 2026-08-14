import type { Metadata } from "next";
import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { BrandMark } from "@/app/ui";
import TankBenchClient from "./tankbench-client";

export const metadata: Metadata = {
  title: "TankBench",
  description: "Eingefrorene Evaluationssuiten, Promotion-Gates, Canary-Rollout und automatischer Rollback.",
};

export const dynamic = "force-dynamic";

export default async function TankBenchPage() {
  const user = await requireChatGPTUser("/tankbench");
  return (
    <main className="tools-shell">
      <header className="tools-header">
        <Link className="brand compact" href="/" aria-label="TankAI Startseite">
          <BrandMark />
          <span>TANK<span>AI</span></span>
        </Link>
        <nav aria-label="TankBench-Navigation">
          <Link href="/commander">Commander</Link>
          <Link href="/react">ReAct</Link>
          <Link href="/tools">Werkzeuge</Link>
          <Link href="/deployment">Deployment</Link>
          <Link href="/workers">Worker</Link>
          <Link href="/app">Arbeitsoberfläche</Link>
          <a href={chatGPTSignOutPath("/")}>Abmelden</a>
        </nav>
      </header>
      <TankBenchClient displayName={user.displayName} />
    </main>
  );
}
