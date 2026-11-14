// Lab 23 · Task 4.5 · Simulator 1: prove the template before 35,000 transcripts.
// The overnight job would send every archived transcript through the Message Batches API. Before that, the
// script runs a PILOT: the same request a batch row would carry (template + transcript, a JSON schema output,
// a custom_id), sent as ordinary synchronous Messages calls over a representative evaluation set, scored
// against the team's labels. A template ships to the batch only when it passes the gate.
//   v0  "tell me the outcome and any refund"            (the template the pilot ran first)
//   v1  fixed instructions + explicit criteria + tagged variables
// Results arrive in any order, so they are matched back by custom_id, never by position.
// The final batch is BUILT here but NOT SENT: a batch takes minutes to hours and cannot be polled reliably from
// a browser. This page never claims a batch ran.
import { TRANSCRIPTS, POLICY_EXCERPT, TEMPLATE_V0, TEMPLATE_V1, EVAL_SET, TRIAGE_SCHEMA, render } from "./shared/t4-triage.js";

const ARCHIVE_SIZE = 35000;
const params = (tpl, tid) => ({
  max_tokens: 2048,
  messages: [{ role: "user", content: render(tpl, { transcript: TRANSCRIPTS[tid], policy_excerpt: POLICY_EXCERPT }) }],
  output_config: { format: { type: "json_schema", schema: TRIAGE_SCHEMA } },
});

// One pilot: every eval-set transcript as a request with a custom_id, all in flight at once.
async function pilot(s, E, version, tpl) {
  const requests = Object.keys(EVAL_SET).map((tid) => ({ custom_id: `${version}-${tid}`, tid, params: params(tpl, tid) }));
  const arrived = [];
  await Promise.all(requests.map(async (r) => {
    const run = await E.runAgent(s, { label: r.custom_id, messages: r.params.messages, output_config: r.params.output_config, max_tokens: r.params.max_tokens, maxTurns: 1 });
    let rec = null; try { rec = JSON.parse(run.text); } catch { /* scored as a failure */ }
    arrived.push({ custom_id: r.custom_id, rec });
  }));
  // Join by custom_id, not by arrival order.
  const byId = Object.fromEntries(arrived.map((a) => [a.custom_id, a.rec]));
  const rows = requests.map((r) => {
    const rec = byId[r.custom_id], want = EVAL_SET[r.tid];
    const dispOk = rec?.disposition === want.disposition;
    const refundOk = rec && Math.abs(Number(rec.refund_total) - want.refund_total) < 0.01;
    const ratOk = !!rec && typeof rec.rationale === "string" && rec.rationale.trim().length >= 15;
    return { ...r, rec, want, dispOk, refundOk, ratOk, ok: dispOk && refundOk && ratOk };
  });
  s.log(`   results arrived in this order: ${arrived.map((a) => a.custom_id).join(", ")} -> joined back by custom_id`, "note");
  for (const x of rows) s.log(`   ${x.ok ? "ok  " : "FAIL"} ${x.custom_id}: ${x.rec ? `${x.rec.disposition}, refund ${x.rec.refund_total}` : "no JSON"}   (label: ${x.want.disposition}, refund ${x.want.refund_total})`, x.ok ? "result" : "error");
  const pass = rows.filter((x) => x.ok).length;
  const ready = pass === rows.length;
  s.log(`   gate: ${pass}/${rows.length} correct -> ${ready ? "READY for the overnight batch" : "NOT ready: refine the template and rerun the pilot"}`, ready ? "result" : "error");
  return { version, rows, pass, ready, arrived, joined: rows.every((x) => x.custom_id in byId) && arrived.length === rows.length };
}

