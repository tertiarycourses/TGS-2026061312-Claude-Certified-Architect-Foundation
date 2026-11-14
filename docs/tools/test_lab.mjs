// Run one browser lab live from a terminal, with the same engine the site uses.
// Usage: node docs/tools/test_lab.mjs 1      (reads ANTHROPIC_API_KEY from the environment or the nearest .env)
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
for (let d = process.cwd(); ; d = dirname(d)) {
  if (!process.env.ANTHROPIC_API_KEY && existsSync(join(d, ".env"))) {
    for (const ln of readFileSync(join(d, ".env"), "utf8").split("\n")) {
      const m = ln.match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.+?)\s*$/);
      if (m) process.env.ANTHROPIC_API_KEY = m[1].replace(/^["']|["']$/g, "");
    }
  }
  if (dirname(d) === d) break;
}
if (!process.env.ANTHROPIC_API_KEY) { console.error("No ANTHROPIC_API_KEY."); process.exit(1); }

const n = String(process.argv[2] || "1").padStart(2, "0");
const E = await import(pathToFileURL(resolve(here, "../assets/engine.js")));
const lab = (await import(pathToFileURL(resolve(here, `../sims/lab-${n}.js`)))).default;
const phases = [];
const s = E.makeSession(process.env.ANTHROPIC_API_KEY, (l, kind) => { const h = String(l).replace(/^\n+/, ""); if (kind === "note" && h.startsWith("== ")) phases.push(h.slice(3)); console.log(l); });
const ids = new Set((lab.scene?.lanes || []).flatMap((ln) => ln.stages.map((st) => st.id)));
const badShow = new Set(), shown = new Set();
let pauses = 0;
s.show = (id) => { (ids.has(id) ? shown : badShow).add(id); };
s.pause = async (i = {}) => { pauses += 1; console.log(`\n== PAUSE · ${i.title}\n   outcome: ${i.outcome}\n   proceed: ${i.next}\n`); };
const t0 = Date.now();
const out = await lab.run(s, E);
console.log("\n== Turns");
for (const t of s.trace) console.log(`${t.label ? t.label + " " : ""}turn ${t.turn}: stop_reason=${t.stop_reason}${t.tools.length ? " tools=" + t.tools.map((x) => x.name + (x.denied ? "(blocked)" : x.isError ? "(error)" : "")).join(",") : ""}`);
console.log("\n== Checks");
for (const c of out.checks || []) console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.label}`);
if (out.compare) {
  console.log("\n== Side by side");
  for (const c of out.compare.cols || []) console.log(`[${c.tone || "-"}] ${c.title}: ${c.verdict}`);
  for (const r of out.compare.rows || []) console.log("  " + r.map((x) => (x && typeof x === "object" ? `${x.v}${x.tone ? ` (${x.tone})` : ""}` : x)).join(" | "));
}
const sc = lab.scene;
if (!sc) console.log("WARN  no scene{} board for this lab");
else {
  for (const ln of sc.lanes.slice(1)) if (ln.on && !phases.some((p) => ln.on.test(p))) console.log(`WARN  scene lane ${ln.key}: its on ${ln.on} matched no "== " phase line`);
  if (badShow.size) console.log(`WARN  s.show() ids not in the scene: ${[...badShow].join(", ")}`);
  const fixes = sc.lanes.filter((l) => l.tone === "fix").length, traps = sc.lanes.filter((l) => l.tone === "trap").length;
  if (traps && fixes && !pauses) console.log("WARN  a trap and a fix, but no s.pause() between them");
  if (traps && fixes && !out.compare) console.log("WARN  a trap and a fix, but no compare{} in the result");
  const outs = sc.lanes.flatMap((l) => l.stages.filter((st) => st.out).map((st) => st.id)).filter((id) => !shown.has(id));
  if (outs.length) console.log(`WARN  outcome stages never set with s.show(): ${outs.join(", ")}`);
}
if (!lab.slide || !lab.slide.code || !(lab.slide.keys || []).length) console.log("WARN  no slide{title, code, keys} for the deck");
console.log(`\n${s.usage.calls} Claude calls · ${s.usage.input} in / ${s.usage.output} out tokens · about US$${s.cost().toFixed(4)} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit((out.checks || []).every((c) => c.pass) ? 0 : 2);
