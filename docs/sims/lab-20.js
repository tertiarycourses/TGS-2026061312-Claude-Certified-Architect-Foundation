// Lab 20 · Task 4.2 · Simulator 2: "clean this up" means three things: show which one you mean.
// The team's /task command (.claude/commands/task.md) must choose investigate, plan or modify. Two versions
// of the command run on the three ambiguous requests from the evals, each request twice:
//   1. detailed written criteria only (the version that has not stabilised the boundary)
//   2. the same criteria plus three <example> blocks: a request, the chosen path, and why the plausible
//      alternative loses. The examples use DIFFERENT requests and files from the three under test,
//      so a match is judgement, not copying.
// Each call returns {path, rejected_alternative, reasoning} through output_config (a JSON schema).

const FILES = "src/api/orders.js, src/db/orderRepository.js, src/middleware/authorize.js, src/services/invoice.ts, src/services/report.ts, src/utils/formatDate.js, src/utils/quantity.js, src/components/Button.tsx";

const CRITERIA = `Classify the developer's request into exactly one path, then say which path you rejected.
- investigate: the request is about understanding behaviour, an error or a cause.
- plan: the change is broad, touches callers in several files, or has no clear acceptance criterion.
- modify: the change is small, specific and low-risk, and can be made directly.`;

const EXAMPLES = `<examples>
<example>
request: "look into why the invoice header prints undefined"
path: investigate
rejected_alternative: modify
why: a symptom with an unknown cause. Editing now could patch the wrong file; diagnose first and report the cause.
</example>
<example>
request: "can you make src/services/invoice.ts better"
path: plan
rejected_alternative: modify
why: "better" has no acceptance criterion and the file has callers. Propose options before touching code.
</example>
<example>
request: "tidy this: drop the unused lodash import in src/services/report.ts"
path: modify
rejected_alternative: plan
why: one file, one named change, nothing to decide. A plan would only add a round trip.
</example>
</examples>`;

const command = (withExamples) => `---
description: Decide whether a developer request needs investigation, a plan, or a direct code change
---
${CRITERIA}
${withExamples ? `\nDecide with the examples below; they show where the boundary falls and why one path beats the plausible alternative.\n\n${EXAMPLES}\n` : ""}
Repository files: ${FILES}

Request: $ARGUMENTS`;

const SCHEMA = { type: "object", additionalProperties: false, required: ["path", "rejected_alternative", "reasoning"],
  properties: { path: { type: "string", enum: ["investigate", "plan", "modify"] },
                rejected_alternative: { type: "string", enum: ["investigate", "plan", "modify"] },
                reasoning: { type: "string" } } };

const REQUESTS = [
  { req: "look into this error: TypeError in formatDate", want: "investigate" },
  { req: "can you improve this module src/api/orders.js", want: "plan" },
  { req: "clean this up: remove the unused imports in src/db/orderRepository.js", want: "modify" },
];
const RUNS = 2;

async function classify(s, E, withExamples, r, k) {
  const run = await E.runAgent(s, {
    label: `${withExamples ? "examples" : "criteria"} #${k} "${r.req.slice(0, 28)}…"`,
    prompt: command(withExamples).replace("$ARGUMENTS", r.req),
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    maxTurns: 1,
  });
  let out = null; try { out = JSON.parse(run.text); } catch { /* reported as a miss */ }
  return { ...r, k, out, path: out?.path || "(no answer)" };
}

async function evalCommand(s, E, withExamples) {
  const jobs = [];
  for (const r of REQUESTS) for (let k = 1; k <= RUNS; k++) jobs.push(classify(s, E, withExamples, r, k));
  const res = await Promise.all(jobs);
  for (const r of REQUESTS) {
    const got = res.filter((x) => x.req === r.req).map((x) => x.path);
    const ok = got.every((p) => p === r.want);
    s.log(`   "${r.req}" -> ${got.join(", ")}   (team wants ${r.want})${ok ? "" : "  <- miss"}`, ok ? "result" : "error");
  }
  return res;
}

