// The scenario board: each lab's own story, drawn as lanes of stages, lit live while the lab runs.
// A lab declares it in its sims/lab-NN.js as `scene`:
//   scene: { title, caption?, loop?: "open",
//            lanes: [ { key, label, sub?, tone: "trap" | "fix" | "", on?: /phase regex/, stages: [
//              { id, icon?, t, s?, claude?: true | /agent label regex/, tools?: ["tool_name", ...], out?: true, diff?: true } ] } ] }
// - A lane becomes active when a "== ..." phase line matches its `on` (the first lane is active at the start).
// - A stage with `claude` lights while a Claude call is in flight in its lane; one with `tools` flashes when
//   one of those tools runs. `out` marks the outcome stage; `diff` marks the stage that differs between methods.
// - The lab sets any stage's text and state itself with s.show(id, text, state): "hot" | "done" | "good" | "bad".

// The board names which method is the trap and which is the fix, so it would give the question's answer away.
// It stays veiled (blurred) until the learner picks an answer, presses Simulate, or chooses to show it.
if (typeof document !== "undefined") document.addEventListener("click", (e) => {
  if (e.target.closest?.(".opts label, #run, .scene .unveil")) document.querySelectorAll(".scene.veiled").forEach((s) => s.classList.remove("veiled"));
});

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const CHIP = { trap: "✘ the trap", fix: "✔ the fix", "": "" };

export function sceneBox(sc) {
  const lanes = sc.lanes.map((ln) => `
    <div class="lane tone-${ln.tone || "plain"}" data-lane="${esc(ln.key)}">
      <div class="ln">${ln.tone ? `<span class="chip">${CHIP[ln.tone]}</span>` : ""}<b>${esc(ln.label)}</b>${ln.sub ? `<small>${esc(ln.sub)}</small>` : ""}<span class="pz"></span></div>
      <div class="sts">${ln.stages.map((st, i) => `${i ? '<i class="arw" aria-hidden="true">➜</i>' : ""}<div class="st${st.out ? " out" : ""}${st.diff ? " diff" : ""}" data-id="${esc(st.id)}">
        ${st.diff ? '<span class="dtag">the change</span>' : ""}<div class="sh">${st.icon ? `<span class="ic">${st.icon}</span>` : ""}<b>${esc(st.t)}</b></div>${st.s ? `<small>${esc(st.s)}</small>` : ""}<em class="v"></em></div>`).join("")}</div>
    </div>`).join("");
  return `<div class="box scene veiled" id="scene"><h4>${esc(sc.title)}</h4><div class="veil"><div>The scenario board shows which method is the trap and which is the fix.<br><b>Pick your answer to the question first.</b></div><button type="button" class="unveil">Show the board anyway</button></div><div class="lanes">${lanes}
    <div class="caption">${sc.caption ? sc.caption + " " : ""}<span class="rmkey"><i class="k hot"></i> running now <i class="k done"></i> done <i class="k good"></i> the outcome you want <i class="k bad"></i> the outcome that goes wrong</span></div></div></div>`;
}

export function sceneLive(el, sc) {
  const lanes = [...el.querySelectorAll(".lane")];
  const laneOf = (key) => el.querySelector(`.lane[data-lane="${CSS.escape(key)}"]`);
  const stageEl = (id) => el.querySelector(`.st[data-id="${CSS.escape(id)}"]`);
  const spec = Object.fromEntries(sc.lanes.flatMap((ln) => ln.stages.map((st) => [st.id, { ...st, lane: ln.key }])));
  let active = null;
  const labels = [];                                   // the agent runs in progress (label "" is the main agent)
  const setState = (st, state) => {
    if (!st) return;
    st.classList.remove("hot", "done", "good", "bad");
    if (state) st.classList.add(state);
  };
  const settled = (st) => st.classList.contains("good") || st.classList.contains("bad");
  const activate = (key) => {
    if (active === key) return;
    if (active) { const prev = laneOf(active); prev?.classList.remove("active"); prev?.classList.add("ran");
      prev?.querySelectorAll(".st.hot").forEach((s) => setState(s, "done")); }
    active = key; const ln = laneOf(key); if (!ln) return;
    ln.classList.remove("wait"); ln.classList.add("active");
    ln.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  };
  const inLane = (pred) => sc.lanes.find((l) => l.key === active)?.stages.find(pred);
  const claudeStage = () => inLane((st) => st.claude === true || (st.claude instanceof RegExp && st.claude.test(labels.at(-1) ?? "")))
                         || inLane((st) => st.claude);
  const brief = (input) => { const v = input && typeof input === "object" ? Object.values(input).find((x) => typeof x === "string" || typeof x === "number") : input;
    const t = v === undefined ? "" : String(v).replace(/\s+/g, " "); return t.length > 26 ? t.slice(0, 25) + "…" : t; };
  return {
    reset() {
      active = null; labels.length = 0;
      lanes.forEach((l) => { l.classList.remove("active", "ran", "paused"); l.classList.add("wait"); l.querySelector(".pz").textContent = ""; });
      el.querySelectorAll(".st").forEach((s) => { setState(s, ""); s.querySelector(".v").textContent = ""; });
      if (sc.lanes[0]) activate(sc.lanes[0].key);
    },
    phase(title) { const ln = sc.lanes.find((l) => l.on && l.on.test(title)); if (ln) activate(ln.key); },
    request() { const st = claudeStage(); const e = st && stageEl(st.id); if (e && !settled(e)) setState(e, "hot"); },
    response() { const st = claudeStage(); const e = st && stageEl(st.id); if (e && !settled(e)) setState(e, "done"); },
    agent(ev) {
      if (ev.event === "start") labels.push(ev.label || "");
      else if (ev.event === "end") { const i = labels.lastIndexOf(ev.label || ""); if (i >= 0) labels.splice(i, 1); }
      else if (ev.event === "tool") {
        const st = inLane((x) => (x.tools || []).includes(ev.name)); const e = st && stageEl(st.id); if (!e) return;
        e.querySelector(".v").textContent = `${ev.denied ? "⛔ blocked " : ev.isError ? "✘ " : "✓ "}${ev.name}${brief(ev.input) ? ` · ${brief(ev.input)}` : ""}`;
        if (!settled(e)) { setState(e, "hot"); clearTimeout(e._t); e._t = setTimeout(() => { if (e.classList.contains("hot")) setState(e, "done"); }, 650); }
      }
    },
    show(id, text, state) {
      const e = stageEl(id); if (!e) return;
      const ln = spec[id]?.lane; if (ln && ln !== active && state === "hot") activate(ln);
      if (text !== undefined && text !== null) e.querySelector(".v").textContent = text;
      if (state) { clearTimeout(e._t); setState(e, state); }
    },
    paused(on) { const ln = laneOf(active); if (!ln) return; ln.classList.toggle("paused", on); ln.querySelector(".pz").textContent = on ? "⏸ paused here" : ""; },
    finish() { el.querySelectorAll(".st.hot").forEach((s) => setState(s, "done")); lanes.forEach((l) => l.classList.remove("active", "wait")); },
  };
}
