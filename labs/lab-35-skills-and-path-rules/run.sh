#!/usr/bin/env bash
# Lab 35: a project skill (/review) and a path-scoped rule, run through Claude Code on Haiku 5.5.
set -e
cd "$(dirname "$0")/project"
. ../../load_env.sh
CLAUDE=(claude --model claude-haiku-5-5 --setting-sources project --allowedTools Read Grep Glob --max-turns 8)

echo "== Step 1: run the project skill /review on src/cart.js"
"${CLAUDE[@]}" -p "/review src/cart.js" < /dev/null

echo; echo "== Step 2: which rules load for a SOURCE file?"
"${CLAUDE[@]}" -p "Read src/cart.js. Then list every instruction or rule now in your context that comes from a file INSIDE this project folder, naming the file. Ignore user-level files such as ~/.claude/CLAUDE.md." < /dev/null

echo; echo "== Step 3: which rules load for a TEST file?"
"${CLAUDE[@]}" -p "Read src/cart.test.js. Then list every instruction or rule now in your context that comes from a file INSIDE this project folder, naming the file. Ignore user-level files such as ~/.claude/CLAUDE.md." < /dev/null
