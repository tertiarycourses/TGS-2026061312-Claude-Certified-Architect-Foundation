// Lab 21 · Task 4.3 · Simulator 6: know your tool_choice options, and check what came back.
// Three extraction tools (invoice, receipt, credit note), all strict: true. The pipeline runs with the three
// tool_choice settings it might use, and after EVERY call the script checks for a tool_use block before it
// reads anything:
//   auto                      Claude decides: it may call a tool, or answer in prose
//   any                       Claude must call one of the tools, and picks which (document type unknown)
//   {type:"tool", name:...}   Claude must call that one tool (with disable_parallel_tool_use: exactly one)
// DOC-08 is a supplier price notice that none of the three schemas fits: it shows what each setting does
// when the input is not what you expected.
import { DOCS, TYPED_TOOLS, TOOL_FOR_TYPE } from "./shared/t4-extract.js";

const SYSTEM = "You are an accounts-payable assistant. You have tools that record financial documents as structured data.";

function toolsFor() {
  const t = {};
  for (const [name, def] of Object.entries(TYPED_TOOLS)) t[name] = { ...def, run: () => "Recorded." };
  return t;
}

// One request, then the check every caller must make: did a tool_use block come back?
async function extract(s, E, id, tool_choice) {
  s.log(`-- ${id} (${DOCS[id].type === "notice" ? "a price notice" : "type unknown to the script"}) · tool_choice ${JSON.stringify(tool_choice)}`, "note");
  const run = await E.runAgent(s, { system: SYSTEM, prompt: `<document id="${id}">\n${DOCS[id].text}\n</document>\nRecord this document.`, tools: toolsFor(), tool_choice, maxTurns: 1 });
  const uses = s.trace[s.trace.length - 1].tools;
  if (!uses.length) s.log(`   check: NO tool_use block (stop_reason ${run.stop_reason}): nothing to parse, so the script does not treat the prose as data`, "error");
  else s.log(`   check: ${uses.length} tool_use block(s): ${uses.map((u) => u.name).join(", ")}; safe to read the input`, "result");
  return { id, stop_reason: run.stop_reason, uses, text: run.text };
}

