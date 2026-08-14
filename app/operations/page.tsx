import type { Metadata } from "next";
import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { BrandMark } from "@/app/ui";
import OperationsClient from "./operations-client";

export const metadata: Metadata = {
  title: "Reliability Operations",
  description: "Admission Control, SLOs, Alerts, Dead-Letter-Replay und Audit-Export für TankAI.",
};
export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  const user = await requireChatGPTUser("/operations");
  return <main className="tools-shell operations-shell">
    <header className="tools-header">
      <Link className="brand compact" href="/" aria-label="TankAI Startseite"><BrandMark /><span>TANK<span>AI</span></span></Link>
      <nav aria-label="Operations-Navigation">
        <Link href="/deployment">Deployment</Link><Link href="/tankbench">TankBench</Link><Link href="/commander">Commander</Link>
        <Link href="/workers">Worker</Link><Link href="/tools">Werkzeuge</Link><Link href="/data">Daten</Link><Link href="/app">Arbeitsoberfläche</Link>
        <a href={chatGPTSignOutPath("/")}>Abmelden</a>
      </nav>
    </header>
    <OperationsClient displayName={user.displayName} />
  </main>;
}
