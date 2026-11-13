# Sourced by each lab's run.sh: finds labs/.env (or any .env above this folder) and exports ANTHROPIC_API_KEY.
d="$PWD"
while [ "$d" != "/" ]; do
  if [ -f "$d/.env" ]; then set -a; . "$d/.env"; set +a; break; fi
  d="$(dirname "$d")"
done
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "No ANTHROPIC_API_KEY found. Run set-api-key (labs folder) or add it to labs/.env first." >&2; exit 1
fi
