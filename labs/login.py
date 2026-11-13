#!/usr/bin/env python3
"""Check that the live labs can reach Claude with your Anthropic API key, and save the key if it is missing.
Usage: uv run login.py           (checks the key with one tiny Claude Haiku 5.5 call)
       uv run login.py --set     (asks for the key and writes it to labs/.env)"""
import getpass, os, sys
import simkit  # loads ANTHROPIC_API_KEY from labs/.env or the course folder's .env

from set_api_key import mask, save_key

if "--set" in sys.argv or not os.environ.get("ANTHROPIC_API_KEY", "").strip() or "sk-ant-..." in os.environ.get("ANTHROPIC_API_KEY", ""):
    if "--set" not in sys.argv:
        print("No ANTHROPIC_API_KEY yet in labs/.env.")
    try:
        print(f"Key saved ({save_key(getpass.getpass('Paste your Anthropic API key (starts sk-ant-; nothing shows while you paste): '))}) to labs/.env.")
    except ValueError as e:
        sys.exit(str(e))

import anthropic
try:
    r = anthropic.Anthropic().messages.create(model=simkit.HAIKU, max_tokens=16, messages=[{"role": "user", "content": "Reply with: ready"}])
except anthropic.AuthenticationError:
    sys.exit("The API key was refused (401). Check it, then run: uv run login.py --set")
except anthropic.APIStatusError as e:
    sys.exit(f"The API answered {e.status_code}: {e.message}")
except anthropic.APIConnectionError as e:
    sys.exit(f"Could not reach api.anthropic.com: {e}")
print(f"API key works. {r.model} answered (stop_reason {r.stop_reason}). The live labs are ready.")
