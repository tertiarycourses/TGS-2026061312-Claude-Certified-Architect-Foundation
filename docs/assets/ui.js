// Page layer for the simulator site: sidebar (API key + the five topics), the home page and each lab page.
import * as E from "./engine.js";

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
  ["", "messages = [ the user's message ]"],
  ["", "for turn in 1 .. maxTurns:                    # a hard turn cap"],
  ["call", "    response = claude(messages, tools)          # POST /v1/messages"],
  ["check", "    if response.stop_reason != \"tool_use\":"],
  ["stop", "        break                                  # end_turn: Claude has finished"],
  ["tool", "    for each tool_use block: result = run_tool()   # a hook may block it"],
  ["append", "    messages += [ Claude's turn, every tool_result ]  # then go round again"],
];
const LOOP_HTML = LOOP.map(([id, t]) => `<span data-step="${id}">${esc(t)}</span>`).join("\n");

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
      <input type="password" id="key" placeholder="sk-ant-..." autocomplete="off">
      <div class="row"><button id="save">Save key</button><button id="test">Test</button><button id="clear">Clear</button></div>
      <div class="caption" style="margin-top:6px">Saved only in this browser and sent only to Anthropic. Every lab calls <code>claude-haiku-5-5</code>.</div>
    </div>
    <nav><h4>Start</h4><a href="index.html" class="${here === 0 ? "on" : ""}">All topics and simulators</a>
    <h4>Day 1 · one lab per task statement</h4>${nav}
    <h4>Day 2 · build it yourself</h4>${D.day2.map((l) => `<a class="task" href="guides/${l.slug}.html"><b>Lab ${l.id}</b> · ${esc(l.short)}</a>`).join("")}
    <h4>After class</h4><a href="${EXAM}">Practice exam</a><a href="${REPO}">GitHub repository</a></nav>`;
  const show = () => { const k = getKey(); const st = $(".keystate"); st.textContent = k ? `saved (…${k.slice(-4)})` : "not set"; st.className = "keystate " + (k ? "ok" : "no"); };
  show();
  $("#save").onclick = () => { const v = $("#key").value.trim(); if (!v.startsWith("sk-ant-")) { alert("That doesn't look like an Anthropic API key (it starts with sk-ant-)."); return; } localStorage.setItem(KEY, v); $("#key").value = ""; show(); };
  $("#clear").onclick = () => { localStorage.removeItem(KEY); show(); };
  $("#test").onclick = async () => {
    const k = getKey(); if (!k) { alert("Save a key first."); return; }
    const s = E.makeSession(k, () => {});
    try { await E.callClaude(s, { max_tokens: 20, messages: [{ role: "user", content: "Say OK." }] }); alert("Key works: claude-haiku-5-5 answered."); }
    catch (e) { alert(e.message); }
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
  const prev = D.labs.find((x) => x.id === n - 1), next = D.labs.find((x) => x.id === n + 1);
  document.title = `Lab ${n}: ${l.title}`;
  $("main").innerHTML = `
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
    <div class="live">
      <div><div class="caption"><b>The code running</b>: the agentic loop, with the line executing now highlighted</div><pre class="code loop" id="loop">${LOOP_HTML}</pre></div>
      <div><div class="caption"><b>Live output</b> from Claude Haiku 5.5</div><pre class="console" id="out">Press Simulate it live. The output appears here line by line.</pre></div>
    </div>
    <details><summary>See the full code this lab runs</summary>
      <div class="caption">The lab (sims/lab-${pad}.js):</div><pre class="code">${esc(src)}</pre>
      ${shared.map((f, i) => `<details><summary>Shared simulator code: sims/shared/${f}</summary><pre class="code">${esc(sharedSrc[i])}</pre></details>`).join("")}
      <details><summary>The agentic loop every lab uses: runAgent() in assets/engine.js</summary><pre class="code">${esc(loop)}</pre></details>
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
    const log = (t, kind = "") => { const sp = document.createElement("span"); sp.className = (/^\s{4}/.test(t) || /subagent/.test(t) ? "sub " : "") + kind; sp.textContent = t + "\n"; out.appendChild(sp); out.scrollTop = out.scrollHeight; };
    session = E.makeSession(key, log);
    session.step = (id) => { document.querySelectorAll("#loop span").forEach((x) => x.classList.toggle("hot", x.dataset.step === id)); };
    $("#run").textContent = "■ Stop"; $("#run").classList.add("stop");
    let res = null;
    try { res = await spec.run(session, E); } catch (e) { log(`!! ${e.message}`, "error"); }
    log(`\n${session.usage.calls} Claude call${session.usage.calls === 1 ? "" : "s"} on claude-haiku-5-5 · about US$${session.cost().toFixed(4)} on your API key`, "note");
    $("#run").textContent = "▶ Simulate it again"; $("#run").classList.remove("stop");
    document.querySelectorAll("#loop span").forEach((x) => x.classList.remove("hot"));
    const trace = session.trace, reqs = session.requests; session = null;
    if (!res) return;
    const main = trace.filter((t) => !t.label);
    const finalText = res.final || [...main].reverse().find((t) => t.text)?.text || "";
    const explainTurn = (t) => {
      const who = t.label ? `${esc(t.label)} · ` : "";
      if (t.stop_reason === "tool_use") {
        const tools = t.tools.map((x) => `<code>${esc(x.name)}</code>${x.denied ? " (blocked by a hook)" : x.isError ? " (returned an error)" : ""}`).join(", ");
        return `<li><b>${who}Turn ${t.turn} · stop_reason: <code>tool_use</code>.</b> Claude asked for ${tools}. The loop ran ${t.tools.length > 1 ? "them" : "it"}, appended the result${t.tools.length > 1 ? "s" : ""}, and called Claude again.</li>`;
      }
      if (t.stop_reason === "end_turn") return `<li><b>${who}Turn ${t.turn} · stop_reason: <code>end_turn</code>.</b> Claude finished${t.label ? " and handed its answer back" : ""}, so the loop stopped.${t.label ? "" : " That reply is the final output."}</li>`;
      if (t.stop_reason === "max_tokens") return `<li><b>${who}Turn ${t.turn} · stop_reason: <code>max_tokens</code>.</b> The reply hit its token limit and was cut off.</li>`;
      return `<li><b>${who}Turn ${t.turn} · stop_reason: <code>${esc(t.stop_reason)}</code>.</b></li>`;
    };
    $("#result").innerHTML = `<h2>3 · Read your result</h2>
      <div class="box final"><h4>Claude's final output</h4><div>${md(finalText || "(No text reply. Read the live output above.)").replace(/\n/g, "<br>")}</div></div>
      <h2>4 · The observation explained</h2>
      <div class="box"><h4>Turn by turn</h4><ol>${trace.map(explainTurn).join("")}</ol>
        <div class="caption">${main.length} turn${main.length === 1 ? "" : "s"} of the main loop${trace.length > main.length ? `, plus ${trace.length - main.length} subagent turns` : ""}. The loop never reads Claude's wording to decide what to do next: <code>stop_reason</code> is the signal.</div></div>
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
