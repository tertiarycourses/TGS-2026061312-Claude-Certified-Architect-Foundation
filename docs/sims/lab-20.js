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
    s.log("== Version 1 · detailed written criteria only", "note");
    const base = await evalCommand(s, E, false);
    s.log("== Version 2 · the same criteria + three <example> blocks with reasoning against the alternative", "note");
    const ex = await evalCommand(s, E, true);

    const score = (res) => res.filter((x) => x.path === x.want).length;
    s.log(`== Score: criteria only ${score(base)}/${base.length} · with examples ${score(ex)}/${ex.length}`, "note");
    const exFor = (want) => ex.filter((x) => x.want === want);
    const final = [
      `Criteria only: ${score(base)}/${base.length} decisions matched the team's path.`,
      ...base.map((x) => `  - "${x.req}" run ${x.k}: ${x.path}`),
      `With tagged examples: ${score(ex)}/${ex.length}.`,
      ...ex.map((x) => `  - "${x.req}" run ${x.k}: ${x.path} (rejected ${x.out?.rejected_alternative}): ${x.out?.reasoning || ""}`),
    ].join("\n");
    return {
      final,
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
