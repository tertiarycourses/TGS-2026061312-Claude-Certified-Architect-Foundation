// Lab 16 · Task 3.4 · Simulator 2: replacing the auth layer, nobody agrees on the boundary, so plan.
// Ported from casekit.py UC-8. The same request runs twice on the Orderly workspace: first in direct execution
// (acceptEdits: Claude may edit at once), then in plan mode. The emulator (shared/t3-claudecode.js) enforces
// plan mode the way Claude Code does: read-only tools work, Edit and Write are blocked, and the plan goes to
// the user through ExitPlanMode for approval. Every file is hashed before and after each run.
import { SIM2_WORKSPACE } from "./shared/t3-workspaces.js";
import { workspace, session, hashTree, changedFiles } from "./shared/t3-claudecode.js";

const ASK = "We are replacing the homegrown authorization layer (src/middleware/authorize.js) with a policy engine across API handlers, middleware and tests. " +
  "Engineers disagree about where the policy boundary should live, and I am new to these packages.";
// Options A and B, as the question words them: no questions, no plan, edit now and let the tests reveal the architecture.
const DIRECT = ASK + " Do not ask me any questions. Use direct execution: start editing immediately and discover the architecture through test failures.";
const TOOLS = ["Read", "Grep", "Glob", "Edit", "Write"];

