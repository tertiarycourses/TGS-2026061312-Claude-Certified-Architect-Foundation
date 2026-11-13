// Lab 12 · Task 2.5 · Simulator 4: /find-callers needs Grep with a glob, not Glob, not Bash grep.
// A virtual copy of Simulator 4's sample_repo. Claude gets Claude Code's built-in search tools, modelled
// on their real parameters: Grep (pattern, path, glob, type, output_mode: content | files_with_matches |
// count, -n, -i, -C), Glob (file NAMES), Read (one whole file) and Bash (a shell, where grep also works).
const FILES = {
  "src/__init__.py": "",
  "src/billing/__init__.py": "",
  "src/billing/invoice.py": `"""Invoice totals for the legacy billing module."""\nfrom decimal import Decimal\n\nTAX_RATE = Decimal("0.09")\n\n\ndef line_total(qty, unit_price):\n    total = Decimal(qty) * Decimal(unit_price)\n    return total\n\n\ndef calculate_total(lines, discount=Decimal("0")):\n    total = sum(line_total(q, p) for q, p in lines)\n    total = total - discount\n    total = total + total * TAX_RATE\n    return total\n`,
  "src/billing/validation.py": `from decimal import Decimal\nfrom .invoice import calculate_total\n\n\ndef validate_invoice(lines, stated_total):\n    computed = calculate_total(lines)\n    if abs(computed - Decimal(stated_total)) > Decimal("0.01"):\n        raise ValueError(f"stated {stated_total} != computed {computed}")\n    return computed\n`,
  "src/legacy/__init__.py": `from .report import monthly_report\n__all__ = ["monthly_report"]\n`,
  "src/legacy/report.py": `from src.billing.invoice import calculate_total\n\n\ndef monthly_report(invoices):\n    return {inv_id: calculate_total(lines) for inv_id, lines in invoices.items()}\n`,
  "tests/test_invoice.py": `from decimal import Decimal\nfrom src.billing.invoice import calculate_total\n\n\ndef test_total_with_tax():\n    assert calculate_total([(2, "10.00")]) == Decimal("21.80")\n`,
  "tests/test_validation.py": `import pytest\nfrom src.billing.validation import validate_invoice\n\n\ndef test_rejects_mismatch():\n    with pytest.raises(ValueError):\n        validate_invoice([(1, "10.00")], "99.00")\n`,
  "docs/architecture.txt": "Billing module: invoice.py computes totals; validation.py compares against stated totals.\nLegacy report.py wraps calculate_total for the monthly job.\n",
  "docs/runbook.txt": "Monthly billing job: run python -m src.legacy.report after the 1st of each month.\n",
};
const HELPER = "calculate_total";

