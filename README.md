# Claude Certified Architect Foundation

Run six real agent systems on your own laptop, break them on purpose, and learn what the Claude Certified Architect exam actually tests.

| Course detail | Information |
|---|---|
| Course code | `TGS-2026061312` |
| Programme | WSQ |
| Duration | 2 days / 16 hours |
| Courseware release | Trainer deck v3.1, Lesson Plan v2.9, Learner Guide v2.9 |
| Day 1 simulator | [Run all 30 labs live in your browser](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/) |
| Registration | [View course details and register](https://www.tertiarycourses.com.sg/wsq-claude-certified-architect-foundation.html) |
| Funding | Up to 70% course fee funding for eligible learners and employers. Eligibility and current terms apply. |

![The six simulators, running locally in the browser](screenshot.png)

## About the course

You learn architecture judgement for agentic systems: when a prompt is enough, when a rule must live in code, and how to prove a system stays useful when tools fail, context grows and confidence runs out. Day 1 covers the six exam scenarios and the five domains on a simulator that runs in your browser: for each of the 30 task statements you answer an exam-style question, press Simulate it live, watch the lab's own scenario board light up as the code runs (its real case, data and outcome, one row per method), together with a live diagram of its pattern (the agentic loop, the hook gates, a coordinator spawning its subagents, or separate passes and session forks). Where a lab has a trap and a fix, the run stops after the trap and shows its outcome until you press Proceed; then you read Claude's final output and the observation explained, with the two methods side by side. Day 2 is eleven hands-on Python builds: the API and the agent loop, PreToolUse/PostToolUse hooks, subagents, tool design, an MCP server, a skill, Claude Code in CI, structured output, batches, caching and error handling.

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

Each simulator is one official exam scenario. On Day 1 you run all six in the browser on the [Day 1 simulator](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/), with nothing to install. The folders below hold the same scenarios as optional local Python versions on the [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview), run with [uv](https://docs.astral.sh/uv/). Either way you use your own Anthropic API key, and every Claude call goes to `claude-haiku-5-5`. The customers and data are fake. Claude is real.

1. **[Customer Support Resolution Agent](labs/simulators/simulator-1-customer-support/)**: Your agent has refund powers. Prove it knows when not to use them.
2. **[Code Generation with Claude Code](labs/simulators/simulator-2-code-generation/)**: Claude Code, configured so the whole team gets the same teammate.
3. **[Multi-Agent Research System](labs/simulators/simulator-3-multi-agent-research/)**: One coordinator, four specialists, zero invented citations.
4. **[Developer Productivity with Claude](labs/simulators/simulator-4-developer-productivity/)**: Find your way around a legacy repo without drowning in it.
5. **[Claude Code for Continuous Integration](labs/simulators/simulator-5-ci-cd/)**: A reviewer in the pipeline that developers don't learn to ignore.
6. **[Structured Data Extraction](labs/simulators/simulator-6-structured-extraction/)**: Messy documents in, trustworthy records out.

### Day 1: nothing to install

Open the **[Day 1 simulator](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/)**, paste your Anthropic API key (it starts with `sk-ant-`) into the sidebar (the eye icon in the field shows or hides it), press **Save**, then **Test**. The key stays in your browser and is sent only to Anthropic. Every lab calls `claude-haiku-5-5`, so a whole lab usually costs under one US cent.

### Day 2: vibe-code one agent on your laptop

You need [uv](https://docs.astral.sh/uv/), Git and an AI coding tool that can edit files and run commands: Claude Code, Codex, Antigravity, Cursor or similar.

1. Clone the repo: `git clone https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation.git`, or click **Code → Download ZIP**.
2. Make an empty project folder, copy `labs/lab-31-build-the-customer-resolution-agent/starter/backend.json` into it, and create `.env` there with one line: `ANTHROPIC_API_KEY=sk-ant-...`. It is never committed.
3. Open [Lab 31's prompt page](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab-31.html), paste the prompts into your coding tool one at a time, and run what it builds: `uv run agent.py "your customer message"`. Labs 32 to 34 carry on in the same folder.

The original Python simulators are still in `labs/simulators/` if you prefer to run Day 1 locally: double-click `labs/start-labs.command` (Mac) or `labs\start-labs.cmd` (Windows).

## Labs

Every lab has its own folder with a step-by-step `README.md` and `README.pdf`. Day 1 labs run live on the [simulator site](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/).

### Day 1: one exam-style question and one live simulation per task statement

**Topic 1: Agentic Architecture & Orchestration**

| Lab | Task | Simulator | What you find out |
|---|---|---|---|
| 1 | 1.1 | 1 | [Watch one refund go round the loop](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=1) ([guide](labs/lab-01-watch-one-refund-go-round-the-loop/)) |
| 2 | 1.2 | 3 | [Every subagent succeeds, and the report still misses half the topic](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=2) ([guide](labs/lab-02-every-subagent-succeeds-and-the-report/)) |
| 3 | 1.3 | 2 | [A /parallel-review that can't fan out because Task isn't allowed](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=3) ([guide](labs/lab-03-a-parallel-review-that-can-t-fan-out/)) |
| 4 | 1.4 | 1 | [12% of cases skip get_customer: fix it with a gate, not a sentence](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=4) ([guide](labs/lab-04-12-of-cases-skip-get-customer-fix-it/)) |
| 5 | 1.5 | 1 | [The prompt forgot the $500 rule. The hook did not.](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=5) ([guide](labs/lab-05-the-prompt-forgot-the-500-rule-the-hook/)) |
| 6 | 1.6 | 6 | [60-page packets: section passes first, reconcile second](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=6) ([guide](labs/lab-06-60-page-packets-section-passes-first/)) |
| 7 | 1.7 | 2 | [Two attempts, one analysis: fork the session, checkpoint the files](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=7) ([guide](labs/lab-07-two-attempts-one-analysis-fork-the/)) |

**Topic 2: Tool Design & MCP Integration**

| Lab | Task | Simulator | What you find out |
|---|---|---|---|
| 8 | 2.1 | 6 | [One analyze_document tool does three jobs badly](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=8) ([guide](labs/lab-08-one-analyze-document-tool-does-three/)) |
| 9 | 2.2 | 1 | [The refund failed. The customer was told it worked.](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=9) ([guide](labs/lab-09-the-refund-failed-the-customer-was-told/)) |
| 10 | 2.3 | 5 | [Review and test generation fight over one Claude call](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=10) ([guide](labs/lab-10-review-and-test-generation-fight-over/)) |
| 11 | 2.4 | 2 | [Commit the server, never the token](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=11) ([guide](labs/lab-11-commit-the-server-never-the-token/)) |
| 12 | 2.5 | 4 | [/find-callers needs Grep with a glob, not Bash](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=12) ([guide](labs/lab-12-find-callers-needs-grep-with-a-glob-not/)) |

**Topic 3: Claude Code Configuration & Workflows**

| Lab | Task | Simulator | What you find out |
|---|---|---|---|
| 13 | 3.1 | 2 | [Which instructions actually reached Claude?](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=13) ([guide](labs/lab-13-which-instructions-actually-reached/)) |
| 14 | 3.2 | 1 | [Keep a noisy case review out of your main session](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=14) ([guide](labs/lab-14-keep-a-noisy-case-review-out-of-your/)) |
| 15 | 3.3 | 3 | [Testing rules for test files spread across every folder](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=15) ([guide](labs/lab-15-testing-rules-for-test-files-spread/)) |
| 16 | 3.4 | 2 | [Replacing the auth layer: nobody agrees on the boundary, so plan](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=16) ([guide](labs/lab-16-replacing-the-auth-layer-nobody-agrees/)) |
| 17 | 3.5 | 3 | [Two linked defects go in one detailed request](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=17) ([guide](labs/lab-17-two-linked-defects-go-in-one-detailed/)) |
| 18 | 3.6 | 5 | [The nightly job hangs because nobody can press Enter](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=18) ([guide](labs/lab-18-the-nightly-job-hangs-because-nobody-can/)) |

**Topic 4: Prompt Engineering & Structured Output**

| Lab | Task | Simulator | What you find out |
|---|---|---|---|
| 19 | 4.1 | 5 | ["Only high confidence" didn't quiet the reviewer](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=19) ([guide](labs/lab-19-only-high-confidence-didn-t-quiet-the/)) |
| 20 | 4.2 | 2 | ["Clean this up" means three things: show which one you mean](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=20) ([guide](labs/lab-20-clean-this-up-means-three-things-show/)) |
| 21 | 4.3 | 6 | [Know your tool_choice options, and check what came back](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=21) ([guide](labs/lab-21-know-your-tool-choice-options-and-check/)) |
| 22 | 4.4 | 6 | [Retry when the format is wrong, stop when the data is absent](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=22) ([guide](labs/lab-22-retry-when-the-format-is-wrong-stop-when/)) |
| 23 | 4.5 | 1 | [Prove the template before 35,000 transcripts](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=23) ([guide](labs/lab-23-prove-the-template-before-35-000/)) |
| 24 | 4.6 | 5 | [14 files, shallow comments: split the review](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=24) ([guide](labs/lab-24-14-files-shallow-comments-split-the/)) |

**Topic 5: Context Management & Reliability**

| Lab | Task | Simulator | What you find out |
|---|---|---|---|
| 25 | 5.1 | 1 | [Refund amount jumped to the wrong order](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=25) ([guide](labs/lab-25-refund-amount-jumped-to-the-wrong-order/)) |
| 26 | 5.2 | 1 | [55% first-contact resolution: calibrate with criteria and examples](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=26) ([guide](labs/lab-26-55-first-contact-resolution-calibrate/)) |
| 27 | 5.3 | 3 | [The search timed out: tell the coordinator everything](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=27) ([guide](labs/lab-27-the-search-timed-out-tell-the/)) |
| 28 | 5.4 | 4 | [Delegate the noisy search, keep a scratchpad](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=28) ([guide](labs/lab-28-delegate-the-noisy-search-keep-a/)) |
| 29 | 5.5 | 6 | [The aggregate masks a segment: break it and watch](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=29) ([guide](labs/lab-29-the-aggregate-masks-a-segment-break-it/)) |
| 30 | 5.6 | 3 | [A vendor benchmark isn't a peer-reviewed study](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=30) ([guide](labs/lab-30-a-vendor-benchmark-isn-t-a-peer-reviewed/)) |

### Day 2: vibe-code one customer resolution agent, in four labs

You paste prompts, read the code your AI coding tool writes, and run it. Each lab has a prompt page with a Copy button on every prompt, a `solution/` folder and a real run in `sample-output.txt`.

| Lab | Tasks | What you build |
|---|---|---|
| 31 | 1.1, 2.1 | [Vibe-code the customer resolution agent with the Python SDK](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab-31.html) ([folder](labs/lab-31-build-the-customer-resolution-agent/)) |
| 32 | 2.4, 2.2 | [Vibe-code an MCP server for the agent's tools](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab-32.html) ([folder](labs/lab-32-move-the-tools-to-an-mcp-server/)) |
| 33 | 1.5, 1.4 | [Vibe-code a PreToolUse hook that blocks the $780 refund](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab-33.html) ([folder](labs/lab-33-pretooluse-hook-blocks-the-780-refund/)) |
| 34 | 1.5 | [Vibe-code a PostToolUse hook that cleans the data, then prove the agent works](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab-34.html) ([folder](labs/lab-34-posttooluse-hook-cleans-the-data/)) |

### Bonus: hand-written code builds

Optional builds in curl, the Python SDK and Claude Code (save your key once in `labs/` with `uv run set_api_key.py`; Labs 40 and 41 also need Claude Code). The [practice exam](https://exams.tertiaryinfotech.com/practice-exams/anthropic/anthropic-cca-foundations) is a bonus too.

| Lab | Tasks | What you build |
|---|---|---|
| 35 | 1.1 | [From one API call to a working agent loop](labs/lab-35-first-api-call-to-agent-loop/) |
| 36 | 1.5 | [Build the hooks that the prompt can't be trusted with](labs/lab-36-build-agent-hooks/) |
| 37 | 1.2, 1.3 | [Be the coordinator: brief your subagents or they work blind](labs/lab-37-coordinator-and-subagents/) |
| 38 | 2.1, 2.3 | [Write the tool description Claude actually reads](labs/lab-38-tool-design-and-tool-choice/) |
| 39 | 2.4 | [Build an MCP server once, plug it into any agent](labs/lab-39-build-an-mcp-server/) |
| 40 | 3.2, 3.3 | [Teach Claude Code your repo: a /review skill and a rule that loads only for tests](labs/lab-40-skills-and-path-rules/) |
| 41 | 3.6 | [Put Claude Code in the pipeline and let the exit code decide](labs/lab-41-claude-code-in-ci/) |
| 42 | 4.3 | [Valid JSON is the floor: check the meaning yourself](labs/lab-42-structured-output/) |
| 43 | 4.5 | [Half price, no hurry: triage tickets with the Batches API](labs/lab-43-message-batches/) |
| 44 | 5.1 | [Keep the facts, cache the handbook](labs/lab-44-context-and-prompt-caching/) |
| 45 | 5.3 | [When a subagent fails, tell the coordinator everything](labs/lab-45-error-propagation/) |

Questions come from the exam guide's task statements and official samples, and from SkillCertPro's Part 1 practice exam (third-party and unofficial, so treat them as practice material, never as real exam items). After the course, sit the [practice exam](https://exams.tertiaryinfotech.com/practice-exams/anthropic/anthropic-cca-foundations) under timed conditions.

## In this repository

- [Trainer slides, PowerPoint](courseware/TGS-2026061312-Claude-Certified-Architect-Foundation-Trainer-Slides-v3.1.pptx) and [PDF](courseware/TGS-2026061312-Claude-Certified-Architect-Foundation-Trainer-Slides-v3.1.pdf)
- [Lesson Plan, Word](courseware/LP-Claude-Certified-Architect-Foundation-v2.9.docx) and [PDF](courseware/LP-Claude-Certified-Architect-Foundation-v2.9.pdf)
- [Learner Guide, Word](courseware/LG-Claude-Certified-Architect-Foundation-v2.9.docx), [PDF](courseware/LG-Claude-Certified-Architect-Foundation-v2.9.pdf) and [Markdown](courseware/LG-Claude-Certified-Architect-Foundation-v2.9.md)
- [The labs folder](labs/): 45 lab folders (30 Day 1, 4 Day 2, 11 bonus) and the six Python simulators
- [`docs/`](docs/): the [Day 1 simulator](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/) (GitHub Pages)

## What isn't here

Assessment papers, answer keys, the Facilitator Guide, the Assessment Plan, source references and credentials stay private. Trainers and learners get them through the LMS.

## Acknowledgements

The original lab scenarios were informed by publicly available study projects from [Paul Larionov](https://github.com/paullarionov/claude-certified-architect), [Ade Regil](https://github.com/aderegil/claude-certified-architect) and [Daron Yondem](https://github.com/daronyondem/claude-architect-exam-guide). No assessment or solution content from those repositories is redistributed here.

Provided by [Tertiary Infotech Academy Pte Ltd](https://www.tertiarycourses.com.sg/) (UEN 201200696W).
