# Lab 6: 60-page packets: section passes first, reconcile second
> Day 1 · Topic 1: Agentic Architecture & Orchestration · Task statement 1.6 · Simulator 6: Structured Data Extraction · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 1.6: **Design task decomposition strategies for complex workflows.** You answer one exam-style question, then run the Structured Data Extraction simulator once and watch the right answer work with a real Claude call.

## The scenario
You are building a structured data extraction system using Claude. The system extracts information from unstructured documents, validates the output using JavaScript Object Notation (JSON) schemas, and maintains high accuracy. It must handle edge cases gracefully and integrate with downstream systems.

## The question
Production evaluation shows accuracy drops on 60-page packets with predictable sections, such as intake forms, narrative notes, invoices, and attachments. The current single-pass extraction often captures fields within individual sections, but produces duplicate entities, inconsistent totals, and occasional schema-valid output with incorrect relationships. Which task-decomposition strategy should this team use first?

- **A.** Generate adaptive subtasks after each page, then stop when the agent determines that all required fields have been found.
- **B.** Summarize each packet into a narrative first, then extract the required schema fields from that summary in a final pass.
- **C.** Run section-level extraction passes, then run a reconciliation pass that validates schema, deduplicates entities, and checks cross-section consistency.
- **D.** Send the full packet through one expanded extraction prompt, then ask Claude to self-check the JSON before returning it.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **6. Structured Data Extraction**.
3. Click **Lab 6** in the row of lab buttons. You can also pick it from **Jump to any lab**.
4. Read the question and click the answer you chose. The page tells you at once whether it is right, and why. Open **Why the other answers fall short** to see each distractor's flaw.
5. Under **Watch the right answer work**, open **See the code this lab runs** if you want to read the script first.
6. Press **▶ Simulate it live**. The output box fills line by line while Claude Haiku 5.5 works. The run takes from a few seconds to about a minute.
7. When it finishes, read **Read your result**: what this run showed, **What to look for**, **Why it happens** and the **Exam tip**.

## Or run it from a terminal
Open a terminal in the `labs` folder. **Windows:** in File Explorer, open `labs`, click the address bar, type `powershell` and press Enter. **Mac:** right-click the `labs` folder and choose **New Terminal at Folder**. Then:

```
cd simulators/simulator-6-structured-extraction
uv run extract.py --case UC-31
```

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 6` from the `labs` folder.

## What you will see
What to look for: Single pass: one record for three documents. Section pipeline: four section records, reconciled into three unique invoices (CN-118, INV-2041, INV-2043) with one duplicate merged.

These lines are from our own run of this lab on Claude Haiku 5.5. Your wording will differ, because Claude writes each reply fresh; the tool calls, decisions and checks should match.

```
  -> extract_invoice({"invoice_id": "INV-2041", "vendor": "Harbour Office Supplies Pte Ltd", "issue_date": "2026-10-03", "due_date…)
  -> extract_invoice({"invoice_id": "INV-2043", "vendor": "Northgate Logistics", "issue_date": "2026-10-09", "due_date": "2026-11-…)
  -> extract_invoice({"invoice_id": "CN-118", "vendor": "Harbour Office Supplies", "issue_date": "2026-10-10", "due_date": null, "…)
  stop_reason: tool_use
  -> extract_invoice({"invoice_id": "INV-2041", "vendor": "Harbour Office Supplies Pte Ltd", "issue_date": "2026-10-03", "due_date…)
  stop_reason: tool_use
  -> extract_invoice({"invoice_id": "INV-2043", "vendor": "Northgate Logistics", "issue_date": "2026-10-09", "due_date": "2026-11-…)
  stop_reason: tool_use
  -> extract_invoice({"invoice_id": "CN-118", "vendor": "Harbour Office Supplies", "issue_date": "2026-10-10", "due_date": null, "…)
  stop_reason: tool_use
  -> extract_invoice({"invoice_id": "INV-2041", "vendor": "Harbour Office Supplies Pte Ltd", "issue_date": "2026-10-03", "due_date…)
  stop_reason: tool_use
...
single pass records: 1 | section records: 4 | unique after reconciliation: ['CN-118', 'INV-2041', 'INV-2043'] | duplicates merged: 1
Estimated API cost: US$0.0032 for 5 Claude runs on Claude Haiku 5.5, billed to your Anthropic API key.
```

How to read the output:

| Output line | What it means |
|---|---|
| `connected: claude-haiku-5-5, tools: …` | The run started on Claude Haiku 5.5 and lists the tools Claude may call. |
| `Turn N: sending the conversation to Claude` | One trip round the agent loop: the whole conversation so far goes to the Claude API. |
| `-> tool_name({...})` | Claude asked to call a tool, with these inputs. |
| `<- result: …` / `!! tool error: …` | The tool's answer, appended to the conversation for Claude's next turn. `!!` marks an error or a hook that blocked the call. |
| `stop_reason: tool_use` / `end_turn` | Why Claude stopped: `tool_use` means run the tool and loop again; `end_turn` means Claude has finished. |
| `(subagent)` | The line came from a subagent working in its own context, not the main conversation. |
| `PASS` / `FAIL` | The simulator's automatic checks on what Claude actually did. |
| `Estimated API cost` | What the run cost on your API key at Haiku 5.5 prices. |

## Why it happens
One pass over a 60-page packet asks the model to find fields and enforce cross-section rules at the same time, so it merges three documents into one record. Section passes look at less evidence each, then a reconciliation pass deduplicates invoice_ids and checks totals once every partial record exists. UC-31 shows four section records reconciled to three unique invoices.

## Check your answer
**The answer is C.** Run section-level extraction passes, then run a reconciliation pass that validates schema, deduplicates entities, and checks cross-section consistency.

For predictable workflows, a fixed sequential decomposition beats asking one prompt to do everything: local first, global second. Section passes focus on less evidence and make failures easier to isolate. The reconciliation pass handles constraints that only make sense once every partial extraction exists, such as deduplication, totals, dates and relationships across sections.

- **A** falls short: Adaptive decomposition suits exploratory work where the next step depends on discoveries. These packets have a known structure.
- **B** falls short: A narrative summary throws away detail before extraction and can hide errors behind valid-looking JSON.
- **D** falls short: The same overloaded single pass. A self-check rarely catches errors in the model's own output.

## Try this
Change DOC-04's printed total in fixtures/invoices.txt, rerun, and watch by_document_type.invoice fall while the others hold.

## How the exam tests this
Predictable sections call for a fixed pipeline: extract locally, then reconcile globally. Reject the bigger single prompt with a self-check, since the model rarely catches its own errors, and save adaptive subtasks for exploratory work.

The question is a third-party practice question (SkillCertPro, unofficial, reconstructed from a video). Evidence from your run is saved in `labs/simulators/simulator-6-structured-extraction/evidence/`.
