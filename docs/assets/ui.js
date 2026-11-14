// Page layer for the simulator site: sidebar (API key + the five topics), the home page and each lab page.
import * as E from "./engine.js";
import { DIAGRAMS, HOOKS_SVG, patternBox, runMap } from "./diagrams.js";
// Eye icons for the API key field (show / hide the key).
const EYE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>';

const KEY = "ccarf_anthropic_key";
const COL = { 1: "#C9603A", 2: "#2F6F6D", 3: "#A84F2E", 4: "#A06A12", 5: "#A93F32" };
const SIMCOL = { 1: "#C9603A", 2: "#2F6F6D", 3: "#5B4BB8", 4: "#A06A12", 5: "#A84F2E", 6: "#A93F32" };
const REPO = "https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation";
const EXAM = "https://exams.tertiaryinfotech.com/practice-exams/anthropic/anthropic-cca-foundations";
const $ = (s, r = document) => r.querySelector(s);
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const md = (t) => esc(t).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
export const getKey = () => localStorage.getItem(KEY) || "";

// The loop every lab runs, as learners see it while it runs. Each line's id matches the step the engine reports.
const LOOP = [
  ["", "messages = [ user message ]"],
  ["", "for turn in 1..10:              # turn cap"],
  ["call", "  r = claude(model=\"claude-haiku-5-5\","],
  ["call", "             api_key=YOUR_KEY,"],
  ["call", "             messages, tools)  # POST"],
  ["check", "  if r.stop_reason != \"tool_use\":"],
  ["stop", "    break                       # end_turn"],
  ["tool", "  results = run_tools(r)        # hooks"],
  ["append", "  messages += [r, results]      # go again"],
]
const LOOP_HTML = LOOP.map(([id, t]) => `<span data-step="${id}">${esc(t)}</span>`).join("\n");

// The agentic loop as a diagram. Node ids match the engine's step ids, so the running step lights up.
const LOOP_SVG = `
<svg class="loopsvg" viewBox="0 0 760 250" role="img" aria-label="The agentic loop: user message, Claude, check stop_reason, run tools, append results, back to Claude; end_turn gives the final answer">
  <defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#5F5C56"/></marker><marker id="ar-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#C9603A"/></marker></defs>
  <g class="n" data-step="start"><rect x="10" y="95" width="120" height="58" rx="8"/><text x="70" y="120">User</text><text x="70" y="138" class="s">message</text></g>
  <g class="n" data-step="call"><rect x="175" y="95" width="150" height="58" rx="8"/><text x="250" y="118">Claude</text><text x="250" y="137" class="s">claude-haiku-5-5</text></g>
  <g class="n" data-step="check"><polygon points="440,82 520,124 440,166 360,124"/><text x="440" y="120">stop_</text><text x="440" y="136">reason?</text></g>
  <g class="n" data-step="tool"><rect x="560" y="10" width="170" height="58" rx="8"/><text x="645" y="34">Run the tool</text><text x="645" y="53" class="s">hooks may block it</text></g>
  <g class="n" data-step="append"><rect x="175" y="10" width="150" height="58" rx="8"/><text x="250" y="34">Append</text><text x="250" y="53" class="s">every tool_result</text></g>
  <g class="n" data-step="stop"><rect x="560" y="180" width="170" height="58" rx="8"/><text x="645" y="204">Final answer</text><text x="645" y="223" class="s">loop stops</text></g>
  <path data-e="start-call" d="M130,124 L172,124" marker-end="url(#ar)"/>
  <path data-e="call-check" d="M325,124 L357,124" marker-end="url(#ar)"/>
  <path data-e="check-tool" d="M440,82 L440,39 L557,39" marker-end="url(#ar)"/><text x="480" y="32" class="lbl">tool_use</text>
  <path data-e="check-stop" d="M440,166 L440,209 L557,209" marker-end="url(#ar)"/><text x="482" y="226" class="lbl">end_turn</text>
  <path data-e="tool-append" d="M645,10 L645,2 L250,2 L250,7" marker-end="url(#ar)"/>
  <path data-e="append-call" d="M250,68 L250,92" marker-end="url(#ar)"/>
</svg>`;

