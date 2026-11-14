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
  // The scenario board (assets/scene.js): two customers, two prompts, and who ends up with a human.
  scene: {
    title: "CS-08 and CS-10: a polite policy gap and an angry routine question",
    caption: "The same agent and the same tools handle both customers twice. Only the escalation section of the system prompt changes.",
    lanes: [
      { key: "D", label: "Design D", sub: "escalate when the customer sounds upset", tone: "trap", on: /Design D/, stages: [
        { id: "drule", icon: "😠", t: "Prompt: escalate on anger", s: "no criteria, no examples: tone decides", diff: true },
        { id: "dagent", icon: "🤖", t: "Support agent", s: "reads each message, picks its tools", claude: true },
        { id: "dtools", icon: "🗄", t: "Backend", s: "get_customer, lookup_order, refunds, tickets", tools: ["get_customer", "lookup_order", "recommend_refund", "process_refund", "escalate_to_human"] },
        { id: "d08", icon: "🙂", t: "CS-08 · price match", s: "Arjun, polite: match $170, refund $40. Want: a human", out: true },
        { id: "d10", icon: "📦", t: "CS-10 · \"Sort it out\"", s: "Mei Lin, angry, ORD-5501 tracking. Want: an answer", out: true } ] },
      { key: "A", label: "Design A", sub: "named criteria + few-shot examples", tone: "fix", on: /Design A/, stages: [
        { id: "arule", icon: "📋", t: "Prompt: named criteria", s: "policy gap, > $500, asks for a human; tone is not one", diff: true },
        { id: "aagent", icon: "🤖", t: "Support agent", s: "decides on the case type, not the tone", claude: true },
        { id: "atools", icon: "🗄", t: "Backend", s: "get_customer, lookup_order, refunds, tickets", tools: ["get_customer", "lookup_order", "recommend_refund", "process_refund", "escalate_to_human"] },
        { id: "a08", icon: "🙂", t: "CS-08 · price match", s: "Arjun, polite: match $170, refund $40. Want: a human", out: true },
        { id: "a10", icon: "📦", t: "CS-10 · \"Sort it out\"", s: "Mei Lin, angry, ORD-5501 tracking. Want: an answer", out: true } ] },
    ],
  },
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
    // What each customer's run came to, judged against the case type (not the tone).
    const ok08 = (r) => r.state.escalations.length > 0 && r.refunded === 0;
    const ok10 = (r) => r.state.escalations.length === 0 && r.run.calls.some((c) => c.name === "lookup_order" && /5501/.test(c.input.order_id || ""));
    const tix = (r) => r.state.escalations.map((e) => e.ticket_id).join(", ");
    const said08 = (r) => r.state.escalations.length ? `escalated ${tix(r)} · $${r.refunded} refunded` : `kept by the agent, no ticket · $${r.refunded} refunded`;
    const said10 = (r) => {
      const looked = E.called(r.run.calls, "lookup_order").length > 0;
      return r.state.escalations.length ? `escalated ${tix(r)}${looked ? "" : " · no lookup"}` : `answered by the agent${looked ? " · looked up ORD-5501" : " · no lookup_order"}`;
    };
    const gapNamed = (r) => { const h = r.state.escalations[0]?.handoff; return !!h && /competitor|price.?match|not covered|policy/i.test(`${h.root_cause} ${h.recommended_action}`); };

    s.log("== Design D (the trap): escalate on negative sentiment, no criteria, no examples", "note");
    s.show("drule", "\"escalate when frustrated, angry or upset\"", "done");
    const wrong = [];
    for (const [i, c] of CASES.entries()) {
      const id = i ? "d10" : "d08";
      s.show(id, "running…", "hot");
      const r = await runCase(s, E, SYSTEM_SENTIMENT, c);
      wrong.push(r);
      s.show(id, i ? said10(r) : said08(r), (i ? ok10(r) : ok08(r)) ? "good" : "bad");
    }
    s.log(`Sentiment rule: CS-08 ${wrong[0].state.escalations.length ? "escalated" : `kept by the agent, $${wrong[0].refunded} refunded`} · CS-10 ${wrong[1].state.escalations.length ? "escalated although the case is routine" : "resolved"}`, "note");

    const [w8, w10] = wrong;
    const misses = [!ok08(w8) && "the policy gap never reached a human", !ok10(w10) && "a routine question went to a human because the customer was angry"].filter(Boolean);
    await s.pause({
      title: "Design D finished: the sentiment rule decided both cases",
      outcome: `CS-08, the polite competitor price match: **${said08(w8)}**. CS-10, the angry but routine tracking question: **${said10(w10)}**. ` +
        (misses.length ? `${misses.join("; ").replace(/^./, (x) => x.toUpperCase())}.` : "This time tone happened to point the right way for both, but nothing in the prompt makes that hold."),
      next: "Design A: the same two customers with named escalation criteria and few-shot examples",
    });

    s.log("== Design A (the fix): explicit escalation criteria with few-shot examples", "note");
    s.show("arule", "price match = policy gap; anger alone ≠ escalate", "done");
    s.show("a08", "running…", "hot");
    const p = await runCase(s, E, SYSTEM, CASES[0]);
    s.show("a08", said08(p), ok08(p) ? "good" : "bad");
    s.show("a10", "running…", "hot");
    const f = await runCase(s, E, SYSTEM, CASES[1]);
    s.show("a10", said10(f), ok10(f) ? "good" : "bad");

    const handoff = p.state.escalations[0]?.handoff || {};
    const fNames = f.run.calls.map((c) => c.name);
    const tickets = (a, b) => a.state.escalations.length + b.state.escalations.length;
    const paid = (a, b) => a.refunded + b.refunded;
    const tone = (ok) => (ok ? "good" : "bad");
    const verdict = (r8, r10, fix) => {
      const right = ok08(r8) && ok10(r10);
      const parts = [ok08(r8) ? `sent the price match to a human (${tix(r8)}, $0 paid)` : r8.state.escalations.length ? `escalated the price match (${tix(r8)}) but still refunded $${r8.refunded}` : `handled the price match itself with no human (${r8.refunded ? `$${r8.refunded} refunded` : "no ticket"})`,
        ok10(r10) ? "answered the angry customer from lookup_order" : (r10.state.escalations.length ? `sent the routine tracking question to a human (${tix(r10)})` : `answered the tracking question without checking ORD-5501`)];
      const lead = right ? (fix ? "Both right: it " : "Both right this time: it ") : (fix ? "Not this run: it " : "Wrong: it ");
      return `${lead}${parts.join(" and ")}.${right && !fix ? " Tone happened to line up with the case type; nothing in the prompt makes that hold." : ""}`;
    };
    return {
      final: `CS-08 (price match): ${p.run.text}\n\nCS-10 (angry, routine): ${f.run.text}`,
      compare: {
        cols: [
          { title: "Design D: escalate on sentiment", short: "Design D", tone: "trap", verdict: verdict(w8, w10, false),
            said: `CS-08: ${w8.run.text}\n\nCS-10: ${w10.run.text}` },
          { title: "Design A: named criteria + examples", short: "Design A", tone: "fix", verdict: verdict(p, f, true),
            said: `CS-08: ${p.run.text}\n\nCS-10: ${f.run.text}` },
        ],
        rows: [
          ["What the prompt escalates on", "the customer's tone", "named cases: policy gap, > $500, asks for a human"],
          ["CS-08 polite price match", { v: said08(w8), tone: tone(ok08(w8)) }, { v: said08(p), tone: tone(ok08(p)) }],
          ["CS-08 handoff names the policy gap", { v: w8.state.escalations.length ? (gapNamed(w8) ? "yes" : "no") : "no handoff", tone: tone(gapNamed(w8)) },
            { v: p.state.escalations.length ? (gapNamed(p) ? "yes" : "no") : "no handoff", tone: tone(gapNamed(p)) }],
          ["CS-10 angry tracking question", { v: said10(w10), tone: tone(ok10(w10)) }, { v: said10(f), tone: tone(ok10(f)) }],
          ["Human tickets raised (want 1)", { v: String(tickets(w8, w10)), tone: tone(ok08(w8) && w10.state.escalations.length === 0) }, { v: String(tickets(p, f)), tone: tone(ok08(p) && f.state.escalations.length === 0) }],
          ["Money paid out (want $0)", { v: `$${paid(w8, w10)}`, tone: tone(paid(w8, w10) === 0) }, { v: `$${paid(p, f)}`, tone: tone(paid(p, f) === 0) }],
        ],
        note: "Same agent, same tools, same two customers. Only the escalation section of the system prompt changed: the customer's tone in design D, named case types with one example per boundary in design A.",
      },
      checks: [
        E.check("CS-08: the price match was escalated (ticket HS-0001) with $0 refunded", p.state.escalations[0]?.ticket_id === "HS-0001" && p.refunded === 0),
        E.check("CS-08: the handoff names the policy gap (competitor price matching)", /competitor|price.?match|not covered|policy/i.test(`${handoff.root_cause} ${handoff.recommended_action}`) && Number(handoff.refund_amount || 0) === 0),
        E.check("CS-10: the angry customer was not escalated", f.state.escalations.length === 0 && !fNames.includes("escalate_to_human")),
        E.check("CS-10: the agent verified the customer and looked up ORD-5501 itself", fNames.includes("get_customer") && f.run.calls.some((c) => c.name === "lookup_order" && /5501/.test(c.input.order_id || ""))),
      ],
    };
  },
};
