#!/usr/bin/env python3
"""Extra practice (not a numbered lab), live: a prompt-based quality gate with one noisy category, switched off, then rebuilt and measured.

Usage: uv run quality_gate.py

Claude classifies eight draft report findings against a category list. The eight are labelled, so every
flag is scored against the truth. Three real runs, one Claude call each:
  Run 1  all three categories, including the team's broad "unsupported market claim"
  Run 2  the noisy category left out of the active list; the accurate two stay on
  Run 3  the category rebuilt with a tight definition and examples, measured before it comes back
Evidence: evidence/quality_gate.json
"""
import sys as _s, pathlib as _p; _s.path.insert(0, str(_p.Path(__file__).resolve().parents[2])); import simkit
import json, sys, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
EVID = HERE / "evidence" / "quality_gate.json"
emit = simkit.emit

# Eight draft findings with the categories a careful reviewer would flag. Source tags like [S2] are citations.
FINDINGS = [
    ("F1", "The Singapore edtech market grew 18% in 2025 to S$1.2B [S2: IMDA Digital Economy Report 2026, p.14].", []),
    ("F2", "Three vendors hold 61% of the regional LMS market; S5 and S7 agree on the figure.", []),
    ("F3", "Corporate training spend per employee rose to US$1,280 in 2025 [S1: ATD State of the Industry 2026].", []),
    ("F4", "Learners who finish the first module are twice as likely to complete the course.", ["missing citation"]),
    ("F5", "The AI tutoring market will triple by 2028.", ["missing citation", "unsupported market claim"]),
    ("F6", "Completion rose to 72% [S3]; S6 reports the same cohort at 58%, and the draft keeps 72% without comment.", ["source conflict"]),
    ("F7", "S2 dates the policy change to March 2025 and S4 to September 2025; the draft uses March.", ["source conflict"]),
    ("F8", "The pilot ran for six weeks with 40 learners [S3, table 2].", []),
]
CATS = {
    "missing citation": "a factual or numeric statement with no source tag or named source.",
    "source conflict": "two sources disagree on the same fact and the draft does not resolve it.",
    "unsupported market claim": "any sentence that states a market size, growth rate, market share or spending figure.",
}
REBUILT = ("a market size, growth, share or spending figure with no source cited for it. A figure followed by a source tag such as [S2], "
           "or named sources that agree, is supported: do not flag it. Example to flag: 'The market will double by 2027.' "
           "Example not to flag: 'The market grew 12% [S4].'")
TOOL = [{"name": "record_flags", "description": "Record the quality-gate categories that apply to each finding.",
         "input_schema": {"type": "object", "properties": {"results": {"type": "array", "items": {"type": "object", "properties": {
             "id": {"type": "string"}, "categories": {"type": "array", "items": {"type": "string"}}}, "required": ["id", "categories"]}}},
             "required": ["results"]}}]

def gate(client, model, cats, label):
    emit(""); emit(f"=== {label}")
    emit("  active categories: " + "; ".join(cats))
    prompt = ("You are the quality gate for a research report. For each finding, list every category from the ACTIVE list that applies "
              "(an empty list if none). Use only these categories:\n" + "\n".join(f"- {k}: {v}" for k, v in cats.items()) +
              "\n\nFindings:\n" + "\n".join(f"{i}: {t}" for i, t, _ in FINDINGS))
    emit("Turn 1: sending the 8 findings to Claude")
    r = client.messages.create(model=model, max_tokens=900, tools=TOOL, tool_choice={"type": "tool", "name": "record_flags"},
                               messages=[{"role": "user", "content": prompt}])
    use = next((b for b in r.content if b.type == "tool_use"), None)
    got = {x["id"]: [c for c in x.get("categories", []) if c in cats] for x in (use.input.get("results", []) if use else [])}
    rows = {}
    for c in cats:
        tp = sum(1 for i, _, want in FINDINGS if c in got.get(i, []) and c in want)
        fp = sum(1 for i, _, want in FINDINGS if c in got.get(i, []) and c not in want)
        fn = sum(1 for i, _, want in FINDINGS if c not in got.get(i, []) and c in want)
        prec = tp / (tp + fp) if tp + fp else None; rec = tp / (tp + fn) if tp + fn else None
        rows[c] = {"flagged": tp + fp, "true": tp, "false_positives": fp, "missed": fn, "precision": prec, "recall": rec}
        fmt = lambda v: "  -  " if v is None else f"{v:.2f}"
        emit(f"  {c:<26} flagged {tp + fp}  false positives {fp}  missed {fn}  precision {fmt(prec)}  recall {fmt(rec)}")
    for i, t, want in FINDINGS:
        wrong = sorted(set(got.get(i, [])) - set(want))
        if wrong: emit(f"    false positive on {i}: {', '.join(wrong)}  <- {simkit.short(t, 80)}")
    return {"label": label, "categories": cats, "flags": got, "scores": rows, "cost_usd": round(r.cost_usd or 0, 4),
            "tool_calls": [{"tool": "record_flags", "input": use.input if use else None}]}