async function data() {
  const [labs, sims, day2] = await Promise.all(["data/labs.json", "data/sims.json", "data/day2.json"].map((f) => fetch(f).then((r) => r.json())));
  return { labs, sims, day2 };
}

function sidebar(D, here) {
  const byTopic = {};
  for (const l of D.labs) (byTopic[l.topic] ||= []).push(l);
  const nav = Object.entries(byTopic).map(([t, ls]) =>
    `<div class="topic" style="--c:${COL[t]}">Topic ${t}: ${esc(ls[0].topic_name)}</div>` +
    ls.map((l) => `<a class="task ${here === l.id ? "on" : ""}" href="lab.html?n=${l.id}" title="${esc(l.task_title)}"><b>${l.task}</b> · Lab ${l.id}</a>`).join("")).join("");
  $("aside").innerHTML = `
    <div class="brand">TGS-2026061312 · Simulators</div>
    <div class="course">Claude Certified Architect Foundation</div>
    <div class="keybox">
      <div>Anthropic API key: <span class="keystate"></span></div>
      <div class="keyrow"><input type="password" id="key" placeholder="sk-ant-..." autocomplete="off" spellcheck="false"><button id="show" class="eye" type="button" title="Show the key" aria-label="Show the key">${EYE}</button></div>
      <div class="row"><button id="save">Save</button><button id="test">Test</button><button id="clear">Clear</button></div>
      <div id="keymsg" class="keymsg"></div>
      <div class="caption" style="margin-top:6px">Saved only in this browser and sent only to Anthropic. Every lab calls <code>claude-haiku-5-5</code>.</div>
    </div>
    <nav><h4>Start</h4><a href="index.html" class="${here === 0 ? "on" : ""}">All topics and simulators</a>
    <h4>Day 1 · one lab per task statement</h4>${nav}
    <h4>Day 2 · build it yourself</h4>${D.day2.map((l) => `<a class="task" href="guides/${l.slug}.html"><b>Lab ${l.id}</b> · ${esc(l.short)}</a>`).join("")}
    <h4>After class</h4><a href="${EXAM}">Practice exam</a><a href="${REPO}">GitHub repository</a></nav>`;
  const msg = (text, ok) => { const m = $("#keymsg"); m.textContent = text; m.className = "keymsg " + (ok === undefined ? "" : ok ? "ok" : "no"); };
  const show = () => { const k = getKey(); const st = $(".keystate"); st.textContent = k ? "saved" : "not set"; st.className = "keystate " + (k ? "ok" : "no"); $("#key").value = k; };
  show();
  $("#show").onclick = () => { const i = $("#key"); const hidden = i.type === "password"; i.type = hidden ? "text" : "password"; const b = $("#show"); b.innerHTML = hidden ? EYE_OFF : EYE; b.title = hidden ? "Hide the key" : "Show the key"; b.setAttribute("aria-label", b.title); };
  $("#save").onclick = () => {
    const v = $("#key").value.trim();
    if (!v.startsWith("sk-ant-")) { msg("That doesn't look like an Anthropic API key. It starts with sk-ant-.", false); return; }
    localStorage.setItem(KEY, v); show(); msg("Key saved in this browser. Press Test to check it.", true);
  };
  $("#clear").onclick = () => { localStorage.removeItem(KEY); show(); msg("Key removed from this browser.", true); };
  $("#test").onclick = async () => {
    const k = getKey(); if (!k) { msg("Save a key first.", false); return; }
    msg("Testing: one short call to claude-haiku-5-5…");
    const s = E.makeSession(k, () => {});
    try { await E.callClaude(s, { max_tokens: 20, messages: [{ role: "user", content: "Say OK." }] }); msg("Key works: claude-haiku-5-5 answered.", true); }
    catch (e) { msg(e.message, false); }
  };
}

