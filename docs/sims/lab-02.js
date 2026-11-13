// Lab 2 · Task 1.2 · Simulator 3: every subagent succeeds, and the report still misses half the topic.
// A coordinator delegates research to web-search subagents through an Agent tool. Each subagent is a
// nested agent loop with an EMPTY context: it researches only the sub-topic the coordinator hands it.
// Phase 1 runs the exam guide's narrow plan (three flavours of visual art); phase 2 decomposes broadly.
// The web is a sandbox corpus ported from fixtures/sources.json (example.org URLs, invented figures).

const TOPIC = "Impact of AI on creative industries";
const WEB = {
  music: [
    { url: "https://example.org/ifpi-2026-ai-music", title: "IFPI Global Music Report 2026", published: "2026-03-19", excerpt: "62% of surveyed labels used generative tools in production during 2025." },
    { url: "https://example.org/musicians-union-survey", title: "Musicians' Union member survey", published: "2025-09-02", excerpt: "48% of members reported using AI tools in composition or mixing." },
  ],
  writing: [
    { url: "https://example.org/authors-guild-ai-2026", title: "Authors Guild AI survey", published: "2026-01-14", excerpt: "Median reported income effect of AI on freelance writers: -11% year over year." },
  ],
  film: [
    { url: "https://example.org/vfx-society-2026", title: "Visual Effects Society workforce note", published: "2026-02-07", excerpt: "Previsualisation time fell by roughly 30% on productions using AI storyboarding." },
  ],
  visual_arts: [   // sandbox-only additions so the narrow plan's subagents also succeed
    { url: "https://example.org/illustration-freelancers-2026", title: "Illustration freelancers survey", published: "2026-02-20", excerpt: "37% of freelance illustrators said AI image tools replaced at least one commission in 2025." },
    { url: "https://example.org/design-studios-ai-2026", title: "Design studio tooling note", published: "2026-03-05", excerpt: "71% of graphic design studios used AI for first-draft layouts in 2025." },
    { url: "https://example.org/photo-retouch-2025", title: "Photo retouching workload study", published: "2025-12-01", excerpt: "AI retouching cut average photo editing time per shoot by 40%." },
  ],
};
const SECTOR_RE = {
  music: /\b(music|musician|song|record label|audio|composer)/i,
  writing: /\b(writ|author|book|publish|journalis|novel)/i,
  film: /\b(film|vfx|video|cinema|television|tv\b|previs|storyboard|screen)/i,
  visual_arts: /\b(visual art|artist|art\b|arts\b|design|photo|illustrat|graphic|painting|image)/i,
};
const sectorOf = (q) => Object.keys(SECTOR_RE).find((k) => SECTOR_RE[k].test(q)) || null;

const SANDBOX = " The sources are a sandbox corpus: treat its URLs, titles and dates as authoritative citations for this exercise and do not comment on them. Today is 2026-11-14.";
const SUBAGENT = "You research exactly the sub-topic in your prompt using search_web: ONE query naming the sector, at most two. Take what it returns and stop. Return ONLY a compact JSON object, no code fence: {\"subtopic\": str, \"findings\": [{\"claim\": str (max 15 words), \"value\": str, \"source_title\": str, \"published\": \"YYYY-MM-DD\"}] (at most 2), \"coverage\": \"complete|partial|none\"}. Never invent a number that is not in a search result." + SANDBOX;

const NARROW = "You are the coordinator of a research team. Your only subagent type is web-search. Decompose the topic into exactly three sub-tasks: 'AI in digital art creation', 'AI in graphic design' and 'AI in photography'. Spawn one web-search agent per sub-task, all in one response, each with a prompt under 40 words. When they return, write the final report yourself: under 120 words, every figure with its source title and date." + SANDBOX;
const BROAD = "You are the coordinator of a research team. Your only subagent type is web-search, and each subagent starts with an EMPTY context, so give it the sector and goal in its prompt. Decompose the topic BROADLY: 'creative industries' means music, writing/publishing, film/TV and visual arts, not only the visual ones. Spawn one web-search agent for each of those four sectors, all in one response, each with a prompt under 40 words. When they return, write the final report yourself: under 150 words, every figure with its source title and date, and end with a 'Coverage:' line naming each sector and whether findings came back." + SANDBOX;

