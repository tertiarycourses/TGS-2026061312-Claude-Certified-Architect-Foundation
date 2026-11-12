#!/bin/sh
# PreToolUse command hook (matcher: Bash). Claude Code pipes the hook JSON on stdin:
#   {"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"..."},"cwd":"...",...}
# Exit 0 = let the call through. Exit 2 = BLOCK the call; stderr is fed back to Claude as the reason.
INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))')
case "$CMD" in
  *approve_pr.sh*|*"gh pr review"*--approve*|*"gh pr review --approve"*)
    ART="ci/artifacts/tests-passed.json"
    if [ ! -f "$ART" ]; then
      echo "DENIED by require-passing-tests hook: $ART is missing. Run ./ci/run_tests.sh first; approvals are blocked until the passing artifact exists." >&2
      exit 2
    fi
    if ! python3 -c 'import json,sys; sys.exit(0 if json.load(open(sys.argv[1])).get("status")=="passing" else 1)' "$ART"; then
      echo "DENIED by require-passing-tests hook: $ART does not report status=passing." >&2
      exit 2
    fi
    ;;
esac
exit 0
