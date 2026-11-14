# Lab 21: Know your tool_choice options, and check what came back
> Day 1 · Topic 4: Prompt Engineering & Structured Output · Task statement 4.3 · Simulator 6: Structured Data Extraction · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 4.3: **Enforce structured output using tool use and JSON schemas.** You answer one exam-style question, then run the Structured Data Extraction simulator once and watch the right answer work with a real Claude call.

## Open this lab

- **The main lab page:** [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/). It lists all 30 Day 1 labs, the two Day 2 bonus topics (Labs 31–35) and the practice exam, and holds the API key box.
- **Run it live in your browser (nothing to install):** open [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=21](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=21), paste your Anthropic API key into the sidebar once, then press **Simulate it live**. Every call uses `claude-haiku-5-5`. The scenario board above the code shows this lab's story as it runs. The run **stops after the first method** and shows you its outcome; press **Proceed** to run the fix, then read the two **side by side** under The observation explained.
- **Or on the local Python simulator:** start it (double-click `labs/start-labs.command` on Mac or `labs\start-labs.cmd` on Windows), then open [http://localhost:8765/sim6?lab=21](http://localhost:8765/sim6?lab=21).
- **In a terminal, one click:** double-click `run-lab.command` (Mac) or `run-lab.cmd` (Windows) in this folder. It runs `uv run extract.py --tool-choice forced --max-docs 2` from `simulators/simulator-6-structured-extraction`.
- **The code it runs:** [simulators/simulator-6-structured-extraction/extract.py](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-6-structured-extraction/extract.py). The lab folder holds the instructions; the simulator folder holds the code, so all its labs share one working system.

## The scenario
You are building a structured data extraction system using Claude. The system extracts information from unstructured documents, validates the output using JavaScript Object Notation (JSON) schemas, and maintains high accuracy. It must handle edge cases gracefully and integrate with downstream systems.

## The question
Extraction has to come back as a tool call, and you don't know the document type in advance. How do you control whether Claude calls a tool?

- **A.** Assume a forced tool_choice setting behaves the same on every model and surface, and skip the check.
- **B.** Leave tool_choice on auto and add "always use the tool" to the system prompt.
- **C.** Ask for the JSON in plain text and parse it with a regular expression.
- **D.** Know the tool_choice options (auto, any, a named tool), pick the one that fits, and check that a tool_use block actually came back on your model.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **6. Structured Data Extraction**.
3. Click **Lab 21** in the row of lab buttons. You can also pick it from **Jump to any lab**.
4. Read the question and click the answer you chose. The page tells you at once whether it is right, and why. Open **Why the other answers fall short** to see each distractor's flaw.
5. Under **Watch the right answer work**, open **See the code this lab runs** if you want to read the script first.
6. Press **▶ Simulate it live**. The output box fills line by line while Claude Haiku 5.5 works. The run takes from a few seconds to about a minute.
7. When it finishes, read **Read your result**: what this run showed, **What to look for**, **Why it happens** and the **Exam tip**.

## Or run it from a terminal
Open a terminal in the `labs` folder. **Windows:** in File Explorer, open `labs`, click the address bar, type `powershell` and press Enter. **Mac:** right-click the `labs` folder and choose **New Terminal at Folder**. Then:

```
cd simulators/simulator-6-structured-extraction
uv run extract.py --tool-choice forced --max-docs 2
```

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 21` from the `labs` folder.

## What you will see
What to look for: The script sends tool_choice {"type": "tool", "name": "extract_invoice"} to the real Messages API. Claude Haiku 5.5 accepts it, both documents come back as extract_invoice tool_use blocks (stop_reason tool_use), and the script still checks that a tool_use block arrived before trusting it.

These lines are from our own run of this lab on Claude Haiku 5.5. Your wording will differ, because Claude writes each reply fresh; the tool calls, decisions and checks should match.

```
  -> extract_invoice({"invoice_id": "INV-2041", "vendor": "Harbour Office Supplies Pte Ltd", "issue_date": "2026-10-03", "due_date…)
  stop_reason: tool_use
  -> extract_invoice({"invoice_id": "INV-2042", "vendor": "Meridian Catering", "issue_date": "2026-10-05", "due_date": null, "curr…)
  stop_reason: tool_use
...
tool_choice in use: {'type': 'tool', 'name': 'extract_invoice'}
DOC-01 invoice     attempts=1 errors=0 conflict=False -> auto_accept
DOC-02 invoice     attempts=1 errors=0 conflict=False -> human_review
accuracy: {"overall": 100, "by_field": {"stated_total": 100, "due_date": 100, "vendor": 100}, "by_document_type": {"invoice": 100}}
routing: {'auto_accept': ['DOC-01'], 'human_review': ['DOC-02']}
Estimated API cost: US$0.0009 for 2 Claude runs on Claude Haiku 5.5, billed to your Anthropic API key.
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
tool_choice is a Messages API parameter: "auto" lets Claude answer in prose, "any" makes it call some tool, {"type": "tool", "name": "extract_invoice"} forces one named tool, and "none" forbids tools. Support is model-specific: Claude Haiku 5.5 accepts the forced forms, while Claude Opus 5.5 and Sonnet 5.5 reject "any" and named tools with a 400, so you steer them with "auto", strict tools and the prompt. Whatever you send, check that a tool_use block came back before you read its input.

## Check your answer
**The answer is D.** Know the tool_choice options (auto, any, a named tool), pick the one that fits, and check that a tool_use block actually came back on your model.

auto lets Claude answer in prose, any makes it call some tool and a named tool forces one; support differs across models, so test it and verify the tool_use block.

- **A** falls short: Forced tool_choice is rejected by some current models; assuming it works everywhere fails in production.
- **B** falls short: An instruction raises the odds but guarantees nothing; auto still allows a prose answer.
- **C** falls short: Free-text JSON gives no schema guarantee and breaks on the first formatting change.

## Try this
Change DOC-04's printed total in fixtures/invoices.txt, rerun, and watch by_document_type.invoice fall while the others hold.

## How the exam tests this
With an unknown document type and several extraction schemas, pick tool_choice "any", and save the forced named tool for an extraction that must run first. Reject "auto", which lets Claude reply in prose, and reject any option that assumes a forced setting behaves the same on every model and surface without testing it.

The question is written for this course from the exam guide's task statement. Evidence from your run is saved in `labs/simulators/simulator-6-structured-extraction/evidence/`.
