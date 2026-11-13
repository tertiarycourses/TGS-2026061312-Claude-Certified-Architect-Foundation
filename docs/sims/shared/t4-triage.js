// Simulator 1 · archived-transcript triage (labs/simulators/simulator-1-customer-support/triage.py):
// the transcripts, the two prompt templates and the team's evaluation labels. Used by Lab 23.

export const TRANSCRIPTS = {
  "T-001": `Customer: Hi, my order ORD-5501 (ceramic lamp) arrived cracked. I attached a photo.
Agent: Sorry about that. I can see the photo. Would you like a refund or a replacement?
Customer: Refund please, $120.
Agent: Done, the refund is on its way to your card within 5 days.
Customer: Great, thanks.`,
  "T-002": `Customer: I was charged twice for the desk organiser, ORD-5503.
Agent: Let me check. I see two charges of $45.
Customer: So you will refund one?
Agent: Yes, one charge of $45 is refunded. Anything else?
Customer: No.`,
  "T-003": `Customer: I want to speak to a real person. Now.
Agent: I understand. Can I ask what the issue is first?
Customer: No. Human. Now.
Agent: Transferring you to a colleague.`,
  "T-004": `Customer: The standing desk ORD-5502 came with a bent frame, photos attached, I want the full $780 back.
Agent: I am sorry. The damage is clear. Refunds over $500 need a manager, so I have raised this with the team and they will confirm within one business day.
Customer: Fine but I expect the full amount.
Agent: Noted: full amount $780 recommended.`,
  "T-005": `Customer: another shop sells the same keyboard for $170 and I paid $210 on ORD-5507. Match it?
Agent: Our price promise covers our own price drops within 14 days. I am not able to confirm competitor matching, so I have passed this to a specialist.
Customer: ok`,
  "T-006": `Customer: ORD-5504 where is it?? a WEEK
Agent: It shipped and is due 9 November.
Customer: thats not what the app says but ok`,
  "T-007": `Customer: I'd like to return the chair mat from ORD-5505. Doesn't fit.
Agent: You are within the 30-day window. I have approved the return, you will get a label by email.
Customer: thx`,
  "T-008": `Customer: Bookshelf ORD-5508, want to return it, don't like it.
Agent: That order was delivered on 10 August, so the 30-day window has closed. I cannot approve a change-of-mind return.
Customer: that's annoying. can I at least get store credit for shipping?
Agent: Shipping on that order was free, so there is nothing to credit. Sorry.`,
  "T-009": `Customer: hi this is sofia alvarez what's the status of my latest order
Agent: I found two accounts under that name. Which email did you use?
Customer: sofia@example.com
Agent: Thanks, ORD-5505 was delivered on 29 October.`,
  "T-010": `Customer: my lamp ORD-5501 is cracked AND I got charged twice on ORD-5503 AND where is ORD-5504
Agent: Three things. Lamp: refund $120 issued. Organiser: duplicate $45 refunded. Monitor arm: shipped, due 9 November.
Customer: ok good`,
};

export const POLICY_EXCERPT = "Refunds up to $500 may be issued by the agent; above that a human approves. Change-of-mind returns are accepted within 30 days of delivery. Price matching: own-site price drops within 14 days only; competitor price matching is not covered.";

// prompts/triage_template_v0.md: the template the pilot ran first.
export const TEMPLATE_V0 = `Read this support transcript and tell me the outcome and any refund.

{{transcript}}`;

// The refined template: fixed instructions, clear criteria, variables in tags.
export const TEMPLATE_V1 = `You classify ONE archived support transcript for the Orderly quality team.

Policy excerpt:
{{policy_excerpt}}

<transcript>
{{transcript}}
</transcript>

Criteria:
- disposition "resolved": the agent gave a final answer or completed the action within policy, even if the customer did not get what they wanted (a refused out-of-window return is resolved).
- disposition "escalated": the agent handed the case to a human, manager, specialist or colleague, including when it recommends a refund that someone else must approve.
- disposition "clarified": the agent only asked or answered a question and no decision was needed.
- disposition "unresolved": the conversation ended with no answer and no handoff.
- refund_total: money the agent CONFIRMED as refunded in this conversation, summed across orders. A refund that is only recommended or awaiting approval counts as 0. Store credit that was refused counts as 0.
- rationale: one sentence that quotes or cites the transcript line the decision rests on.`;

export const render = (tpl, vars) => tpl.replace(/{{(\w+)}}/g, (_, k) => {
  if (!(k in vars)) throw new Error(`template placeholder not filled: ${k}`);
  return vars[k];
});

// The team's labels for the evaluation set, written against the criteria above.
// One transcript per kind of case the archive holds: routine refund, explicit request for a human,
// refund above the limit (recommended, not paid), competitor price match, delivery-status question,
// refused late return, multi-issue.
export const EVAL_SET = {
  "T-001": { disposition: "resolved", refund_total: 120 },
  "T-003": { disposition: "escalated", refund_total: 0 },
  "T-004": { disposition: "escalated", refund_total: 0 },
  "T-005": { disposition: "escalated", refund_total: 0 },
  "T-006": { disposition: "clarified", refund_total: 0 },
  "T-008": { disposition: "resolved", refund_total: 0 },
  "T-010": { disposition: "resolved", refund_total: 165 },
};

export const TRIAGE_SCHEMA = {
  type: "object", additionalProperties: false, required: ["disposition", "rationale", "refund_total"],
  properties: {
    disposition: { type: "string", enum: ["resolved", "escalated", "clarified", "unresolved"] },
    rationale: { type: "string" },
    refund_total: { type: "number" },
  },
};
