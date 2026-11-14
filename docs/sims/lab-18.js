// Lab 18 · Task 3.6 · Simulator 5: the nightly job hangs because nobody can press Enter.
// Ported from casekit.py UC-18. A CI runner has no terminal and nobody at the keyboard. The emulator
// (shared/t3-claudecode.js, ciStep) behaves like the CLI: plain `claude` opens an interactive session that answers,
// then waits at the > prompt for the next message (the runner kills it at the job timeout); `claude -p` runs the
// prompt once in a non-interactive session, prints one result to stdout and exits, with --max-turns as a hard cap
// and --json-schema mapped to structured output (output_config) on the Messages API.
import { SIM5_REPO } from "./shared/t3-workspaces.js";
import { workspace, ciStep, showFile } from "./shared/t3-claudecode.js";

const TRIAGE = "Nightly support triage check: read stock/jobs.py and stock/api.py and decide whether the nightly sync job can raise an exception when it runs.";
const SCHEMA = {
  type: "object", additionalProperties: false, required: ["verdict", "files_read", "reason"],
  properties: { verdict: { type: "string", enum: ["can_raise", "safe"] }, files_read: { type: "array", items: { type: "string" } }, reason: { type: "string" } },
};
const valid = (o) => o && typeof o === "object" && ["can_raise", "safe"].includes(o.verdict) && Array.isArray(o.files_read) && typeof o.reason === "string" &&
  Object.keys(o).every((k) => k in SCHEMA.properties);

