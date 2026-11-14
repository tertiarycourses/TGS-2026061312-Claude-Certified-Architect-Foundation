// Lab 9 · Task 2.2 · Simulator 1 · Case Study lab: the refund failed, and the agent must say so.
// ORD-5508 (a bookshelf, delivered 2026-08-10) is outside the 30-day return window. The refund service
// enforces that rule and answers like an MCP server should: a CallToolResult with isError: true and
// structured details (errorCategory, isRetryable, a customer_message). The engine turns isError into
// the tool_result block's is_error flag, so Claude reads a failed business action, not a completed refund.
import { BACKEND, SYSTEM, newState, supportTools } from "./shared/support.js";

// Lab 9 deployment note: eligibility lives in the refund service, so the agent submits and reads the tool's answer.
const POLICY_OWNER = "\n## Refund eligibility\nReturn-window and refund eligibility are enforced by the refund service, not by you. For a refund request, verify the customer, look up the order, call recommend_refund, then call process_refund, and act on what it returns. If it returns an error, tell the customer exactly what it says.\n";

export default {
  id: 9,
  see: "process_refund on ORD-5508 comes back isError: true with errorCategory business and isRetryable false, so no refund is issued, Claude does not retry, and the final reply explains the closed return window instead of claiming the $140 was refunded.",
  try: "In the shared support.js, make process_refund return the same failure as a plain result (drop isError: true, keep an error field), run it again, and compare what the reply tells Sofia.",
  // The scenario board (assets/scene.js): case CS-11, one refund failure delivered two ways.
  scene: {
    title: "Case CS-11: Sofia wants $140 back for a bookshelf delivered in August",
    caption: "The refund service fails the same way both times: ORD-5508 is outside the 30-day window. What changes is how the failure travels back to the agent.",
    lanes: [
      { key: "A", label: "Failure sent as a success", sub: "options A/C: is_error false, the error buried in the content", tone: "trap", on: /Phase 1/, stages: [
        { id: "aorder", icon: "🛋", t: "ORD-5508: bookshelf, $140", s: "delivered 2026-08-10, change of mind" },
        { id: "asvc", icon: "💳", t: "Refund service says no", s: "process_refund: outside the 30-day window" },
        { id: "aenv", icon: "📦", t: "tool_result is_error: false", s: "the failure rides inside a normal result", diff: true },
        { id: "aseen", icon: "👀", t: "What the loop records", s: "want: a failed refund, not a completed call", out: true } ] },
      { key: "B", label: "isError: true, structured details", sub: "option B: the MCP way, run live with Claude", tone: "fix", on: /Phase 2/, stages: [
        { id: "bcust", icon: "👤", t: "Sofia: \"$140 back, please\"", s: "sofia@example.com · ORD-5508" },
        { id: "bagent", icon: "🤖", t: "Support agent", s: "verify, look up, recommend, refund", claude: true },
        { id: "bbackend", icon: "🗄", t: "Backend lookups", s: "get_customer · lookup_order · recommend_refund", tools: ["get_customer", "lookup_order", "recommend_refund", "escalate_to_human"] },
        { id: "brefund", icon: "💳", t: "process_refund → isError", s: "errorCategory business · isRetryable false", diff: true, tools: ["process_refund"] },
        { id: "breply", icon: "💬", t: "Reply to Sofia", s: "want: no refund claimed, the window explained", out: true } ] },
    ],
  },
  slide: {
    title: "A failed refund must come back as isError: true",
    code: `def process_refund(order_id, amount):
    if outside_return_window(order_id):
        return CallToolResult(                   # KEY 1
            isError=True,
            content={"errorCategory": "business",  # KEY 2
                     "isRetryable": False,         # KEY 3
                     "message": "outside the 30-day window",
                     "customer_message": "..."})   # KEY 4
    return CallToolResult(content=issue(order_id, amount))`,
    keys: [["1", "isError: true, in the result", "The call worked; the business action failed."],
           ["2", "Say what kind of failure", "business, validation, permission or transient."],
           ["3", "Say whether to retry", "A closed window won't open on a second try."],
           ["4", "Give the recovery words", "The agent explains the rule, never a refund."]],
  },
  async run(s, E) {
    const state = newState();
    const customer = "sofia@example.com";
    const message = "I want to return the bookshelf from ORD-5508 and get my $140 back. It just does not look good in the room.";
    const tools = supportTools(state);
    // The order service reports facts (delivered 2026-08-10); the refund service enforces the policy.
    // Removing the precomputed return_window_open flag means the window is checked where it belongs: in process_refund.
    const lookup = tools.lookup_order.run;
    tools.lookup_order = { ...tools.lookup_order, run: (a) => { const o = lookup(a); if (o && !o.isError) { const { return_window_open, ...facts } = o; return facts; } return o; } };

    s.log("== Phase 1: the trap, without calling Claude: the same failure sent two ways", "note");
    const failure = tools.process_refund.run({ order_id: "ORD-5508", amount: BACKEND.orders["ORD-5508"].amount, reason: "change of mind" });
    const { isError, ...details } = failure;
    s.log(`Wrong (options A/C): tool_result {"is_error": false, "content": ${E.short({ status: "received", order_id: "ORD-5508", ...details }, 120)}}`, "error");
    s.log("  The protocol says success. Claude, hooks and audit logs see a completed call and must guess from the wording.", "note");
    s.log(`Right (option B): tool_result {"is_error": true, "content": ${E.short(details, 120)}}`, "result");
    s.log("  The failure is explicit, and errorCategory + isRetryable tell the agent what to do next.", "note");
    state.refunds.length = 0;   // phase 1 issued nothing; keep the live run's state clean
    const o5508 = BACKEND.orders["ORD-5508"];
    const wrongEnvelope = { is_error: false, content: { status: "received", order_id: "ORD-5508", ...details } };
    const hidden = !wrongEnvelope.is_error && !!details.errorCategory;   // a failure the protocol flag reports as a success
    s.show("aorder", `$${o5508.amount} · delivered ${o5508.eta} · window open: ${o5508.return_window_open}`, "done");
    s.show("asvc", `${details.errorCategory} · isRetryable ${details.isRetryable}`, "done");
    s.show("aenv", `is_error: ${wrongEnvelope.is_error} · status "received"`, "done");
    s.show("aseen", hidden ? "a successful call: the refund looks done" : "flagged as a failure", hidden ? "bad" : "good");
    await s.pause({
      title: "The trap: the refund failure sent back as a normal result",
      outcome: `process_refund refused ORD-5508 (**${details.errorCategory}**, isRetryable ${details.isRetryable}: "${details.message}"). ` +
               `Wrapped with **is_error: ${wrongEnvelope.is_error}**, the tool_result tells Claude, hooks and audit logs that the call succeeded.`,
      next: "Run Sofia's case live, with the failure returned as isError: true and structured details",
    });

    s.log(`== Phase 2, live: case CS-11 · ${customer}: "${message}"`, "note");
    s.show("bcust", "change of mind, 2026-08-10 delivery", "done");
    const run = await E.runAgent(s, {
      system: SYSTEM + POLICY_OWNER,
      prompt: `Incoming support message (email: ${customer}):\n\n${message}`,
      tools,
      maxTurns: 8,
    });

    const refundCalls = run.calls.filter((c) => c.name === "process_refund");
    const err = refundCalls.find((c) => c.isError)?.result;
    const reply = run.text || "";
    // A claim of success: "your refund has been issued", "we've processed your refund", "you'll receive the $140" ...
    // A match preceded by a negation ("No refund has been issued", "I can't confirm ...") is not a claim.
    const claims = /\b(refund|\$?140)\b[^.!?\n]{0,40}\b(has been|have been|was|is now|is being)\s+(issued|processed|completed|approved|initiated|sent)\b|\b(we|I)(['’]ve| have)\s+(issued|processed|refunded|approved)\b|\byou(['’]ll| will) (receive|see|get) (your|the) (refund|\$140)/gi;
    const sentenceBefore = (i) => { const pre = reply.slice(0, i); return pre.slice(Math.max(...[".", "!", "?", "\n"].map((c) => pre.lastIndexOf(c))) + 1); };
    const claimed = [...reply.matchAll(claims)].some((m) => !/\b(no|not|never|unable|cannot)\b|n['’]t\b/i.test(sentenceBefore(m.index) + m[0]));
    const explains = /return window|30[- ]day|30 days|outside (the|our)/i.test(reply);

    s.log("\n== What the refund tool returned, and what the customer was told", "note");
    if (err) s.log(`process_refund -> isError: ${err.isError}, errorCategory: ${err.errorCategory}, isRetryable: ${err.isRetryable}, message: "${err.message}"`, "error");
    else s.log(refundCalls.length ? "process_refund was called and did not return an error" : "process_refund was not called this run", "note");
    s.log(`Refunds issued: ${state.refunds.length} · reply claims a refund: ${claimed ? "YES" : "NO"} · reply explains the return window: ${explains ? "yes" : "no"}`, claimed || state.refunds.length ? "error" : "result");

    const refundOk = state.refunds.length === 0 && !claimed && explains;
    s.show("brefund", err ? `isError ${err.isError} · ${err.errorCategory} · retryable ${err.isRetryable}` : refundCalls.length ? "no error returned" : "not called this run", "done");
    s.show("breply", `refunds ${state.refunds.length} · claims a refund: ${claimed ? "YES" : "no"} · window explained: ${explains ? "yes" : "no"}`, refundOk ? "good" : "bad");
    const yes = (v, want = true) => ({ v: v ? "yes" : "no", tone: v === want ? "good" : "bad" });
    return {
      final: reply,
      compare: {
        cols: [
          { title: "Failure sent as a normal result (A/C)", short: "is_error false", tone: "trap",
            verdict: `Not sent to Claude: built from the same refund failure to show the envelope. With is_error **${wrongEnvelope.is_error}** the loop, hooks and audit logs record a completed call; only the wording says otherwise.` },
          { title: "isError: true with structured details (B)", short: "isError true", tone: "fix", said: reply,
            verdict: refundOk ? `Claude read a failed refund: ${state.refunds.length} refunds issued, ${refundCalls.length} process_refund call${refundCalls.length === 1 ? "" : "s"}, and the reply explains the closed 30-day window.`
              : `Refunds ${state.refunds.length}, process_refund calls ${refundCalls.length}, reply ${claimed ? "**claims a refund**" : "claims no refund"}${explains ? "" : " and does not explain the window"}. Read the live output: Claude writes each run fresh.` },
        ],
        rows: [
          ["tool_result is_error", { v: String(wrongEnvelope.is_error), tone: "bad" }, err ? { v: String(err.isError), tone: err.isError ? "good" : "bad" } : { v: "process_refund not called", tone: "bad" }],
          ["errorCategory / isRetryable", "inside a \"received\" result the agent must interpret", err ? `\`${err.errorCategory}\` / \`${err.isRetryable}\`, read as a failure` : "—"],
          ["process_refund calls", "— (not run live)", { v: String(refundCalls.length), tone: refundCalls.length <= 1 ? "good" : "bad" }],
          ["Refunds issued", "— (not run live)", { v: String(state.refunds.length), tone: state.refunds.length ? "bad" : "good" }],
          ["Reply claims a refund", "— (not run live)", yes(claimed, false)],
          ["Reply explains the 30-day window", "— (not run live)", yes(explains)],
        ],
        note: "The refund service fails the same way in both. Only the flag on the tool_result differs: is_error false says the call worked; isError true, with errorCategory and isRetryable, tells the agent the refund failed and that a retry will not help.",
      },
      checks: [
        E.check("process_refund on ORD-5508 returned a structured business error: isError true, errorCategory business, isRetryable false",
                !!err && err.isError === true && err.errorCategory === "business" && err.isRetryable === false),
        E.check(`No refund was issued (refunds issued: ${state.refunds.length})`, state.refunds.length === 0),
        E.check(`Claude did not retry the non-retryable error (process_refund calls: ${refundCalls.length})`, refundCalls.length <= 1),
        E.check("The final reply does not claim a refund was issued", reply.trim() && !claimed),
        E.check("The final reply explains the closed 30-day return window", explains),
      ],
    };
  },
};
