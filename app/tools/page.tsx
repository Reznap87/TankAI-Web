import type { Metadata } from "next";
import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { BrandMark } from "@/app/ui";
import ToolsClient from "./tools-client";

export const metadata: Metadata = {
  title: "Tool Fabric",
  description: "Lease-geschützte HTTPS-, Dokument- und Patchwerkzeuge mit persistenten Receipts.",
};

export const dynamic = "force-dynamic";

export default async function ToolsPage() {
  const user = await requireChatGPTUser("/tools");
  return (
    <main className="tools-shell">
      <header className="tools-header">
        <Link className="brand compact" href="/" aria-label="TankAI Startseite">
          <BrandMark />
          <span>TANK<span>AI</span></span>
        </Link>
        <nav aria-label="Werkzeugnavigation">
          <Link href="/commander">Commander</Link>
          <Link href="/react">ReAct</Link>
          <Link href="/tankbench">TankBench</Link>
          <Link href="/deployment">Deployment</Link>
          <Link href="/workers">Worker</Link>
          <Link href="/app">Arbeitsoberfläche</Link>
          <a href={chatGPTSignOutPath("/")}>Abmelden</a>
        </nav>
      </header>
      <ToolsClient displayName={user.displayName} />
    </main>
  );
}
