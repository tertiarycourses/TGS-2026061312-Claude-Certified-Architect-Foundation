#!/bin/sh
# Mock "post approving review": records the approval. In production this is `gh pr review --approve`.
mkdir -p "$(dirname "$0")"
echo "approved PR $1 at $(date -u +%FT%TZ)" >> "$(dirname "$0")/approvals.log"
echo "PR $1 approved"
