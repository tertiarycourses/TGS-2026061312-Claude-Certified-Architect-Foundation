// The live pattern diagram for each lab. Most labs run one agentic loop, so they show the loop diagram (ui.js).
// Labs whose task statement is about a different pattern show that pattern instead, drawn live from the run:
//   agents   - a coordinator (or main session) and the subagents it spawns
//   passes   - separate Claude calls or passes that your code runs and combines
//   sessions - one saved session and the forks resumed from it
//   hooks    - the agentic loop with the PreToolUse / PostToolUse gates around the tool
// Each Claude run reports { event: "start" | "turn" | "end", label } through session.agent (assets/engine.js);
// runs with a label are subagents or passes, runs without one are the main agent. "== ..." log lines start a phase.

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export const DIAGRAMS = {
  2: { kind: "agents", title: "The multi-agent pattern: a coordinator spawns web-search subagents",
       main: "Coordinator", sub: "web-search subagent", ghost: [{ main: "Coordinator", subs: ["web-search", "web-search", "web-search"] }],
       caption: "The coordinator calls its <b>Agent</b> tool once per sub-topic. Each subagent starts with an <b>empty context</b>: it sees only the prompt it is given, runs its own loop, and hands back only its answer. One row per phase: compare what the narrow plan and the broad plan send out." },
  3: { kind: "agents", title: "The multi-agent pattern: can the coordinator fan out?",
       main: "Coordinator (/parallel-review)", sub: "review subagent", ghost: [{ main: "Coordinator", subs: ["review", "review", "review"] }],
       caption: "Run 1: the delegation tool is not in <b>allowedTools</b>, so the call is refused and no subagent appears. Run 2: the tool is auto-approved and the reviews fan out as subagents." },
  14: { kind: "agents", title: "Where does the skill run: in your session, or in a forked subagent?",
        main: "Main session", sub: "forked skill (context: fork)", ghost: [{ main: "Main session", subs: ["forked skill"] }],
        caption: "With <b>context: main</b> the skill's noisy review runs inside your session (no subagent box). With <b>context: fork</b> it runs as a subagent with its own context, and only its short answer comes back to the main session." },
  27: { kind: "agents", title: "The multi-agent pattern: an error inside a subagent travels back to the coordinator",
        main: "Coordinator", sub: "search subagent", ghost: [{ main: "Coordinator", subs: ["search", "search"] }],
        caption: "The timeout happens inside a subagent. What the subagent hands back (an empty \"success\", or structured error context) is all the coordinator knows when it decides how to recover." },
  28: { kind: "agents", title: "Delegate the noisy search to a subagent; keep the main session clean",
        main: "Main session", sub: "explore subagent", ghost: [{ main: "Main session", subs: ["explore"] }],
        caption: "Trap: the main session greps and reads everything itself, so the noise fills its own context. Fix: an explore subagent does the search in its own context and returns a short map; the main session writes it to NOTES.md, and a fresh session answers from the notes." },
  30: { kind: "agents", title: "The multi-agent pattern: the coordinator sees only the subagent's handoff",
        main: "Coordinator", sub: "document-analysis subagent", ghost: [{ main: "Coordinator", subs: ["document analysis"] }],
        caption: "The coordinator writes the report from the subagent's handoff alone. A prose summary loses which figure came from which source; structured claim records keep the provenance." },
  6: { kind: "passes", title: "Decompose the job: one pass per section, then reconcile",
       main: "Single call: whole packet", sub: "section pass", ghost: [{ subs: ["section pass", "section pass", "section pass"] }],
       caption: "Phase 1 sends the whole packet in one call. Phase 2 runs one small extraction per section, each seeing only its own evidence. Phase 3, reconciliation, runs in your code: no Claude call." },
  10: { kind: "passes", title: "One step per job, each with only its own tools",
        main: "Shared step: every tool, tool_choice auto", sub: "step", ghost: [{ subs: ["Review step", "Test step"] }],
        caption: "The trap is one shared call holding every tool. The fix runs separate steps: the review step holds only its reporting tool and is forced to call it; the test step holds only its own." },
  20: { kind: "passes", title: "One call per request: criteria only, then criteria with examples",
        sub: "request", ghost: [{ subs: ["request", "request", "request"] }],
        caption: "The same requests go through two prompt versions. Each box is one Claude call; compare how consistently the two rows classify the same requests." },
  22: { kind: "passes", title: "Validate, retry with the errors, stop when the data is absent",
        sub: "extraction attempt", ghost: [{ subs: ["DOC attempt 1", "DOC attempt 2"] }],
        caption: "Each box is one extraction attempt. Your code validates it; a format error goes back to Claude as feedback for a retry, but a value missing from the source stops the retries." },
  23: { kind: "passes", title: "Pilot the template: one request per transcript, joined back by custom_id",
        sub: "request", ghost: [{ subs: ["custom_id", "custom_id", "custom_id"] }],
        caption: "Each box is one request keyed by its custom_id, graded against the human labels. A template goes to the batch only when its pilot row passes." },
  24: { kind: "passes", title: "Split the review: focused per-file passes, then one integration pass",
        sub: "review pass", ghost: [{ subs: ["per-file", "per-file", "per-file"] }, { subs: ["integration"] }],
        caption: "Pass 1 reviews each file on its own, so attention isn't spread across the PR. Pass 2 reads all the files together and reports only cross-file issues." },
  7: { kind: "sessions", title: "One analysis, two forks: resume the saved session twice",
       names: ["Baseline session (plan mode, read-only)", "Fork A: the minimal patch", "Fork B: the larger refactor"],
       ghost: [{ subs: ["Baseline session"] }, { subs: ["Fork A"] }, { subs: ["Fork B"] }],
       caption: "The baseline session's history is copied into a new session id for each attempt, so both forks start from the same analysis and neither sees the other. Files are checkpointed and restored in code between them." },
  4: { kind: "hooks", title: "The agentic loop with a PreToolUse gate",
       caption: "Phase 1 has no gate: the order of tool calls is left to the prompt. Phase 2 adds a <b>PreToolUse</b> prerequisite gate: a call that comes too early is <b>blocked</b> and its error goes back to Claude as the tool result." },
  5: { kind: "hooks", title: "The agentic loop with PreToolUse and PostToolUse hooks",
       caption: "<b>PreToolUse</b> runs before the tool and can block it (here: refunds above the limit). <b>PostToolUse</b> runs after it and can rewrite the result before Claude reads it." },
};

