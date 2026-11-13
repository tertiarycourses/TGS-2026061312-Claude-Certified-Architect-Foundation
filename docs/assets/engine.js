// The engine behind every simulator lab on this site: a real agentic loop on the Claude Messages API.
// Runs in the browser (GitHub Pages) and in Node (tools/test_lab.mjs) with the same code.
// Every call goes to claude-haiku-5-5 with the learner's own API key. Nothing is pre-recorded.

export const MODEL = "claude-haiku-5-5";
const API = "https://api.anthropic.com/v1/messages";
const PRICE = { in: 0.10 / 1e6, out: 0.50 / 1e6 };       // Haiku 5.5, US$ per token

export function makeSession(apiKey, log) {
  const s = { apiKey, log: log || ((l) => console.log(l)), usage: { input: 0, output: 0, calls: 0 }, stopped: false,
              trace: [],               // one entry per Claude turn: { label, turn, stop_reason, tools, text }
              requests: [],            // every request body sent, so the page can show each call as curl
              step: () => {} };        // the page highlights the loop line that is running: "call" | "check" | "tool" | "append" | "stop"
  s.cost = () => s.usage.input * PRICE.in + s.usage.output * PRICE.out;
  return s;
}

// The same call as a terminal command: what fetch() sends is exactly this HTTPS POST.
export function asCurl(body) {
  const json = JSON.stringify(body, null, 1).replace(/'/g, "'\\''");
  return `curl https://api.anthropic.com/v1/messages \\\n  -H "x-api-key: $ANTHROPIC_API_KEY" \\\n  -H "anthropic-version: 2023-06-01" \\\n  -H "content-type: application/json" \\\n  -d '${json}'`;
}

// One Messages API call. Throws an Error with a readable message on any API error.
// s.apiKey is the key the learner saved in the sidebar (kept in this browser's localStorage);
// MODEL above pins every call in every lab to claude-haiku-5-5.
export async function callClaude(s, body) {
  if (s.stopped) throw new Error("Stopped.");
  s.requests.push({ model: MODEL, max_tokens: 4096, ...body });
  s.onRequest?.(s.requests.at(-1));                        // the page shows the request being sent
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "x-api-key": s.apiKey,                                 // YOUR API key, from the sidebar box
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",   // lets the browser call the API with your own key
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 4096, ...body }),   // model: "claude-haiku-5-5"
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText;
    if (res.status === 401) throw new Error("Your API key was rejected (401). Check it in the API key box.");
    throw new Error(`The API refused the call (${res.status}): ${msg}`);
  }
  s.usage.input += data.usage?.input_tokens || 0;
  s.usage.output += data.usage?.output_tokens || 0;
  s.usage.calls += 1;
  return data;
}

export const short = (v, n = 150) => {
  const t = (typeof v === "string" ? v : JSON.stringify(v)).replace(/\s+/g, " ");
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};
export const textOf = (content) => (content || []).filter((b) => b.type === "text").map((b) => b.text).join("");

