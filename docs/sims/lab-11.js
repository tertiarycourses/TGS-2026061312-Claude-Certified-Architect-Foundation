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

    // Write, as Claude Code has it: create or overwrite a file. A deny rule keeps Claude out of your user scope.
    const tools = { ...R.tools, Write: { description: "Create or overwrite a file with the given content.", input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
      run: ({ path, content }) => { R.fs[path] = content; return `Wrote ${path}`; } } };
    const preToolUse = (name, input) => ((name === "Edit" || name === "Write") && String(input.path || "").startsWith("~/")
      ? { deny: "Deny rule: Edit(~/.claude.json) and Write(~/.claude/**). User-scope config is outside this project." } : null);

    const ask = `Add a 'sentry' MCP server for the whole team to this project. It runs \`npx -y @sentry/mcp-server\` and needs a SENTRY_TOKEN environment variable. My personal token is ${TOKEN}. ` +
                "Set it up so every teammate gets the server from git but nobody's token is committed. Edit only files in this project. When you are done, search the project for the token string to confirm it is not in any committed file.";
    s.log(`\n== Phase 2, live: "${ask.replace(TOKEN, "<personal token>")}"`, "note");
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

    return {
      final: run.text,
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
