import type { Metadata } from "next";
import { requireChatGPTUser, chatGPTSignOutPath } from "@/app/chatgpt-auth";
import { BrandMark } from "@/app/ui";
import ChatClient from "./chat-client";

export const metadata: Metadata = {
  title: "Arbeitsoberfläche",
  description: "Die geschützte TankAI-Team-Arbeitsoberfläche.",
};

export const dynamic = "force-dynamic";

export default async function TankAIAppPage() {
  const user = await requireChatGPTUser("/app");

  return (
    <main className="app-shell">
      <header className="app-mobile-header">
        <div className="brand compact">
          <BrandMark />
          <span>TANK<span>AI</span></span>
        </div>
        <span className="mobile-core-state">SESSION ACTIVE</span>
      </header>
      <ChatClient
        displayName={user.displayName}
        signOutPath={chatGPTSignOutPath("/")}
      />
    </main>
  );
}
