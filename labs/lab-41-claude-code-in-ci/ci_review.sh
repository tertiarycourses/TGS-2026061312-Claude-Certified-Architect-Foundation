#!/usr/bin/env bash
# Lab 41: Claude Code as a CI step. No keyboard in CI, so: -p (print mode), fixed tools, a turn cap, JSON out.
set -e
cd "$(dirname "$0")"
. ../load_env.sh                                   # in real CI: ANTHROPIC_API_KEY comes from the CI secret store

cd repo                                            # the code under review
claude -p "Review src/payments.js for bugs that give wrong results or lose money. Report each finding once." \
  --model claude-haiku-5-5 \
  --output-format json \
  --json-schema "$(cat ../finding.schema.json)" \
  --allowedTools Read Grep Glob \
  --max-turns 6 < /dev/null > ../review.json      # KEY: -p never waits for input; schema-checked output to a file
cd ..
if command -v uv >/dev/null; then uv run -q gate.py review.json; else python3 gate.py review.json; fi
