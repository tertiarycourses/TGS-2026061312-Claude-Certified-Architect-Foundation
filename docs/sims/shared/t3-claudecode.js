// Topic 3 · a faithful, browser-sized emulation of Claude Code on the Messages API.
// Claude Code itself can't run in a web page, so this file does what its harness does, in plain JS:
//   - memory: ~/.claude/CLAUDE.md (user), CLAUDE.md (project) with its @imports, and .claude/rules/*.md
//     without `paths` load at startup, inside a <system-reminder> on the first user message;
//   - path rules: a .claude/rules/*.md file with `paths:` globs (and a CLAUDE.md in a sub-folder) loads
//     only when Claude reads or edits a matching file, appended to that tool result;
//   - skills: .claude/skills/<name>/SKILL.md (a directory, never a loose .md) is invoked as /<name>;
//     `context: fork` runs it as a nested subagent and hands only its answer back to the main session;
//   - permission modes: plan (read tools only; edits blocked until a plan is approved), acceptEdits,
//     default, and dontAsk (print mode: anything outside --allowedTools is denied, nobody can approve);
//   - the CLI: `claude` is an interactive session that waits for the next message, `claude -p` runs one
//     prompt, prints one result to stdout and exits, honouring --max-turns, --output-format, --json-schema.
// Claude is real (claude-haiku-5-5 via E.callClaude, in agentLoop below, which mirrors E.runAgent). The file system
// is an in-memory repo (E.repo).

export const CWD = "/repo";

