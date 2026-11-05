#!/usr/bin/env python3
"""Start the six simulators in your browser: uv run serve.py

Python, the Claude Agent SDK and your Claude login. Everything runs on this laptop."""
import argparse, os, socket, subprocess, sys
from pathlib import Path
for k in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDECODE"): os.environ.pop(k, None)
ap = argparse.ArgumentParser(description=__doc__); ap.add_argument("--port", type=int, default=8765); ap.add_argument("--no-open", action="store_true"); a = ap.parse_args()
def free(p):
    with socket.socket() as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try: s.bind(("127.0.0.1", p)); return True
        except OSError: return False
port = next((p for p in range(a.port, a.port + 25) if free(p)), None)
if port is None: sys.exit(f"No free port near {a.port}. Try: uv run serve.py --port 9000")
if port != a.port: print(f"Port {a.port} is busy, using {port}.")
print(f"Six simulators at http://127.0.0.1:{port}  (Ctrl+C to stop)")
os.chdir(Path(__file__).parent)
sys.exit(subprocess.call([sys.executable, "-m", "streamlit", "run", "app.py", "--server.port", str(port), "--server.address", "127.0.0.1", "--server.headless", "true" if a.no_open else "false"]))
