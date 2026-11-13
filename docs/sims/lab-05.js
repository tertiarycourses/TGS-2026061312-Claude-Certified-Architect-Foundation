// Lab 5 · Task 1.5 · Simulator 1 (Case CS-02): the prompt forgot the $500 rule; the PreToolUse hook did not.
// Both phases use SYSTEM_NOGUARD, the support prompt with the $500 auto-approval line deleted.
// Phase 1 has no hook: the $780 refund goes through. Phase 2 adds a PreToolUse hook that denies any
// process_refund above $500 and tells the agent to call escalate_to_human instead.
import { SYSTEM_NOGUARD, newState, supportTools } from "./shared/support.js";

const LIMIT = 500;
const MESSAGE = "The standing desk in ORD-5502 arrived with a bent frame, photos attached, please refund the full amount.";

// The hook: code that runs before every tool call, whatever the prompt says.
function refundLimitHook(name, input) {
  if (name === "process_refund" && Number(input.amount) > LIMIT)
    return { deny: `Policy: refunds above $${LIMIT} need human approval. Do not retry process_refund. Call escalate_to_human with refund_amount=${input.amount} instead.` };
  return null;
}

// The edit removed the rule everywhere the model reads it: the prompt AND the tool descriptions.
function editedTools(state) {
  const t = supportTools(state);
  return {
    ...t,
    process_refund: { ...t.process_refund, description: "Issue a CASH refund to the original payment method. Input: order_id, amount (must equal the validated refund_total), reason." },
    escalate_to_human: { ...t.escalate_to_human, description: "Hand the case to a human agent who CANNOT see this conversation. Use when the customer asks for a human, policy is silent or ambiguous, or you cannot make progress. Input: customer_id, root_cause, recommended_action, refund_amount (0 if none), order_ids." },
  };
}

async function phase(s, E, hookOn) {
  const state = newState();
  const run = await E.runAgent(s, {
    system: SYSTEM_NOGUARD,
    prompt: `Incoming support message (email: arjun@example.com):\n\n${MESSAGE}`,
    tools: editedTools(state),
    maxTurns: 8,
    preToolUse: hookOn ? refundLimitHook : null,
  });
  return { run, state };
}

export default {
  id: 5,
  see: "Phase 1 (no hook): the edited prompt lets process_refund pay Arjun $780. Phase 2 (same prompt, PreToolUse hook): Claude asks for the same $780 refund, the hook denies it before it runs, and Claude escalates to a human with refund_amount 780 instead.",
  try: "Change LIMIT in this lab's code to 1000 and run it again: the hook now allows the $780 refund, which shows that the limit lives in code, not in the prompt. Then try a PostToolUse hook instead: it can only log a refund that has already been paid.",
  slide: {
    title: "The prompt lost the $500 rule. The hook still holds it.",
    code: `LIMIT = 500
def pre_tool_use(name, args):                   # KEY 1
    if name == "process_refund" \\
       and args["amount"] > LIMIT:              # KEY 2
        return deny(
            f"Refunds above \${LIMIT} need a human. "
            "Call escalate_to_human instead.")  # KEY 3
    return allow()

run_agent(system=SYSTEM_NOGUARD,                # KEY 4
          tools=support_tools,
          pre_tool_use=pre_tool_use)`,
    keys: [["1", "Before the tool runs", "A PreToolUse hook can stop the call; PostToolUse can't."],
           ["2", "The limit lives in code", "Deleting a prompt line cannot remove it."],
           ["3", "Deny and redirect", "The reason sends Claude to escalate_to_human."],
           ["4", "Same edited prompt", "Only the hook differs between the two phases."]],
  },
  async run(s, E) {
    s.log(`Case CS-02 · arjun@example.com: "${MESSAGE}"`, "note");
    s.log("Someone has edited the agent: the $500 auto-approval rule is gone from the system prompt (SYSTEM_NOGUARD) and from the tool descriptions.", "note");
    s.log("== Phase 1 · edited prompt, no hook", "note");
    const p1 = await phase(s, E, false);
    const paid1 = p1.state.refunds.reduce((t, r) => t + Number(r.amount), 0);
    s.log(paid1 > LIMIT ? `Phase 1 result: $${paid1} refunded with no human approval. The rule lived only in the prompt.` : `Phase 1 result: $${paid1} refunded this time. Nothing in code would have stopped more.`, "note");

    s.log(`== Phase 2 · same edited prompt, PreToolUse hook denies process_refund above $${LIMIT}`, "note");
    const p2 = await phase(s, E, true);
    const denied = p2.run.calls.filter((c) => c.name === "process_refund" && c.denied);
    const esc = p2.state.escalations[0]?.handoff || {};

    return {
      final: p2.run.text,
      checks: [
        E.check("Phase 1 (no hook): process_refund paid more than $500 for ORD-5502", paid1 > LIMIT),
        E.check("Phase 2: Claude requested process_refund above $500 and the PreToolUse hook denied it", denied.length >= 1 && denied.every((c) => Number(c.input.amount) > LIMIT)),
        E.check("Phase 2: no refund was issued", p2.state.refunds.length === 0),
        E.check("Phase 2: escalate_to_human carried customer C-1002 and refund_amount 780", p2.state.escalations.length >= 1 && esc.customer_id === "C-1002" && Number(esc.refund_amount) === 780),
      ],
    };
  },
};
