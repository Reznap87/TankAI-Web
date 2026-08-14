import type { Metadata } from "next";
import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { BrandMark } from "@/app/ui";
import WorkersClient from "./workers-client";

export const metadata: Metadata = {
  title: "Worker Runtime",
  description: "Registrierte Worker, Heartbeats, Claims, Retry und Dead Letter.",
};
export const dynamic = "force-dynamic";

export default async function WorkersPage() {
  const user = await requireChatGPTUser("/workers");
  return (
    <main className="tools-shell">
      <header className="tools-header">
        <Link className="brand compact" href="/" aria-label="TankAI Startseite"><BrandMark /><span>TANK<span>AI</span></span></Link>
        <nav aria-label="Workernavigation"><Link href="/commander">Commander</Link>
          <Link href="/react">ReAct</Link><Link href="/tankbench">TankBench</Link><Link href="/deployment">Deployment</Link><Link href="/tools">Werkzeuge</Link><Link href="/app">Arbeitsoberfläche</Link><a href={chatGPTSignOutPath("/")}>Abmelden</a></nav>
      </header>
      <WorkersClient displayName={user.displayName} />
    </main>
  );
}