export default {
  id: 18,
  see: "Plain claude answers, then sits at the > prompt until the runner kills it (exit 124, nothing on stdout), even with --output-format json and a please-exit instruction. claude -p prints one JSON envelope with a session_id and a schema-valid verdict, then exits with code 0.",
  try: "Lower --max-turns to 1 and run it again: Claude can't finish reading both files, so print mode exits with subtype error_max_turns and exit code 1. The job fails fast instead of hanging.",
  // The scenario board (assets/scene.js): the nightly triage step in a CI runner, twice. Plain claude with
  // --output-format json and "then exit" is the trap; claude -p (print mode) is the fix.
  scene: {
    title: "Nightly stock triage in CI: a runner with no terminal and nobody at the keyboard",
    caption: "Same repo, same triage question, both with --output-format json. Only the mode changes: an interactive session waits for the next message; print mode prints one result and exits.",
    lanes: [
      { key: "plain", label: "Options B + C: plain claude", sub: "--output-format json, \"then exit\" in the prompt", tone: "trap", on: /plain claude/, stages: [
        { id: "pcmd", icon: "💻", t: "claude --output-format json", s: "\"…Answer in two lines, then exit.\"" },
        { id: "pmode", icon: "🖥", t: "Interactive session", s: "stdin is not a terminal; it opens anyway", diff: true },
        { id: "pclaude", icon: "🤖", t: "Claude reads and answers", s: "stock/jobs.py, stock/api.py", tools: ["Read", "Grep", "Glob"], claude: true },
        { id: "pwait", icon: "⏳", t: "Waits at the > prompt", s: "nobody types in a CI runner" },
        { id: "pout", icon: "🚦", t: "Job result", s: "want: exit 0 with JSON on stdout", out: true } ] },
      { key: "print", label: "Option A: claude -p", sub: "print mode, schema, turn cap, allowed tools", tone: "fix", on: /claude -p/, stages: [
        { id: "fcmd", icon: "💻", t: "claude -p … --json-schema", s: "--max-turns 5 --allowedTools Read,Grep,Glob" },
        { id: "fmode", icon: "📤", t: "Print mode", s: "one prompt, one result on stdout, exit", diff: true },
        { id: "fclaude", icon: "🤖", t: "Claude reads and answers", s: "stock/jobs.py, stock/api.py", tools: ["Read", "Grep", "Glob"], claude: true },
        { id: "fjson", icon: "🧾", t: "JSON envelope on stdout", s: "session_id + structured_output.verdict" },
        { id: "fout", icon: "🚦", t: "Job result", s: "want: exit 0 with JSON on stdout", out: true } ] },
    ],
  },
  slide: {
    title: "CI runs claude -p: one prompt, stdout, exit",
    code: `# hangs: interactive, waits for the next message
claude "Triage... then exit."              # KEY 1

# CI: print mode
claude -p "Nightly triage: read stock/jobs.py" \\  # KEY 2
  --output-format json \\                    # KEY 3
  --json-schema "$(cat triage.schema.json)" \\
  --max-turns 5 \\                           # KEY 4
  --allowedTools "Read,Grep,Glob" > out.json
jq -r .structured_output.verdict out.json`,
    keys: [["1", "A prompt can't change mode", "Plain claude waits for the next message."],
           ["2", "-p makes it non-interactive", "One prompt, result on stdout, exit."],
           ["3", "JSON shapes the output", "It does not make the run exit."],
           ["4", "Cap the turns", "A confused run fails fast, never hangs."]],
  },
  async run(s, E) {
    s.log("== The repository the nightly job checks (Simulator 5)", "note");
    showFile(s, "stock/jobs.py", SIM5_REPO["stock/jobs.py"], 16);

    s.log("== Options B + C, the tempting fix: plain claude, --output-format json, and 'exit after answering'", "note");
    const bad = await ciStep(s, E, workspace(E, SIM5_REPO),
      ["claude", "--output-format", "json", TRIAGE + " Answer in two lines, then exit."], { jobTimeoutMin: 30 });
    s.show("pcmd", "no -p flag", "done");
    s.show("pmode", bad.hung ? "opened, ignored --output-format" : "exited", "done");
    s.show("pclaude", `answered in ${bad.run.turns} turn${bad.run.turns === 1 ? "" : "s"} (${bad.seconds.toFixed(1)} s)`, "done");
    s.show("pwait", bad.hung ? `waited ${bad.waitedMin}:00, then SIGTERM` : "did not wait", bad.hung ? "bad" : "done");
    s.show("pout", `exit ${bad.exitCode} · stdout ${bad.stdout ? `${bad.stdout.length} bytes` : "empty"}`, bad.exitCode === 0 && bad.stdout ? "good" : "bad");
    await s.pause({
      title: "Plain claude finished answering, but never exited",
      outcome: `Claude ${bad.run.text.trim() ? `answered in ${bad.seconds.toFixed(1)} s` : "ran"}, then the session ${bad.hung ? `sat at the > prompt until the ${bad.waitedMin}-minute job timeout killed it` : "ended"}: **exit ${bad.exitCode}, ${bad.stdout ? `${bad.stdout.length} bytes` : "nothing"} on stdout**. --output-format json and "then exit" changed nothing about the mode.`,
      next: "Option A: the same triage with claude -p (print mode)",
    });

    s.log("== Option A, the fix: claude -p (print mode)", "note");
    const argv = ["claude", "-p", TRIAGE, "--output-format", "json", "--json-schema", JSON.stringify(SCHEMA), "--max-turns", "5", "--allowedTools", "Read,Grep,Glob"];
    const good = await ciStep(s, E, workspace(E, SIM5_REPO), argv);
    let env = null; try { env = JSON.parse(good.stdout); } catch { env = null; }
    s.log(`  stdout: one JSON envelope, ${good.stdout.length} bytes (the result field shortened here):`, "note");
    s.log(`  ${env ? JSON.stringify({ ...env, result: E.short(env.result, 60) }) : good.stdout.slice(0, 700)}`, "result");
    const so = env?.structured_output;
    s.log(`  $ jq -r .structured_output.verdict out.json  ->  ${so?.verdict ?? "(missing)"}`, "reply");

    const readBoth = ["stock/jobs.py", "stock/api.py"].every((f) => good.run.reads.includes(f));
    const ok = good.exitCode === 0 && !!env;
    s.show("fcmd", "-p --output-format json --json-schema", "done");
    s.show("fmode", "non-interactive", "done");
    s.show("fclaude", `${env?.num_turns ?? good.run.turns} turns · read ${good.run.reads.map((f) => f.split("/").pop()).join(", ") || "nothing"}`, "done");
    s.show("fjson", so ? `verdict: ${so.verdict}` : env ? "envelope, no structured_output" : "no JSON", so && valid(so) ? "done" : "bad");
    s.show("fout", `exit ${good.exitCode} in ${good.seconds.toFixed(1)} s · ${good.stdout.length} bytes`, ok ? "good" : "bad");
    const badTurns = bad.run.turns;
    return {
      compare: {
        cols: [
          { title: "Options B + C: plain claude, --output-format json, \"then exit\"", short: "Plain claude", tone: "trap", said: bad.run.text,
            verdict: bad.hung ? `Claude answered in ${bad.seconds.toFixed(1)} s, then the interactive session **waited for the next message** until the runner killed it: exit ${bad.exitCode}, empty stdout, a ${bad.waitedMin}-minute job with nothing to show.`
                              : `Exited with code ${bad.exitCode}. Read the live output.` },
          { title: "Option A: claude -p (print mode)", short: "claude -p", tone: "fix", said: so ? `verdict: ${so.verdict}\nreason: ${so.reason}` : good.stdout,
            verdict: ok ? `Ran once, printed **one JSON envelope** (session_id, structured_output.verdict = \`${so?.verdict ?? "missing"}\`) and **exited 0** after ${good.seconds.toFixed(1)} s.`
                        : `Exit ${good.exitCode}${env ? ` (${env.subtype})` : ", no JSON on stdout"}. Read the live output: Claude writes each run fresh.` },
        ],
        rows: [
          ["Command", "`claude --output-format json \"…then exit.\"`", "`claude -p … --output-format json --json-schema … --max-turns 5`"],
          ["Session type", { v: "interactive: waits at >", tone: "bad" }, { v: "print: one prompt, then exit", tone: "good" }],
          ["Claude's turns", String(badTurns), String(env?.num_turns ?? good.run.turns)],
          ["Process exit", { v: bad.hung ? `${bad.exitCode} (killed at ${bad.waitedMin}:00)` : String(bad.exitCode), tone: bad.exitCode === 0 ? "good" : "bad" }, { v: `${good.exitCode} after ${good.seconds.toFixed(1)} s`, tone: good.exitCode === 0 ? "good" : "bad" }],
          ["stdout", { v: bad.stdout ? `${bad.stdout.length} bytes` : "empty", tone: bad.stdout ? "good" : "bad" }, { v: env ? `${good.stdout.length} bytes, one JSON envelope` : `${good.stdout.length} bytes, not JSON`, tone: env ? "good" : "bad" }],
          ["Verdict a script can jq", { v: "none", tone: "bad" }, { v: so?.verdict ?? "missing", tone: so && valid(so) ? "good" : "bad" }],
        ],
        note: "Both runs asked for `--output-format json`, and the first even told Claude to exit. Only `-p` changes the mode: the JSON flag shapes the output, and no instruction to Claude can end an interactive session.",
      },
      final: so ? `verdict: ${so.verdict}\nfiles_read: ${so.files_read.join(", ")}\nreason: ${so.reason}` : good.stdout,
      checks: [
        E.check("Plain claude answered, yet never exited: the runner killed it at the timeout (exit 124, empty stdout)", bad.run.text.trim().length > 0 && bad.exitCode === 124 && bad.stdout === ""),
        E.check(`claude -p exited on its own with code ${good.exitCode} and one JSON envelope with a session_id on stdout`, good.exitCode === 0 && /^[0-9a-f-]{36}$/.test(env?.session_id || "")),
        E.check("structured_output in the envelope is valid against the --json-schema", valid(so)),
        E.check("Claude read jobs.py and api.py and caught the PR 418 break: get_stock now needs a warehouse", readBoth && so?.verdict === "can_raise" && /warehouse|argument|TypeError|parameter/i.test(so?.reason || "")),
        E.check(`The run stayed inside --max-turns 5 (${env?.num_turns ?? "?"} turns) and finished in ${good.seconds.toFixed(1)} s`, env && env.num_turns <= 5 && good.seconds < 60),
      ],
    };
  },
};
