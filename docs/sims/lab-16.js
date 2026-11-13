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

    s.log("== Option D, the right design: plan mode", "note");
    const wsP = workspace(E, SIM2_WORKSPACE);
    const p0 = hashTree(wsP.fs);
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
    return {
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
