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
const s = E.makeSession(process.env.ANTHROPIC_API_KEY);
const t0 = Date.now();
const out = await lab.run(s, E);
console.log("\n== Turns");
for (const t of s.trace) console.log(`${t.label ? t.label + " " : ""}turn ${t.turn}: stop_reason=${t.stop_reason}${t.tools.length ? " tools=" + t.tools.map((x) => x.name + (x.denied ? "(blocked)" : x.isError ? "(error)" : "")).join(",") : ""}`);
console.log("\n== Checks");
for (const c of out.checks || []) console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.label}`);
if (!lab.slide || !lab.slide.code || !(lab.slide.keys || []).length) console.log("WARN  no slide{title, code, keys} for the deck");
console.log(`\n${s.usage.calls} Claude calls · ${s.usage.input} in / ${s.usage.output} out tokens · about US$${s.cost().toFixed(4)} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit((out.checks || []).every((c) => c.pass) ? 0 : 2);
