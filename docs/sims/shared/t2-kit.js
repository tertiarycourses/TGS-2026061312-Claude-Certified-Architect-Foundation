// Topic 2 helpers (Labs 8-12): a single-shot tool call for pipelines, and a small JSON Schema checker.
// A pipeline step that only needs Claude's tool input (extraction, a forced reporting tool) makes ONE
// Messages call and hands the tool_use input to the downstream consumer: there is no loop to go round.

// One Messages call. The first tool_use block goes to that tool's run() (the downstream consumer).
// Recorded in s.trace like an agent turn, so the page explains it turn by turn.
export async function oneShot(s, E, o) {
  const tag = o.label ? `${o.label} ` : "";
  const toolDefs = Object.entries(o.tools || {}).map(([name, t]) => ({ name, description: t.description, input_schema: t.input_schema, ...(t.strict ? { strict: true } : {}) }));
  s.log(`${tag}One call: sending the request to Claude with ${toolDefs.length} tool${toolDefs.length === 1 ? "" : "s"} [${toolDefs.map((t) => t.name).join(", ")}]` +
        `${o.tool_choice ? `, tool_choice ${JSON.stringify(o.tool_choice)}` : ""}`, "turn");
  s.agent?.({ event: "start", label: o.label || "" });
  await s.step("call");
  const resp = await E.callClaude(s, {
    ...(o.system ? { system: o.system } : {}),
    messages: [{ role: "user", content: o.prompt }],
    ...(toolDefs.length ? { tools: toolDefs } : {}),
    ...(o.tool_choice ? { tool_choice: o.tool_choice } : {}),
    max_tokens: o.max_tokens || 2048,
  });
  await s.step("check");
  const text = E.textOf(resp.content).trim();
  const use = resp.content.find((b) => b.type === "tool_use");
  const t = { label: o.label || "", turn: 1, stop_reason: resp.stop_reason, tools: use ? [{ name: use.name, input: use.input }] : [], text };
  s.trace.push(t);
  s.agent?.({ event: "turn", ...t });
  s.log(`  stop_reason: ${resp.stop_reason}${use ? "" : " (no tool call: Claude answered in prose)"}`, "stop");
  if (text) s.log(`  Claude: ${E.short(text, 200)}`, "text");
  let result = null, isError = false;
  if (use) {
    s.log(`  -> ${use.name}(${E.short(use.input, 140)})`, "call");
    await s.step("tool");
    const tool = o.tools[use.name];
    result = tool && tool.run ? await tool.run(use.input) : { received: true };
    isError = !!(result && typeof result === "object" && result.isError);
    s.log(`  <- ${isError ? "!! " : ""}${E.short(result, 150)}`, isError ? "error" : "result");
    Object.assign(t.tools[0], { result, isError });
  }
  await s.step("stop");
  s.agent?.({ event: "end", label: o.label || "", stop_reason: resp.stop_reason, turns: 1, calls: use ? 1 : 0, denied: 0 });
  return { name: use ? use.name : null, input: use ? use.input : null, result, text, stop_reason: resp.stop_reason };
}

// A small JSON Schema checker: type (incl. ["string","null"]), enum, required, properties,
// additionalProperties:false, items, minItems, pattern, minimum, maximum. Returns a list of errors.
export function validate(schema, v, path = "$") {
  const errs = [];
  const typeOf = (x) => (x === null ? "null" : Array.isArray(x) ? "array" : Number.isInteger(x) ? "integer" : typeof x);
  if (schema.type) {
    const want = [].concat(schema.type), got = typeOf(v);
    const ok = want.some((w) => w === got || (w === "number" && got === "integer"));
    if (!ok) { errs.push(`${path}: expected ${want.join("|")}, got ${got}`); return errs; }
  }
  if (schema.enum && !schema.enum.includes(v)) errs.push(`${path}: ${JSON.stringify(v)} is not one of ${schema.enum.join(", ")}`);
  if (typeof v === "string" && schema.pattern && !new RegExp(schema.pattern).test(v)) errs.push(`${path}: "${v}" does not match ${schema.pattern}`);
  if (typeof v === "number") {
    if (schema.minimum !== undefined && v < schema.minimum) errs.push(`${path}: ${v} < ${schema.minimum}`);
    if (schema.maximum !== undefined && v > schema.maximum) errs.push(`${path}: ${v} > ${schema.maximum}`);
  }
  if (Array.isArray(v)) {
    if (schema.minItems !== undefined && v.length < schema.minItems) errs.push(`${path}: needs at least ${schema.minItems} item(s)`);
    if (schema.items) v.forEach((x, i) => errs.push(...validate(schema.items, x, `${path}[${i}]`)));
  }
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const r of schema.required || []) if (!(r in v)) errs.push(`${path}.${r}: required field missing`);
    for (const [k, x] of Object.entries(v)) {
      if (schema.properties && schema.properties[k]) errs.push(...validate(schema.properties[k], x, `${path}.${k}`));
      else if (schema.additionalProperties === false) errs.push(`${path}.${k}: not allowed by the schema`);
    }
  }
  return errs;
}
