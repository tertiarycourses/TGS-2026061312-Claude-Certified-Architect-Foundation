// One call to Claude Haiku 5.5 with the Anthropic TypeScript SDK, signed in with Anthropic OAuth.
// Prints the full response, then reads stop_reason, stop_details, content and usage out of it.
//
// Usage:  npm install                                 (first time)
//         npm start                                   default prompt, max_tokens 1024
//         npm start -- "Your prompt" 20               small max_tokens -> stop_reason "max_tokens"
// Needs:  `ant auth login` once. The SDK finds that OAuth profile by itself: no API key.
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-5-5";
const prompt = process.argv[2] ?? "In two sentences, explain what stop_reason tells an agent loop to do next.";
const maxTokens = Number(process.argv[3] ?? 1024);

if (process.env.ANTHROPIC_API_KEY) {
  console.error("Note: ANTHROPIC_API_KEY is set, so it overrides your OAuth sign-in. Unset it to use OAuth.");
}

// No apiKey option: the client reads the `ant auth login` OAuth profile from ~/.config/anthropic.
const client = new Anthropic();

let message: Anthropic.Message;
try {
  message = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
} catch (err) {
  // APIConnectionError is a subclass of APIError in TypeScript, so check it first.
  if (err instanceof Anthropic.AuthenticationError) {
    console.error("Not signed in, or the sign-in ran out. Run: ant auth login");
  } else if (err instanceof Anthropic.RateLimitError) {
    console.error(`Rate limited (429). Wait and retry. ${err.message}`);
  } else if (err instanceof Anthropic.APIConnectionError) {
    console.error(`Could not reach the API: ${err.message}`);
  } else if (err instanceof Anthropic.APIError) {
    console.error(`The API refused the call (${err.status} ${err.type}): ${err.message}`);
  } else if (err instanceof Error && err.message.includes("Could not resolve authentication method")) {
    // Thrown before anything is sent when the SDK finds no key and no OAuth profile.
    console.error("Not signed in to the Claude API. Run: ant auth login");
  } else {
    throw err;
  }
  process.exit(1);
}

console.log("== Full response object");
console.log(JSON.stringify(message, null, 2));

console.log("\n== What the agent loop reads");
console.log(`id            : ${message.id}`);
console.log(`model         : ${message.model}`);
console.log(`stop_reason   : ${message.stop_reason}`);
console.log(`stop_sequence : ${message.stop_sequence}`);
console.log(`stop_details  : ${JSON.stringify(message.stop_details ?? null)}`);
console.log(`input_tokens  : ${message.usage.input_tokens}`);
console.log(`output_tokens : ${message.usage.output_tokens}`);
console.log(`content blocks: ${message.content.map((block) => block.type).join(", ")}`);

console.log("\n== Text Claude wrote");
// Read every text block, not content[0]: a thinking block can come first.
for (const block of message.content) {
  if (block.type === "text") console.log(block.text);
}

console.log();
switch (message.stop_reason) {
  case "end_turn":
    console.log("end_turn: Claude finished. The loop stops and shows the answer.");
    break;
  case "max_tokens":
    console.log(`max_tokens: cut off at ${maxTokens} tokens. Raise max_tokens or continue the turn.`);
    break;
  case "stop_sequence":
    console.log("stop_sequence: a stop sequence you set was hit.");
    break;
  case "tool_use":
    console.log("tool_use: Claude wants a tool. Run it and send back a tool_result.");
    break;
  case "pause_turn":
    console.log("pause_turn: a server tool paused. Send the reply back to let it continue.");
    break;
  case "refusal":
    console.log(`refusal: declined (${JSON.stringify(message.stop_details)}). Don't use the content.`);
    break;
  default:
    console.log(`Unexpected stop_reason ${message.stop_reason}. Check the full response above.`);
}
