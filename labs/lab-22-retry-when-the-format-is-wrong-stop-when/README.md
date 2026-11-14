# Lab 22: Retry when the format is wrong, stop when the data is absent
> Day 1 · Topic 4: Prompt Engineering & Structured Output · Task statement 4.4 · Simulator 6: Structured Data Extraction · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 4.4: **Implement validation, retry, and feedback loops for extraction quality.** You answer one exam-style question, then run the Structured Data Extraction simulator once and watch the right answer work with a real Claude call.

## Open this lab

- **The main lab page:** [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/). It lists all 30 Day 1 labs, the two Day 2 bonus topics (Labs 31–35) and the practice exam, and holds the API key box.
- **Run it live in your browser (nothing to install):** open [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=22](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=22), paste your Anthropic API key into the sidebar once, then press **Simulate it live**. Every call uses `claude-haiku-5-5`. The scenario board above the code shows this lab's story as it runs. The run **stops after the first method** and shows you its outcome; press **Proceed** to run the fix, then read the two **side by side** under The observation explained.
- **Or on the local Python simulator:** start it (double-click `labs/start-labs.command` on Mac or `labs\start-labs.cmd` on Windows), then open [http://localhost:8765/sim6?lab=22](http://localhost:8765/sim6?lab=22).
- **In a terminal, one click:** double-click `run-lab.command` (Mac) or `run-lab.cmd` (Windows) in this folder. It runs `uv run extract.py` from `simulators/simulator-6-structured-extraction`.
- **The code it runs:** [simulators/simulator-6-structured-extraction/extract.py](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-6-structured-extraction/extract.py). The lab folder holds the instructions; the simulator folder holds the code, so all its labs share one working system.

## The scenario
You are building a structured data extraction system using Claude. The system extracts information from unstructured documents, validates the output using JavaScript Object Notation (JSON) schemas, and maintains high accuracy. It must handle edge cases gracefully and integrate with downstream systems.

## The question
Validation fails on two documents: a date written DD/MM, and a receipt whose total doesn't match its line items. Which is worth a retry?

- **A.** Retry both documents until something comes back that passes validation.
- **B.** Retry both with a higher temperature so Claude produces a different answer.
- **C.** Retry the DD/MM date with the original document, the failed extraction and the exact validation error; route the total mismatch to a human, because no retry can supply data the source lacks.
- **D.** Drop both documents from the batch and log them as failures.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **6. Structured Data Extraction**.
3. Click **Lab 22** in the row of lab buttons. You can also pick it from **Jump to any lab**.
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

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 22` from the `labs` folder.

## What you will see
What to look for: One line per document. DOC-03 keeps both totals (line items 35.00, printed 38.00), is not retried because the gap is real data, and goes to human review. DOC-07 names the missing schedule A in missing_information and goes to a human without a retry. Haiku got every format right first time in our run, so no retry fired; a format error would be retried with the document, the failed extraction and the exact error.

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
DOC-02 invoice     attempts=1 errors=0 conflict=False -> auto_accept
DOC-03 receipt     attempts=1 errors=1 conflict=True -> human_review
DOC-04 invoice     attempts=1 errors=0 conflict=False -> auto_accept
DOC-05 credit_note attempts=1 errors=0 conflict=False -> human_review
DOC-06 invoice     attempts=1 errors=0 conflict=False -> auto_accept
DOC-07 invoice     attempts=1 errors=0 conflict=False -> human_review
accuracy: {"overall": 100, "by_field": {"stated_total": 100, "due_date": 100, "vendor": 100}, "by_document_type": {"invoice": 100, "receipt": 100, "c…
routing: {'auto_accept': ['DOC-01', 'DOC-02', 'DOC-04', 'DOC-06'], 'human_review': ['DOC-03', 'DOC-05', 'DOC-07']}
Estimated API cost: US$0.0035 for 7 Claude runs on Claude Haiku 5.5, billed to your Anthropic API key.
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
The validator separates errors a second attempt can fix from facts a retry can never supply. DOC-03's line items sum to 35.00 against a printed 38.00, a real gap from GST that the receipt never itemises, so the script keeps stated_total and calculated_total, sets conflict_detected and routes it to a human. DOC-07 points to a schedule A that is not attached, so Claude fills missing_information and the script skips the retry; only a format error earns a follow-up that resends the document, the failed extraction and the exact validation error.

## Check your answer
**The answer is C.** Retry the DD/MM date with the original document, the failed extraction and the exact validation error; route the total mismatch to a human, because no retry can supply data the source lacks.

A retry with the error attached fixes format mistakes; when the information is not in the source, retrying only invents data, so flag it for review.

- **A** falls short: Retrying a real data gap eventually produces a made-up value that passes validation.
- **B** falls short: A different sample cannot supply a fact the document never states.
- **D** falls short: Dropping recoverable documents throws away a fixable date and hides a real conflict.

## Try this
Change DOC-04's printed total in fixtures/invoices.txt, rerun, and watch by_document_type.invoice fall while the others hold.

## How the exam tests this
Ask one question before you retry: is the answer in the source? A DD/MM date is a format mismatch worth a retry with the error attached; data that lives in an absent attachment is not, so reject "retry until something comes back".

The question is written for this course from the exam guide's task statement. Evidence from your run is saved in `labs/simulators/simulator-6-structured-extraction/evidence/`.