export default {
  id: 12,
  see: "One Grep call for calculate_total, scoped to Python files (a *.py glob or type py) with output_mode content, returns every match as file:line: text; no grep through Bash, no whole-file reads, and docs/architecture.txt stays out of the answer.",
  try: "Change the request to \"find every file named after the helper\" and run it again: Claude should switch to Glob, because that question is about file NAMES, not contents.",
  slide: {
    title: "Callers live inside files: search contents with Grep",
    code: `# /find-callers calculate_total
Grep(pattern="calculate_total",          # KEY 1
     glob="**/*.py",                     # KEY 2
     output_mode="content", -n=true)     # KEY 3
# -> src/legacy/report.py:5: return {...calculate_total(...
#    validation.py:6: computed = calculate_total(...

# not this: Glob matches NAMES only
Glob("**/calculate_total.py")  # -> no files       KEY 4
# not this: Bash("grep -rn ...")  shell + permissions`,
    keys: [["1", "Grep searches contents", "A caller is a line of code, not a file name."],
           ["2", "A glob scopes the search", "Only Python files; docs/ stays out."],
           ["3", "content mode gives lines", "file:line: text, ready to jump to."],
           ["4", "Glob and Bash are traps", "Names only, or a shell you must parse."]],
  },
  async run(s, E) {
    const R = E.repo(FILES);
    const fs = R.fs;
    // Glob matching with ** spanning any number of folders (placeholders keep ** and * from colliding).
    const globList = (pat) => {
      const re = new RegExp("^" + pat.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\//g, "\u0001").replace(/\*\*/g, "\u0002").replace(/\*/g, "[^/]*")
        .replace(/\?/g, "[^/]").replace(/\u0001/g, "(?:.*/)?").replace(/\u0002/g, ".*") + "$");
      return Object.keys(fs).filter((f) => re.test(f)).sort();
    };
    const inScope = (glob, type) => {
      let files = glob ? globList(glob.includes("/") ? glob : `**/${glob}`) : Object.keys(fs).sort();
      if (type) files = files.filter((f) => f.endsWith("." + type));
      return files;
    };
    const grep = ({ pattern, path, glob, type, output_mode = "files_with_matches", ...o }) => {
      let re; try { re = new RegExp(pattern, o["-i"] ? "i" : ""); } catch { return { isError: true, message: "Invalid regular expression" }; }
      const files = inScope(glob, type).filter((f) => !path || path === "." || f.startsWith(path.replace(/^\.\//, "").replace(/\/?$/, "/")) || f === path);
      const hits = {}; const C = Number(o["-C"] || 0);
      for (const f of files) fs[f].split("\n").forEach((ln, i, all) => { if (re.test(ln)) (hits[f] ||= []).push(C ? all.slice(Math.max(0, i - C), i + C + 1).map((x, j) => `${f}:${Math.max(0, i - C) + j + 1}: ${x}`).join("\n") : `${f}:${i + 1}: ${ln.trim()}`); });
      if (!Object.keys(hits).length) return "No matches found";
      if (output_mode === "content") return Object.values(hits).flat().join("\n");
      if (output_mode === "count") return Object.entries(hits).map(([f, h]) => `${f}: ${h.length}`).join("\n");
      return `Found ${Object.keys(hits).length} files\n${Object.keys(hits).join("\n")}`;
    };
    const tools = {
      Grep: { description: "A powerful search tool for file CONTENTS, built on ripgrep. Supports full regex syntax. Filter files with the glob parameter (e.g. \"*.js\", \"**/*.tsx\") or the type parameter (e.g. \"js\", \"py\"). output_mode: \"content\" shows matching lines (with -n line numbers), \"files_with_matches\" shows only file paths (default), \"count\" shows match counts. ALWAYS use Grep for search tasks; never invoke grep or rg as a Bash command.",
        input_schema: { type: "object", properties: { pattern: { type: "string" }, path: { type: "string" }, glob: { type: "string" }, type: { type: "string" },
          output_mode: { type: "string", enum: ["content", "files_with_matches", "count"] }, "-n": { type: "boolean" }, "-i": { type: "boolean" }, "-C": { type: "number" } }, required: ["pattern"] },
        run: grep },
      Glob: { ...R.tools.Glob, run: ({ pattern }) => globList(pattern).join("\n") || "No files match.", description: "Fast file-pattern matching on file NAMES and paths, e.g. \"**/*.py\" or \"src/**/*.ts\". Returns matching file paths. It does not look inside files." },
      Read: { ...R.tools.Read, description: "Read a whole file from the repository. Input: path." },
      Bash: { description: "Run a shell command in the repository and return stdout.", input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
        run: ({ command }) => {
          const words = (String(command).match(/"[^"]*"|'[^']*'|\S+/g) || []).map((w) => w.replace(/^["']|["']$/g, ""));
          const at = words.findIndex((w) => w === "grep" || w === "rg");
          if (at < 0) return `bash: ${words[0]}: not available in this sandbox`;
          const pattern = words.slice(at + 1).find((w) => !w.startsWith("-"));
          const inc = (words.find((w) => w.startsWith("--include=")) || "").slice(10) || undefined;
          return pattern ? grep({ pattern, glob: inc, output_mode: "content" }) : "usage: grep PATTERN [FILE...]";
        } },
    };

    s.log("== Phase 1: the traps, run without Claude", "note");
    const byName = globList(`**/${HELPER}.py`);
    s.log(`Option A, Glob("**/${HELPER}.py") -> ${byName.length ? byName.join(", ") : "no files"}. File NAMES can't show callers.`, "error");
    const py = globList("**/*.py"); const chars = py.reduce((t, f) => t + fs[f].length, 0);
    s.log(`Option C, Glob("**/*.py") then Read each -> ${py.length} files, ${chars} characters loaded into context just to scan them (a real repo has thousands).`, "error");

    const ask = `Implement what a /find-callers command would do: locate every reference to the renamed helper \`${HELPER}\` in Python source files only, and give me file:line plus the matching line so I can jump to each. Do not read whole files.`;
    s.log(`\n== Phase 2, live: "${ask}"`, "note");
    const run = await E.runAgent(s, {
      system: "You are Claude Code in a payments repository (Python). Use the built-in tools. Keep the final answer to the list of matches and one line of summary.",
      prompt: ask, tools, maxTurns: 4, max_tokens: 1500,
    });

    const greps = run.calls.filter((c) => c.name === "Grep" && String(c.input.pattern).includes(HELPER));
    const scoped = greps.some((c) => (String(c.input.glob || "").endsWith(".py") || c.input.type === "py") && c.input.output_mode === "content");
    const bashGrep = run.calls.some((c) => c.name === "Bash" && /\b(grep|rg|find)\b/.test(String(c.input.command)));
    const reads = run.calls.filter((c) => c.name === "Read").length;
    const expected = []; for (const f of py) fs[f].split("\n").forEach((ln, i) => { if (ln.includes(HELPER)) expected.push([f, i + 1]); });
    const reply = run.text || "";
    const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const missing = expected.filter(([f, n]) => !new RegExp(`(${esc(f)}|${esc(f.split("/").pop())}):${n}\\b`).test(reply));
    s.log(`\nExpected ${expected.length} references in Python files; the reply ${missing.length ? `misses ${missing.map(([f, n]) => `${f}:${n}`).join(", ")}` : "lists all of them"}; docs/architecture.txt in the reply: ${/architecture\.txt/.test(reply) ? "yes" : "no"}.`, missing.length ? "error" : "result");

    return {
      final: reply,
      checks: [
        E.check(`Claude used the built-in Grep with pattern ${HELPER} (${greps.length} call${greps.length === 1 ? "" : "s"})`, greps.length >= 1),
        E.check("Grep was scoped to Python files (a *.py glob or type py) with output_mode content", scoped),
        E.check(`No grep through Bash and fewer than 3 Read calls (Read calls: ${reads})`, !bashGrep && reads < 3),
        E.check(`The reply gives file:line for all ${expected.length} Python references and none from docs/`, missing.length === 0 && !/architecture\.txt/.test(reply)),
      ],
    };
  },
};
