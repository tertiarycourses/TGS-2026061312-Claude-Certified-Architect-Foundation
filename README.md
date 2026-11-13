# Claude Certified Architect Foundation

Run six real agent systems on your own laptop, break them on purpose, and learn what the Claude Certified Architect exam actually tests.

| Course detail | Information |
|---|---|
| Course code | `TGS-2026061312` |
| Programme | WSQ |
| Duration | 2 days / 16 hours |
| Courseware release | Trainer deck v3.0, Lesson Plan v2.7, Learner Guide v2.7 |
| Lab guides | [All 40 labs on GitHub Pages](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/) |
| Registration | [View course details and register](https://www.tertiarycourses.com.sg/wsq-claude-certified-architect-foundation.html) |
| Funding | Up to 70% course fee funding for eligible learners and employers. Eligibility and current terms apply. |

![The six simulators, running locally in the browser](screenshot.png)

## About the course

You learn architecture judgement for agentic systems: when a prompt is enough, when a rule must live in code, and how to prove a system stays useful when tools fail, context grows and confidence runs out. Day 1 covers the six exam scenarios and the five domains: for each of the 30 task statements you answer an exam-style question, then watch the answer work live on a simulator. Day 2 opens the code: API calls with curl and the Python SDK, a hand-written agent loop, subagents, an MCP server, Claude Code in CI, batches, caching and error handling.

## Learning outcomes

By the end of the course, you will be able to:

- Design bounded agentic loops and multi-agent orchestration with explicit handoffs, state and stop conditions.
- Engineer reliable tool and MCP integrations with precise schemas, structured errors and least-privilege tool distribution.
- Configure Claude Code projects with scoped instructions, reusable skills, rules, plan mode and CI/CD workflows.
- Produce validated structured outputs using clear criteria, few-shot examples, batching and review loops.
- Manage context, uncertainty, provenance and human escalation in large, long-running AI systems.

## Topics covered

| Topic and exam domain | Weight |
|---|---:|
| Agentic Architecture & Orchestration | 27% |
| Tool Design & MCP Integration | 18% |
| Claude Code Configuration & Workflows | 20% |
| Prompt Engineering & Structured Output | 20% |
| Context Management & Reliability | 15% |

## Six simulators

Each simulator is one official exam scenario, written in Python on the [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview) and run with [uv](https://docs.astral.sh/uv/). It runs on your laptop with your own Anthropic API key, and every Claude call uses `claude-haiku-5-5`. The customers and data are fake. Claude is real.

1. **[Customer Support Resolution Agent](labs/simulators/simulator-1-customer-support/)**: Your agent has refund powers. Prove it knows when not to use them.
2. **[Code Generation with Claude Code](labs/simulators/simulator-2-code-generation/)**: Claude Code, configured so the whole team gets the same teammate.
3. **[Multi-Agent Research System](labs/simulators/simulator-3-multi-agent-research/)**: One coordinator, four specialists, zero invented citations.
4. **[Developer Productivity with Claude](labs/simulators/simulator-4-developer-productivity/)**: Find your way around a legacy repo without drowning in it.
5. **[Claude Code for Continuous Integration](labs/simulators/simulator-5-ci-cd/)**: A reviewer in the pipeline that developers don't learn to ignore.
6. **[Structured Data Extraction](labs/simulators/simulator-6-structured-extraction/)**: Messy documents in, trustworthy records out.

### Set up your laptop

You need an Anthropic API key (it starts with `sk-ant-`; create one at https://console.anthropic.com). Every lab calls `claude-haiku-5-5`, so a whole lab usually costs under one US cent. Windows and Mac work the same way.

**1. Get the course (first time only)**

- **Option A, clone:** `git clone https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation.git`
- **Option B, download:** on this page click **Code → Download ZIP** and unzip it.
- **Option C, let Claude do it:** open Claude Code on an empty folder outside OneDrive, iCloud Drive and Dropbox, and paste:

```text
Set up the Claude Certified Architect Foundation course simulators in this folder.
Read https://raw.githubusercontent.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/master/labs/START-LABS.md
and follow it step by step. Install anything that's missing for me.
```

**2. Save your API key once**

Double-click `labs\set-api-key.cmd` (Windows) or `labs/set-api-key.command` (Mac), or run `uv run set_api_key.py` in `labs`. The key is saved to `labs/.env` on your laptop only and is never committed. You can also paste it into the **Anthropic API key** box in the simulator website's sidebar.

**3. Start the simulators (Day 1)**

Double-click `labs\start-labs.cmd` on Windows, or `labs/start-labs.command` on Mac. The simulators open at http://localhost:8765, or the next free port. Keep that window open during class.

**4. Run the code labs (Day 2)**

Open a terminal in a lab folder, for example `labs/lab-31-first-api-call-to-agent-loop`, and follow its README: `uv run agent_loop.py` for Python, `./call_claude.sh` for shell (Git Bash on Windows).

## Labs

Every lab has its own folder with a step-by-step `README.md` and `README.pdf`. Browse them all on the [lab site](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/).

### Day 1: one exam-style question and one live simulation per task statement

**Topic 1: Agentic Architecture & Orchestration**

| Lab | Task | Simulator | What you find out |
|---|---|---|---|
| 1 | 1.1 | 1 | [Watch one refund go round the loop](labs/lab-01-watch-one-refund-go-round-the-loop/) |
| 2 | 1.2 | 3 | [Every subagent succeeds, and the report still misses half the topic](labs/lab-02-every-subagent-succeeds-and-the-report/) |
| 3 | 1.3 | 2 | [A /parallel-review that can't fan out because Task isn't allowed](labs/lab-03-a-parallel-review-that-can-t-fan-out/) |
| 4 | 1.4 | 1 | [12% of cases skip get_customer: fix it with a gate, not a sentence](labs/lab-04-12-of-cases-skip-get-customer-fix-it/) |
| 5 | 1.5 | 1 | [The prompt forgot the $500 rule. The hook did not.](labs/lab-05-the-prompt-forgot-the-500-rule-the-hook/) |
| 6 | 1.6 | 6 | [60-page packets: section passes first, reconcile second](labs/lab-06-60-page-packets-section-passes-first/) |
| 7 | 1.7 | 2 | [Two attempts, one analysis: fork the session, checkpoint the files](labs/lab-07-two-attempts-one-analysis-fork-the/) |

**Topic 2: Tool Design & MCP Integration**

| Lab | Task | Simulator | What you find out |
|---|---|---|---|
| 8 | 2.1 | 6 | [One analyze_document tool does three jobs badly](labs/lab-08-one-analyze-document-tool-does-three/) |
| 9 | 2.2 | 1 | [The refund failed. The customer was told it worked.](labs/lab-09-the-refund-failed-the-customer-was-told/) |
| 10 | 2.3 | 5 | [Review and test generation fight over one Claude call](labs/lab-10-review-and-test-generation-fight-over/) |
| 11 | 2.4 | 2 | [Commit the server, never the token](labs/lab-11-commit-the-server-never-the-token/) |
| 12 | 2.5 | 4 | [/find-callers needs Grep with a glob, not Bash](labs/lab-12-find-callers-needs-grep-with-a-glob-not/) |

**Topic 3: Claude Code Configuration & Workflows**

| Lab | Task | Simulator | What you find out |
|---|---|---|---|
| 13 | 3.1 | 2 | [Which instructions actually reached Claude?](labs/lab-13-which-instructions-actually-reached/) |
| 14 | 3.2 | 1 | [Keep a noisy case review out of your main session](labs/lab-14-keep-a-noisy-case-review-out-of-your/) |
| 15 | 3.3 | 3 | [Testing rules for test files spread across every folder](labs/lab-15-testing-rules-for-test-files-spread/) |
| 16 | 3.4 | 2 | [Replacing the auth layer: nobody agrees on the boundary, so plan](labs/lab-16-replacing-the-auth-layer-nobody-agrees/) |
| 17 | 3.5 | 3 | [Two linked defects go in one detailed request](labs/lab-17-two-linked-defects-go-in-one-detailed/) |
| 18 | 3.6 | 5 | [The nightly job hangs because nobody can press Enter](labs/lab-18-the-nightly-job-hangs-because-nobody-can/) |

**Topic 4: Prompt Engineering & Structured Output**

| Lab | Task | Simulator | What you find out |
|---|---|---|---|
| 19 | 4.1 | 5 | ["Only high confidence" didn't quiet the reviewer](labs/lab-19-only-high-confidence-didn-t-quiet-the/) |
| 20 | 4.2 | 2 | ["Clean this up" means three things: show which one you mean](labs/lab-20-clean-this-up-means-three-things-show/) |
| 21 | 4.3 | 6 | [Know your tool_choice options, and check what came back](labs/lab-21-know-your-tool-choice-options-and-check/) |
| 22 | 4.4 | 6 | [Retry when the format is wrong, stop when the data is absent](labs/lab-22-retry-when-the-format-is-wrong-stop-when/) |
| 23 | 4.5 | 1 | [Prove the template before 35,000 transcripts](labs/lab-23-prove-the-template-before-35-000/) |
| 24 | 4.6 | 5 | [14 files, shallow comments: split the review](labs/lab-24-14-files-shallow-comments-split-the/) |

**Topic 5: Context Management & Reliability**

| Lab | Task | Simulator | What you find out |
|---|---|---|---|
| 25 | 5.1 | 1 | [Refund amount jumped to the wrong order](labs/lab-25-refund-amount-jumped-to-the-wrong-order/) |
| 26 | 5.2 | 1 | [55% first-contact resolution: calibrate with criteria and examples](labs/lab-26-55-first-contact-resolution-calibrate/) |
| 27 | 5.3 | 3 | [The search timed out: tell the coordinator everything](labs/lab-27-the-search-timed-out-tell-the/) |
| 28 | 5.4 | 4 | [Delegate the noisy search, keep a scratchpad](labs/lab-28-delegate-the-noisy-search-keep-a/) |
| 29 | 5.5 | 6 | [The aggregate masks a segment: break it and watch](labs/lab-29-the-aggregate-masks-a-segment-break-it/) |
| 30 | 5.6 | 3 | [A vendor benchmark isn't a peer-reviewed study](labs/lab-30-a-vendor-benchmark-isn-t-a-peer-reviewed/) |

### Day 2: run the code

| Lab | Tasks | What you build |
|---|---|---|
| 31 | 1.1 | [From one API call to a working agent loop](labs/lab-31-first-api-call-to-agent-loop/) |
| 32 | 1.2, 1.3 | [Be the coordinator: brief your subagents or they work blind](labs/lab-32-coordinator-and-subagents/) |
| 33 | 2.1, 2.3 | [Write the tool description Claude actually reads](labs/lab-33-tool-design-and-tool-choice/) |
| 34 | 2.4 | [Build an MCP server once, plug it into any agent](labs/lab-34-build-an-mcp-server/) |
| 35 | 3.2, 3.3 | [Teach Claude Code your repo: a /review skill and a rule that loads only for tests](labs/lab-35-skills-and-path-rules/) |
| 36 | 3.6 | [Put Claude Code in the pipeline and let the exit code decide](labs/lab-36-claude-code-in-ci/) |
| 37 | 4.3 | [Valid JSON is the floor: check the meaning yourself](labs/lab-37-structured-output/) |
| 38 | 4.5 | [Half price, no hurry: triage tickets with the Batches API](labs/lab-38-message-batches/) |
| 39 | 5.1 | [Keep the facts, cache the handbook](labs/lab-39-context-and-prompt-caching/) |
| 40 | 5.3 | [When a subagent fails, tell the coordinator everything](labs/lab-40-error-propagation/) |

Questions come from the exam guide's task statements and official samples, and from SkillCertPro's Part 1 practice exam (third-party and unofficial, so treat them as practice material, never as real exam items). After the course, sit the [practice exam](https://exams.tertiaryinfotech.com/practice-exams/anthropic/anthropic-cca-foundations) under timed conditions.

## In this repository

- [Trainer slides, PowerPoint](courseware/TGS-2026061312-Claude-Certified-Architect-Foundation-Trainer-Slides-v3.0.pptx) and [PDF](courseware/TGS-2026061312-Claude-Certified-Architect-Foundation-Trainer-Slides-v3.0.pdf)
- [Lesson Plan, Word](courseware/LP-Claude-Certified-Architect-Foundation-v2.7.docx) and [PDF](courseware/LP-Claude-Certified-Architect-Foundation-v2.7.pdf)
- [Learner Guide, Word](courseware/LG-Claude-Certified-Architect-Foundation-v2.7.docx), [PDF](courseware/LG-Claude-Certified-Architect-Foundation-v2.7.pdf) and [Markdown](courseware/LG-Claude-Certified-Architect-Foundation-v2.7.md)
- [The labs folder](labs/): 40 lab folders and the six simulators
- [`docs/`](docs/): the [lab site](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/) on GitHub Pages

## What isn't here

Assessment papers, answer keys, the Facilitator Guide, the Assessment Plan, source references and credentials stay private. Trainers and learners get them through the LMS.

## Acknowledgements

The original lab scenarios were informed by publicly available study projects from [Paul Larionov](https://github.com/paullarionov/claude-certified-architect), [Ade Regil](https://github.com/aderegil/claude-certified-architect) and [Daron Yondem](https://github.com/daronyondem/claude-architect-exam-guide). No assessment or solution content from those repositories is redistributed here.

Provided by [Tertiary Infotech Academy Pte Ltd](https://www.tertiarycourses.com.sg/) (UEN 201200696W).
