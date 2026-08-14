import type { Metadata } from "next";
import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { BrandMark } from "@/app/ui";
import DeploymentClient from "./deployment-client";

export const metadata: Metadata = {
  title: "React Deployment Control Plane",
  description: "Live-Metriken, Request-Traces, Traffic-Shifting, Provider-Fallback und Circuit Breaker.",
};
export const dynamic = "force-dynamic";

export default async function DeploymentPage() {
  const user = await requireChatGPTUser("/deployment");
  return <main className="tools-shell deployment-shell">
    <header className="tools-header">
      <Link className="brand compact" href="/" aria-label="TankAI Startseite"><BrandMark /><span>TANK<span>AI</span></span></Link>
      <nav aria-label="Deployment-Navigation">
        <Link href="/operations">Operations</Link><Link href="/tankbench">TankBench</Link><Link href="/commander">Commander</Link><Link href="/react">ReAct</Link>
        <Link href="/workers">Worker</Link><Link href="/app">Arbeitsoberfläche</Link><a href={chatGPTSignOutPath("/")}>Abmelden</a>
      </nav>
    </header>
    <DeploymentClient displayName={user.displayName} />
  </main>;
}