async function coordinator(s, E, system, phaseName) {
  const subs = [];
  const searchTool = {
    description: "Search the sandbox web for one sub-topic. Input: a short query naming the sector, e.g. 'AI adoption in music production 2026'. Returns up to three hits with url, title, published date and excerpt.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    run: ({ query }) => {
      const sector = sectorOf(query || "");
      return sector ? { sector, results: WEB[sector] } : { results: [], note: "valid empty result: no sector matched this query" };
    },
  };
  const run = await E.runAgent(s, {
    system,
    prompt: `Research topic: ${TOPIC}`,
    maxTurns: 4, max_tokens: 2000,
    tools: {
      Agent: {
        description: "Launch a subagent. Agent types: web-search (searches the web for ONE sub-topic and returns dated, cited findings as JSON). The subagent sees only the prompt you give it.",
        input_schema: { type: "object", properties: { subagent_type: { type: "string", enum: ["web-search"] }, description: { type: "string" }, prompt: { type: "string" } }, required: ["subagent_type", "prompt"] },
        run: async ({ description, prompt }) => {
          const sub = await E.runAgent(s, { label: `(subagent web-search: ${description || "sub-topic"})`, system: SUBAGENT, prompt, tools: { search_web: searchTool }, maxTurns: 3, max_tokens: 1200 });
          const sectors = [...new Set(sub.calls.filter((c) => c.name === "search_web").map((c) => c.result?.sector).filter(Boolean))];
          subs.push({ description, prompt, sectors, ok: sectors.length > 0 && !sub.calls.some((c) => c.isError) && sub.stop_reason === "end_turn" });
          return sub.text;
        },
      },
    },
  });
  const covered = [...new Set(subs.flatMap((x) => x.sectors))].sort();
  s.log(`${phaseName}: ${subs.length} subagents, ${subs.filter((x) => x.ok).length} succeeded. Sectors the plan reached: ${covered.join(", ") || "none"}.`, "note");
  return { run, subs, covered };
}

export default {
  id: 2,
  see: "Narrow plan: three web-search subagents all succeed, but every search lands in visual arts, so the report has no music, writing or film. Broad plan: four subagents, one per sector, and the report cites the music, writing and film figures and ends with a Coverage line.",
  try: "Edit BROAD in this lab's code to drop 'film/TV' from the sector list and run it again: the subagents still all succeed, and film disappears from the report. Coverage is decided by the coordinator's plan.",
  slide: {
    title: "Coverage is decided by the coordinator's plan",
    code: `BROAD = ("Decompose broadly: music, writing, "    # KEY 1
         "film/TV and visual arts. Spawn one "
         "web-search agent per sector in one turn.")
coordinator = Agent(system=BROAD, tools=[Agent_tool])
def agent_tool(subagent_type, prompt):           # KEY 2
    sub = run_agent(system=WEB_SEARCH,
                    prompt=prompt,               # KEY 3
                    tools=[search_web], max_turns=3)
    return sub.text
covered = {c.sector for c in all_search_calls}   # KEY 4`,
    keys: [["1", "The plan sets the scope", "Name every sector, or no one researches it."],
           ["2", "One subagent per sector", "Spawned together in one coordinator turn."],
           ["3", "Empty context", "A subagent knows only the prompt it is given."],
           ["4", "Measure coverage in code", "Compare the sectors searched with the topic."]],
  },
  async run(s, E) {
    s.log(`Topic: ${TOPIC}`, "note");
    s.log("== Phase 1 · narrow plan (the exam guide's coordinator log): digital art, graphic design, photography", "note");
    const narrow = await coordinator(s, E, NARROW, "Narrow plan");
    s.log("== Phase 2 · broad plan: music, writing, film/TV and visual arts", "note");
    const broad = await coordinator(s, E, BROAD, "Broad plan");
    const rep = broad.run.text;
    const narrowRep = narrow.run.text;
    return {
      final: rep,
      checks: [
        E.check("Narrow plan: every subagent succeeded, yet the plan reached only visual arts", narrow.subs.length >= 3 && narrow.subs.every((x) => x.ok) && narrow.covered.join() === "visual_arts"),
        E.check("Narrow plan: the report has no music, writing or film findings", !/(62%|48%|-11%|30%)/.test(narrowRep)),
        E.check("Broad plan: the subagents searched music, writing, film and visual arts", ["film", "music", "visual_arts", "writing"].every((k) => broad.covered.includes(k))),
        E.check("Broad plan: the report cites the music, writing and film figures", /(62%|48%)/.test(rep) && /(-11%|11%)/.test(rep) && /30%/.test(rep)),
      ],
    };
  },
};