def main():
    model = simkit.MODEL; client = simkit.Anthropic(); began = time.time()
    emit(f"Extra practice · quality gate with a noisy category · 8 labelled findings · model {model}")
    noisy = gate(client, model, CATS, "Run 1 · all three categories (the team's broad definition)")
    off = gate(client, model, {k: v for k, v in CATS.items() if k != "unsupported market claim"}, "Run 2 · noisy category left out; accurate ones stay on")
    rebuilt = gate(client, model, dict(CATS, **{"unsupported market claim": REBUILT}), "Run 3 · category rebuilt with a tight definition and examples")
    fp = lambda run: sum(s["false_positives"] for s in run["scores"].values())
    u1, u3 = noisy["scores"]["unsupported market claim"], rebuilt["scores"]["unsupported market claim"]
    keep = lambda run: all((run["scores"][c]["recall"] or 0) >= 1.0 for c in ("missing citation", "source conflict"))
    ready = (u3["precision"] or 0) >= 0.9 and (u3["recall"] or 0) >= 0.9
    checks = [
        {"check": f"the broad category raised false positives on well-cited findings ({u1['false_positives']})", "pass": u1["false_positives"] >= 1},
        {"check": f"switching it off cut total false positives ({fp(noisy)} -> {fp(off)})", "pass": fp(off) < fp(noisy)},
        {"check": "missing citation and source conflict still caught every labelled case", "pass": keep(off)},
        {"check": f"the rebuilt category is measured before it returns: precision {u3['precision'] if u3['precision'] is not None else '-'}, recall {u3['recall'] if u3['recall'] is not None else '-'} (bar: 0.9)",
         "pass": u3["precision"] is not None}]
    out = {"lab": 39, "model": model, "message": "Classify 8 draft findings with the quality gate.", "findings": FINDINGS,
           "tool_calls": noisy["tool_calls"] + off["tool_calls"] + rebuilt["tool_calls"], "runs": [noisy, off, rebuilt],
           "reply": f"Rebuilt category {'meets' if ready else 'misses'} the 0.9 precision and recall bar on the labelled set.",
           "checks": checks, "cost_usd": round(noisy["cost_usd"] + off["cost_usd"] + rebuilt["cost_usd"], 4), "seconds": round(time.time() - began, 1)}
    EVID.parent.mkdir(parents=True, exist_ok=True); EVID.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    emit(""); emit(f"done: false positives {fp(noisy)} with the broad category, {fp(off)} with it off, {fp(rebuilt)} with it rebuilt. "
                   f"Rebuilt category {'is ready to re-enable' if ready else 'stays off until it reaches 0.9 precision and recall'}. cost ${out['cost_usd']}")
    for c in checks: emit(f"  {'PASS' if c['pass'] else 'FAIL'}  {c['check']}")
    sys.exit(0 if all(c["pass"] for c in checks) else 1)

if __name__ == "__main__":
    main()
