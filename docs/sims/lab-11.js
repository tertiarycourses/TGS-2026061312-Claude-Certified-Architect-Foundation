// Lab 11 · Task 2.4 · Simulator 2: commit the MCP server, never the token.
// A virtual copy of Simulator 2's workspace: the project-scope .mcp.json (travels with git) and your
// user-scope ~/.claude.json (personal servers, never committed). Claude is asked to add a team Sentry
// server and is handed a personal token. The right result: the server goes into .mcp.json with a
// ${SENTRY_TOKEN} placeholder that Claude Code expands from each developer's own environment at load time.
const TOKEN = "sntrys_FAKE_lab11_do_not_commit_7f3a";
const FILES = {
  ".mcp.json": JSON.stringify({ mcpServers: {
    github: { command: "npx", args: ["-y", "@modelcontextprotocol/server-github"], env: { GITHUB_PERSONAL_ACCESS_TOKEN: "${GITHUB_TOKEN}" } },
    "orderly-docs": { command: "node", args: ["tools/docs-mcp/server.js"], env: { DOCS_API_KEY: "${DOCS_API_KEY}" } },
  } }, null, 2) + "\n",
  ".gitignore": "node_modules/\n.env\n.env.*\n.claude/settings.local.json\n",
  "CLAUDE.md": "# Orderly web app\n\n- Never commit secrets. Tokens come from environment variables only.\n- Shared MCP servers: `.mcp.json` (tokens expand from the environment).\n- Personal, experimental MCP servers: user scope (~/.claude.json), never the shared .mcp.json.\n",
  "package.json": JSON.stringify({ name: "orderly-web", private: true, scripts: { test: "vitest run" } }, null, 2) + "\n",
  "src/api/orders.ts": "export async function getOrder(id: string) {\n  return fetch(`/api/orders/${id}`).then((r) => r.json());\n}\n",
  "~/.claude.json": JSON.stringify({ mcpServers: { "sqlite-scratch": { command: "uvx", args: ["mcp-server-sqlite", "--db-path", "/tmp/scratch.db"] } } }, null, 2) + "\n",
};
const IGNORED = [/^node_modules\//, /(^|\/)\.env$/, /(^|\/)\.env\.[^/]+$/, /^\.claude\/settings\.local\.json$/];
const committed = (p) => !p.startsWith("~/") && !IGNORED.some((re) => re.test(p));
const LITERAL = /(sntrys_[A-Za-z0-9_]{8,}|ghp_[A-Za-z0-9]{10,}|sk-[A-Za-z0-9_-]{10,}|xox[a-z]-[A-Za-z0-9-]{10,})/g;
const expand = (v, env) => v.replace(/\$\{([A-Z0-9_]+)\}/g, (m, k) => (k in env ? env[k] : m));

export default {
  id: 11,
  see: "Claude adds a team 'sentry' server to .mcp.json with SENTRY_TOKEN set to ${SENTRY_TOKEN}, greps for your token to show no committed file holds it, and leaves ~/.claude.json alone, so the same file expands to a different token for each developer.",
  try: "Change the request to \"add a sentry server just for my own experiments\" and run it again: does Claude reach for user scope (~/.claude.json, blocked here by a deny rule) instead of the shared .mcp.json?",
  // The scenario board (assets/scene.js): the Orderly repo's MCP config, with a token pasted in, then with a placeholder.
  scene: {
    title: "Orderly repo: a team MCP server everyone gets from git, and a token nobody commits",
    caption: "Both lanes end in the same .mcp.json that every teammate clones. The difference is what sits in its env block: your literal token, or a ${VAR} placeholder that each developer's own environment fills.",
    lanes: [
      { key: "A", label: "Token pasted into .mcp.json", sub: "option A: a literal secret in a committed file", tone: "trap", on: /Phase 1/, stages: [
        { id: "amcp", icon: "📄", t: ".mcp.json today", s: "github + orderly-docs, ${VAR} placeholders" },
        { id: "apaste", icon: "🔑", t: "Paste the token in", s: "GITHUB_PERSONAL_ACCESS_TOKEN = \"ghp_…\"", diff: true },
        { id: "ateam", icon: "👥", t: "What each teammate loads", s: "alice and bob, after git pull" },
        { id: "ascan", icon: "🔍", t: "Secret scan of the commit", s: "want: 0 literal secrets in committed files", out: true } ] },
      { key: "B", label: "${SENTRY_TOKEN} placeholder", sub: "option D: Claude Code adds the team server, live", tone: "fix", on: /Phase 2/, stages: [
        { id: "bask", icon: "🗣", t: "Add a team sentry server", s: "your personal token is in the request" },
        { id: "bclaude", icon: "🤖", t: "Claude Code", s: "Read · Edit · Write · Grep · Glob, ~/ denied", claude: true },
        { id: "bedit", icon: "✏️", t: ".mcp.json gets sentry", s: "SENTRY_TOKEN: \"${SENTRY_TOKEN}\"", diff: true, tools: ["Read", "Edit", "Write", "Glob"] },
        { id: "bgrep", icon: "🔍", t: "Grep for the token", s: "proof: in no file git would commit", tools: ["Grep"] },
        { id: "bteam", icon: "👥", t: "What each teammate loads", s: "want: alice → her token, bob → his", out: true } ] },
    ],
  },
  slide: {
    title: "Commit the MCP server; each developer brings the token",
    code: `// .mcp.json: project scope, committed with git     KEY 1
{ "mcpServers": {
    "sentry": {
      "command": "npx",
      "args": ["-y", "@sentry/mcp-server"],
      "env": {
        "SENTRY_TOKEN": "\${SENTRY_TOKEN}" } } } }  // KEY 2

// each developer's shell, never committed           KEY 3
export SENTRY_TOKEN=sntrys_...

// ~/.claude.json: user scope, your experiments only  KEY 4`,
    keys: [["1", "Project scope travels", ".mcp.json in git gives everyone the server."],
           ["2", "A placeholder, not a secret", "${VAR} expands from the environment at load."],
           ["3", "Tokens stay personal", "Each developer exports their own token."],
           ["4", "User scope is personal", "Solo experiments never reach teammates."]],
  },
  async run(s, E) {
    const R = E.repo(FILES);
    const userBefore = R.fs["~/.claude.json"];

    s.log("== Phase 1: scan the committed config (no Claude call)", "note");
    const raw = R.fs[".mcp.json"];
    s.log(`.mcp.json servers: ${Object.keys(JSON.parse(raw).mcpServers).join(", ")} · placeholders: ${[...raw.matchAll(/\$\{([A-Z0-9_]+)\}/g)].map((m) => m[0]).join(", ")} · literal secrets: ${(raw.match(LITERAL) || []).length}`, "result");
    const leaky = raw.replace("${GITHUB_TOKEN}", "ghp_1234567890abcdefXYZ");
    s.log(`The trap (option A), pasted token: GITHUB_PERSONAL_ACCESS_TOKEN = "${leaky.match(LITERAL)[0]}" -> the scan flags ${(leaky.match(LITERAL) || []).length} literal secret in a file every teammate clones.`, "error");
    const leakyCount = (leaky.match(LITERAL) || []).length;
    const leakyEnv = JSON.parse(leaky).mcpServers.github.env;
    const pastedLoads = ["sntrys_alice_0001", "sntrys_bob_0002"].map((t) => expand(JSON.stringify(leakyEnv), { GITHUB_TOKEN: t }));
    const sameForAll = pastedLoads.every((x) => x === pastedLoads[0]);
    s.show("amcp", `${Object.keys(JSON.parse(raw).mcpServers).join(", ")} · ${(raw.match(LITERAL) || []).length} literal secrets`, "done");
    s.show("apaste", E.short(leaky.match(LITERAL)[0], 24), "done");
    s.show("ateam", sameForAll ? "alice and bob both load the pasted token" : "each loads their own token", "done");
    s.show("ascan", `${leakyCount} literal secret in .mcp.json`, leakyCount ? "bad" : "good");
    await s.pause({
      title: "The trap: a personal token pasted into the committed .mcp.json",
      outcome: `The secret scan finds **${leakyCount} literal secret** in .mcp.json, a file every teammate clones, and ${sameForAll ? "**every teammate loads the same personal token**" : "teammates load different tokens"}: there is no \${VAR} left to expand.`,
      next: "Ask Claude Code, live, to add a team sentry server without committing anyone's token",
    });

    // Write, as Claude Code has it: create or overwrite a file. A deny rule keeps Claude out of your user scope.
    const tools = { ...R.tools, Write: { description: "Create or overwrite a file with the given content.", input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
      run: ({ path, content }) => { R.fs[path] = content; return `Wrote ${path}`; } } };
    const preToolUse = (name, input) => ((name === "Edit" || name === "Write") && String(input.path || "").startsWith("~/")
      ? { deny: "Deny rule: Edit(~/.claude.json) and Write(~/.claude/**). User-scope config is outside this project." } : null);

    const ask = `Add a 'sentry' MCP server for the whole team to this project. It runs \`npx -y @sentry/mcp-server\` and needs a SENTRY_TOKEN environment variable. My personal token is ${TOKEN}. ` +
                "Set it up so every teammate gets the server from git but nobody's token is committed. Edit only files in this project. When you are done, search the project for the token string to confirm it is not in any committed file.";
    s.log(`== Phase 2, live: "${ask.replace(TOKEN, "<personal token>")}"`, "note");
    s.show("bask", "team server, from git, no token committed", "done");
    const run = await E.runAgent(s, {
      system: "You are Claude Code working in the Orderly repository. Paths are relative to the project root; ~/.claude.json is the user's personal Claude Code config. Use the tools to read and change files. Keep the final reply under 120 words.",
      prompt: ask, tools, preToolUse, maxTurns: 8, max_tokens: 2000,
    });

    let cfg = null; try { cfg = JSON.parse(R.fs[".mcp.json"]); } catch { /* invalid JSON fails check 1 */ }
    const sentry = cfg?.mcpServers?.sentry || null;
    const sentryText = JSON.stringify(sentry || {});
    const holding = Object.keys(R.fs).filter((p) => R.fs[p].includes(TOKEN));
    const leaked = holding.filter(committed);
    const greppedToken = run.calls.some((c) => c.name === "Grep" && /sntrys|FAKE_lab11|7f3a/.test(String(c.input.pattern)));
    const devs = { alice: { SENTRY_TOKEN: "sntrys_alice_0001" }, bob: { SENTRY_TOKEN: "sntrys_bob_0002" } };
    const perDev = Object.fromEntries(Object.entries(devs).map(([d, env]) => [d, expand(JSON.stringify(sentry?.env || sentry?.headers || {}), env)]));

    s.log("\n== The result in the repository", "note");
    s.log(`.mcp.json sentry server: ${sentry ? sentryText : "(none)"}`, sentry ? "result" : "error");
    s.log(`Files holding the personal token: ${holding.join(", ") || "none"} (committed by git: ${leaked.join(", ") || "none"})`, leaked.length ? "error" : "result");
    s.log(`At load time Claude Code expands \${SENTRY_TOKEN} per developer: alice -> ${perDev.alice}, bob -> ${perDev.bob}`, "note");
    s.log(`~/.claude.json (user scope): ${R.fs["~/.claude.json"] === userBefore ? "unchanged" : "CHANGED"}`, R.fs["~/.claude.json"] === userBefore ? "result" : "error");

    const placeholder = sentryText.includes("${SENTRY_TOKEN}");
    const userSame = R.fs["~/.claude.json"] === userBefore;
    const perDevOk = placeholder && perDev.alice.includes("sntrys_alice_0001") && perDev.bob.includes("sntrys_bob_0002");
    const fixOk = !!sentry && perDevOk && leaked.length === 0 && userSame;
    s.show("bedit", sentry ? E.short(JSON.stringify(sentry.env || sentry.headers || {}), 40) : "no sentry server", sentry ? "done" : "bad");
    s.show("bgrep", greppedToken ? `grepped · token in ${leaked.length} committed file(s)` : "never grepped for the token", "done");
    s.show("bteam", perDevOk ? `alice → …alice_0001 · bob → …bob_0002 · leaked ${leaked.length}` : `${placeholder ? "placeholder" : "no placeholder"} · leaked in ${leaked.join(", ") || "none"}`, fixOk ? "good" : "bad");
    const yes = (v, want = true) => ({ v: v ? "yes" : "no", tone: v === want ? "good" : "bad" });
    return {
      final: run.text,
      compare: {
        cols: [
          { title: "Token pasted into .mcp.json (A)", short: "Pasted token", tone: "trap",
            verdict: `Not run with Claude: the scan of the same .mcp.json with one token pasted in finds ${leakyCount} literal secret, and ${sameForAll ? "every clone loads that one person's token" : "the clones differ"}.` },
          { title: "${SENTRY_TOKEN} placeholder, added live (D)", short: "Placeholder", tone: "fix", said: run.text,
            verdict: fixOk ? `Claude added the sentry server with \`\${SENTRY_TOKEN}\`; the token is in no committed file${greppedToken ? " (Claude grepped to prove it)" : ""}, and ~/.claude.json is untouched.`
              : `sentry server ${sentry ? "added" : "missing"}, placeholder ${placeholder ? "used" : "not used"}, token in committed files: ${leaked.join(", ") || "none"}, ~/.claude.json ${userSame ? "unchanged" : "changed"}. Read the live output: Claude writes each run fresh.` },
        ],
        rows: [
          ["What the env block holds", "`ghp_…` (a literal token)", sentry ? `\`${E.short(JSON.stringify(sentry.env || sentry.headers || {}), 60)}\`` : "no sentry server"],
          ["Literal secrets in committed files", { v: String(leakyCount), tone: leakyCount ? "bad" : "good" }, { v: String(leaked.length), tone: leaked.length ? "bad" : "good" }],
          ["What alice loads", { v: sameForAll ? "the pasted token" : pastedLoads[0], tone: "bad" }, { v: perDev.alice, tone: perDev.alice.includes("sntrys_alice_0001") ? "good" : "bad" }],
          ["What bob loads", { v: sameForAll ? "the same pasted token" : pastedLoads[1], tone: "bad" }, { v: perDev.bob, tone: perDev.bob.includes("sntrys_bob_0002") ? "good" : "bad" }],
          ["~/.claude.json (user scope) unchanged", "— (not run live)", yes(userSame)],
          ["Grepped to prove no token is committed", "— (not run live)", yes(greppedToken)],
        ],
        note: "Both lanes commit the same file to the same repo. Only the env value differs: a literal token travels to every clone, while a ${VAR} placeholder is expanded at load time from each developer's own environment.",
      },
      checks: [
        E.check("The project .mcp.json is still valid JSON and now has a 'sentry' server running @sentry/mcp-server", !!sentry && /@sentry\/mcp-server/.test(sentryText)),
        E.check("Its token is the ${SENTRY_TOKEN} placeholder, which expands to each developer's own token", sentryText.includes("${SENTRY_TOKEN}") && perDev.alice.includes("sntrys_alice_0001") && perDev.bob.includes("sntrys_bob_0002")),
        E.check(`The personal token is in no file git would commit (committed: ${leaked.join(", ") || "none"})`, leaked.length === 0),
        E.check("Your user-scope MCP servers in ~/.claude.json are unchanged", R.fs["~/.claude.json"] === userBefore),
        E.check("Claude grepped the project for the token to prove it was not committed", greppedToken),
      ],
    };
  },
};
