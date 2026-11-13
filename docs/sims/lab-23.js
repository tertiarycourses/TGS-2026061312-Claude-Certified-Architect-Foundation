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
    s.log("== Pilot 2 · template v1: explicit criteria, variables in tags", "note");
    const p1 = await pilot(s, E, "v1", TEMPLATE_V1);

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

    const ids = batch ? batch.map((b) => b.custom_id) : [];
    const failed0 = p0.rows.filter((x) => !x.ok).map((x) => x.tid);
    const final = [
      `Pilot v0: ${p0.pass}/${p0.rows.length} -> ${p0.ready ? "ready" : `NOT ready (failed: ${failed0.join(", ")})`}`,
      ...p0.rows.map((x) => `  - ${x.custom_id}: ${x.rec ? `${x.rec.disposition}, refund ${x.rec.refund_total}. ${x.rec.rationale}` : "no JSON"}`),
      `Pilot v1: ${p1.pass}/${p1.rows.length} -> ${p1.ready ? "ready for the overnight batch" : "NOT ready"}`,
      ...p1.rows.map((x) => `  - ${x.custom_id}: ${x.rec ? `${x.rec.disposition}, refund ${x.rec.refund_total}. ${x.rec.rationale}` : "no JSON"}`),
      batch ? `Batch: ${batch.length} sample rows built with ${chosen.version}, standing in for ${ARCHIVE_SIZE.toLocaleString("en-US")}. NOT sent from this page.` : "Batch: not built.",
    ].join("\n");
    return {
      final,
      checks: [
        E.check(`Every pilot result was joined back to its request by custom_id (${p0.rows.length + p1.rows.length} of ${p0.rows.length + p1.rows.length}), whatever order it arrived in`, p0.joined && p1.joined),
        E.check(`The pilot caught v0's defects before the batch: ${p0.pass}/${p0.rows.length}, not ready (${failed0.join(", ") || "none failed"})`, !p0.ready),
        E.check(`The refined v1 template passed the gate: ${p1.pass}/${p1.rows.length} dispositions, refund totals and rationales`, p1.ready),
        E.check("The batch was built only from a template that passed, with a unique custom_id per row (built, not sent)", !!batch && chosen === p1 && new Set(ids).size === ids.length),
      ],
    };
  },
};
