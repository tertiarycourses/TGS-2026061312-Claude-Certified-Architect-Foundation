# Lab 4: Developer Productivity Agent

**Alignment:** Domains 2 and 5 — Native Tools and Context Management  
**Estimated time:** 75 minutes  
**Mode:** Local simulation; no API key required

## Objective

Explore a codebase with a narrow Glob–Grep–Read sequence, record findings in an external scratchpad, and avoid whole-repository ingestion.

## Scenario

A developer asks where invoice totals are calculated and validated. The agent must locate the relevant path and dependency with a small, reproducible evidence set.

## Prerequisites

- Python 3.10 or newer.
- A terminal opened in this lab folder.
- No production account, network access, or secret is required.

## Architecture before execution

Read the source and identify the control boundary, the evidence artifact, and the terminal condition before running it. All side effects are confined to this lab's `evidence/` folder.

## Procedure

### 1. Inspect the sample codebase without opening every file.```bashfind sample_repo -maxdepth 3 -type f | sort```### 2. Run the exploration workflow for `calculate_total`.```bashpython3 -B explorer.py calculate_total```### 3. Inspect the retrieval trace and note the progressive expansion from path match to symbol match to focused read.```bashpython3 -m json.tool evidence/retrieval.json```### 4. Review the scratchpad. Confirm it records decisions and evidence without copying the entire source tree.```bashsed -n '1,200p' evidence/scratchpad.md```### 5. Run the verifier and save its output.```bashmkdir -p evidence && python3 -B verify.py | tee evidence/verification.txt```
## Acceptance checks

- [ ] Only text-like candidate files are searched.
- [ ] Focused reads include matched lines and a small context window.
- [ ] The dependency on `validate_items` is captured.
- [ ] The scratchpad records source paths and open questions.

## Reflection

What evidence would justify expanding the read set, and what signal would tell you to stop retrieving more context?

## Evidence and completion

Save terminal output in `evidence/verification.txt`. The lab is complete when the verifier prints `PASS`, every acceptance check is satisfied, and your reflection identifies one design trade-off.

## Troubleshooting

- Run commands from this lab folder so relative paths resolve correctly.
- Use `python3 -B` to prevent learner machines from creating `__pycache__` artifacts.
- If a check fails, read the named failed assertion, inspect the referenced file, and rerun only after correcting the underlying design.

## Clean-up

Remove only files you created outside this folder. Never store API keys, access tokens, customer data, or production logs in lab evidence.