// The agentic loop with hooks: same layout as the plain loop, with the gates drawn around the tool.
export const HOOKS_SVG = `
<svg class="loopsvg hk" viewBox="0 0 980 300" role="img" aria-label="The agentic loop with hooks: Claude, stop_reason, PreToolUse gate, run the tool or block it, PostToolUse, append, back to Claude">
  <defs><marker id="arh" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#5F5C56"/></marker><marker id="arh-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#C9603A"/></marker></defs>
  <g class="n" data-step="start"><rect x="10" y="130" width="110" height="58" rx="8"/><text x="65" y="155">User</text><text x="65" y="173" class="s">message</text></g>
  <g class="n" data-step="call"><rect x="160" y="130" width="140" height="58" rx="8"/><text x="230" y="153">Claude</text><text x="230" y="172" class="s">claude-haiku-5-5</text></g>
  <g class="n" data-step="check"><polygon points="400,118 470,159 400,200 330,159"/><text x="400" y="155">stop_</text><text x="400" y="171">reason?</text></g>
  <g class="n" data-step="append"><rect x="160" y="15" width="140" height="58" rx="8"/><text x="230" y="39">Append</text><text x="230" y="58" class="s">every tool_result</text></g>
  <g class="n" data-step="pre"><polygon points="550,8 625,44 550,80 475,44"/><text x="550" y="40">PreToolUse</text><text x="550" y="58" class="s">hook</text></g>
  <g class="n" data-step="tool"><rect x="655" y="15" width="140" height="58" rx="8"/><text x="725" y="39">Run the tool</text><text x="725" y="58" class="s">allowed</text></g>
  <g class="n" data-step="post"><rect x="825" y="15" width="145" height="58" rx="8"/><text x="897" y="39">PostToolUse</text><text x="897" y="58" class="s">may rewrite result</text></g>
  <g class="n deny" data-step="deny"><rect x="480" y="122" width="140" height="56" rx="8"/><text x="550" y="145">Blocked</text><text x="550" y="164" class="s">error is the result</text></g>
  <g class="n" data-step="stop"><rect x="655" y="232" width="170" height="58" rx="8"/><text x="740" y="256">Final answer</text><text x="740" y="275" class="s">loop stops</text></g>
  <path data-e="start-call" d="M120,159 L157,159" marker-end="url(#arh)"/>
  <path data-e="call-check" d="M300,159 L327,159" marker-end="url(#arh)"/>
  <path data-e="check-pre" d="M400,118 L400,44 L472,44" marker-end="url(#arh)"/><text x="436" y="36" class="lbl">tool_use</text>
  <path data-e="pre-tool" d="M625,44 L652,44" marker-end="url(#arh)"/><text x="638" y="36" class="lbl">ok</text>
  <path data-e="tool-post tool-append" d="M795,44 L822,44" marker-end="url(#arh)"/>
  <path data-e="pre-deny" d="M550,80 L550,119" marker-end="url(#arh)"/><text x="582" y="104" class="lbl">deny</text>
  <path data-e="post-append tool-append deny-append" d="M897,15 L897,3 L230,3 L230,12" marker-end="url(#arh)"/>
  <path data-e="deny-append" d="M620,150 L976,150 L976,3 L897,3"/>
  <path data-e="append-call" d="M230,73 L230,127" marker-end="url(#arh)"/>
  <path data-e="check-stop" d="M400,200 L400,261 L652,261" marker-end="url(#arh)"/><text x="444" y="279" class="lbl">end_turn</text>
</svg>`;