export default {
  id: 20,
  see: "Each ambiguous request runs twice through each version of /task. With three tagged examples (on different requests and files), \"look into this error\" -> investigate, \"can you improve this module\" -> plan and \"clean this up\" on a named file -> modify, every time, each naming the alternative it rejected.",
  try: "Delete the third <example> (the modify one) from EXAMPLES in sims/lab-20.js and rerun: watch whether \"clean this up\" still lands on modify.",
  // The scenario board (assets/scene.js): the three ambiguous requests through two versions of /task.
  scene: {
    title: "/task: three ambiguous requests, and where the boundary falls",
    caption: "Both versions keep the same written criteria and the same JSON schema; each request runs twice. Version 2 only adds three tagged examples, on other requests and files.",
    lanes: [
      { key: "req", label: "The evals", sub: "3 ambiguous requests × 2 runs each", stages: [
        { id: "r1", icon: "🔎", t: "\"look into this error\"", s: "TypeError in formatDate · team wants investigate" },
        { id: "r2", icon: "🧭", t: "\"can you improve this module\"", s: "src/api/orders.js · team wants plan" },
        { id: "r3", icon: "🧹", t: "\"clean this up\"", s: "unused imports, orderRepository.js · wants modify" } ] },
      { key: "A", label: "Version 1 · criteria only", sub: ".claude/commands/task.md: three written rules", tone: "trap", on: /^Version 1/, stages: [
        { id: "acmd", icon: "📄", t: "task.md: criteria only", s: "investigate / plan / modify described in words", diff: true },
        { id: "arun", icon: "🤖", t: "6 classifications", s: "{path, rejected_alternative, reasoning}", claude: true },
        { id: "amiss", icon: "↔", t: "Where it drifted", s: "requests that left the team's path" },
        { id: "ascore", icon: "🎯", t: "Matches the team", s: "want: 6/6", out: true } ] },
      { key: "B", label: "Version 2 · + 3 <example> blocks", sub: "the same criteria, plus examples that argue against the alternative", tone: "fix", on: /^Version 2/, stages: [
        { id: "bcmd", icon: "🏷", t: "task.md + 3 <example>s", s: "invoice header · invoice.ts · report.ts import", diff: true },
        { id: "brun", icon: "🤖", t: "6 classifications", s: "{path, rejected_alternative, reasoning}", claude: true },
        { id: "bmiss", icon: "↔", t: "Where it drifted", s: "requests that left the team's path" },
        { id: "bscore", icon: "🎯", t: "Matches the team", s: "want: 6/6", out: true } ] },
    ],
  },
  slide: {
    title: "Show the boundary with 2–4 tagged examples",
    code: `---
description: investigate, plan or modify
---
<example>                                      # KEY 1
request: "look into why the header prints undefined"
path: investigate
why: unknown cause; an edit could hit the wrong file
</example>                                     # KEY 2
<example> ... "make invoice.ts better" -> plan ...
<example> ... "drop the unused import" -> modify ...
Request: $ARGUMENTS                            # KEY 3`,
    keys: [["1", "Tagged examples", "Each in its own <example> block."],
           ["2", "Reasoning vs alternative", "Why plan beats modify, not just the answer."],
           ["3", "Live input kept apart", "The request sits outside the examples."]],
  },
  async run(s, E) {
    s.log(`/task on ${REQUESTS.length} ambiguous requests from the evals, ${RUNS} runs each, two versions of .claude/commands/task.md`, "note");
    const score = (res) => res.filter((x) => x.path === x.want).length;
    const SHORT = { investigate: "look into this error", plan: "can you improve this module", modify: "clean this up" };
    const paths = (res, want) => res.filter((x) => x.want === want).map((x) => x.path);
    const misses = (res) => REQUESTS.filter((r) => paths(res, r.want).some((p) => p !== r.want))
      .map((r) => `"${SHORT[r.want]}" -> ${paths(res, r.want).join(", ")} (want ${r.want})`);
    const showVersion = (p, res) => {
      const m = misses(res);
      s.show(`${p}run`, `${res.filter((x) => x.out).length}/${res.length} valid JSON answers`, "done");
      s.show(`${p}miss`, m.length ? m.join(" · ") : "none: every run on the team's path", m.length ? "bad" : "good");
      s.show(`${p}score`, `${score(res)}/${res.length}`, score(res) === res.length ? "good" : "bad");
      return m;
    };

    s.log("== Version 1 · detailed written criteria only", "note");
    const base = await evalCommand(s, E, false);
    s.show("acmd", "3 written rules, no examples", "done");
    const missA = showVersion("a", base);
    await s.pause({
      title: "Version 1 finished: written criteria only",
      outcome: `Criteria alone matched the team's path on **${score(base)}/${base.length}** decisions. ` +
        (missA.length ? `It drifted on ${missA.map((m) => `**${m}**`).join("; ")}.` : "Every request landed where the team wants this time, but nothing shows Claude where the boundary falls, so the next run may differ."),
      next: "Version 2: the same criteria plus three tagged <example> blocks with reasoning against the alternative",
    });
    s.log("== Version 2 · the same criteria + three <example> blocks with reasoning against the alternative", "note");
    const ex = await evalCommand(s, E, true);
    s.show("bcmd", "3 tagged examples on other requests and files", "done");
    const missB = showVersion("b", ex);
    REQUESTS.forEach((r, i) => {
      const okB = paths(ex, r.want).every((x) => x === r.want);
      s.show(`r${i + 1}`, `v1: ${paths(base, r.want).join(", ")} · v2: ${paths(ex, r.want).join(", ")}`, okB ? "good" : "bad");
    });

    s.log(`== Score: criteria only ${score(base)}/${base.length} · with examples ${score(ex)}/${ex.length}`, "note");
    const exFor = (want) => ex.filter((x) => x.want === want);
    const final = [
      `Criteria only: ${score(base)}/${base.length} decisions matched the team's path.`,
      ...base.map((x) => `  - "${x.req}" run ${x.k}: ${x.path}`),
      `With tagged examples: ${score(ex)}/${ex.length}.`,
      ...ex.map((x) => `  - "${x.req}" run ${x.k}: ${x.path} (rejected ${x.out?.rejected_alternative}): ${x.out?.reasoning || ""}`),
    ].join("\n");
    const cell = (res, want) => { const got = paths(res, want); return { v: got.join(", "), tone: got.every((x) => x === want) ? "good" : "bad" }; };
    const reasoned = (res) => res.filter((x) => x.out && x.out.rejected_alternative !== x.out.path && x.out.reasoning.length > 20).length;
    const sample = ex.find((x) => x.want === "modify" && x.out)?.out;
    return {
      final,
      compare: {
        cols: [
          { title: "Version 1: written criteria only", short: "Criteria only", tone: "trap",
            verdict: missA.length ? `${score(base)}/${base.length} on the team's path. The rules read fine, but Claude drew the boundary elsewhere on ${missA.length} request${missA.length === 1 ? "" : "s"}: ${missA.join("; ")}.`
                                  : `${score(base)}/${base.length} this time: the criteria alone held. Nothing pins the boundary down, so rerun it and watch for drift.` },
          { title: "Version 2: criteria + 3 tagged examples", short: "With examples", tone: "fix",
            said: sample ? `"clean this up": ${sample.path} (rejected ${sample.rejected_alternative}). ${sample.reasoning}` : undefined,
            verdict: !missB.length ? `${score(ex)}/${ex.length}: every request on the team's path in both runs${reasoned(ex) === ex.length ? ", each naming the path it rejected and why" : ""}. The examples used other requests and files, so this is judgement, not copying.`
                                   : `${score(ex)}/${ex.length}: still drifted on ${missB.join("; ")}. Read the live output: Claude writes each run fresh.` },
        ],
        rows: [
          ["\"look into this error\" (want investigate)", cell(base, "investigate"), cell(ex, "investigate")],
          ["\"can you improve this module\" (want plan)", cell(base, "plan"), cell(ex, "plan")],
          ["\"clean this up\" on a named file (want modify)", cell(base, "modify"), cell(ex, "modify")],
          ["Decisions on the team's path", { v: `${score(base)}/${base.length}`, tone: score(base) === base.length ? "good" : "bad" }, { v: `${score(ex)}/${ex.length}`, tone: score(ex) === ex.length ? "good" : "bad" }],
          ["Named a rejected path and a reason", `${reasoned(base)}/${base.length}`, `${reasoned(ex)}/${ex.length}`],
        ],
        note: "Same criteria, same schema, same requests. Version 2 adds only three `<example>` blocks, each showing a request, the chosen path and why the plausible alternative loses.",
      },
      checks: [
        E.check(`With examples, "look into this error" -> investigate in every run (${exFor("investigate").map((x) => x.path).join(", ")})`, exFor("investigate").every((x) => x.path === "investigate")),
        E.check(`With examples, "can you improve this module" -> plan in every run (${exFor("plan").map((x) => x.path).join(", ")})`, exFor("plan").every((x) => x.path === "plan")),
        E.check(`With examples, "clean this up" on a named file -> modify in every run (${exFor("modify").map((x) => x.path).join(", ")})`, exFor("modify").every((x) => x.path === "modify")),
        E.check("With examples, every decision named a different path it rejected and gave a reason", ex.every((x) => x.out && x.out.rejected_alternative !== x.out.path && x.out.reasoning.length > 20)),
        E.check(`The examples matched the team's path at least as often as criteria alone (${score(ex)} vs ${score(base)} of ${ex.length})`, score(ex) >= score(base)),
      ],
    };
  },
};
