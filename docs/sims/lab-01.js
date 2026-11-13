// Lab 1 · Task 1.1 · Simulator 1: watch one refund go round the agentic loop.
// The loop is runAgent() in assets/engine.js: it continues on stop_reason "tool_use" (runs the tool,
// appends the result, calls Claude again) and stops on "end_turn". Nothing here decides when to stop
// by reading Claude's wording.
import { BACKEND, SYSTEM, newState, supportTools } from "./shared/support.js";

export default {
  id: 1,
  see: "A stop_reason on every turn: tool_use after get_customer, lookup_order, recommend_refund and process_refund, each result appended to the conversation, then end_turn stops the loop with a $120 refund.",
  // The slide that prints this lab's key code (deck: "LAB 1 · THE CODE").
  slide: {
    title: "The loop runs on stop_reason, never on Claude's wording",
    code: `for turn in range(1, 11):                     # KEY 1
    r = claude(system, messages, tools)
    messages.append(r.content)                  # KEY 2
    if r.stop_reason != "tool_use":             # KEY 3
        break
    results = [run(b) for b in r.content
               if b.type == "tool_use"]
    messages.append(results)                    # KEY 4`,
    keys: [["1", "A hard turn cap", "A confused loop stops at 10 turns."],
           ["2", "Keep Claude's whole turn", "Every tool_use block stays in the history."],
           ["3", "stop_reason decides", "tool_use: run the tool. end_turn: stop."],
           ["4", "Every result goes back", "Matched to its tool_use_id, in one message."]],
  },
  async run(s, E) {
    const state = newState();
    const customer = "meilin@example.com";
    const message = "My ceramic table lamp from order ORD-5501 arrived cracked. Photo attached. I want a refund.";
    s.log(`Case CS-01 · ${customer}: "${message}"`, "note");

    const run = await E.runAgent(s, {
      system: SYSTEM,
      prompt: `Incoming support message (email: ${customer}):\n\n${message}`,
      tools: supportTools(state),
      maxTurns: 10,                       // a hard cap, so a confused loop can't run forever
    });

    const names = run.calls.map((c) => c.name);
    return {
      final: run.text,
      checks: [
        E.check("The loop continued on every tool_use turn and stopped on end_turn", run.stop_reason === "end_turn"),
        E.check("get_customer ran before lookup_order", E.firstIndex(run.calls, "get_customer") > -1 && E.firstIndex(run.calls, "get_customer") < E.firstIndex(run.calls, "lookup_order")),
        E.check("process_refund issued $120 for ORD-5501", state.refunds.some((r) => r.order_id === "ORD-5501" && Number(r.amount) === BACKEND.orders["ORD-5501"].amount)),
        E.check("No escalation was needed", !names.includes("escalate_to_human")),
      ],
    };
  },
};
