// Runnable check for the Claude integration.
//   node scripts/check-claude.mjs
// Skips cleanly (exit 0) if no ANTHROPIC_API_KEY is set, so it never blocks a build.
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

// Minimal .env.local loader (no dotenv dependency).
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // no .env.local yet, rely on real env
}

const key = process.env.ANTHROPIC_API_KEY;
if (!key) {
  console.log("SKIP: ANTHROPIC_API_KEY not set. Add it to .env.local to run this check.");
  process.exit(0);
}

const anthropic = new Anthropic({ apiKey: key });
const msg = await anthropic.messages.create({
  model: "claude-sonnet-5",
  max_tokens: 32,
  messages: [{ role: "user", content: "Reply with exactly: pong" }],
});
const reply = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();

if (!reply) {
  console.error("FAIL: Claude returned an empty reply.");
  process.exit(1);
}
console.log(`PASS: Claude replied "${reply}"`);
