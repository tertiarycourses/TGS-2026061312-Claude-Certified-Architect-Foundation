// Lab 3 · Task 1.3 · Simulator 2 (Case UC-25): /parallel-review can't fan out until the coordinator
// auto-approves its delegation tool. This lab emulates an Agent SDK run in JS: allowedTools auto-approves
// the tools it lists; any other tool falls through to the permission prompt, and a headless SDK run has
// no one to answer it, so the call is refused. The repository is pinned to a pre-v2.1.63 configuration,
// so the delegation tool is called Task (current Claude Code calls the same tool Agent).
import { WORKSPACE } from "./shared/t1-workspace.js";

const DELEGATE = "Task";                   // pre-v2.1.63 name; set to "Agent" for a current configuration
const AGENTS = {                           // cases/agents-review.json in the Python simulator
  "style-reviewer": {
    description: "Reviews one JavaScript file for correctness and returns a one-line verdict",
    prompt: "Read the file you are given and reply with exactly one line starting with VERDICT: followed by your assessment.",
    tools: ["Read"],
  },
};
const PROMPT = "/parallel-review: Use the style-reviewer agent to review src/utils/quantity.js and report its one-line verdict verbatim. If you cannot delegate, say exactly: DELEGATION BLOCKED.";

// One emulated SDK run: query(prompt, options = { allowedTools, agents }).
async function sdkRun(s, E, allowedTools) {
  const r = E.repo(WORKSPACE);
  const spawned = [];
  const permission = [];                  // every call that fell through to the permission prompt
  const tools = {
    Read: r.tools.Read, Grep: r.tools.Grep, Glob: r.tools.Glob,
    [DELEGATE]: {
      description: `Launch a subagent to handle a task. Available agent types: ${Object.entries(AGENTS).map(([k, a]) => `${k} (${a.description})`).join("; ")}. The subagent starts with an empty context: put everything it needs in prompt.`,
      input_schema: { type: "object", properties: { subagent_type: { type: "string", enum: Object.keys(AGENTS) }, description: { type: "string" }, prompt: { type: "string" } }, required: ["subagent_type", "prompt"] },
      run: async ({ subagent_type, prompt }) => {
        const def = AGENTS[subagent_type];
        if (!def) return { isError: true, message: `No agent type ${subagent_type}` };
        const sub = await E.runAgent(s, {
          label: `(subagent ${subagent_type})`,
          system: def.prompt,
          prompt,
          tools: Object.fromEntries(def.tools.map((t) => [t, r.tools[t]])),
          maxTurns: 3, max_tokens: 400,
        });
        spawned.push({ subagent_type, prompt, sub });
        return sub.text || "(the subagent returned no text)";
      },
    },
  };
  s.log(`options = { allowedTools: [${allowedTools.join(", ")}], agents: { style-reviewer } }`, "note");
  const run = await E.runAgent(s, {
    system: "You are Claude Code running headless (SDK) in the Orderly repository. Use your tools to complete the command.",
    prompt: PROMPT,
    tools,
    maxTurns: 4, max_tokens: 600,
    // The SDK's permission flow, emulated: listed tools are auto-approved; anything else needs a human.
    preToolUse: (name) => {
      if (allowedTools.includes(name)) return null;
      permission.push(name);
      s.log(`    permission prompt: "Allow ${name}?" (not in allowedTools). Headless run: no one can answer, so the call is refused.`, "deny");
      return { deny: `Permission required: ${name} is not auto-approved by allowedTools and this headless run cannot show an interactive prompt.` };
    },
  });
  return { run, spawned, permission };
}

export default {
  id: 3,
  see: `Run 1 (allowedTools Read, Grep, Glob): Claude calls ${DELEGATE}, the call drops to a permission prompt nobody can answer, no reviewer spawns, and the reply is DELEGATION BLOCKED. Run 2 (Task added to the coordinator's allowedTools): the style-reviewer subagent spawns, reads quantity.js, and its VERDICT line comes back.`,
  try: "Change DELEGATE to \"Agent\" at the top of this lab's code (the current Claude Code name) and keep \"Task\" in allowedTools for run 2: the delegation is refused again, because allowedTools matches tool names exactly.",
  explain: "allowedTools auto-approves only the tools it lists. With Read, Grep and Glob alone, the coordinator's first delegation call falls through to the permission flow; a headless SDK run cannot show the prompt, so the fan-out stalls and no reviewer ever starts. Adding the delegation tool to the coordinator's allowedTools lets the subagent spawn, run with its own tools and empty context, and hand its verdict back. Note that the delegation tool was offered to Claude both times: allowedTools is not a hard allow-list, it decides what runs without asking. This lab uses Task, as in the exam's pinned pre-v2.1.63 setup; current Claude Code calls the same tool Agent.",
  slide: {
    title: "The coordinator must auto-approve its delegation tool",
    code: `options = ClaudeAgentOptions(
    allowed_tools=["Read", "Grep", "Glob",
                   "Task"],                     # KEY 1
    agents={"style-reviewer": reviewer},        # KEY 2
)
def permission(name):                           # KEY 3
    if name in options.allowed_tools:
        return allow()                     # auto-approved
    return ask_human(name)   # headless: no one answers

query("/parallel-review src/utils/quantity.js",
      options)                                  # KEY 4`,
    keys: [["1", "Task on the coordinator", "The one delegating must auto-approve it."],
           ["2", "Agents defined is not enough", "A defined subagent still needs Task approved."],
           ["3", "Auto-approve, not allow-list", "Unlisted tools fall through to a prompt."],
           ["4", "Same command, now fans out", "The reviewer's VERDICT comes back."]],
  },
  async run(s, E) {
    s.log(`Case UC-25 · repository pinned to a pre-v2.1.63 configuration: delegation uses the ${DELEGATE} tool.`, "note");
    s.log("== Run 1 · allowedTools = Read, Grep, Glob (delegation not auto-approved)", "note");
    const r1 = await sdkRun(s, E, ["Read", "Grep", "Glob"]);
    s.log(`== Run 2 · allowedTools = Read, Grep, Glob, ${DELEGATE}`, "note");
    const r2 = await sdkRun(s, E, ["Read", "Grep", "Glob", DELEGATE]);
    const sub = r2.spawned[0]?.sub;
    const verdict = (sub?.text || "").match(/VERDICT:.*/)?.[0] || "";
    return {
      final: r2.run.text,
      checks: [
        E.check(`Run 1: Claude tried ${DELEGATE}, it fell to the permission prompt, and no subagent spawned`, r1.permission.includes(DELEGATE) && r1.spawned.length === 0),
        E.check("Run 1: the coordinator reported DELEGATION BLOCKED", /DELEGATION BLOCKED/.test(r1.run.text)),
        E.check(`Run 2: ${DELEGATE} was auto-approved and the style-reviewer read src/utils/quantity.js`, r2.permission.length === 0 && !!sub && sub.calls.some((c) => c.name === "Read" && /quantity\.js$/.test(c.input.path || "") && !c.isError)),
        E.check("Run 2: the subagent's VERDICT line came back in the final reply", !!verdict && /VERDICT/.test(r2.run.text)),
      ],
    };
  },
};
