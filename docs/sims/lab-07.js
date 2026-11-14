// Lab 7 · Task 1.7 · Simulator 2 (Case UC-5): two attempts from one analysis.
// Sessions are emulated in JS: a session is an id plus its conversation history. "Resume with fork"
// copies a saved session's history into a NEW session id and leaves the original untouched.
// A session is not a file-system snapshot: both attempts share one working directory (the virtual repo),
// so files are checkpointed before the edits and restored before attempt B.
import { WORKSPACE, writeTool, changedFiles } from "./shared/t1-workspace.js";

const newId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(16).slice(2)).slice(0, 8);
// One system prompt for every run: a resumed or forked session keeps the session's system prompt (and the
// API rejects copied thinking blocks if it changes). The permission mode is enforced in code, by a hook.
const SYSTEM = "You are Claude Code working in the Orderly repository (a JavaScript/TypeScript app). Be brief.";

export default {
  id: 7,
  see: "Three session ids: the plan-mode baseline and two forks of it. Attempt A edits only formatDate.js; the checkpoint is restored before attempt B, so B starts from the original files (no trace of A's patch), creates src/utils/dates.js and updates the callers. The baseline's history is unchanged at the end.",
  try: "Comment out the restore() call before attempt B and run it again: B now starts from A's patched formatDate.js, because a forked session copies the conversation, not the files.",
  // The scenario board (assets/scene.js): case UC-5, one saved analysis and two forked attempts. Neither attempt
  // is a trap: they are two legitimate fixes. The step that matters is restoring the files between them.
  scene: {
    title: "Case UC-5: one analysis of the formatDate() crash, two forked attempts",
    caption: "Both attempts fork the SAME saved session, so each starts with the same analysis. They share one working directory, so the files are checkpointed first and restored before attempt B.",
    lanes: [
      { key: "base", label: "Step 1 · plan-mode baseline", sub: "investigate once, save the session", on: /Step 1/, stages: [
        { id: "bug", icon: "🐞", t: "formatDate() crashes on null", s: "UC-5 · src/utils/formatDate.js, 3 callers" },
        { id: "plan", icon: "🔍", t: "Plan-mode investigation", s: "reads the callers; Edit and Write denied", claude: true, tools: ["Read", "Grep", "Glob", "Edit", "Write"] },
        { id: "save", icon: "💾", t: "Save the session id", s: "the analysed conversation is the asset" },
        { id: "ckpt", icon: "📸", t: "Checkpoint the files", s: "a session is not a file-system snapshot" } ] },
      { key: "A", label: "Step 2 · attempt A (fork 1)", sub: "the minimal patch", on: /Step 2/, stages: [
        { id: "a_fork", icon: "🍴", t: "Fork the baseline", s: "new session id, copied history" },
        { id: "a_run", icon: "🤖", t: "Minimal patch", s: "touch src/utils/formatDate.js only", claude: true, tools: ["Read", "Grep", "Glob"] },
        { id: "a_out", icon: "📝", t: "Files A changed", s: "want: formatDate.js and nothing else", out: true, tools: ["Edit", "Write"] } ] },
      { key: "B", label: "Step 3 · attempt B (fork 2)", sub: "the larger refactor, from the original files", on: /Step 3/, stages: [
        { id: "b_restore", icon: "⏪", t: "Restore the checkpoint", s: "undo attempt A's edits on disk", diff: true },
        { id: "b_fork", icon: "🍴", t: "Fork the SAME baseline", s: "new id; never sees attempt A's turns" },
        { id: "b_run", icon: "🤖", t: "Larger refactor", s: "new src/utils/dates.js, update the callers", claude: true, tools: ["Read", "Grep", "Glob"] },
        { id: "b_out", icon: "📝", t: "Files B changed", s: "want: dates.js created, callers updated", out: true, tools: ["Edit", "Write"] } ] },
    ],
  },
  slide: {
    title: "Fork the conversation, checkpoint the files",
    code: `base = run(PLAN_PROMPT, mode="plan")
saved_id = base.session_id                      # KEY 1
checkpoint = snapshot(workdir)                  # KEY 2
a = run("Attempt A: minimal patch",
        resume=saved_id, fork_session=True)     # KEY 3
restore(workdir, checkpoint)                    # KEY 4
b = run("Attempt B: larger refactor",
        resume=saved_id, fork_session=True)
assert len({saved_id, a.session_id,
            b.session_id}) == 3`,
    keys: [["1", "Save the analysed session", "The valuable asset is the conversation."],
           ["2", "Checkpoint before edits", "A session is not a file-system snapshot."],
           ["3", "Fork each attempt", "New id, copied history, original untouched."],
           ["4", "Restore before attempt B", "Otherwise B starts from A's edited files."]],
  },
  async run(s, E) {
    const r = E.repo(WORKSPACE);
    const fs = r.fs;                                   // the one shared working directory
    const sessions = {};                               // session id -> conversation history
    const restore = (snap) => { for (const k of Object.keys(fs)) delete fs[k]; Object.assign(fs, snap); };
    const editTools = { Read: r.tools.Read, Grep: r.tools.Grep, Glob: r.tools.Glob, Edit: r.tools.Edit, Write: writeTool(fs) };
    const planGate = (name) => (name === "Edit" || name === "Write" ? { deny: "Permission mode is plan: edits are not allowed." } : null);   // permissionMode "plan"

    // A run that resumes a saved session with the fork option: copy the history into a new session id.
    async function forkAndRun(baseId, prompt, maxTurns) {
      const id = newId();
      const history = structuredClone(sessions[baseId]);
      s.log(`resume=${baseId} fork_session=True -> new session ${id} (copied ${history.length} messages)`, "note");
      const run = await E.runAgent(s, { system: SYSTEM, messages: [...history, { role: "user", content: prompt }], tools: editTools, maxTurns, max_tokens: 3000 });
      sessions[id] = run.messages;
      return { id, run, copied: history.length };
    }

    s.log("Case UC-5 · formatDate() crashes on a null date. Investigate once, then try two fixes from the same analysis.", "note");
    s.log("== Step 1 · plan-mode investigation (read-only), then save the session id", "note");
    s.show("bug", "3 callers: orders.js, invoice.ts, report.ts", "done");
    const base = await E.runAgent(s, {
      system: SYSTEM,
      prompt: "Plan mode investigation only: formatDate in src/utils/formatDate.js crashes on a null date. Read its callers (src/api/orders.js, src/services/*.ts) and report, in five lines, the minimal patch and the larger refactor that would remove the crash class entirely. Do not edit.",
      tools: { ...editTools }, preToolUse: planGate, maxTurns: 6, max_tokens: 1500,
    });
    const baseId = newId();
    sessions[baseId] = base.messages;
    const baseLen = base.messages.length;
    s.log(`Saved baseline session ${baseId} (${baseLen} messages).`, "note");
    const blockedEdits = base.calls.filter((c) => c.denied).length;
    s.show("plan", `${base.calls.length} tool calls${blockedEdits ? ` · ${blockedEdits} edit${blockedEdits === 1 ? "" : "s"} denied` : ", no edits"}`, "done");
    s.show("save", `session ${baseId} · ${baseLen} messages`, "done");

    s.log("== Step 2 · checkpoint the files, then attempt A in a fork of the baseline", "note");
    const checkpoint = { ...fs };
    s.show("ckpt", `${Object.keys(checkpoint).length} files snapshotted`, "done");
    const a = await forkAndRun(baseId, "Attempt A from this analysis: implement ONLY the minimal patch to src/utils/formatDate.js. Touch no other file.", 5);
    const changedA = changedFiles(checkpoint, fs);
    s.log(`Attempt A changed: ${changedA.join(", ") || "nothing"}. Without a restore, attempt B would start from these edited files.`, "note");
    const aRight = changedA.length === 1 && changedA[0] === "src/utils/formatDate.js";
    s.show("a_fork", `${a.id} · ${a.copied} messages copied`, "done");
    s.show("a_run", `${a.run.calls.length} tool calls · ${a.run.turns} turns`, "done");
    s.show("a_out", changedA.join(", ") || "nothing changed", aRight ? "good" : "bad");
    await s.pause({
      title: "Attempt A finished: fork 1 of the baseline",
      outcome: `Session **${a.id}** (a copy of ${baseId}'s ${a.copied} messages) changed **${changedA.join(", ") || "nothing"}**. ` +
        (changedA.length ? "Those edits are still on disk: a fork copies the conversation, not the files, so attempt B would start from them." : "Nothing changed on disk this time, but a fork would not have protected the files if it had."),
      next: "Attempt B: restore the checkpoint, then fork the same baseline again",
    });

    s.log("== Step 3 · restore the checkpoint, then attempt B in a second fork of the SAME baseline", "note");
    restore(checkpoint);
    const startB = { ...fs };
    const cleanStart = changedFiles(checkpoint, startB).length === 0;
    s.show("b_restore", cleanStart ? `${changedA.length} file${changedA.length === 1 ? "" : "s"} rolled back` : "files still differ", cleanStart ? "done" : "bad");
    const b = await forkAndRun(baseId, "Attempt B from this analysis: implement the larger refactor you described. Move date formatting into src/utils/dates.js and update every caller.", 10);
    const changedB = changedFiles(checkpoint, fs);
    s.log(`Attempt B changed: ${changedB.join(", ") || "nothing"}.`, "note");

    const ids = [baseId, a.id, b.id];
    const promptA = JSON.stringify(sessions[b.id]).includes("Attempt A from this analysis");
    const callers = ["src/api/orders.js", "src/services/invoice.ts", "src/services/report.ts"].filter((f) => changedB.includes(f));
    const bRight = cleanStart && changedB.includes("src/utils/dates.js") && callers.length >= 2;
    s.show("b_fork", `${b.id} · ${b.copied} messages copied`, "done");
    s.show("b_run", `${b.run.calls.length} tool calls · ${b.run.turns} turns`, "done");
    s.show("b_out", E.short(changedB.join(", ") || "nothing changed", 80), bRight ? "good" : "bad");
    const final = `Sessions: baseline ${baseId}, attempt A ${a.id}, attempt B ${b.id}.\nAttempt A changed: ${changedA.join(", ") || "nothing"}.\nAttempt B changed: ${changedB.join(", ") || "nothing"}.\n\nAttempt B's reply: ${b.run.text}`;
    const baseAfter = { v: `${sessions[baseId].length} messages${sessions[baseId].length === baseLen ? ", unchanged" : ` (was ${baseLen})`}`, tone: sessions[baseId].length === baseLen ? "good" : "bad" };
    const short = (f) => f.replace(/^src\//, "");
    return {
      final,
      compare: {
        cols: [
          { title: "Attempt A: the minimal patch (fork 1)", short: "Attempt A", said: a.run.text,
            verdict: aRight ? `Patched only \`formatDate.js\`, in its own session ${a.id}; the saved baseline stayed at ${baseLen} messages.`
              : `Changed ${changedA.map(short).join(", ") || "nothing"}: ${changedA.length ? "more than the one file it was asked to touch" : "no patch landed"}. Read the live output.` },
          { title: "Attempt B: the larger refactor (fork 2, after the restore)", short: "Attempt B", said: b.run.text,
            verdict: bRight ? `Started from the original files (A's patch rolled back), created \`dates.js\` and updated ${callers.length} caller${callers.length === 1 ? "" : "s"}, in its own session ${b.id}${promptA ? "" : ", with no trace of attempt A's conversation"}.`
              : `Changed ${changedB.map(short).join(", ") || "nothing"}${cleanStart ? "" : ", starting from A's edited files"}. Read the live output: Claude writes each run fresh.` },
        ],
        rows: [
          ["Session id (forked from the baseline)", `${a.id} ← ${baseId}`, `${b.id} ← ${baseId}`],
          ["History copied from the baseline", `${a.copied} messages`, `${b.copied} messages`],
          ["Files at the start", "the checkpoint (original files)", { v: cleanStart ? "the original files, restored" : "attempt A's edited files", tone: cleanStart ? "good" : "bad" }],
          ["Files changed", { v: changedA.map(short).join(", ") || "none", tone: aRight ? "good" : "bad" }, { v: changedB.map(short).join(", ") || "none", tone: bRight ? "good" : "bad" }],
          ["Saw the other attempt's conversation", "no (it ran first)", { v: promptA ? "yes" : "no", tone: promptA ? "bad" : "good" }],
          ["Baseline history afterwards", baseAfter, baseAfter],
        ],
        note: "Both attempts are legitimate: the fork gave each its own session id and a copy of the same analysis. What kept them independent on disk was the checkpoint restore, because a session holds the conversation, not the files.",
      },
      checks: [
        E.check("Three distinct session ids, and the baseline's own history is unchanged", new Set(ids).size === 3 && sessions[baseId].length === baseLen && a.copied === baseLen && b.copied === baseLen),
        E.check("Attempt A changed only src/utils/formatDate.js", changedA.length === 1 && changedA[0] === "src/utils/formatDate.js"),
        E.check("The checkpoint was restored before attempt B: B started from the original files", changedFiles(checkpoint, startB).length === 0 && startB["src/utils/formatDate.js"] === WORKSPACE["src/utils/formatDate.js"]),
        E.check("Attempt B created src/utils/dates.js and updated the callers", changedB.includes("src/utils/dates.js") && callers.length >= 2),
        E.check("Attempt B's fork never saw attempt A's conversation", !promptA),
      ],
    };
  },
};
