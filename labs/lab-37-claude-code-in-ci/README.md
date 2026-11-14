# Lab 37: Put Claude Code in the pipeline and let the exit code decide

> Day 2 · Topic 3: Claude Code Configuration & Workflows · Task statement 3.6 · Code lab · Claude Haiku 5.5

**No keyboard in CI: claude -p, a JSON schema, a turn cap, and a gate that fails the build on a high finding.**

**Lab page:** [the main lab page](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/) lists every lab (Day 1 runs there live in your browser). This lab's guide online: [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/guides/lab-37-claude-code-in-ci.html](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/guides/lab-37-claude-code-in-ci.html).

## What you'll do

Run Claude Code non-interactively, get schema-checked findings as JSON, and turn them into a pass/fail exit code your CI acts on.

## What's in this folder

| File | What it is |
|---|---|
| `ci_review.sh` | the CI step |
| `finding.schema.json` | the shape every finding must have |
| `gate.py` | reads the JSON, prints findings, exits 1 on any high finding |
| `.github-example/claude-review.yml` | the same step as a GitHub Actions workflow |

## Before you start

- Open a terminal in the labs folder. Windows: use Git Bash for the .sh scripts (it comes with Git); PowerShell is fine for the Python ones.
- Set your Anthropic API key once, if you haven't already. It is saved to labs/.env on your laptop and never uploaded. Run `uv run set_api_key.py`.
- Go into this lab's folder. Run `cd lab-37-claude-code-in-ci`.

You need uv (https://docs.astral.sh/uv/) for the Python scripts, Claude Code (`claude`) for the shell scripts. Every call uses Claude Haiku 5.5 and costs a fraction of a US cent.

## Steps

**Step 1.** Run the CI step. Claude reviews repo/src/payments.js; gate.py prints the findings.

```
./ci_review.sh; echo "exit code: $?"
```

**Step 2.** Open review.json and find structured_output, num_turns and total_cost_usd.

**Step 3.** Read .github-example/claude-review.yml: the key comes from a repository secret, never the file.

## What you should see

From a live run on Claude Haiku 5.5 (your wording will differ; the behaviour should not):

- `HIGH   src/payments.js:4  refund() does not cap the refund at the amount paid...`
- `3 findings, 1 high (another run found 2 high). Cost about $0.014, 4 turns`
- `exit code: 1 (any high finding fails the build)`

The full output of our run is in `sample-output.txt`.

## The key lines, explained

In `gate.py`, look for the `KEY` comments:

- **KEY 1.** --output-format json wraps the run: is_error, num_turns, total_cost_usd and structured_output.
- **KEY 2.** Fail closed. A review that didn't finish must never look like a pass.
- **KEY 3.** The exit code is the only thing CI reads: 1 blocks the merge.

## The code: `gate.py`

```python
"""Lab 37: the CI gate. Reads Claude Code's JSON result, prints the findings, fails the build on any high finding."""
import json
import sys

result = json.load(open(sys.argv[1]))             # KEY 1: --output-format json wraps the run: cost, turns, structured_output
if result.get("is_error") or result.get("structured_output") is None:
    sys.exit("Review did not finish: no verdict. Failing closed.")   # KEY 2: a broken review must never pass
findings = result["structured_output"]["findings"]
for f in findings:
    print(f"{f['severity'].upper():<6} {f['file']}:{f['line']}  {f['issue']}\n       fix: {f['fix']}")
high = sum(f["severity"] == "high" for f in findings)
print(f"\n{len(findings)} findings, {high} high. Cost ${result.get('total_cost_usd', 0):.4f}, turns {result.get('num_turns')}")
sys.exit(1 if high else 0)                        # KEY 3: the exit code is what CI acts on
```

## Try this

Fix the bug in repo/src/payments.js (check the total paid before refunding) and run again until the gate exits 0.

## How this shows up in the exam

Task 3.6: -p (print mode) so nothing waits for input, --output-format json with --json-schema for machine-readable findings, fixed --allowedTools and --max-turns.
