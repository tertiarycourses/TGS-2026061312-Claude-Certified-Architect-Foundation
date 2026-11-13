// Lab 1 · Task 1.1 · Simulator 1: watch one refund go round the agentic loop.
// This lab writes everything out in one file, so you can see exactly how the API is called:
//   1. callClaude(): one HTTPS POST to the Claude Messages API, model claude-haiku-5-5, your API key
//   2. the loop: continue while stop_reason is "tool_use", stop on "end_turn"
// (The other labs use the same two pieces from assets/engine.js.)
import { BACKEND, SYSTEM, newState, supportTools } from "./shared/support.js";

const MODEL = "claude-haiku-5-5";                         // the model every call in this course uses
const API_URL = "https://api.anthropic.com/v1/messages";  // the Claude Messages API

export default {
  id: 1,
  see: "Each turn POSTs the whole conversation to claude-haiku-5-5. stop_reason is tool_use after get_customer, lookup_order, recommend_refund and process_refund, each result is appended, then end_turn stops the loop with a $120 refund.",
  // The slide that prints this lab's key code (deck: "LAB 1 · THE CODE").
  slide: {
    title: "One POST per turn; stop_reason decides what's next",
    code: `body = {"model": "claude-haiku-5-5",        # KEY 1
        "system": SYSTEM, "tools": TOOLS,
        "messages": messages}
r = POST(API_URL, headers={"x-api-key": key}, # KEY 2
         json=body)
messages.append(r.content)                   # KEY 3
if r.stop_reason != "tool_use":              # KEY 4
    break
messages.append([run(b) for b in r.content
                 if b.type == "tool_use"])`,
    keys: [["1", "The model, every call", "claude-haiku-5-5, plus system, tools, history."],
           ["2", "Your key in a header", "x-api-key carries the key you saved."],
           ["3", "Keep Claude's whole turn", "Every tool_use block stays in the history."],
           ["4", "stop_reason decides", "tool_use: run the tool. end_turn: stop."]],
  },

  async run(s, E) {
    const state = newState();
    const tools = supportTools(state);
    const toolDefs = Object.entries(tools).map(([name, t]) => ({ name, description: t.description, input_schema: t.input_schema }));

    // 1. One call to Claude: an HTTPS POST with the model, your key and the whole conversation.
    async function callClaude(messages) {
      const body = { model: MODEL, max_tokens: 4096, system: SYSTEM, tools: toolDefs, messages };
      s.requests.push(body); s.onRequest?.(body);
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "x-api-key": s.apiKey,                              // your API key, from the sidebar box
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true", // allows the call straight from a web page
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`The API refused the call (${res.status}): ${data.error?.message || res.statusText}`);
      s.usage.input += data.usage.input_tokens; s.usage.output += data.usage.output_tokens; s.usage.calls += 1;
      return data;                                            // { id, model, content: [...], stop_reason, usage }
    }

    const customer = "meilin@example.com";
    const message = "My ceramic table lamp from order ORD-5501 arrived cracked. Photo attached. I want a refund.";
    s.log(`Case CS-01 · ${customer}: "${message}"`, "note");
    const messages = [{ role: "user", content: `Incoming support message (email: ${customer}):\n\n${message}` }];
    const calls = [];
    let r = null;

    // 2. The agentic loop.
    for (let turn = 1; turn <= 10; turn++) {                 // a hard cap: a confused loop stops at 10 turns
      s.log(`Turn ${turn}: POST ${API_URL} · model ${MODEL} · ${messages.length} message${messages.length > 1 ? "s" : ""}`, "turn");
      s.step("call");
      r = await callClaude(messages);
      messages.push({ role: "assistant", content: r.content }); // keep Claude's whole turn
      const uses = r.content.filter((b) => b.type === "tool_use");
      s.step("check");
      s.trace.push({ label: "", turn, stop_reason: r.stop_reason, tools: uses.map((u) => ({ name: u.name, input: u.input })), text: E.textOf(r.content) });
      if (r.stop_reason !== "tool_use") {                     // end_turn: Claude has finished
        s.step("stop");
        s.log(`  stop_reason: ${r.stop_reason} -> STOP: Claude has finished (model replied: ${r.model})`, "stop");
        break;
      }
      s.log(`  stop_reason: tool_use -> CONTINUE: run the tool, append the result, call Claude again`, "stop");
      const results = [];
      for (const [i, u] of uses.entries()) {
        s.step("tool");
        s.log(`  -> ${u.name}(${E.short(u.input, 120)})`, "call");
        const out = tools[u.name].run(u.input);
        const isError = !!out?.isError;
        s.log(`  <- ${isError ? "!! error: " : "result: "}${E.short(out, 150)}`, isError ? "error" : "result");
        Object.assign(s.trace.at(-1).tools[i], { result: out, isError });
        calls.push({ name: u.name, input: u.input, result: out });
        results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out), ...(isError ? { is_error: true } : {}) });
      }
      s.step("append");
      messages.push({ role: "user", content: results });      // every result goes back, in one message
    }

    const final = E.textOf(r?.content);
    s.log(`Reply: ${E.short(final, 600)}`, "reply");
    const at = (n) => calls.findIndex((c) => c.name === n);
    return {
      final,
      checks: [
        E.check(`Every call went to ${MODEL} with your API key`, s.requests.every((b) => b.model === MODEL) && r?.model?.startsWith("claude-haiku-5-5")),
        E.check("The loop continued on every tool_use turn and stopped on end_turn", r?.stop_reason === "end_turn"),
        E.check("get_customer ran before lookup_order", at("get_customer") > -1 && at("get_customer") < at("lookup_order")),
        E.check("process_refund issued $120 for ORD-5501", state.refunds.some((x) => x.order_id === "ORD-5501" && Number(x.amount) === BACKEND.orders["ORD-5501"].amount)),
      ],
    };
  },
};