// The agentic loop. tools: { name: { description, input_schema, run(input, ctx) } }.
// A tool's run() may return any JSON value; return { isError: true, ... } (or throw) to send an error result.
// preToolUse(name, input, ctx) may return { deny: "reason" } to block a call before it runs (a hook).
// postToolUse(name, input, result, ctx) may return a replacement result (e.g. normalised data).
export async function runAgent(s, o) {
  const tag = o.label ? `${o.label} ` : "";
  const indent = o.label ? "    " : "";
  const toolDefs = Object.entries(o.tools || {}).map(([name, t]) => ({ name, description: t.description, input_schema: t.input_schema, ...(t.strict ? { strict: true } : {}) }));
  const messages = o.messages ? [...o.messages] : [{ role: "user", content: o.prompt }];
  const calls = [];
  const maxTurns = o.maxTurns || 8;
  let resp = null, turn = 0;
  for (turn = 1; turn <= maxTurns; turn++) {
    s.log(`${indent}${tag}Turn ${turn}: POST /v1/messages · model ${MODEL} · ${messages.length} message${messages.length > 1 ? "s" : ""}${turn > 1 ? " (tool results appended)" : ""}`, "turn");
    s.step("call");
    resp = await callClaude(s, {
      system: o.system, messages,
      ...(toolDefs.length ? { tools: toolDefs } : {}),
      ...(o.tool_choice ? { tool_choice: o.tool_choice } : {}),
      ...(o.output_config ? { output_config: o.output_config } : {}),
      ...(o.max_tokens ? { max_tokens: o.max_tokens } : {}),
    });
    messages.push({ role: "assistant", content: resp.content });
    const said = textOf(resp.content).trim();
    if (said && resp.stop_reason === "tool_use") s.log(`${indent}  Claude: ${short(said, 160)}`, "text");
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
    const results = [];
    for (const [i, u] of uses.entries()) {
      s.log(`${indent}  -> ${u.name}(${short(u.input, 120)})`, "call");
      s.step("tool");
      const rec = { name: u.name, input: u.input, turn };
      let out, isError = false;
      const verdict = o.preToolUse ? await o.preToolUse(u.name, u.input, o.ctx) : null;
      if (verdict && verdict.deny) {
        out = { isError: true, blocked_by: "hook", reason: verdict.deny }; isError = true; rec.denied = verdict.deny;
        s.log(`${indent}  !! hook blocked ${u.name}: ${verdict.deny}`, "deny");
      } else {
        const tool = o.tools[u.name];
        try {
          out = tool ? await tool.run(u.input, o.ctx) : { isError: true, message: `No tool called ${u.name}` };
        } catch (e) { out = { isError: true, message: String(e.message || e) }; }
        isError = !!(out && typeof out === "object" && out.isError);
        if (o.postToolUse) { const changed = await o.postToolUse(u.name, u.input, out, o.ctx); if (changed !== undefined) out = changed; }
        s.log(`${indent}  <- ${isError ? "!! error: " : "result: "}${short(out, 150)}`, isError ? "error" : "result");
      }
      rec.result = out; rec.isError = isError; calls.push(rec);
      Object.assign(t.tools[i], { result: out, isError, denied: rec.denied });
      results.push({ type: "tool_result", tool_use_id: u.id, content: typeof out === "string" ? out : JSON.stringify(out), ...(isError ? { is_error: true } : {}) });
    }
    s.step("append");
    messages.push({ role: "user", content: results });
    if (turn === maxTurns) s.log(`${indent}  Turn cap of ${maxTurns} reached: the loop stops here, so a confused agent can't run forever.`, "stop");
  }
  const text = textOf(resp?.content);
  if (text.trim()) s.log(`${indent}${o.label ? tag + "answer" : "Reply"}: ${short(text, o.label ? 220 : 600)}`, "reply");
  return { messages, text, calls, turns: Math.min(turn, maxTurns), stop_reason: resp?.stop_reason };
}

// A small in-memory repository for the Claude Code labs: Read, Grep, Glob, Edit.
export function repo(files) {
  const fs = { ...files };
  const glob = (pat) => {
    const re = new RegExp("^" + pat.replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*\//g, "\u0001").replace(/\*\*/g, "\u0002")             // protect ** before single * is replaced
      .replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]")
      .replace(/\u0001/g, "(?:.*/)?").replace(/\u0002/g, ".*") + "$");
    return Object.keys(fs).filter((f) => re.test(f)).sort();
  };
  return {
    fs, glob,
    tools: {
      Read: { description: "Read a file from the repository. Input: path.", input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
        run: ({ path }) => (path in fs ? fs[path] : { isError: true, message: `No such file: ${path}` }) },
      Grep: { description: "Search file CONTENTS with a regular expression. Optional glob limits which files are searched (e.g. **/*.ts). Returns matching lines as path:line: text.",
        input_schema: { type: "object", properties: { pattern: { type: "string" }, glob: { type: "string" } }, required: ["pattern"] },
        run: ({ pattern, glob: g }) => {
          let re; try { re = new RegExp(pattern); } catch { return { isError: true, message: "Invalid regular expression" }; }
          const hits = [];
          for (const f of g ? glob(g) : Object.keys(fs).sort()) fs[f].split("\n").forEach((ln, i) => { if (re.test(ln)) hits.push(`${f}:${i + 1}: ${ln.trim()}`); });
          return hits.length ? hits.join("\n") : "No matches.";
        } },
      Glob: { description: "Find files by NAME pattern, e.g. **/*.test.ts. Returns matching paths.", input_schema: { type: "object", properties: { pattern: { type: "string" } }, required: ["pattern"] },
        run: ({ pattern }) => glob(pattern).join("\n") || "No files match." },
      Edit: { description: "Replace one exact, unique string in a file with new text.", input_schema: { type: "object", properties: { path: { type: "string" }, old_string: { type: "string" }, new_string: { type: "string" } }, required: ["path", "old_string", "new_string"] },
        run: ({ path, old_string, new_string }) => {
          if (!(path in fs)) return { isError: true, message: `No such file: ${path}` };
          const n = fs[path].split(old_string).length - 1;
          if (n === 0) return { isError: true, message: "old_string not found" };
          if (n > 1) return { isError: true, message: `old_string is not unique (${n} matches): add surrounding lines to make it unique` };
          fs[path] = fs[path].replace(old_string, new_string); return `Edited ${path}`;
        } },
    },
  };
}

// Checks shown under "Read your result": [{ label, pass }]
export const check = (label, pass) => ({ label, pass: !!pass });
export const called = (calls, name) => calls.filter((c) => c.name === name);
export const firstIndex = (calls, name) => calls.findIndex((c) => c.name === name);
