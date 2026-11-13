# Lab 8: One analyze_document tool does three jobs badly
> Day 1 · Topic 2: Tool Design & MCP Integration · Task statement 2.1 · Simulator 6: Structured Data Extraction · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 2.1: **Design effective tool interfaces with clear descriptions and boundaries.** You answer one exam-style question, then run the Structured Data Extraction simulator once and watch the right answer work with a real Claude call.

## Open this lab

- **Run it live in your browser (nothing to install):** open [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=8](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=8), paste your Anthropic API key into the sidebar once, then press **Simulate it live**. Every call uses `claude-haiku-5-5`.
- **Or on the local Python simulator:** start it (double-click `labs/start-labs.command` on Mac or `labs\start-labs.cmd` on Windows), then open [http://localhost:8765/sim6?lab=8](http://localhost:8765/sim6?lab=8).
- **In a terminal, one click:** double-click `run-lab.command` (Mac) or `run-lab.cmd` (Windows) in this folder. It runs `uv run extract.py --case UC-11` from `simulators/simulator-6-structured-extraction`.
- **The code it runs:** [simulators/simulator-6-structured-extraction/extract.py](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-6-structured-extraction/extract.py), with the case file [simulators/simulator-6-structured-extraction/cases/UC-11.json](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-6-structured-extraction/cases/UC-11.json). The lab folder holds the instructions; the simulator folder holds the code, so all its labs share one working system.

## The scenario
You are building a structured data extraction system using Claude. The system extracts information from unstructured documents, validates the output using JavaScript Object Notation (JSON) schemas, and maintains high accuracy. It must handle edge cases gracefully and integrate with downstream systems.

## The question
The current implementation exposes one client tool named analyze_document with parameters for document text, requested operation, and desired format. In evaluation runs, Claude sometimes uses it to produce summaries when the downstream validator expected extracted fields, and sometimes attempts claim verification without passing the source excerpt needed for validation. What redesign best improves tool selection and downstream reliability without creating unnecessary tool sprawl?

- **A.** Keep analyze_document and add more operation names to its schema enum, while requiring Claude to choose the exact operation before each call.
- **B.** Replace analyze_document with a few non-overlapping tools for distinct workflows, each with clear descriptions, JSON Schema inputs, and minimal stable result fields.
- **C.** Create a separate tool for every document field, then merge all field-level tool results into one validated downstream record.
- **D.** Move the operation instructions into the system prompt and keep the same tool schema to reduce changes to the integration.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **6. Structured Data Extraction**.
3. Click **Lab 8** in the row of lab buttons. You can also pick it from **Jump to any lab**.
4. Read the question and click the answer you chose. The page tells you at once whether it is right, and why. Open **Why the other answers fall short** to see each distractor's flaw.
5. Under **Watch the right answer work**, open **See the code this lab runs** if you want to read the script first.
6. Press **▶ Simulate it live**. The output box fills line by line while Claude Haiku 5.5 works. The run takes from a few seconds to about a minute.
7. When it finishes, read **Read your result**: what this run showed, **What to look for**, **Why it happens** and the **Exam tip**.

## Or run it from a terminal
Open a terminal in the `labs` folder. **Windows:** in File Explorer, open `labs`, click the address bar, type `powershell` and press Enter. **Mac:** right-click the `labs` folder and choose **New Terminal at Folder**. Then:

```
cd simulators/simulator-6-structured-extraction
uv run extract.py --case UC-11
```

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 8` from the `labs` folder.

## What you will see
What to look for: The generic tool drifts into summaries. The split set calls extract_invoice with valid fields.

These lines are from our own run of this lab on Claude Haiku 5.5. Your wording will differ, because Claude writes each reply fresh; the tool calls, decisions and checks should match.

```
  -> analyze_document({"document_text": "INVOICE INV-2041\nFrom: Harbour Office Supplies Pte Ltd\nDate: 03/10/2026 Due: 02/11/2026 …)
  stop_reason: tool_use
  -> analyze_document({"document_text": "Tax invoice no. INV-2042 issued by Meridian Catering on 5 Oct 2026.\nItems: lunch boxes 24…)
  stop_reason: tool_use
  -> analyze_document({"document_text": "RECEIPT R-7781 Lumen Coworking 2026-10-07\nDay pass ............................ 35.00\nAm…)
  stop_reason: tool_use
  -> analyze_document({"document_text": "INVOICE INV-2043 Northgate Logistics Issued 2026-10-09 Due 2026-11-08\nFreight Singapore->…)
  stop_reason: tool_use
  -> analyze_document({"document_text": "CREDIT NOTE CN-118 against INV-1990, Harbour Office Supplies, 10 Oct 2026\nReturned: 2 x D…)
  stop_reason: tool_use
  -> analyze_document({"document_text": "INVOICE INV-2044 Pacific Print Works 12.10.2026 due 11.11.2026, amounts in Thai baht\nBann…)
  stop_reason: tool_use
...
generic tool: extraction chosen on 0/7 documents (the rest drifted to summarize/verify); split tools: extract_invoice chosen on 7/7, schema-valid pay…
Estimated API cost: US$0.0050 for 14 Claude runs on Claude Haiku 5.5, billed to your Anthropic API key.
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
A catch-all analyze_document tool forces Claude to guess the workflow from an operation parameter, so it drifts into summaries where the validator expects fields. Split tools give each job its own description and input_schema, so the choice is clear and extract_invoice receives a schema-valid payload every time. UC-11 records both behaviours side by side.

## Check your answer
**The answer is B.** Replace analyze_document with a few non-overlapping tools for distinct workflows, each with clear descriptions, JSON Schema inputs, and minimal stable result fields.

Split an overly generic tool into a small number of purpose-specific tools that don't overlap, such as extraction, summarisation and source-backed verification. Each description should say what the tool does, when to use it and when not to, what the parameters mean, and any caveats. Descriptions are a primary driver of tool selection. The input_schema is the contract for what Claude sends, so a verification tool can require the source excerpt. strict: true can enforce schema conformance, but semantic validation is still needed downstream.

- **A** falls short: Adding enum values keeps incompatible workflows hidden behind one catch-all tool, so the selection ambiguity remains.
- **C** falls short: One tool per field is tool sprawl: more tools, more selection ambiguity.
- **D** falls short: Leaves the interface unchanged. The schema still allows verification without an excerpt.

## Try this
Change DOC-04's printed total in fixtures/invoices.txt, rerun, and watch by_document_type.invoice fall while the others hold.

## How the exam tests this
Choose a few non-overlapping tools with clear descriptions and JSON Schema inputs. Reject one tool per field as tool sprawl, and reject more enum values, because they keep the ambiguity inside one tool.

The question is a third-party practice question (SkillCertPro, unofficial, reconstructed from a video). Evidence from your run is saved in `labs/simulators/simulator-6-structured-extraction/evidence/`.