export default {
  id: 21,
  see: "auto: the invoice comes back as a tool_use block, the price notice as prose, and the check catches it. any: every document comes back as a tool call, the receipt and credit note on their own schemas, and even the price notice is forced into extract_invoice. Forced: exactly one extract_invoice block.",
  try: "Add a fourth tool, record_other_document (document_kind, summary), rerun, and see where tool_choice any now files the price notice.",
  // The scenario board (assets/scene.js): the same three strict extraction tools under three tool_choice settings.
  scene: {
    title: "Accounts payable: invoices, receipts, a credit note, and a price notice that fits no schema",
    caption: "Every lane sends the same three strict tools (extract_invoice, extract_receipt, extract_credit_note); only tool_choice changes. After every call the script checks for a tool_use block before it reads anything.",
    lanes: [
      { key: "auto", label: "tool_choice auto", sub: "Claude decides: a tool call, or prose", tone: "trap", on: /^1 · tool_choice auto/, stages: [
        { id: "a_set", icon: "⚙", t: "{\"type\": \"auto\"}", s: "a tool call is allowed, not required", diff: true },
        { id: "a_claude", icon: "🤖", t: "Claude reads the document", s: "3 strict extraction tools offered", claude: true },
        { id: "a_doc04", icon: "🧾", t: "DOC-04 invoice", s: "INV-2043 Northgate Logistics · 456.00" },
        { id: "a_doc08", icon: "📢", t: "DOC-08 price notice", s: "prices rise 5% from 1 Dec: no schema fits" },
        { id: "a_chk", icon: "🔍", t: "tool_use check", s: "want: a tool_use block on every call", out: true } ] },
      { key: "any", label: "tool_choice any", sub: "a tool call is required; Claude picks the schema", tone: "fix", on: /^2 · tool_choice any/, stages: [
        { id: "y_set", icon: "⚙", t: "{\"type\": \"any\"}", s: "must call one of the three; type unknown", diff: true },
        { id: "y_claude", icon: "🤖", t: "Claude picks a tool", s: "invoice, receipt or credit note", claude: true },
        { id: "y_typed", icon: "📑", t: "DOC-03 · DOC-05 · DOC-02", s: "receipt · credit note · invoice" },
        { id: "y_doc08", icon: "📢", t: "DOC-08 price notice", s: "a call is required, but no schema fits" },
        { id: "y_chk", icon: "🔍", t: "tool_use check", s: "want: 4/4 tool calls, matching schemas", out: true } ] },
      { key: "forced", label: "Forced: extract_invoice", sub: "this step must produce exactly one invoice record", on: /^3 · forced/, stages: [
        { id: "f_set", icon: "📌", t: "{type: tool, name: …}", s: "extract_invoice, disable_parallel_tool_use", diff: true },
        { id: "f_claude", icon: "🤖", t: "Claude fills the schema", s: "no choice of tool, no prose", claude: true },
        { id: "f_doc04", icon: "🧾", t: "DOC-04 invoice", s: "want: total_due 456" },
        { id: "f_chk", icon: "🔍", t: "tool_use check", s: "want: exactly one extract_invoice block", out: true } ] },
    ],
  },
  slide: {
    title: "auto may talk, any must call, a named tool is forced",
    code: `tools = [extract_invoice, extract_receipt,
         extract_credit_note]                  # strict: true
r = claude(doc, tools,
           tool_choice={"type": "auto"})       # KEY 1
r = claude(doc, tools,
           tool_choice={"type": "any"})        # KEY 2
r = claude(doc, tools, tool_choice={"type": "tool",
           "name": "extract_invoice",          # KEY 3
           "disable_parallel_tool_use": True})
block = next((b for b in r.content            # KEY 4
              if b.type == "tool_use"), None)
if block is None: raise NoExtraction(r)`,
    keys: [["1", "auto", "Claude may answer in prose instead."],
           ["2", "any", "Some tool must be called; Claude picks."],
           ["3", "A named tool", "Forces that schema; one call."],
           ["4", "Always check", "No tool_use block, no data."]],
  },
  async run(s, E) {
    s.log("== 1 · tool_choice auto: Claude decides whether to call a tool", "note");
    const autoInv = await extract(s, E, "DOC-04", { type: "auto" });
    const autoNotice = await extract(s, E, "DOC-08", { type: "auto" });
    const got = (r) => r.uses.length ? `tool_use ${r.uses.map((u) => u.name).join(", ")}` : `prose, stop_reason ${r.stop_reason}`;
    s.show("a_set", "auto on DOC-04 and DOC-08", "done");
    s.show("a_doc04", got(autoInv), autoInv.uses.length ? "good" : "bad");
    s.show("a_doc08", got(autoNotice), autoNotice.uses.length ? "done" : "bad");
    const autoTool = [autoInv, autoNotice].filter((r) => r.uses.length).length;
    s.show("a_chk", autoTool === 2 ? "2/2 tool calls this time" : `${autoTool}/2 tool calls: the check caught the prose`, autoTool === 2 ? "good" : "bad");
    await s.pause({
      title: "tool_choice auto finished",
      outcome: `DOC-04 came back as **${got(autoInv)}**; DOC-08, the price notice, came back as **${got(autoNotice)}**. ` +
        (autoNotice.uses.length ? "This run called a tool both times, but auto never promises it." : "No tool_use block means nothing to parse: without the check, the pipeline would have tried to read prose as data."),
      next: "tool_choice any: a tool call is required, and Claude picks the schema for each document",
    });

    s.log("== 2 · tool_choice any: extraction must come back as a tool call, and the document type is unknown, so Claude picks the schema", "note");
    const anyRuns = [];
    for (const id of ["DOC-03", "DOC-05", "DOC-02", "DOC-08"]) anyRuns.push(await extract(s, E, id, { type: "any" }));
    const typed = anyRuns.filter((r) => r.id !== "DOC-08");
    const anyNotice = anyRuns.find((r) => r.id === "DOC-08");
    const matched = typed.filter((r) => r.uses.length && r.uses.every((u) => u.name === TOOL_FOR_TYPE[DOCS[r.id].type]));
    const anyTool = anyRuns.filter((r) => r.stop_reason === "tool_use" && r.uses.length).length;
    const anyGood = anyTool === anyRuns.length && matched.length === typed.length;
    s.show("y_set", "any on 4 documents", "done");
    s.show("y_typed", typed.map((r) => `${r.id} -> ${r.uses.map((u) => u.name.replace("extract_", "")).join(",") || "none"}`).join(" · "), matched.length === typed.length ? "good" : "bad");
    s.show("y_doc08", `${got(anyNotice)}${anyNotice.uses.length ? " (forced into a schema)" : ""}`, "done");
    s.show("y_chk", `${anyTool}/${anyRuns.length} tool calls · ${matched.length}/${typed.length} schemas match`, anyGood ? "good" : "bad");
    await s.pause({
      title: "tool_choice any finished",
      outcome: `**${anyTool}/${anyRuns.length}** documents came back as tool calls, and Claude picked the matching schema for **${matched.length}/${typed.length}** typed documents. ` +
        `The price notice came back as **${got(anyNotice)}**: any guarantees a call, not that a schema fits.`,
      next: "A forced named tool: this step must produce exactly one extract_invoice record from DOC-04",
    });

    s.log("== 3 · forced named tool: this step must produce exactly one invoice record", "note");
    const forced = await extract(s, E, "DOC-04", { type: "tool", name: "extract_invoice", disable_parallel_tool_use: true });
    const forcedOk = forced.uses.length === 1 && forced.uses[0].name === "extract_invoice" && Number(forced.uses[0].input.total_due) === 456;
    s.show("f_set", "extract_invoice, one call", "done");
    s.show("f_doc04", forced.uses.length ? `total_due ${forced.uses[0].input.total_due}` : "no tool_use block", forcedOk ? "good" : "bad");
    s.show("f_chk", `${forced.uses.length} block(s): ${forced.uses.map((u) => u.name).join(", ") || "none"}`, forcedOk ? "good" : "bad");

    const all = [autoInv, autoNotice, ...anyRuns, forced];
    const picked = typed.map((r) => `${r.id} ${DOCS[r.id].type} -> ${r.uses.map((u) => u.name).join(", ") || "no tool"}`);
    const required = (u) => Object.keys(TYPED_TOOLS[u.name].input_schema.properties).every((k) => k in u.input);
    const show = (r) => r.uses.length ? r.uses.map((u) => `${u.name} ${JSON.stringify(u.input)}`).join(" ") : `no tool_use block, prose: "${E.short(r.text, 160)}"`;
    const final = [
      `auto · DOC-04 invoice: ${show(autoInv)}`,
      `auto · DOC-08 price notice: ${show(autoNotice)}`,
      ...typed.map((r) => `any · ${r.id} ${DOCS[r.id].type}: ${show(r)}`),
      `any · DOC-08 price notice: ${show(anyNotice)}`,
      `forced extract_invoice · DOC-04: ${show(forced)}`,
    ].join("\n");
    const toolCell = (r) => ({ v: r.uses.length ? r.uses.map((u) => `\`${u.name}\``).join(", ") : `prose (\`${r.stop_reason}\`)`, tone: r.uses.length ? "good" : "bad" });
    return {
      final,
      compare: {
        cols: [
          { title: "tool_choice auto", short: "auto", tone: "trap", said: autoNotice.uses.length ? undefined : autoNotice.text,
            verdict: autoNotice.uses.length ? `Called a tool both times this run (DOC-08 -> ${autoNotice.uses.map((u) => u.name).join(", ")}). auto still allows prose, so the check stays.`
                                            : `DOC-04 came back as a tool call, but DOC-08 came back as **prose** (\`${autoNotice.stop_reason}\`): no tool_use block, nothing to parse. The check caught it.` },
          { title: "tool_choice any", short: "any", tone: "fix",
            verdict: anyGood ? `All ${anyRuns.length} documents came back as tool calls, each typed document on its own schema. Right for an unknown type, but the price notice was still forced into **${anyNotice.uses.map((u) => u.name).join(", ") || "no tool"}**: a call is guaranteed, a fitting schema is not.`
                             : `${anyTool}/${anyRuns.length} tool calls, ${matched.length}/${typed.length} matching schemas. Read the live output: Claude writes each run fresh.` },
          { title: "Forced: extract_invoice", short: "forced", tone: "",
            verdict: forcedOk ? "Exactly one `extract_invoice` block, total_due 456. Use it when the step must produce that one record and you know the type." : `Got ${forced.uses.length} block(s): ${forced.uses.map((u) => u.name).join(", ") || "none"}. Read the live output.` },
        ],
        rows: [
          ["DOC-04 invoice", toolCell(autoInv), "not sent", toolCell(forced)],
          ["DOC-03 receipt · DOC-05 credit note · DOC-02 invoice", "not sent", { v: typed.map((r) => `${r.id}: ${r.uses.map((u) => u.name).join(", ") || "prose"}`).join("; "), tone: matched.length === typed.length ? "good" : "bad" }, "not sent"],
          ["DOC-08 price notice (fits no schema)", toolCell(autoNotice), { v: anyNotice.uses.length ? `forced into \`${anyNotice.uses.map((u) => u.name).join(", ")}\`` : "prose", tone: anyNotice.uses.length ? "" : "bad" }, "not sent"],
          ["Calls that returned a tool_use block", { v: `${autoTool}/2`, tone: autoTool === 2 ? "good" : "bad" }, { v: `${anyTool}/${anyRuns.length}`, tone: anyTool === anyRuns.length ? "good" : "bad" }, { v: `${forced.uses.length ? 1 : 0}/1`, tone: forced.uses.length ? "good" : "bad" }],
          ["Who picks the schema", "Claude, or no tool at all", "Claude, one of the three", "you: extract_invoice"],
        ],
        note: "Same three strict tools, same documents, same prompt: only `tool_choice` changed. Whatever you send, check that a tool_use block came back before you read its input.",
      },
      checks: [
        E.check("auto: the invoice came back as a tool_use block, but the price notice came back as prose, and the check caught it", autoInv.uses.length >= 1 && autoNotice.uses.length === 0 && autoNotice.stop_reason === "end_turn"),
        E.check("any: every document came back as a tool_use block, even the price notice that fits no schema", anyRuns.every((r) => r.stop_reason === "tool_use" && r.uses.length >= 1)),
        E.check(`any: Claude chose the matching schema for each document (${picked.join("; ")})`, typed.every((r) => r.uses.length && r.uses.every((u) => u.name === TOOL_FOR_TYPE[DOCS[r.id].type]))),
        E.check("Forced named tool: exactly one extract_invoice block, total_due 456", forced.uses.length === 1 && forced.uses[0].name === "extract_invoice" && Number(forced.uses[0].input.total_due) === 456),
        E.check("Every tool input carried all its strict-schema fields", all.flatMap((r) => r.uses).every(required)),
      ],
    };
  },
};
