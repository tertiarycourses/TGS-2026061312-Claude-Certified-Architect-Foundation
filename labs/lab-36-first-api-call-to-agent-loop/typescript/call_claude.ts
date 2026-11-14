// Lab 36, step 1 (TypeScript): the same call with the Anthropic TypeScript SDK.
// Usage:  npm install        (first time)
//         npm start          or   npm start -- "Explain the agent loop" 20
import Anthropic from "@anthropic-ai/sdk";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

// KEY 1: find labs/.env (walking up from here) and load ANTHROPIC_API_KEY from it
for (let d = process.cwd(); ; d = dirname(d)) {
  if (existsSync(join(d, ".env"))) { process.loadEnvFile(join(d, ".env")); break; }
  if (dirname(d) === d) break;
}

const client = new Anthropic();                       // reads ANTHROPIC_API_KEY from the environment
const prompt = process.argv[2] ?? "In two sentences, what does stop_reason tell an agent loop?";
const maxTokens = Number(process.argv[3] ?? 1024);

const message = await client.messages.create({        // KEY 2: same request shape as curl and Python
  model: "claude-haiku-5-5",
  max_tokens: maxTokens,
  messages: [{ role: "user", content: prompt }],
});

console.log("stop_reason   :", message.stop_reason);  // KEY 3: the field the loop branches on
console.log("usage         :", message.usage.input_tokens, "in /", message.usage.output_tokens, "out");
console.log("content blocks:", message.content.map((b) => b.type));
for (const block of message.content) if (block.type === "text") console.log("\n" + block.text);