// ---------------------------------------------------------------- frontmatter and globs
export function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text || "");
  if (!m) return { meta: {}, body: text || "", raw: "" };
  const meta = {}; let key = null;
  for (const ln of m[1].split("\n")) {
    const item = /^\s+-\s*(.+)$/.exec(ln);
    if (item && key) { (meta[key] = Array.isArray(meta[key]) ? meta[key] : []).push(unquote(item[1])); continue; }
    const kv = /^([\w-]+):\s*(.*)$/.exec(ln);
    if (!kv) continue;
    key = kv[1]; const v = kv[2].trim();
    if (!v) meta[key] = [];
    else if (v.startsWith("[") && key !== "argument-hint") meta[key] = v.slice(1, -1).split(",").map((x) => unquote(x)).filter(Boolean);
    else meta[key] = unquote(v);
  }
  return { meta, body: text.slice(m[0].length), raw: m[0] };
}
const unquote = (v) => v.trim().replace(/^["']|["']$/g, "");
const list = (v) => (Array.isArray(v) ? v : String(v || "").split(",")).map((x) => x.trim()).filter(Boolean);

// Glob to RegExp with the usual rules: ** crosses folders (and may match none), * and ? stay inside one.
export function globRe(pat) {
  let re = "";
  for (let i = 0; i < pat.length; i++) {
    const c = pat[i];
    if (c === "*" && pat[i + 1] === "*") { if (pat[i + 2] === "/") { re += "(?:.*/)?"; i += 2; } else { re += ".*"; i += 1; } }
    else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp("^" + re + "$");
}
// Every string Claude was sent or wrote in a conversation (text, tool inputs, tool results).
export function contextText(messages) {
  const out = [];
  const walk = (v) => { if (typeof v === "string") out.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v).forEach(walk); };
  walk(messages);
  return out.join("\n");
}
export const matchesAny = (path, globs) => list(globs).some((g) => globRe(g).test(path));

// ---------------------------------------------------------------- memory (CLAUDE.md, @imports, rules)
const LABEL = {
  user: "user's private global instructions for all projects",
  project: "project instructions, checked into the codebase",
  rule: "project rule, checked into the codebase",
};
const show = (p) => (p.startsWith("~") ? p : `${CWD}/${p}`);

// Resolve @path imports outside code spans and fences, recursively (Claude Code allows 5 hops).
function withImports(fs, path, depth, seen, out, kind) {
  if (seen.has(path) || !(path in fs)) return;
  seen.add(path);
  out.push({ path, kind, why: depth ? `imported with @${path}` : "", body: fs[path] });
  if (depth >= 5) return;
  let fence = false;
  for (const ln of fs[path].split("\n")) {
    if (/^\s*```/.test(ln)) { fence = !fence; continue; }
    if (fence) continue;
    for (const m of ln.replace(/`[^`]*`/g, "").matchAll(/(?:^|\s)@([\w./~-]+)/g)) {
      const target = m[1].replace(/^\.\//, "");
      if (target in fs) withImports(fs, target, depth + 1, seen, out, kind);
    }
  }
}

// What Claude Code loads at startup, in order.
export function startupMemory(fs) {
  const out = [], seen = new Set();
  if ("~/.claude/CLAUDE.md" in fs) withImports(fs, "~/.claude/CLAUDE.md", 0, seen, out, "user");
  for (const p of ["CLAUDE.md", ".claude/CLAUDE.md"]) withImports(fs, p, 0, seen, out, "project");
  for (const p of Object.keys(fs).sort()) {
    if (!/^\.claude\/rules\/.+\.md$/.test(p)) continue;
    if (!frontmatter(fs[p]).meta.paths) out.push({ path: p, kind: "rule", why: "no paths: frontmatter, so it loads at startup", body: fs[p] });
  }
  return out;
}

// What loads when Claude touches `path`: CLAUDE.md files in its sub-folders, and rules whose paths match.
export function pathMemory(fs, path, already) {
  const out = [];
  const parts = path.split("/");
  for (let i = 1; i < parts.length; i++) {
    const p = parts.slice(0, i).join("/") + "/CLAUDE.md";
    if (p in fs && !already.has(p)) out.push({ path: p, kind: "project", why: `${path} is inside ${parts.slice(0, i).join("/")}/`, body: fs[p] });
  }
  for (const p of Object.keys(fs).sort()) {
    if (!/^\.claude\/rules\/.+\.md$/.test(p) || already.has(p)) continue;
    const globs = frontmatter(fs[p]).meta.paths;
    if (globs && matchesAny(path, globs)) out.push({ path: p, kind: "rule", why: `${path} matches paths: ${list(globs).join(", ")}`, body: fs[p] });
  }
  return out;
}

const entry = (e) => `Contents of ${show(e.path)} (${LABEL[e.kind]}):\n\n${frontmatter(e.body).body.trim()}`;
export const memoryReminder = (entries) => entries.length ? "<system-reminder>\nAs you answer the user's questions, you can use the following context:\n# claudeMd\n" +
  "Codebase and user instructions are shown below. Be sure to adhere to these instructions. IMPORTANT: These instructions OVERRIDE any default behavior and you MUST follow them exactly as written.\n\n" +
  entries.map(entry).join("\n\n") + "\n</system-reminder>\n\n" : "";

const PLAN_REMINDER = "\n\n<system-reminder>\nPlan mode is active. The user indicated that they do not want you to execute yet -- you MUST NOT make any edits, run any non-readonly tools, or otherwise make any changes to the system. This supersedes any other instructions you have received. Research with the read-only tools, then present your plan by calling the ExitPlanMode tool, which asks the user to approve it.\n</system-reminder>";

export function systemPrompt(mode, extra = "") {
  return `You are Claude Code, Anthropic's official CLI for Claude. You are an agent that helps users with software engineering tasks. Use the instructions below and the tools available to you to assist the user.

# Doing tasks
- Read a file before you change it, and keep changes to what was asked.
- Use Grep to search file contents, Glob to find files by name, Read to open one file.
- Be concise: lead with the answer. No preamble.

# Environment
Working directory: ${CWD} (pass repository paths relative to it, e.g. src/api/orders.js)
Is directory a git repo: Yes
Model: claude-haiku-5-5
Permission mode: ${mode}${extra ? "\n\n" + extra : ""}`;
}

// ---------------------------------------------------------------- the file system and its tools
export function workspace(E, files) {
  const r = E.repo(files);
  return { fs: r.fs, base: r.tools, glob: r.glob, initial: { ...r.fs } };
}

// A short content hash per file (FNV-1a): identical before and after proves nothing was edited.
export function hashTree(fs) {
  const out = {};
  for (const [p, t] of Object.entries(fs)) {
    let h = 0x811c9dc5;
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    out[p] = h.toString(16).padStart(8, "0");
  }
  return out;
}
export const changedFiles = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]).sort();

const norm = (p) => String(p || "").trim().replace(/^\/repo\//, "").replace(/^\.\//, "").replace(/^\//, "");
const READ_ONLY = new Set(["Read", "Grep", "Glob"]);


// ---------------------------------------------------------------- the loop, with Claude Code's attachments
// The same agentic loop as runAgent() in assets/engine.js (same log lines, trace, hooks and turn cap), plus one
// harness feature runAgent lacks: attachments. When a Read loads a path rule or a sub-folder CLAUDE.md, Claude
// Code adds it to the next user turn as its own <system-reminder> text block after the tool results. It is NOT
// pasted into the tool output, where Claude would rightly treat instructions as untrusted file content.
export async function agentLoop(s, E, o) {
  const tag = o.label ? `${o.label} ` : "", indent = o.label ? "    " : "";
  const toolDefs = Object.entries(o.tools || {}).map(([name, t]) => ({ name, description: t.description, input_schema: t.input_schema }));
  const messages = o.messages ? [...o.messages] : [{ role: "user", content: o.prompt }];
  const calls = [], maxTurns = o.maxTurns || 8;
  let resp = null, turn = 0;
  for (turn = 1; turn <= maxTurns; turn++) {
    s.log(`${indent}${tag}Turn ${turn}: sending the conversation to Claude${turn > 1 ? ", with the tool results appended" : ""}`, "turn");
    s.step("call");
    resp = await E.callClaude(s, { system: o.system, messages, ...(toolDefs.length ? { tools: toolDefs } : {}),
      ...(o.output_config ? { output_config: o.output_config } : {}), ...(o.max_tokens ? { max_tokens: o.max_tokens } : {}) });
    messages.push({ role: "assistant", content: resp.content });
    const said = E.textOf(resp.content).trim();
    if (said && resp.stop_reason === "tool_use") s.log(`${indent}  Claude: ${E.short(said, 160)}`, "text");
    const uses = resp.content.filter((b) => b.type === "tool_use");
    s.step("check");
    const t = { label: o.label || "", turn, stop_reason: resp.stop_reason, tools: uses.map((u) => ({ name: u.name, input: u.input })), text: said };
    s.trace.push(t);
    if (resp.stop_reason !== "tool_use") {
      s.step("stop");
      s.log(`${indent}  stop_reason: ${resp.stop_reason} -> STOP: Claude has finished${o.label ? " (the subagent returns its answer)" : ""}`, "stop");
      break;
    }
    s.log(`${indent}  stop_reason: tool_use -> CONTINUE: run the tool${uses.length > 1 ? "s" : ""}, append the result${uses.length > 1 ? "s" : ""}, call Claude again`, "stop");
    const results = [], attach = [];
    for (const [i, u] of uses.entries()) {
      s.log(`${indent}  -> ${u.name}(${E.short(u.input, 120)})`, "call");
      s.step("tool");
      const rec = { name: u.name, input: u.input, turn };
      let out, isError = false;
      const verdict = o.preToolUse ? await o.preToolUse(u.name, u.input) : null;
      if (verdict && verdict.deny) {
        out = { isError: true, blocked_by: "permission", reason: verdict.deny }; isError = true; rec.denied = verdict.deny;
        s.log(`${indent}  !! Claude Code blocked ${u.name}: ${verdict.deny}`, "deny");
      } else {
        const tool = o.tools[u.name];
        try { out = tool ? await tool.run(u.input, attach) : { isError: true, message: `No tool called ${u.name}` }; }
        catch (e) { out = { isError: true, message: String(e.message || e) }; }
        isError = !!(out && typeof out === "object" && out.isError);
        s.log(`${indent}  <- ${isError ? "!! error: " : "result: "}${E.short(out, 150)}`, isError ? "error" : "result");
      }
      rec.result = out; rec.isError = isError; calls.push(rec);
      Object.assign(t.tools[i], { result: out, isError, denied: rec.denied });
      results.push({ type: "tool_result", tool_use_id: u.id, content: typeof out === "string" ? out : JSON.stringify(out), ...(isError ? { is_error: true } : {}) });
    }
    s.step("append");
    messages.push({ role: "user", content: [...results, ...attach.map((text) => ({ type: "text", text }))] });
    if (turn === maxTurns) s.log(`${indent}  Turn cap of ${maxTurns} reached: the loop stops here, so a confused agent can't run forever.`, "stop");
  }
  const text = E.textOf(resp?.content);
  if (text.trim()) s.log(`${indent}${o.label ? tag + "answer" : "Reply"}: ${E.short(text, o.label ? 220 : 600)}`, "reply");
  return { messages, text, calls, turns: Math.min(turn, maxTurns), stop_reason: resp?.stop_reason };
}

// ---------------------------------------------------------------- one Claude Code session
// o: { prompt, mode, tools: ["Read","Grep","Glob","Edit","Write"], allowedTools, maxTurns, label, output_config,
//      memory: false to skip startup memory (a forked skill inherits none), echoMemory: log what loaded }
export async function session(s, E, ws, o) {
  const mode = o.mode || "default";
  const ind = o.label ? "    " : "";
  const allowed = new Set(list(o.allowedTools || []).map((t) => t.replace(/\(.*\)$/, "")));
  const loaded = new Set(), loadedLog = [], reads = new Set(), asks = [];
  let plan = null;

  const start = o.memory === false ? [] : startupMemory(ws.fs);
  for (const e of start) loaded.add(e.path);
  if (o.echoMemory !== false && start.length) {
    s.log(`${ind}[Claude Code] startup context: ${start.length} instruction file${start.length > 1 ? "s" : ""}`, "note");
    for (const e of start) s.log(`${ind}   loaded ${show(e.path)}  (${e.kind}${e.why ? ", " + e.why : ""})`, "note");
  }
  const names = o.tools || ["Read", "Grep", "Glob"];
  const tools = {};
  const touch = (path, attach) => {
    for (const e of pathMemory(ws.fs, path, loaded)) {
      loaded.add(e.path); loadedLog.push({ ...e, trigger: path });
      s.log(`${ind}   [Claude Code] ${e.why} -> loaded ${show(e.path)} into context`, "note");
      attach.push(`<system-reminder>\nYou just worked with ${path}, so Claude Code loaded the instructions below for it. Be sure to adhere to these instructions. IMPORTANT: These instructions OVERRIDE any default behavior and you MUST follow them exactly as written.\n\n${entry(e)}\n</system-reminder>`);
    }
  };
  for (const n of names) {
    if (n === "Read") tools.Read = { ...ws.base.Read, description: "Read a file from the repository. Input: path (relative to the working directory).",
      run: ({ path }, attach) => { const p = norm(path); if (!(p in ws.fs)) return { isError: true, message: `File does not exist: ${p}` }; reads.add(p); touch(p, attach); return ws.fs[p]; } };
    if (n === "Grep") tools.Grep = { ...ws.base.Grep, run: (i) => ws.base.Grep.run({ ...i, glob: i.glob ? norm(i.glob) : i.glob }) };
    if (n === "Glob") tools.Glob = { ...ws.base.Glob, run: (i) => ws.base.Glob.run({ pattern: norm(i.pattern) }) };
    if (n === "Edit") tools.Edit = { ...ws.base.Edit,
      run: (i, attach) => { const p = norm(i.path); if (p in ws.fs && !reads.has(p)) return { isError: true, message: "File has not been read yet. Read it first before writing to it." };
        const r = ws.base.Edit.run({ ...i, path: p }); if (typeof r === "string") touch(p, attach); return r; } };
    if (n === "Write") tools.Write = { description: "Create or overwrite a file. Input: path, content. An existing file must be Read first.",
      input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
      run: ({ path, content }, attach) => { const p = norm(path); if (p in ws.fs && !reads.has(p)) return { isError: true, message: "File has not been read yet. Read it first before writing to it." };
        ws.fs[p] = String(content); reads.add(p); touch(p, attach); return `Wrote ${p}`; } };
  }
  if (mode === "plan") tools.ExitPlanMode = {
    description: "Call this when you have finished researching in plan mode and are ready to present your implementation plan to the user for approval. Input: plan (Markdown).",
    input_schema: { type: "object", properties: { plan: { type: "string" } }, required: ["plan"] },
    run: ({ plan: p }) => { plan = String(p || ""); return "The plan is now in front of the user. They will approve or change it before any file is edited. Do not edit anything; end your turn with a one-line summary."; } };

  const preToolUse = (name, input) => {
    if (mode === "plan" && (name === "Edit" || name === "Write")) return { deny: "Plan mode is active: file edits are blocked until the user approves a plan (ExitPlanMode)." };
    if (mode === "dontAsk" && name !== "ExitPlanMode" && !allowed.has(name)) return { deny: `Permission to use ${name} has not been granted (not in --allowedTools), and nobody is there to approve it.` };
    if (mode === "default" && !READ_ONLY.has(name) && !allowed.has(name)) return { deny: `${name} needs your approval and nobody approved it in this emulation.` };
    if (!allowed.has(name) && name !== "ExitPlanMode") asks.push({ name, input });
    return null;
  };

  const prompt = (o.memory === false ? "" : memoryReminder(start)) + o.prompt + (mode === "plan" ? PLAN_REMINDER : "");
  const run = await agentLoop(s, E, {
    system: systemPrompt(mode, o.extraSystem), prompt, tools, preToolUse, label: o.label, maxTurns: o.maxTurns || 8,
    ...(o.output_config ? { output_config: o.output_config } : {}), ...(o.max_tokens ? { max_tokens: o.max_tokens } : {}),
  });
  return { ...run, loaded: [...loaded], pathLoaded: loadedLog, reads: [...reads], plan, notPreApproved: asks, mode };
}

// ---------------------------------------------------------------- skills and slash commands
export function discoverSkills(fs) {
  const skills = {}, ignored = [];
  for (const p of Object.keys(fs).sort()) {
    const dir = /^\.claude\/skills\/([^/]+)\/SKILL\.md$/.exec(p);
    if (dir) { const { meta, body } = frontmatter(fs[p]); skills[meta.name || dir[1]] = { path: p, meta, body }; continue; }
    if (/^\.claude\/skills\/[^/]+\.md$/.test(p)) ignored.push(p);
  }
  return { skills, ignored };
}
export const autocomplete = (skills) => Object.entries(skills).map(([n, sk]) => `/${n} ${sk.meta["argument-hint"] || ""}`.trimEnd() + `   ${sk.meta.description || ""}`);

// The user types "/name args". o: { tools, maxTurns, mainTools }
export async function slash(s, E, ws, line, o = {}) {
  const [, name, args = ""] = /^\/([\w-]+)\s*(.*)$/.exec(line.trim()) || [];
  const { skills } = discoverSkills(ws.fs);
  const sk = skills[name];
  if (!sk) { s.log(`> ${line}`, "call"); s.log(`  Unknown skill: /${name} (Claude Code looks for .claude/skills/${name}/SKILL.md)`, "error"); return { unknown: true }; }
  const body = sk.body.replace(/\$ARGUMENTS/g, args.trim()).trim();
  const ctx = sk.meta.context || "main";
  const allowedTools = list(sk.meta["allowed-tools"]);
  s.log(`> ${line}`, "call");
  s.log(`  [Claude Code] skill ${sk.path}: context: ${ctx} · allowed-tools: ${allowedTools.join(", ") || "(none)"} · argument-hint: ${sk.meta["argument-hint"] || "(none)"}`, "note");
  const header = `<command-name>/${name}</command-name>\n<command-args>${args.trim()}</command-args>\n\n`;
  if (ctx === "fork") {
    s.log(`  [Claude Code] context: fork -> the skill runs in a fresh subagent context; only its final answer returns`, "note");
    const sub = await session(s, E, ws, { prompt: body, label: "(subagent)", tools: o.tools || ["Read", "Grep", "Glob"], allowedTools, mode: "default", maxTurns: o.maxTurns || 8, memory: false });
    const main = await E.runAgent(s, { system: systemPrompt("default"), maxTurns: 1, max_tokens: 300,
      prompt: header + `<skill-result context="fork">\n${sub.text}\n</skill-result>\n\nTell the user the outcome in one or two lines.` });
    return { ctx, sub, main, mainMessages: main.messages };
  }
  s.log(`  [Claude Code] context: ${ctx} -> the skill's instructions run inside the main conversation`, "note");
  const main = await session(s, E, ws, { prompt: header + body, tools: o.tools || ["Read", "Grep", "Glob"], allowedTools, mode: "default", maxTurns: o.maxTurns || 8, echoMemory: false });
  return { ctx, main, mainMessages: main.messages };
}

// ---------------------------------------------------------------- the CLI: interactive vs print mode
export function parseArgs(argv) {
  const a = { print: false, prompt: "", outputFormat: "text", maxTurns: null, allowedTools: [], schema: null, mode: null };
  for (let i = 1; i < argv.length; i++) {
    const t = argv[i];
    if (t === "-p" || t === "--print") a.print = true;
    else if (t === "--output-format") a.outputFormat = argv[++i];
    else if (t === "--max-turns") a.maxTurns = Number(argv[++i]);
    else if (t === "--allowedTools") a.allowedTools = list(argv[++i]);
    else if (t === "--json-schema") a.schema = JSON.parse(argv[++i]);
    else if (t === "--permission-mode") a.mode = argv[++i];
    else if (!t.startsWith("-")) a.prompt = t;
  }
  return a;
}
const quoteArg = (t) => (/[\s"{}]/.test(t) ? JSON.stringify(t.length > 60 ? t.slice(0, 57) + "…" : t) : t);
export const showCmd = (argv) => argv.map(quoteArg).join(" ");
const uuid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => ((Math.random() * 16) | 0).toString(16)));

// Run one CI step. o: { jobTimeoutMin }. Returns { exitCode, stdout, hung, envelope, run, seconds }.
export async function ciStep(s, E, ws, argv, o = {}) {
  const a = parseArgs(argv);
  const t0 = Date.now(), cost0 = s.cost();
  s.log(`$ ${showCmd(argv)}`, "call");
  if (!a.print) {
    s.log(`  [runner] stdin is not a terminal. Claude Code opens an interactive session anyway.`, "note");
    if (a.outputFormat !== "text") s.log(`  [Claude Code] --output-format only applies with --print; the interactive session ignores it`, "deny");
    const run = await session(s, E, ws, { prompt: a.prompt, mode: a.mode || "default", tools: ["Read", "Grep", "Glob"], allowedTools: a.allowedTools, maxTurns: a.maxTurns || 6, echoMemory: false });
    const secs = (Date.now() - t0) / 1000;
    s.log(`  [runner] ${secs.toFixed(1)} s: Claude has replied. The session now shows the > prompt and waits for the next message.`, "note");
    s.log(`  [runner] Nobody can type in a CI runner, and Claude has no tool that ends the process. Waiting...`, "note");
    s.log(`  [runner] ${o.jobTimeoutMin || 30}:00 job timeout reached: runner sends SIGTERM. Exit code 124. No result on stdout.`, "deny");
    return { exitCode: 124, stdout: "", hung: true, run, seconds: secs, waitedMin: o.jobTimeoutMin || 30 };
  }
  const run = await session(s, E, ws, {
    prompt: a.prompt, mode: a.mode || "dontAsk", tools: ["Read", "Grep", "Glob"], allowedTools: a.allowedTools, maxTurns: a.maxTurns || 10, echoMemory: false,
    ...(a.schema ? { output_config: { format: { type: "json_schema", schema: a.schema } } } : {}),
  });
  const ok = run.stop_reason === "end_turn";
  let structured = null;
  if (a.schema && ok) { try { structured = JSON.parse(run.text); } catch { structured = null; } }
  const envelope = { type: "result", subtype: ok ? "success" : "error_max_turns", is_error: !ok, duration_ms: Date.now() - t0, num_turns: run.turns,
    result: run.text, session_id: uuid(), total_cost_usd: Number((s.cost() - cost0).toFixed(6)), ...(a.schema ? { structured_output: structured } : {}) };
  const stdout = a.outputFormat === "json" ? JSON.stringify(envelope) : run.text;
  const exitCode = ok ? 0 : 1;
  s.log(`  [runner] process exited with code ${exitCode} after ${(envelope.duration_ms / 1000).toFixed(1)} s`, exitCode ? "deny" : "stop");
  return { exitCode, stdout, hung: false, envelope, run, seconds: envelope.duration_ms / 1000 };
}

// Print a config file into the log so learners see exactly what the emulation used.
export function showFile(s, path, text, max = 14) {
  const lines = String(text).replace(/\n$/, "").split("\n");
  s.log(`  ┌ ${show(path)}`, "note");
  for (const ln of lines.slice(0, max)) s.log(`  │ ${ln}`, "result");
  if (lines.length > max) s.log(`  │ … (${lines.length - max} more lines)`, "result");
}
