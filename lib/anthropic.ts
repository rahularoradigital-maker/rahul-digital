import Anthropic from "@anthropic-ai/sdk";

/** Default model for AdBrain. Server-only; the key never reaches the browser. */
export const CLAUDE_MODEL = "claude-sonnet-5";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}
