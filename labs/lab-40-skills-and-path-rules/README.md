# Lab 40: Teach Claude Code your repo: a /review skill and a rule that loads only for tests

> Day 2 bonus build (optional) · Topic 3: Claude Code Configuration & Workflows · Task statements 3.2, 3.3 · Code lab · Claude Haiku 5.5

**Commit a skill and a path-scoped rule, and every teammate who clones the repo gets the same reviewer.**

**Lab page:** [the main lab page](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/) lists every lab (Day 1 runs there live in your browser). This lab's guide online: [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/guides/lab-40-skills-and-path-rules.html](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/guides/lab-40-skills-and-path-rules.html).

## What you'll do

Run a project skill (/review) in Claude Code, then prove that a rule in .claude/rules/ with a paths: glob loads only when a matching file is in play.

## What's in this folder

| File | What it is |
|---|---|
| `project/CLAUDE.md` | always-on project memory |
| `project/.claude/skills/review/SKILL.md` | the /review skill |
| `project/.claude/rules/testing.md` | rule with paths: ['**/*.test.js'] |
| `run.sh` | three Claude Code runs |

## Before you start

- Open a terminal in the labs folder. Windows: use Git Bash for the .sh scripts (it comes with Git); PowerShell is fine for the Python ones.
- Set your Anthropic API key once, if you haven't already. It is saved to labs/.env on your laptop and never uploaded. Run `uv run set_api_key.py`.
- Go into this lab's folder. Run `cd lab-40-skills-and-path-rules`.

You need uv (https://docs.astral.sh/uv/) for the Python scripts, Claude Code (`claude`) for the shell scripts. Every call uses Claude Haiku 5.5 and costs a fraction of a US cent.

## Steps

**Step 1.** Open the three config files above and read them first.

**Step 2.** Run the script. Step 1 runs /review on src/cart.js and ends with a VERDICT line.

```
./run.sh
```

**Step 3.** In Steps 2 and 3, compare the rules Claude lists after reading a source file and after reading a test file.

## What you should see

From a live run on Claude Haiku 5.5 (your wording will differ; the behaviour should not):

- `VERDICT: FAIL with a high finding: applyDiscount takes cents but returns dollars.`
- `After reading src/cart.test.js the list includes .claude/rules/testing.md; after src/cart.js it does not.`

The full output of our run is in `sample-output.txt`.

## The key lines, explained

In `project/.claude/skills/review/SKILL.md`:

- **KEY 1.** Frontmatter: name becomes /review; description tells Claude when to use it; allowed-tools limits it to reading.
- **KEY 2.** $ARGUMENTS is whatever follows /review on the command line.
- **KEY 3.** A fixed output shape (a table plus VERDICT) makes the skill's result easy to check.

In `project/.claude/rules/testing.md`:

- **KEY 1.** paths: is a glob. The rule loads only when Claude works on a file that matches, wherever it sits in the repo.

## The code: `project/.claude/skills/review/SKILL.md`

```markdown
---
name: review
description: Review one source file against this repo's conventions and report findings as a short table. Use when asked to review a file or a change.
allowed-tools: Read, Grep, Glob
---
Review the file given in $ARGUMENTS.

1. Read the file and CLAUDE.md.
2. Check each convention in CLAUDE.md, plus correctness bugs.
3. Report a table: line | severity (high/medium/low) | finding | fix. At most 5 rows. High only for wrong results or money errors.
4. End with one line: VERDICT: PASS (no high findings) or VERDICT: FAIL.
```

## Try this

Add context: fork to the skill's frontmatter and run /review again: the exploration happens in a subagent and only the table comes back.

## How this shows up in the exam

Task 3.2: team skills live in .claude/skills/ in the repo; personal ones in ~/.claude/skills/. Task 3.3: path-scoped rules beat directory CLAUDE.md files when the files are spread across the codebase.