const ghostHTML = (cfg) => cfg.ghost.map((row) => `<div class="rmrow">${row.main
  ? `<div class="rmgroup"><div class="rm main ghost"><span class="tag">${cfg.kind === "agents" ? "main agent" : "call"}</span><b>${esc(row.main)}</b></div>
       <div class="rmkids"><div class="rmlink">Agent tool: task prompt ➜<br>⬅ answer only</div><div class="rmsubs">${row.subs.map((x) => `<div class="rm sub ghost"><span class="tag">subagent</span><b>${esc(x)}</b><small>own empty context</small></div>`).join("")}</div></div></div>`
  : row.subs.map((x) => `<div class="rm sub ghost"><span class="tag">${cfg.kind === "sessions" ? "session" : "Claude call"}</span><b>${esc(x)}</b></div>`).join("")}</div>`).join("");

export function patternBox(cfg) {
  return `<div class="box diagram"><h4>${esc(cfg.title)}</h4><div class="runmap" id="runmap">${ghostHTML(cfg)}</div>
    <div class="caption">${cfg.caption} <span class="rmkey"><i class="k hot"></i> running <i class="k done"></i> finished with end_turn${cfg.kind === "agents" ? ' <i class="k wait"></i> waiting for its subagents' : ""}</span></div></div>`;
}

