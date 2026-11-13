// Lab 26 · Task 5.2 · Simulator 1: escalation calibration. The same agent, the same tools, two prompts:
// a sentiment rule ("escalate when the customer is upset") versus explicit escalation criteria with
// few-shot examples. Two cases from the Python simulator: CS-08 (a polite competitor price match, which
// policy does not cover) and CS-10 (an angry customer with a routine tracking question).
import { SYSTEM, newState, supportTools } from "./shared/support.js";

const CASES = [
  { id: "CS-08", email: "arjun@example.com", message: "I bought the ergonomic keyboard in ORD-5507 for $210 and now another shop sells it for $170. Can you match the price and refund me $40?" },
  { id: "CS-10", email: "meilin@example.com", message: "This is ridiculous. ORD-5501 shows delivered but I am not sure the tracking is right. Sort it out." },
];

// The tempting wrong design (option D): drop the criteria and the examples, escalate on tone instead.
const head = SYSTEM.indexOf("## Escalation criteria"), tail = SYSTEM.indexOf("## Handoff format");
const SYSTEM_SENTIMENT = SYSTEM.slice(0, head) +
  "## Escalation\nEscalate to a human when the customer sounds frustrated, angry or upset (negative sentiment). Otherwise resolve the case yourself.\n\n" +
  SYSTEM.slice(tail);

async function runCase(s, E, system, c) {
  const state = newState();
  s.log(`${c.id} · ${c.email}: "${c.message}"`, "note");
  const run = await E.runAgent(s, { system, prompt: `Incoming support message (email: ${c.email}):\n\n${c.message}`, tools: supportTools(state), maxTurns: 7 });
  const refunded = state.refunds.reduce((t, r) => t + Number(r.amount), 0);
  s.log(`${c.id} outcome: ${state.escalations.length ? `escalated (${state.escalations.map((e) => e.ticket_id).join(", ")})` : "resolved by the agent"} · refunded $${refunded}`, "note");
  return { run, state, refunded };
}

export default {
  id: 26,
  see: "With explicit criteria and examples, the competitor price match on ORD-5507 escalates (ticket HS-0001, $0 refunded) and the angry but routine ORD-5501 tracking question is answered without escalation.",
  explain: "The sentiment rule decides on tone, so it hands the angry but routine CS-10 to a human and lets the polite CS-08 through to the agent, which may improvise a discount the policy never allowed. The fixed prompt names the cases that need a human (an explicit request, a policy gap such as competitor price matching, a refund above $500, an ambiguous identity) and pairs them with short examples. Claude then decides on the case type: the price match escalates with $0 refunded, and the frustrated customer gets an acknowledgement and the order status from lookup_order.",
  try: "In docs/sims/lab-26.js make CS-10 say \"I want to talk to a person\" and rerun: the criteria now escalate it at once, before any lookup_order, because an explicit request for a human is a named criterion.",
  slide: {
    title: "Escalate on named criteria, never on tone",
    code: `## Escalation criteria                          # KEY 1
- The customer explicitly asks for a human.
- Policy is silent: competitor price matching.
- Any refund above $500.
Do not escalate because the customer sounds    # KEY 2
upset: acknowledge, then resolve.
Examples:                                       # KEY 3
- "Match the $170 price I saw elsewhere?"
   -> policy is silent, escalate.
- "I am furious, where is ORD-5504?"
   -> acknowledge, look it up, answer.
escalate_to_human(root_cause, refund_amount=0)  # KEY 4`,
    keys: [["1", "Name the escalation cases", "Explicit request, policy gap, limit, ambiguity."],
           ["2", "Tone is not a trigger", "Anger does not mean the case is complex."],
           ["3", "Few-shot examples", "One line per boundary, escalate versus resolve."],
           ["4", "Hand off, don't improvise", "The policy gap goes to a human with $0 paid."]],
  },
  async run(s, E) {
    s.log("== Design D (the trap): escalate on negative sentiment, no criteria, no examples", "note");
    const wrong = [];
    for (const c of CASES) wrong.push(await runCase(s, E, SYSTEM_SENTIMENT, c));
    s.log(`Sentiment rule: CS-08 ${wrong[0].state.escalations.length ? "escalated" : `kept by the agent, $${wrong[0].refunded} refunded`} · CS-10 ${wrong[1].state.escalations.length ? "escalated although the case is routine" : "resolved"}`, "note");

    s.log("== Design A (the fix): explicit escalation criteria with few-shot examples", "note");
    const [p, f] = [await runCase(s, E, SYSTEM, CASES[0]), await runCase(s, E, SYSTEM, CASES[1])];

    const handoff = p.state.escalations[0]?.handoff || {};
    const fNames = f.run.calls.map((c) => c.name);
    return {
      final: `CS-08 (price match): ${p.run.text}\n\nCS-10 (angry, routine): ${f.run.text}`,
      checks: [
        E.check("CS-08: the price match was escalated (ticket HS-0001) with $0 refunded", p.state.escalations[0]?.ticket_id === "HS-0001" && p.refunded === 0),
        E.check("CS-08: the handoff names the policy gap (competitor price matching)", /competitor|price.?match|not covered|policy/i.test(`${handoff.root_cause} ${handoff.recommended_action}`) && Number(handoff.refund_amount || 0) === 0),
        E.check("CS-10: the angry customer was not escalated", f.state.escalations.length === 0 && !fNames.includes("escalate_to_human")),
        E.check("CS-10: the agent verified the customer and looked up ORD-5501 itself", fNames.includes("get_customer") && f.run.calls.some((c) => c.name === "lookup_order" && /5501/.test(c.input.order_id || ""))),
      ],
    };
  },
};
