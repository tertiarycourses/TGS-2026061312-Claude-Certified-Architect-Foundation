#!/usr/bin/env python3
"""Save your Anthropic API key for the labs, in labs/.env (git-ignored). Standard library only.

Usage: python3 set_api_key.py        (or double-click set-api-key.command on Mac / set-api-key.cmd on Windows)
Get a key at https://platform.claude.com/settings/keys . Every lab calls Claude Haiku 5.5 with it."""
import getpass, os, sys
from pathlib import Path

ENV_FILE = Path(__file__).resolve().parent / ".env"
NAME = "ANTHROPIC_API_KEY"


def mask(key):
    return f"{key[:7]}…{key[-4:]}" if len(key) > 12 else "…"


def save_key(key):
    """Write or replace ANTHROPIC_API_KEY in labs/.env, keeping any other lines. Returns the masked key."""
    key = key.strip()
    if not key.startswith("sk-ant-"):
        raise ValueError("That doesn't look like an Anthropic API key (it should start with sk-ant-).")
    lines = ENV_FILE.read_text(encoding="utf-8").splitlines() if ENV_FILE.exists() else []
    lines = [l for l in lines if not l.strip().startswith(NAME + "=")]
    ENV_FILE.write_text("\n".join(lines + [f"{NAME}={key}"]) + "\n", encoding="utf-8")
    try:
        os.chmod(ENV_FILE, 0o600)
    except OSError:
        pass
    os.environ[NAME] = key
    return mask(key)


def saved_key():
    """The key in labs/.env, or ''."""
    if not ENV_FILE.exists():
        return ""
    for l in ENV_FILE.read_text(encoding="utf-8").splitlines():
        if l.strip().startswith(NAME + "="):
            return l.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


if __name__ == "__main__":
    have = saved_key()
    if have and "--force" not in sys.argv and "sk-ant-..." not in have:
        print(f"labs/.env already holds a key ({mask(have)}). To replace it, run: python3 set_api_key.py --force")
        sys.exit(0)
    key = getpass.getpass("Paste your Anthropic API key (starts sk-ant-; nothing shows while you paste), then press Enter: ")
    try:
        print(f"Key saved ({save_key(key)}) to {ENV_FILE}. It stays on this laptop and is never committed.")
    except ValueError as e:
        sys.exit(str(e))