export async function home() {
  const D = await data(); sidebar(D, 0);
  const byTopic = {}; for (const l of D.labs) (byTopic[l.topic] ||= []).push(l);
  $("main").innerHTML = `
    <div class="kicker">TGS-2026061312 · Claude Certified Architect Foundation</div>
    <h1>Five domains, 30 task statements, 30 live labs</h1>
    <p>Day 1 follows the exam guide: each topic is one exam domain, and each task statement has one lab. Every lab runs the same way: read the <b>task statement</b>, answer an <b>exam-style question</b>, press <b>Simulate it live</b> and watch the code run, read <b>Claude's final output</b>, then the <b>observation explained</b>, turn by turn. The customers, orders and repositories are simulated. Claude is real: Claude Haiku 5.5 on your own API key, called from this page.</p>
    ${getKey() ? "" : `<div class="fb no"><b>No API key yet.</b> Paste your Anthropic API key into the box on the left and press <b>Save key</b>. It stays in this browser.</div>`}
    ${Object.entries(byTopic).map(([t, ls]) => `<h2 style="color:${COL[t]}">Topic ${t} · Domain ${t}: ${esc(ls[0].topic_name)}</h2>
      <table><tr><th>Lab</th><th>Task statement</th><th>Simulator</th></tr>${ls.map((l) => `<tr><td class="n">${l.id}</td><td><a href="lab.html?n=${l.id}"><b>${l.task}</b> ${esc(l.task_title)}</a><br><span class="caption">${esc(l.title)}</span></td><td>${l.sim}. ${esc(l.sim_name)}</td></tr>`).join("")}</table>`).join("")}
    <h2>The six simulators (the exam's six scenarios)</h2>
    <div class="grid">${D.sims.map((s) => `<div class="simcard" style="--c:${SIMCOL[s.n]}"><div class="n">SIMULATOR ${s.n}</div><b>${esc(s.name)}</b><div class="caption">${esc(s.tagline)}</div><div class="caption">Labs ${D.labs.filter((l) => l.sim === s.n).map((l) => `<a href="lab.html?n=${l.id}">${l.id}</a>`).join(", ")}</div></div>`).join("")}</div>
    <h2>Day 2 · build it yourself, as a developer</h2>
    <p>Ten hands-on builds, two per domain, in curl, the Python SDK and Claude Code. Each one has its code, a step-by-step guide and a real run to compare with.</p>
    <table><tr><th>Lab</th><th>What you build</th></tr>${D.day2.map((l) => `<tr><td class="n">${l.id}</td><td><a href="guides/${l.slug}.html">${esc(l.title)}</a> <span class="caption">Task ${l.tasks.join(", ")}</span></td></tr>`).join("")}</table>
    <footer>© Tertiary Infotech Academy Pte Ltd · UEN 201200696W · Practice questions include SkillCertPro's Part 1 practice exam (third-party, unofficial) and the exam guide's samples.</footer>`;
}