// Draws each Claude run as it happens. Returns { agent(ev), phase(title), reset() }.
export function runMap(el, cfg) {
  let phases = [], cur = null, mains = 0;
  const running = [];                         // stack of running boxes
  const clean = (l) => l.replace(/^\(subagent:?\s*/, "").replace(/^\(/, "").replace(/\)$/, "").trim() || cfg.sub || "subagent";
  const newPhase = (title) => {
    const d = document.createElement("div"); d.className = "rmphase"; d.style.display = "none";
    d.innerHTML = `<div class="ph">${esc(title || "Run")}</div><div class="rmrow"></div>`;
    el.appendChild(d); cur = { el: d, row: d.querySelector(".rmrow"), boxes: [] }; phases.push(cur);
  };
  const box = (kind, tag, name) => {
    const b = document.createElement("div"); b.className = `rm ${kind}`;
    b.innerHTML = `<span class="tag">${esc(tag)}</span><b>${esc(name)}</b><small>starting…</small>`;
    return b;
  };
  const status = (b, t) => { b.querySelector("small").textContent = t; };
  const ensurePhase = () => { if (!cur) newPhase(""); cur.el.style.display = ""; };
  return {
    reset() { el.innerHTML = ""; phases = []; cur = null; mains = 0; running.length = 0; },
    phase(title) { newPhase(title); },
    agent(ev) {
      if (ev.event === "start") {
        ensurePhase();
        const parent = running.find((r) => !r.label && cfg.kind === "agents");
        let b;
        if (!ev.label) {
          const name = cfg.kind === "sessions" ? (cfg.names?.[mains] || `Session ${mains + 1}`) : (cfg.main || "Main agent");
          mains += 1;
          const waiting = cfg.kind === "agents" && cur.boxes.find((x) => x.placeholder);
          if (waiting) { b = waiting.el; waiting.placeholder = false; b.classList.remove("ghost"); }
          else if (cfg.kind === "agents") {
            const g = document.createElement("div"); g.className = "rmgroup";
            b = box("main", "main agent", name); g.appendChild(b);
            const kids = document.createElement("div"); kids.className = "rmkids none"; kids.innerHTML = `<div class="rmlink">Agent tool: task prompt ➜<br>⬅ answer only</div><div class="rmsubs"></div>`;
            g.appendChild(kids); cur.row.appendChild(g); b._kids = kids;
            cur.boxes.push({ el: b });
          } else { b = box("sub", cfg.kind === "sessions" ? "session" : "Claude call", name); cur.row.appendChild(b); cur.boxes.push({ el: b }); }
        } else if (parent) {
          b = box("sub", "subagent", clean(ev.label)); parent.el._kids.classList.remove("none"); parent.el._kids.querySelector(".rmsubs").appendChild(b);
          parent.el.classList.remove("hot"); parent.el.classList.add("wait"); status(parent.el, "waiting for its subagents");
        } else if (cfg.kind === "agents") {
          // a subagent that runs before its main session's own call (a forked skill): draw the main box as waiting
          const g = document.createElement("div"); g.className = "rmgroup";
          const m = box("main", "main agent", cfg.main || "Main agent"); m.classList.add("ghost"); status(m, "hands the skill to a subagent"); g.appendChild(m);
          const kids = document.createElement("div"); kids.className = "rmkids"; kids.innerHTML = `<div class="rmlink">task prompt ➜<br>⬅ answer only</div><div class="rmsubs"></div>`;
          g.appendChild(kids); cur.row.appendChild(g); m._kids = kids; cur.boxes.push({ el: m, placeholder: true });
          b = box("sub", "subagent", clean(ev.label)); kids.querySelector(".rmsubs").appendChild(b);
        } else { b = box("sub", cfg.kind === "sessions" ? "session" : "Claude call", clean(ev.label)); cur.row.appendChild(b); cur.boxes.push({ el: b }); }
        b.classList.add("hot"); b._turns = 0; b._tools = 0;
        running.unshift({ label: ev.label, el: b });
      } else if (ev.event === "turn") {
        const r = running.find((x) => x.label === ev.label); if (!r) return;
        r.el._turns = ev.turn; r.el._tools += (ev.tools || []).length;
        status(r.el, `turn ${ev.turn} · stop_reason: ${ev.stop_reason}${ev.tools?.length ? ` · ${ev.tools.map((t) => t.name).join(", ")}` : ""}`);
        if (r.el.classList.contains("wait")) { r.el.classList.remove("wait"); r.el.classList.add("hot"); }
      } else if (ev.event === "end") {
        const i = running.findIndex((x) => x.label === ev.label); if (i < 0) return;
        const r = running.splice(i, 1)[0];
        r.el.classList.remove("hot", "wait"); r.el.classList.add(ev.stop_reason === "end_turn" ? "done" : "warn");
        status(r.el, `${ev.stop_reason === "end_turn" ? "✓ end_turn" : `stopped: ${ev.stop_reason}`} · ${ev.turns} turn${ev.turns === 1 ? "" : "s"} ${ev.calls ? ` · ${ev.calls} tool call${ev.calls === 1 ? "" : "s"}` : ""}${ev.denied ? ` · ${ev.denied} blocked` : ""}`);
        const p = running.find((x) => !x.label && cfg.kind === "agents");
        if (p && !running.some((x) => x.label)) { p.el.classList.remove("wait"); p.el.classList.add("hot"); status(p.el, "reading its subagents' answers"); }
      }
    },
  };
}
