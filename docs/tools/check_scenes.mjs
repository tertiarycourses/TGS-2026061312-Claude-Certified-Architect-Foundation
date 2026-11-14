// Static check of every Day 1 lab's scenario board (no API calls): node docs/tools/check_scenes.mjs [N ...]
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const want = process.argv.slice(2).map(Number);
let bad = 0;
for (let n = 1; n <= 30; n++) {
  if (want.length && !want.includes(n)) continue;
  const f = resolve(here, `../sims/lab-${String(n).padStart(2, "0")}.js`);
  const src = readFileSync(f, "utf8");
  const lab = (await import(pathToFileURL(f))).default;
  const errs = [], sc = lab.scene;
  if (!sc) errs.push("no scene");
  else {
    if (!sc.title) errs.push("scene has no title");
    const ids = [];
    for (const ln of sc.lanes || []) {
      if (!ln.key || !ln.label || !(ln.stages || []).length) errs.push(`lane ${ln.key}: key, label and stages are required`);
      if (ln.tone && !["trap", "fix"].includes(ln.tone)) errs.push(`lane ${ln.key}: tone must be trap, fix or empty`);
      if (ln.on && !(ln.on instanceof RegExp)) errs.push(`lane ${ln.key}: on must be a RegExp`);
      if ((ln.stages || []).length > 5) errs.push(`lane ${ln.key}: ${ln.stages.length} stages (max 5 fit the board)`);
      for (const st of ln.stages || []) { ids.push(st.id); if (!st.t) errs.push(`stage ${st.id}: no title t`); if ((st.t || "").length > 30) errs.push(`stage ${st.id}: title over 30 chars`); if ((st.s || "").length > 60) errs.push(`stage ${st.id}: sub over 60 chars`); }
    }
    const dup = ids.filter((x, i) => ids.indexOf(x) !== i); if (dup.length) errs.push(`duplicate stage ids: ${dup.join(", ")}`);
    for (const m of src.matchAll(/s\.show\(\s*["'`]([^"'`$]+)["'`]/g)) if (!ids.includes(m[1])) errs.push(`s.show("${m[1]}") is not a stage id`);
    const trap = (sc.lanes || []).some((l) => l.tone === "trap"), fix = (sc.lanes || []).some((l) => l.tone === "fix");
    if (trap && fix && !/s\.pause\(/.test(src)) errs.push("trap + fix lanes but no s.pause()");
    if (trap && fix && !/compare\s*:/.test(src)) errs.push("trap + fix lanes but no compare in the result");
  }
  console.log(`${errs.length ? "FAIL" : "ok  "} lab ${n}${errs.length ? ": " + errs.join("; ") : ""}`);
  bad += errs.length ? 1 : 0;
}
process.exit(bad ? 1 : 0);