export async function lab() {
  const D = await data();
  const n = Number(new URLSearchParams(location.search).get("n") || 1);
  const l = D.labs.find((x) => x.id === n); sidebar(D, n);
  if (!l) { $("main").innerHTML = "<h1>Lab not found</h1>"; return; }
  const pad = String(n).padStart(2, "0");
  let spec;
  try { spec = (await import(`../sims/lab-${pad}.js`)).default; }
  catch { $("main").innerHTML = `<div class="kicker">Topic ${l.topic}: ${esc(l.topic_name)}</div><h1>Lab ${n}: ${esc(l.title)}</h1><div class="task-card" style="--c:${COL[l.topic]}"><div class="lbl">Task statement ${l.task}</div><b>${esc(l.task_title)}</b></div><div class="fb no">This lab's live simulation is being built and will appear here shortly. Lab 1 is ready now.</div>`; return; }
  const src = await fetch(`sims/lab-${pad}.js`).then((r) => r.text());
  const shared = [...src.matchAll(/from "\.\/shared\/([\w-]+\.js)"/g)].map((m) => m[1]);
  const sharedSrc = await Promise.all(shared.map((f) => fetch(`sims/shared/${f}`).then((r) => r.text())));
  const engineSrc = await fetch("assets/engine.js").then((r) => r.text());
  const loop = engineSrc.slice(engineSrc.indexOf("export async function runAgent"), engineSrc.indexOf("// A small in-memory repository"));
  const callSrc = engineSrc.slice(engineSrc.indexOf("export const MODEL"), engineSrc.indexOf("export function makeSession")) + "...\n\n" +
    engineSrc.slice(engineSrc.indexOf("// One Messages API call."), engineSrc.indexOf("export const short"));
  const DG = DIAGRAMS[n];
  const prev = D.labs.find((x) => x.id === n - 1), next = D.labs.find((x) => x.id === n + 1);
  document.title = `Lab ${n}: ${l.title}`;
  $("main").innerHTML = `
    <a class="crumb" href="index.html">◀ All labs: the main lab page</a>
    <div class="kicker" style="color:${COL[l.topic]}">Topic ${l.topic}: ${esc(l.topic_name)} · Simulator ${l.sim}: ${esc(l.sim_name)}</div>
    <h1>Lab ${n}: ${esc(l.title)}</h1>
    <div class="task-card" style="--c:${COL[l.topic]}"><div class="lbl">Task statement ${l.task}</div><div><b>${esc(l.task_title)}</b></div></div>
    <details><summary>Lab instructions</summary><ol>
      <li>Read the question and click the answer you'd choose. The page tells you at once whether it's right, and why.</li>
      <li>Press <b>Simulate it live</b>. Watch the code run on the left and the live output on the right: every turn, tool call and stop_reason, from Claude Haiku 5.5 on your API key.</li>
      <li>Read <b>Claude's final output</b>, then <b>the observation explained, turn by turn</b>, and the checks on what Claude actually did.</li>
      <li>Open <b>See the full code this lab runs</b> to read every line, then the exam tip.</li></ol>
      <div class="caption">Scenario: ${esc(D.sims.find((s) => s.n === l.sim)?.scenario || "")}</div></details>
    <h2>1 · The question</h2>
    <p>${md(l.stem)}</p>
    <div class="opts">${Object.entries(l.options).map(([k, v]) => `<label data-k="${k}"><input type="radio" name="pick" value="${k}"> <span><b>${k}.</b> ${md(v)}</span></label>`).join("")}</div>
    <div id="fb"></div>
    <h2>2 · Simulate it live</h2>
    <p><b>What to look for:</b> ${md(spec.see || l.see)}</p>
    <button class="primary" id="run">▶ Simulate it live</button>
    <div class="caption" id="runnote" style="margin:6px 0">Runs on claude-haiku-5-5 with your API key. A run usually costs well under one US cent.</div>
    ${DG?.kind === "hooks" ? `<div class="box diagram"><h4>${esc(DG.title)}</h4>${HOOKS_SVG}<div class="caption">${DG.caption} The box that is running now lights up; the path taken this turn stays shaded.</div></div>`
      : DG ? `${patternBox(DG)}<details class="loopdet"><summary>Inside every agent and every call: the same agentic loop</summary><div class="box diagram">${LOOP_SVG}<div class="caption">Each box above runs this loop. <b>tool_use</b> sends it up and round again; <b>end_turn</b> sends it down to the final answer.${DG.kind === "agents" ? " For the coordinator, \"Run the tool\" means starting a subagent: a whole new loop of its own." : ""}</div></div></details>`
      : `<div class="box diagram"><h4>The agentic loop: watch it go round</h4>${LOOP_SVG}<div class="caption">Every Claude call goes left to right. <b>tool_use</b> sends it up and round again; <b>end_turn</b> sends it down to the final answer. The box that is running now lights up; the path taken this turn stays shaded.</div></div>`}
    <div class="live">
      <div><div class="caption"><b>The code running</b>: the agentic loop, with the line executing now highlighted</div><pre class="code loop" id="loop">${LOOP_HTML}</pre></div>
      <div><div class="caption"><b>Live output</b> from Claude Haiku 5.5</div><pre class="console" id="out">Press Simulate it live. The output appears here line by line.</pre></div>
    </div>
    <div class="box apibox"><h4>The API request being sent now</h4><pre class="code wrap" id="apireq">POST https://api.anthropic.com/v1/messages
x-api-key: ${getKey() ? "sk-ant-…" + esc(getKey().slice(-4)) + "   (your key from the sidebar)" : "(no key saved yet)"}
anthropic-version: 2023-06-01
content-type: application/json

{ "model": "claude-haiku-5-5", "max_tokens": 4096, "system": "…", "tools": [ … ], "messages": [ … ] }</pre>
      <div class="caption">Every turn sends the whole conversation again: the API keeps no memory between calls.</div></div>
    <details><summary>See the full code this lab runs</summary>
      <div class="caption"><b>1. How every call reaches Claude</b> (assets/engine.js): the model is pinned to <code>claude-haiku-5-5</code>, and your API key from the sidebar goes in the <code>x-api-key</code> header.</div><pre class="code wrap">${esc(callSrc)}</pre>
      <div class="caption"><b>2. This lab</b> (sims/lab-${pad}.js): the scenario, tools and checks. It calls Claude through the loop below.</div><pre class="code wrap">${esc(src)}</pre>
      ${shared.map((f, i) => `<details><summary>Shared simulator code: sims/shared/${f}</summary><pre class="code">${esc(sharedSrc[i])}</pre></details>`).join("")}
      <details open><summary><b>3. The agentic loop</b> every lab uses: runAgent() in assets/engine.js</summary><pre class="code wrap">${esc(loop)}</pre></details>
    </details>
    <div id="result"></div>
    <div class="navrow">${prev ? `<a href="lab.html?n=${prev.id}">◀ Lab ${prev.id}: Task ${esc(prev.task)}</a>` : "<span></span>"}${next ? `<a href="lab.html?n=${next.id}">Lab ${next.id}: Task ${esc(next.task)} ▶</a>` : "<span></span>"}</div>
    <footer>Source: ${esc(l.source || "")}. © Tertiary Infotech Academy Pte Ltd · UEN 201200696W</footer>`;

  for (const opt of document.querySelectorAll(".opts label")) opt.onclick = () => {
    const k = opt.dataset.k; opt.querySelector("input").checked = true;
    document.querySelectorAll(".opts label").forEach((x) => x.classList.remove("right", "wrong"));
    opt.classList.add(k === l.answer ? "right" : "wrong");
    document.querySelector(`.opts label[data-k="${l.answer}"]`).classList.add("right");
    const wrong = Object.entries(l.wrong || {});
    $("#fb").innerHTML = `<div class="fb ${k === l.answer ? "ok" : "no"}"><b>${k === l.answer ? `Yes, ${k} is right.` : `Not quite. The answer is ${l.answer}.`}</b> ${md(l.why || l.fix)}</div>` +
      (wrong.length ? `<details><summary>Why the other answers fall short</summary>${wrong.map(([w, t]) => `<p><b>${w}.</b> ${md(t)}</p>`).join("")}</details>` : "");
  };

  let session = null;
  $("#run").onclick = async () => {
    const key = getKey();
    if (!key) { $("#out").textContent = "No API key yet. Paste it into the Anthropic API key box on the left and press Save key."; return; }
    if (session) { session.stopped = true; return; }
    const out = $("#out"); out.innerHTML = ""; $("#result").innerHTML = "";
    document.querySelectorAll(".loopsvg .n, .loopsvg path").forEach((x) => x.classList.remove("hot", "done", "trail"));
    const map = DG && DG.kind !== "hooks" ? runMap($("#runmap"), DG) : null; map?.reset();
    const log = (t, kind = "") => { if (map && kind === "note" && t.startsWith("== ")) map.phase(t.slice(3)); const sp = document.createElement("span"); sp.className = (/^\s{4}/.test(t) || /subagent/.test(t) ? "sub " : "") + kind; sp.textContent = t + "\n"; out.appendChild(sp); out.scrollTop = out.scrollHeight; };
    session = E.makeSession(key, log);
    session.onRequest = (b) => {
      const last = b.messages.at(-1); const lc = Array.isArray(last.content) ? last.content : [{ type: "text" }];
      const lastDesc = lc.every((c) => c.type === "tool_result") ? `${lc.length} tool_result${lc.length > 1 ? "s" : ""}` : "the user's message";
      $("#apireq").textContent = `POST https://api.anthropic.com/v1/messages     (call ${session ? session.requests.length : ""})
x-api-key: sk-ant-…${key.slice(-4)}   (your key from the sidebar)
anthropic-version: 2023-06-01
content-type: application/json

{
  "model": "${b.model}",
  "max_tokens": ${b.max_tokens},${b.system ? `\n  "system": "${E.short(b.system, 70).replace(/"/g, "'")}",` : ""}${b.tools ? `\n  "tools": [ ${b.tools.map((t) => t.name).join(", ")} ],` : ""}${b.tool_choice ? `\n  "tool_choice": ${JSON.stringify(b.tool_choice)},` : ""}
  "messages": [ ${b.messages.length} message${b.messages.length > 1 ? "s" : ""}: the whole conversation so far, ending with ${lastDesc} ]
}`;
    };
    // Light the box (and the arrow into it) for the step that is running. Only the Claude call takes real time;
    // check / tool / append finish in a millisecond, so on pages where the loop diagram is the live diagram each
    // of those steps holds for DWELL ms, so you can watch the loop go round.
    const DWELL = !DG || DG.kind === "hooks" ? 750 : 0;
    let prevStep = "start";
    session.step = (id) => {
      const code = ["pre", "post", "deny"].includes(id) ? "tool" : id;      // the hook steps run inside run_tools
      document.querySelectorAll("#loop span").forEach((x) => x.classList.toggle("hot", x.dataset.step === code));
      if (id === "call") document.querySelectorAll(".loopsvg .n, .loopsvg path").forEach((x) => x.classList.remove("trail"));
      document.querySelectorAll(".loopsvg .n").forEach((x) => { x.classList.toggle("hot", x.dataset.step === id); if (x.dataset.step === id) x.classList.add("trail"); });
      const edge = `${prevStep}-${id}`; prevStep = id;
      document.querySelectorAll(".loopsvg path[data-e]").forEach((p) => { const on = p.dataset.e.split(" ").includes(edge); p.classList.toggle("hot", on); if (on) p.classList.add("trail"); });
      return id === "call" || !DWELL || session?.stopped ? undefined : new Promise((r) => setTimeout(r, DWELL));
    };
    if (map) session.agent = (ev) => map.agent(ev);
    document.querySelector('.loopsvg .n[data-step="start"]').classList.add("hot");
    $("#run").textContent = "■ Stop"; $("#run").classList.add("stop");
    let res = null;
    try { res = await spec.run(session, E); } catch (e) { log(`!! ${e.message}`, "error"); }
    log(`\n${session.usage.calls} Claude call${session.usage.calls === 1 ? "" : "s"} on claude-haiku-5-5 · about US$${session.cost().toFixed(4)} on your API key`, "note");
    $("#run").textContent = "▶ Simulate it again"; $("#run").classList.remove("stop");
    document.querySelectorAll("#loop span, .loopsvg .n, .loopsvg path").forEach((x) => x.classList.remove("hot"));
    if (session.trace.filter((t) => !t.label).at(-1)?.stop_reason === "end_turn") document.querySelector('.loopsvg .n[data-step="stop"]').classList.add("done");
    const trace = session.trace, reqs = session.requests; session = null;
    if (!res) return;
    const main = trace.filter((t) => !t.label);
    const finalText = res.final || [...main].reverse().find((t) => t.text)?.text || "";
    const explainTurn = (t) => {
      const who = t.label ? `${esc(t.label)} · ` : "";
      if (t.stop_reason === "tool_use") {
        const tools = t.tools.map((x) => `<code>${esc(x.name)}</code>${x.denied ? " (blocked by a hook)" : x.isError ? " (returned an error)" : ""}`).join(", ");
        const goesOn = trace.some((x) => x !== t && x.label === t.label && x.turn === t.turn + 1);
        return `<li><b>${who}Turn ${t.turn} · stop_reason: <code>tool_use</code>.</b> Claude asked for ${tools}. ${goesOn ? `The loop ran ${t.tools.length > 1 ? "them" : "it"}, appended the result${t.tools.length > 1 ? "s" : ""}, and called Claude again.` : "This step was a single call: the code read the tool call's input as its answer."}</li>`;
      }
      if (t.stop_reason === "end_turn") return `<li><b>${who}Turn ${t.turn} · stop_reason: <code>end_turn</code>.</b> Claude finished${t.label ? " and handed its answer back" : ""}, so the loop stopped.${t.label ? "" : " That reply is the final output."}</li>`;
      if (t.stop_reason === "max_tokens") return `<li><b>${who}Turn ${t.turn} · stop_reason: <code>max_tokens</code>.</b> The reply hit its token limit and was cut off.</li>`;
      return `<li><b>${who}Turn ${t.turn} · stop_reason: <code>${esc(t.stop_reason)}</code>.</b></li>`;
    };
    $("#result").innerHTML = `<h2>3 · Read your result</h2>
      <div class="box final"><h4>Claude's final output</h4><div>${md(finalText || "(No text reply. Read the live output above.)").replace(/\n/g, "<br>")}</div></div>
      <h2>4 · The observation explained</h2>
      <div class="box"><h4>Turn by turn</h4><ol>${trace.map(explainTurn).join("")}</ol>
        <div class="caption">${main.length} turn${main.length === 1 ? "" : "s"} of the main loop${trace.length > main.length ? `, plus ${trace.length - main.length} turns in labelled steps or subagents` : ""}. The loop never reads Claude's wording to decide what to do next: <code>stop_reason</code> is the signal.</div></div>
      <div class="box"><h4>Checks on what Claude actually did</h4><div class="checks">${(res.checks || []).map((c) => `<div class="${c.pass ? "pass" : "fail"}">${c.pass ? "✔ PASS" : "✘ FAIL"} · ${esc(c.label)}</div>`).join("")}</div>
        ${(res.checks || []).some((c) => !c.pass) ? `<div class="caption">Claude writes each run fresh, so a check can occasionally miss. Read the output, then run it again.</div>` : ""}</div>
      <details><summary>Every Claude call as curl (${reqs.length} call${reqs.length === 1 ? "" : "s"}): copy one into a terminal to send the same request yourself</summary>
        <div class="caption">This page sends each call with JavaScript fetch(). The curl command is the identical HTTPS POST. Set ANTHROPIC_API_KEY in your terminal first.</div>
        ${reqs.map((b, i) => `<details><summary>Call ${i + 1}: ${b.messages.length} message${b.messages.length === 1 ? "" : "s"} in the conversation${b.tools ? `, ${b.tools.length} tools` : ""}</summary><pre class="code">${esc(E.asCurl(b))}</pre></details>`).join("")}
      </details>
      ${(spec.explain || l.explain) ? `<div class="box"><h4>Why it happens</h4>${md(spec.explain || l.explain)}</div>` : ""}
      ${l.exam_tip ? `<div class="box"><h4>Exam tip</h4>${md(l.exam_tip)}</div>` : ""}
      ${spec.try ? `<div class="box"><h4>Try this next</h4>${md(spec.try)}</div>` : ""}`;
  };
}