export default {
  id: 16,
  see: "The same request twice: in direct execution nothing stops an edit (Claude may rewrite files before anyone has chosen a boundary); in plan mode it reads authorize.js and its callers, any edit is blocked, it submits a plan through ExitPlanMode, and every file hashes the same afterwards.",
  try: "Rerun it and compare the two plans: do both name orders.js as a caller? Then ask yourself which boundary option you would approve, which is the decision plan mode hands back to you.",
  // The scenario board (assets/scene.js): the same auth-layer request twice. Direct execution (acceptEdits, no
  // questions) is the trap; plan mode, where edits are blocked until a plan is approved, is the fix.
  scene: {
    title: "Replace authorize.js with a policy engine, while the team still disagrees on the boundary",
    caption: "Same Orderly repo, same request, same tools. Only the permission mode changes. Every file is hashed before and after each run.",
    lanes: [
      { key: "direct", label: "Options A + B: direct execution", sub: "acceptEdits, no questions, learn from test failures", tone: "trap", on: /direct execution/, stages: [
        { id: "dask", icon: "🧑‍💻", t: "\"Replace authorize.js\"", s: "boundary undecided · new to these packages" },
        { id: "dmode", icon: "⚡", t: "acceptEdits, start editing", s: "Edit and Write run at once, no approval", diff: true },
        { id: "dwork", icon: "🤖", t: "Claude Code works", s: "Read, Grep, then edits as it sees fit", tools: ["Read", "Grep", "Glob", "Edit", "Write"], claude: true },
        { id: "dout", icon: "#️⃣", t: "Files changed", s: "want: none before a boundary is chosen", out: true } ] },
      { key: "plan", label: "Option D: plan mode", sub: "research and a plan, no edit until you approve", tone: "fix", on: /plan mode/, stages: [
        { id: "pask", icon: "🧑‍💻", t: "\"Replace authorize.js\"", s: "the same request" },
        { id: "pmode", icon: "📝", t: "--permission-mode plan", s: "read tools run; Edit and Write are blocked", diff: true },
        { id: "pwork", icon: "🔍", t: "Research authorize.js", s: "Read it, Grep its callers", tools: ["Read", "Grep", "Glob", "Edit", "Write"], claude: true },
        { id: "pplan", icon: "📋", t: "ExitPlanMode(plan)", s: "the plan waits for your approval", tools: ["ExitPlanMode"] },
        { id: "pout", icon: "#️⃣", t: "Files changed", s: "want: 0, every hash the same", out: true } ] },
    ],
  },
  slide: {
    title: "Plan mode: research and a plan, no edit until you approve",
    code: `claude --permission-mode plan                 # KEY 1
> Replace authorize.js with a policy engine.
  Engineers disagree on the boundary.

Read(src/middleware/authorize.js)             # KEY 2
Grep("authorize\\(")  -> src/api/orders.js
Edit(...)  -> blocked: plan mode is active    # KEY 3
ExitPlanMode(plan)    -> waits for approval   # KEY 4
files hashed before == after`,
    keys: [["1", "Pick the mode first", "Uncertain, multi-file, unfamiliar: plan."],
           ["2", "Research is allowed", "Read, Grep and Glob run as normal."],
           ["3", "Edits are blocked", "Not one source file changes."],
           ["4", "You approve the plan", "Only then does implementation start."]],
  },
  async run(s, E) {
    s.log(`Request: "${ASK}"`, "note");

    s.log("== Options A + B, the tempting design: direct execution (acceptEdits), no questions", "note");
    const wsD = workspace(E, SIM2_WORKSPACE);
    const d0 = hashTree(wsD.fs);
    s.log(`  + "${DIRECT.slice(ASK.length + 1)}"`, "note");
    const direct = await session(s, E, wsD, { prompt: DIRECT, mode: "acceptEdits", tools: TOOLS, allowedTools: TOOLS, maxTurns: 8, max_tokens: 3000, echoMemory: false });
    const dChanged = changedFiles(d0, hashTree(wsD.fs));
    if (dChanged.length) s.log(`  [hash check] direct execution changed ${dChanged.length} file${dChanged.length === 1 ? "" : "s"}: ${dChanged.join(", ")}. Nobody approved a boundary.`, "deny");
    else s.log(`  [hash check] 0 files changed this time: Claude held back by its own choice. Nothing in direct execution stopped it; Edit was allowed all along.`, "note");
    const dEdits = direct.calls.filter((c) => c.name === "Edit" || c.name === "Write");
    const dLooks = direct.calls.filter((c) => ["Read", "Grep", "Glob"].includes(c.name)).length;
    s.show("dask", "sent with \"start editing immediately\"", "done");
    s.show("dmode", `${dEdits.length} edit call${dEdits.length === 1 ? "" : "s"}, none needed approval`, "done");
    s.show("dout", dChanged.length ? `${dChanged.length} file${dChanged.length === 1 ? "" : "s"} edited: ${dChanged.map((f) => f.split("/").pop()).join(", ")}` : "0 files: held back by choice", dChanged.length ? "bad" : "good");
    await s.pause({
      title: "Direct execution finished: acceptEdits, no questions",
      outcome: dChanged.length
        ? `Claude **edited ${dChanged.length} file${dChanged.length === 1 ? "" : "s"}** (${dChanged.map((f) => `\`${f}\``).join(", ")}) in ${direct.turns} turns, before anyone had chosen where the policy boundary lives. Nothing asked you first.`
        : `Claude **changed no file** this time (${dLooks} reads/searches, ${dEdits.length} edit calls), but only by its own choice: Edit was allowed all along, and no plan came back for you to approve.`,
      next: "Option D: the same request in plan mode",
    });

    s.log("== Option D, the right design: plan mode", "note");
    const wsP = workspace(E, SIM2_WORKSPACE);
    const p0 = hashTree(wsP.fs);
    s.show("pask", "sent as written, no extra instruction", "done");
    const plan = await session(s, E, wsP, { prompt: ASK, mode: "plan", tools: TOOLS, maxTurns: 10, max_tokens: 3000 });
    const p1 = hashTree(wsP.fs);
    const pChanged = changedFiles(p0, p1);
    s.log("  [hash check] file                          before    after", "note");
    for (const f of ["src/middleware/authorize.js", "src/api/orders.js", "tests/quantity.test.js"]) s.log(`               ${f.padEnd(30)}${p0[f]}  ${p1[f]}`, "result");
    s.log(`  [hash check] plan mode changed ${pChanged.length} of ${Object.keys(p0).length} files`, pChanged.length ? "deny" : "note");
    if (plan.plan) s.log("  [Claude Code] ExitPlanMode: the plan is waiting for your approval. No implementation has started.", "note");

    const planText = plan.plan || plan.text;
    const researched = plan.reads.includes("src/middleware/authorize.js") && (plan.reads.includes("src/api/orders.js") || plan.calls.some((c) => c.name === "Grep" && /authoriz/i.test(c.input.pattern || "")));
    // Boundary options the plan lays out for the team: route/middleware, handler, service/repository.
    const options = [/middleware|route/i, /handler/i, /service|repositor/i].filter((re) => re.test(planText || "")).length;
    const blocked = plan.calls.filter((c) => (c.name === "Edit" || c.name === "Write"));
    const pLooks = plan.calls.filter((c) => ["Read", "Grep", "Glob"].includes(c.name)).length;
    s.show("pmode", `${blocked.length} edit attempt${blocked.length === 1 ? "" : "s"}, ${blocked.filter((c) => c.denied).length} blocked`, "done");
    s.show("pwork", `${pLooks} reads/searches${researched ? " · authorize.js + callers" : ""}`, "done");
    s.show("pplan", plan.plan ? `plan submitted (${options} boundary options)` : "no plan submitted", plan.plan ? "done" : "bad");
    s.show("pout", `${pChanged.length} of ${Object.keys(p0).length} files changed`, pChanged.length === 0 ? "good" : "bad");
    const dOptions = [/middleware|route/i, /handler/i, /service|repositor/i].filter((re) => re.test(direct.text || "")).length;
    return {
      compare: {
        cols: [
          { title: "Options A + B: direct execution (acceptEdits)", short: "Direct execution", tone: "trap", said: direct.text,
            verdict: dChanged.length ? `Edited **${dChanged.length} file${dChanged.length === 1 ? "" : "s"}** (${dChanged.map((f) => `\`${f}\``).join(", ")}) before the team chose a boundary, and nothing asked anyone first.`
                                     : `Changed no file this time, but only because Claude held back: ${dEdits.length ? `${dEdits.length} edit call${dEdits.length === 1 ? "" : "s"} ran unblocked` : "Edit was allowed all along"}, and no plan came back for approval.` },
          { title: "Option D: plan mode", short: "Plan mode", tone: "fix", said: planText,
            verdict: pChanged.length === 0 && plan.plan ? `Researched (${pLooks} reads/searches), changed **0 files**${blocked.length ? ` (${blocked.length} edit attempt${blocked.length === 1 ? "" : "s"} blocked)` : ""}, and handed back a plan with ${options} boundary option${options === 1 ? "" : "s"} for you to approve.`
                                                       : `${pChanged.length} files changed; plan ${plan.plan ? "submitted" : "not submitted"}. Read the live output: Claude writes each run fresh.` },
        ],
        rows: [
          ["Permission mode", "`acceptEdits`", "`plan`"],
          ["Reads and searches", String(dLooks), String(pLooks)],
          ["Edit / Write calls", { v: dEdits.length ? `${dEdits.length}, all allowed` : "0 (allowed, none made)", tone: dEdits.length ? "bad" : "" }, { v: blocked.length ? `${blocked.length}, ${blocked.filter((c) => c.denied).length} blocked` : "0 (any would be blocked)", tone: blocked.every((c) => c.denied) ? "good" : "bad" }],
          ["Files changed", { v: String(dChanged.length), tone: dChanged.length ? "bad" : "good" }, { v: String(pChanged.length), tone: pChanged.length ? "bad" : "good" }],
          ["A plan waiting for your approval", { v: "no", tone: "bad" }, { v: plan.plan ? "yes (ExitPlanMode)" : "no", tone: plan.plan ? "good" : "bad" }],
          ["Boundary options laid out", String(dOptions), { v: String(options), tone: options >= 2 ? "good" : "bad" }],
        ],
        note: "The request, the repo and the tools are identical. Only the permission mode changed: in plan mode, Edit and Write are blocked until you approve the plan, so the boundary decision comes back to the team before any file moves.",
      },
      final: planText,
      checks: [
        E.check("Plan mode: Claude researched first, reading authorize.js and finding its callers", researched),
        E.check(`Plan mode: every file hashes the same before and after${blocked.length ? ` (${blocked.length} edit attempt${blocked.length > 1 ? "s" : ""} blocked)` : ""}`, pChanged.length === 0 && blocked.every((c) => c.denied)),
        E.check("Plan mode: Claude handed back a plan for approval (ExitPlanMode) that names the real files", !!plan.plan && /orders\.js|authorize\.js/.test(plan.plan)),
        E.check(`Plan mode: the plan sets out boundary options for the team to choose (${options} of route/middleware, handler, service)`, /boundar/i.test(planText || "") && options >= 2),
      ],
    };
  },
};
