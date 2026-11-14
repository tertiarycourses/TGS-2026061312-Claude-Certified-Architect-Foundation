"""Lab 42: the CI gate. Reads Claude Code's JSON result, prints the findings, fails the build on any high finding."""
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
