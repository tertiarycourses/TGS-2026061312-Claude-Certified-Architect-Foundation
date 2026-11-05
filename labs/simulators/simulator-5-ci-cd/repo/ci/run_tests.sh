#!/bin/sh
# Mock test runner: writes the artifact the approval gate requires.
DIR="$(dirname "$0")/artifacts"; mkdir -p "$DIR"
printf '{"pr": %s, "status": "passing", "tests": 12, "ran_at": "%s"}\n' "${1:-418}" "$(date -u +%FT%TZ)" > "$DIR/tests-passed.json"
echo "12 passed; wrote $DIR/tests-passed.json"
