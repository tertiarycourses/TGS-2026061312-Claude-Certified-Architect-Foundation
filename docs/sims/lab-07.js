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
    const base = await E.runAgent(s, {
      system: SYSTEM,
      prompt: "Plan mode investigation only: formatDate in src/utils/formatDate.js crashes on a null date. Read its callers (src/api/orders.js, src/services/*.ts) and report, in five lines, the minimal patch and the larger refactor that would remove the crash class entirely. Do not edit.",
      tools: { ...editTools }, preToolUse: planGate, maxTurns: 6, max_tokens: 1500,
    });
    const baseId = newId();
    sessions[baseId] = base.messages;
    const baseLen = base.messages.length;
    s.log(`Saved baseline session ${baseId} (${baseLen} messages).`, "note");

    s.log("== Step 2 · checkpoint the files, then attempt A in a fork of the baseline", "note");
    const checkpoint = { ...fs };
    const a = await forkAndRun(baseId, "Attempt A from this analysis: implement ONLY the minimal patch to src/utils/formatDate.js. Touch no other file.", 5);
    const changedA = changedFiles(checkpoint, fs);
    s.log(`Attempt A changed: ${changedA.join(", ") || "nothing"}. Without a restore, attempt B would start from these edited files.`, "note");

    s.log("== Step 3 · restore the checkpoint, then attempt B in a second fork of the SAME baseline", "note");
    restore(checkpoint);
    const startB = { ...fs };
    const b = await forkAndRun(baseId, "Attempt B from this analysis: implement the larger refactor you described. Move date formatting into src/utils/dates.js and update every caller.", 10);
    const changedB = changedFiles(checkpoint, fs);
    s.log(`Attempt B changed: ${changedB.join(", ") || "nothing"}.`, "note");

    const ids = [baseId, a.id, b.id];
    const promptA = JSON.stringify(sessions[b.id]).includes("Attempt A from this analysis");
    const callers = ["src/api/orders.js", "src/services/invoice.ts", "src/services/report.ts"].filter((f) => changedB.includes(f));
    const final = `Sessions: baseline ${baseId}, attempt A ${a.id}, attempt B ${b.id}.\nAttempt A changed: ${changedA.join(", ") || "nothing"}.\nAttempt B changed: ${changedB.join(", ") || "nothing"}.\n\nAttempt B's reply: ${b.run.text}`;
    return {
      final,
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
