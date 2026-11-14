# Lab 29: The aggregate masks a segment: break it and watch
> Day 1 · Topic 5: Context Management & Reliability · Task statement 5.5 · Simulator 6: Structured Data Extraction · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 5.5: **Design human review workflows and confidence calibration.** You answer one exam-style question, then run the Structured Data Extraction simulator once and watch the right answer work with a real Claude call.

## Open this lab

- **The main lab page:** [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/). It lists all 30 Day 1 labs and the 11 Day 2 builds, and holds the API key box.
- **Run it live in your browser (nothing to install):** open [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=29](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=29), paste your Anthropic API key into the sidebar once, then press **Simulate it live**. Every call uses `claude-haiku-5-5`.
- **Or on the local Python simulator:** start it (double-click `labs/start-labs.command` on Mac or `labs\start-labs.cmd` on Windows), then open [http://localhost:8765/sim6?lab=29](http://localhost:8765/sim6?lab=29).
- **In a terminal, one click:** double-click `run-lab.command` (Mac) or `run-lab.cmd` (Windows) in this folder. It runs `uv run extract.py` from `simulators/simulator-6-structured-extraction`.
- **The code it runs:** [simulators/simulator-6-structured-extraction/extract.py](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-6-structured-extraction/extract.py). The lab folder holds the instructions; the simulator folder holds the code, so all its labs share one working system.

## The scenario
You are building a structured data extraction system using Claude. The system extracts information from unstructured documents, validates the output using JavaScript Object Notation (JSON) schemas, and maintains high accuracy. It must handle edge cases gracefully and integrate with downstream systems.

## The question
Overall accuracy looks excellent, and someone proposes cutting human review. What do you check first?

- **A.** Trust the single overall accuracy number and cut review.
- **B.** Break accuracy down by document type and by field, and keep stratified sampling running.
- **C.** Re-run the whole set and cut review if the overall number repeats.
- **D.** Ask Claude to rate its own confidence and cut review for anything above 0.9.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **6. Structured Data Extraction**.
3. Click **Lab 29** in the row of lab buttons. You can also pick it from **Jump to any lab**.
4. Read the question and click the answer you chose. The page tells you at once whether it is right, and why. Open **Why the other answers fall short** to see each distractor's flaw.
5. Under **Watch the right answer work**, open **See the code this lab runs** if you want to read the script first.
6. Press **▶ Simulate it live**. The output box fills line by line while Claude Haiku 5.5 works. The run takes from a few seconds to about a minute.
7. When it finishes, read **Read your result**: what this run showed, **What to look for**, **Why it happens** and the **Exam tip**.

## Or run it from a terminal
Open a terminal in the `labs` folder. **Windows:** in File Explorer, open `labs`, click the address bar, type `powershell` and press Enter. **Mac:** right-click the `labs` folder and choose **New Terminal at Folder**. Then:

```
cd simulators/simulator-6-structured-extraction
uv run extract.py
```

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 29` from the `labs` folder.

## What you will see
What to look for: Accuracy prints three ways: overall, by_field and by_document_type (100 everywhere on the shipped documents). Break one invoice total (see Try this) and only by_document_type.invoice falls, while receipt and credit_note hold.

These lines are from our own run of this lab on Claude Haiku 5.5. Your wording will differ, because Claude writes each reply fresh; the tool calls, decisions and checks should match.

```
  -> extract_invoice({"invoice_id": "INV-2041", "vendor": "Harbour Office Supplies Pte Ltd", "issue_date": "2026-10-03", "due_date…)
  stop_reason: tool_use
  -> extract_invoice({"invoice_id": "INV-2042", "vendor": "Meridian Catering", "issue_date": "2026-10-05", "due_date": null, "curr…)
  stop_reason: tool_use
  -> extract_invoice({"invoice_id": "R-7781", "vendor": "Lumen Coworking", "issue_date": "2026-10-07", "due_date": null, "currency…)
  stop_reason: tool_use
  -> extract_invoice({"invoice_id": "INV-2043", "vendor": "Northgate Logistics", "issue_date": "2026-10-09", "due_date": "2026-11-…)
  stop_reason: tool_use
  -> extract_invoice({"invoice_id": "CN-118", "vendor": "Harbour Office Supplies", "issue_date": "2026-10-10", "due_date": null, "…)
  stop_reason: tool_use
  -> extract_invoice({"invoice_id": "INV-2044", "vendor": "Pacific Print Works", "issue_date": "2026-10-12", "due_date": "2026-11-…)
  stop_reason: tool_use
...
tool_choice in use: {'type': 'auto'}
DOC-01 invoice     attempts=1 errors=0 conflict=False -> auto_accept
DOC-02 invoice     attempts=1 errors=0 conflict=False -> human_review
DOC-03 receipt     attempts=1 errors=1 conflict=True -> human_review
DOC-04 invoice     attempts=1 errors=0 conflict=False -> auto_accept
DOC-05 credit_note attempts=1 errors=0 conflict=False -> auto_accept
DOC-06 invoice     attempts=1 errors=0 conflict=False -> auto_accept
DOC-07 invoice     attempts=1 errors=0 conflict=False -> human_review
accuracy: {"overall": 100, "by_field": {"stated_total": 100, "due_date": 100, "vendor": 100}, "by_document_type": {"invoice": 100, "receipt": 100, "c…
routing: {'auto_accept': ['DOC-01', 'DOC-04', 'DOC-05', 'DOC-06'], 'human_review': ['DOC-02', 'DOC-03', 'DOC-07']}
Estimated API cost: US$0.0036 for 7 Claude runs on Claude Haiku 5.5, billed to your Anthropic API key.
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
The script scores each extraction against fixtures/labels.json and reports accuracy three ways: overall, by_field and by_document_type. Break one invoice total and the miss lands only in the invoice bucket, so by_document_type.invoice falls while the receipt and credit_note scores hold. The overall figure dips by less, because it averages the miss across every document, and that is how an aggregate hides a weak segment.

## Check your answer
**The answer is B.** Break accuracy down by document type and by field, and keep stratified sampling running.

An aggregate can hide a weak segment; per-type and per-field accuracy shows where automation is safe, and stratified sampling keeps catching drift.

- **A** falls short: A 97% average can hide one document type that fails badly.
- **C** falls short: Repeating the aggregate measures consistency, not whether every segment is accurate.
- **D** falls short: Self-reported confidence must be calibrated against labelled data before it can gate review.

## Try this
Change DOC-04's printed total in fixtures/invoices.txt, rerun, and watch by_document_type.invoice fall while the others hold.

## How the exam tests this
Faced with "97% overall, let's cut human review", check accuracy by document type and by field first, then keep stratified sampling running. Reject any option that treats one aggregate number as proof that every segment is safe to automate.

The question is written for this course from the exam guide's task statement. Evidence from your run is saved in `labs/simulators/simulator-6-structured-extraction/evidence/`.