export default {
  id: 23,
  see: "Seven representative transcripts go out as live synchronous requests keyed by custom_id and are joined back by custom_id. Template v0, with no criteria, labels the delivery question and the refused late return \"unresolved\", so the gate says not ready; the refined v1 template scores 7/7, and only then is the batch built, clearly marked as not sent.",
  try: "Delete the \"clarified\" criterion line from TEMPLATE_V1 in sims/shared/t4-triage.js, rerun the pilot, and watch whether T-006 still passes the gate.",
  // The scenario board (assets/scene.js): two pilots on the same 7 labelled transcripts, then the batch.
  scene: {
    title: "35,000 archived transcripts: prove the template on 7 before the overnight batch",
    caption: "Both pilots send the same 7 transcripts as live synchronous calls with the same JSON schema and a custom_id each. Only the template differs. The batch is built, never sent, from the template that passes.",
    lanes: [
      { key: "eval", label: "The evaluation set", sub: "7 labelled transcripts from the archive", stages: [
        { id: "archive", icon: "🗄", t: "35,000 transcripts", s: "waiting on the overnight Message Batches job" },
        { id: "evalset", icon: "🧪", t: "T-001 … T-010 (7 picked)", s: "refund, human, over $500, competitor, delivery, late" },
        { id: "gate", icon: "🚦", t: "Gate: 7/7 correct", s: "disposition · refund_total · a rationale" } ] },
      { key: "A", label: "Pilot 1 · template v0", sub: "\"tell me the outcome and any refund\"", tone: "trap", on: /^Pilot 1/, stages: [
        { id: "atpl", icon: "📄", t: "Template v0", s: "one line, no criteria, transcript pasted raw", diff: true },
        { id: "areq", icon: "🤖", t: "7 requests in parallel", s: "custom_id v0-T-001 … v0-T-010", claude: true },
        { id: "ajoin", icon: "🔗", t: "Join by custom_id", s: "results arrive in any order" },
        { id: "ascore", icon: "🚦", t: "Pilot score", s: "want: 7/7, READY", out: true } ] },
      { key: "B", label: "Pilot 2 · template v1", sub: "fixed instructions, explicit criteria, tagged variables", tone: "fix", on: /^Pilot 2/, stages: [
        { id: "btpl", icon: "🏷", t: "Template v1", s: "criteria + {{policy_excerpt}} + <transcript>", diff: true },
        { id: "breq", icon: "🤖", t: "7 requests in parallel", s: "custom_id v1-T-001 … v1-T-010", claude: true },
        { id: "bjoin", icon: "🔗", t: "Join by custom_id", s: "results arrive in any order" },
        { id: "bscore", icon: "🚦", t: "Pilot score", s: "want: 7/7, READY", out: true } ] },
      { key: "batch", label: "The overnight batch", sub: "SIMULATED: built here, not sent", on: /^Batch step/, stages: [
        { id: "pick", icon: "✅", t: "Template that passed", s: "only a template through the gate ships" },
        { id: "build", icon: "📦", t: "Build batch rows", s: "custom_id archive-T-001 …, same params" },
        { id: "send", icon: "✉", t: "POST /v1/messages/batches", s: "NOT called from this page", out: true } ] },
    ],
  },
  slide: {
    title: "Pilot the template on an eval set, then batch",
    code: `eval_set = pick_representative(archive)        # KEY 1
for tpl in (v0, v1):
    reqs = [{"custom_id": f"{tpl.v}-{t.id}",       # KEY 2
             "params": render(tpl, t)} for t in eval_set]
    got = {r.custom_id: r for r in run_sync(reqs)}
    score = grade(got, labels)                 # KEY 3
    if score == len(eval_set): break
batch = [{"custom_id": t.id,
          "params": render(tpl, t)} for t in archive]
client.messages.batches.create(requests=batch)  # KEY 4`,
    keys: [["1", "A representative eval set", "Routine, human request, edge cases."],
           ["2", "custom_id on every request", "Results come back in any order."],
           ["3", "A gate on clear criteria", "Ship only a template that passes."],
           ["4", "Batch last, not first", "35,000 rows only after the pilot passes."]],
  },
  async run(s, E) {
    s.log(`Archive: ${ARCHIVE_SIZE.toLocaleString("en-US")} transcripts. Evaluation set: ${Object.keys(EVAL_SET).join(", ")} (routine refund, human request, refund over the limit, competitor price match, delivery question, refused late return, multi-issue).`, "note");
    s.log("== Pilot 1 · template v0: \"tell me the outcome and any refund\"", "note");
    const p0 = await pilot(s, E, "v0", TEMPLATE_V0);
    const why = (x) => !x.rec ? "no JSON" : [!x.dispOk && `${x.rec.disposition} (want ${x.want.disposition})`, !x.refundOk && `refund ${x.rec.refund_total} (want ${x.want.refund_total})`, !x.ratOk && "no rationale"].filter(Boolean).join(", ");
    const fails = (p) => p.rows.filter((x) => !x.ok).map((x) => `${x.tid}: ${why(x)}`);
    const showPilot = (k, p) => {
      s.show(`${k}req`, `${p.rows.filter((x) => x.rec).length}/${p.rows.length} valid JSON records`, "done");
      s.show(`${k}join`, `arrived ${p.arrived.map((a) => a.custom_id.split("-T-")[1]).join(",")} -> joined ${p.joined ? "7/7" : "incomplete"}`, p.joined ? "good" : "bad");
      s.show(`${k}score`, `${p.pass}/${p.rows.length} · ${p.ready ? "READY" : "NOT ready"}`, p.ready ? "good" : "bad");
    };
    s.show("atpl", "\"tell me the outcome and any refund\"", "done");
    showPilot("a", p0);
    const f0 = fails(p0);
    await s.pause({
      title: "Pilot 1 finished: template v0",
      outcome: `v0 scored **${p0.pass}/${p0.rows.length}**, so the gate says ${p0.ready ? "**ready**: this time the one-line template passed" : "**not ready**"}. ` +
        (f0.length ? `Misses: ${f0.map((f) => `**${f}**`).join("; ")}. Shipped to 35,000 batch rows, the same kind of miss would repeat across the archive.` : "Nothing in v0 defines a disposition, so a bigger sample may still break it."),
      next: "Pilot 2: template v1, with explicit criteria and the transcript in tags, on the same 7 transcripts",
    });
    s.log("== Pilot 2 · template v1: explicit criteria, variables in tags", "note");
    const p1 = await pilot(s, E, "v1", TEMPLATE_V1);
    s.show("btpl", "criteria, policy excerpt, <transcript> tags", "done");
    showPilot("b", p1);
    s.show("archive", "35,000 rows wait on the gate", "done");
    s.show("evalset", `${p0.rows.length} transcripts, each labelled`, "done");
    s.show("gate", `v0 ${p0.pass}/${p0.rows.length} · v1 ${p1.pass}/${p1.rows.length}`, p1.ready ? "good" : "bad");

    const chosen = p1.ready ? p1 : p0.ready ? p0 : null;
    let batch = null;
    s.log("== Batch step (SIMULATED: built here, NOT sent to the Message Batches API)", "note");
    if (chosen) {
      const tpl = chosen.version === "v1" ? TEMPLATE_V1 : TEMPLATE_V0;
      // The archive here is the 10 sample transcripts standing in for 35,000; the rows carry the SAME params the pilot proved.
      batch = Object.keys(TRANSCRIPTS).map((tid) => ({ custom_id: `archive-${tid}`, params: { model: E.MODEL, ...params(tpl, tid) } }));
      s.log(`   built ${batch.length} sample rows with template ${chosen.version} (in production: ${ARCHIVE_SIZE.toLocaleString("en-US")} rows), e.g. ${E.short(batch[0], 200)}`, "note");
      s.log("   NOT SENT: POST /v1/messages/batches was not called from this page. Results would come back keyed by custom_id; only rows that fail validation are resubmitted, by custom_id.", "note");
    } else {
      s.log("   No template passed the gate, so no batch is built.", "error");
    }
    s.show("pick", chosen ? `template ${chosen.version} (${chosen.pass}/${chosen.rows.length})` : "none passed", chosen ? "done" : "bad");
    s.show("build", batch ? `${batch.length} sample rows (35,000 in production)` : "not built", batch ? "done" : "bad");
    s.show("send", batch ? `built from ${chosen.version}, NOT sent` : "nothing to send", batch && chosen === p1 ? "good" : "bad");

    const ids = batch ? batch.map((b) => b.custom_id) : [];
    const failed0 = p0.rows.filter((x) => !x.ok).map((x) => x.tid);
    const final = [
      `Pilot v0: ${p0.pass}/${p0.rows.length} -> ${p0.ready ? "ready" : `NOT ready (failed: ${failed0.join(", ")})`}`,
      ...p0.rows.map((x) => `  - ${x.custom_id}: ${x.rec ? `${x.rec.disposition}, refund ${x.rec.refund_total}. ${x.rec.rationale}` : "no JSON"}`),
      `Pilot v1: ${p1.pass}/${p1.rows.length} -> ${p1.ready ? "ready for the overnight batch" : "NOT ready"}`,
      ...p1.rows.map((x) => `  - ${x.custom_id}: ${x.rec ? `${x.rec.disposition}, refund ${x.rec.refund_total}. ${x.rec.rationale}` : "no JSON"}`),
      batch ? `Batch: ${batch.length} sample rows built with ${chosen.version}, standing in for ${ARCHIVE_SIZE.toLocaleString("en-US")}. NOT sent from this page.` : "Batch: not built.",
    ].join("\n");
    const f1 = fails(p1);
    const cnt = (p, key) => p.rows.filter((x) => x[key]).length;
    const sc = (p, key) => ({ v: `${cnt(p, key)}/${p.rows.length}`, tone: cnt(p, key) === p.rows.length ? "good" : "bad" });
    return {
      final,
      compare: {
        cols: [
          { title: "Pilot 1: template v0", short: "v0", tone: "trap",
            verdict: p0.ready ? `Passed the gate this time (${p0.pass}/${p0.rows.length}), with no criteria at all. Lucky, not proven: nothing in v0 defines a disposition.`
                              : `${p0.pass}/${p0.rows.length}: NOT ready. ${f0.join("; ")}. The pilot caught it on 7 transcripts instead of 35,000.` },
          { title: "Pilot 2: template v1", short: "v1", tone: "fix",
            verdict: p1.ready ? `${p1.pass}/${p1.rows.length}: READY. Every disposition and refund total matched the labels, each with a rationale, so the batch is built from v1 (and not sent from this page).`
                              : `${p1.pass}/${p1.rows.length}: still not ready (${f1.join("; ")}). Read the live output: Claude writes each run fresh.` },
        ],
        rows: [
          ["Pilot score (the gate needs 7/7)", { v: `${p0.pass}/${p0.rows.length}`, tone: p0.ready ? "good" : "bad" }, { v: `${p1.pass}/${p1.rows.length}`, tone: p1.ready ? "good" : "bad" }],
          ["Dispositions matching the labels", sc(p0, "dispOk"), sc(p1, "dispOk")],
          ["Refund totals matching the labels", sc(p0, "refundOk"), sc(p1, "refundOk")],
          ["Transcripts it got wrong", { v: f0.join("; ") || "none", tone: f0.length ? "bad" : "good" }, { v: f1.join("; ") || "none", tone: f1.length ? "bad" : "good" }],
          ["Joined back by custom_id", p0.joined ? "7/7" : "incomplete", p1.joined ? "7/7" : "incomplete"],
          ["Batch built from it", { v: chosen === p0 ? "yes" : "no", tone: chosen === p0 ? "" : "good" }, { v: chosen === p1 ? `yes, ${batch.length} sample rows, not sent` : "no", tone: chosen === p1 ? "good" : "bad" }],
        ],
        note: "Same 7 transcripts, same JSON schema, same custom_id join. Only the template changed: v1 adds fixed instructions, the criteria for each disposition and the transcript in tags.",
      },
      checks: [
        E.check(`Every pilot result was joined back to its request by custom_id (${p0.rows.length + p1.rows.length} of ${p0.rows.length + p1.rows.length}), whatever order it arrived in`, p0.joined && p1.joined),
        E.check(`The pilot caught v0's defects before the batch: ${p0.pass}/${p0.rows.length}, not ready (${failed0.join(", ") || "none failed"})`, !p0.ready),
        E.check(`The refined v1 template passed the gate: ${p1.pass}/${p1.rows.length} dispositions, refund totals and rationales`, p1.ready),
        E.check("The batch was built only from a template that passed, with a unique custom_id per row (built, not sent)", !!batch && chosen === p1 && new Set(ids).size === ids.length),
      ],
    };
  },
};
