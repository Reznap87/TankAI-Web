import masterPromptDocument from "@/docs/TANKAI_MASTERPROMPT.md?raw";

export const TANKAI_MASTER_PROMPT_VERSION = "2.1.0";

const START_MARKER = "<!-- PROMPT_START -->";
const END_MARKER = "<!-- PROMPT_END -->";

function extractPrompt(document: string): string {
  const start = document.indexOf(START_MARKER);
  const end = document.indexOf(END_MARKER);

  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Der verbindliche TankAI-Masterprompt ist beschädigt.");
  }

  const prompt = document.slice(start + START_MARKER.length, end).trim();
  if (prompt.length < 8_000) {
    throw new Error("Der verbindliche TankAI-Masterprompt ist unvollständig.");
  }

  return prompt;
}

export const TANKAI_MASTER_PROMPT = extractPrompt(masterPromptDocument);
