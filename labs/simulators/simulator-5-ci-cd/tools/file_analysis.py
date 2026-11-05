#!/usr/bin/env python3
"""Stand-in for the CI file-analysis tool. --verbose returns everything the platform knows about a
file (build metadata, ownership, full lint output, CI history, dependency tree); --compact returns
only the fields a reviewer uses. Both are deterministic so the size difference is reproducible."""
import json, sys
path = sys.argv[1]
mode = sys.argv[2] if len(sys.argv) > 2 else "--compact"
compact = {"path": path, "changed_lines": [10, 12], "functions": ["total_qty", "low_stock"],
           "tests_touching": ["tests/test_totals.py::test_total_counts_all_items"], "owner": "stock-team"}
if mode == "--compact":
    print(json.dumps(compact)); sys.exit(0)
verbose = dict(compact)
verbose["build_metadata"] = {f"build_{i}": {"id": f"b-{i:04d}", "status": "success", "duration_s": 100 + i, "runner": "ubuntu-22.04", "commit": "0" * 40} for i in range(40)}
verbose["ownership"] = {"codeowners": ["@stock-team", "@platform"], "history": [{"author": f"dev{i}", "lines": i * 3} for i in range(30)]}
verbose["lint_output"] = "\n".join(f"{path}:{i}:1: C0114 Missing module docstring (missing-module-docstring)" for i in range(1, 120))
verbose["ci_runs"] = [{"run": i, "result": "pass", "log_excerpt": "collected 2 items ... 2 passed in 0.03s " * 5} for i in range(60)]
verbose["dependencies"] = {f"pkg-{i}": {"version": f"1.{i}.0", "license": "MIT", "transitive": [f"pkg-{j}" for j in range(5)]} for i in range(50)}
print(json.dumps(verbose))
