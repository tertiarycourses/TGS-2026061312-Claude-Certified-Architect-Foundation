// Export every Day 1 lab's slide snippet and "see" text for the deck builder.
// Usage: node docs/tools/export_slides.mjs > slides.json
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const out = {};
for (let n = 1; n <= 30; n++) {
  const f = resolve(here, `../sims/lab-${String(n).padStart(2, "0")}.js`);
  if (!existsSync(f)) continue;
  const lab = (await import(pathToFileURL(f))).default;
  out[n] = { see: lab.see || null, try: lab.try || null, slide: lab.slide || null };
}
console.log(JSON.stringify(out, null, 1));
