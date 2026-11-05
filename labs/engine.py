"""Runs the simulators for the website: background jobs that stream, one per simulator, always stoppable."""
import asyncio, json, os, re, secrets, shlex, shutil, signal, subprocess, sys, tempfile, threading, time, hashlib
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import simkit
from guides import BENCH, GUIDES

HERE = Path(__file__).resolve().parent
SIMS_DIR = HERE / "simulators"
LABS = {l["id"]: l for l in json.loads((HERE / "labs.json").read_text())}
SIMS = {s["n"]: s for s in json.loads((HERE / "sims.json").read_text())}
MODELS = ["claude-sonnet-5-5", "claude-haiku-5-5", "claude-opus-5-5"]
TEXT = {".json", ".md", ".txt", ".py", ".sh", ".jsonl", ".yml", ".yaml", ".toml", ".ts", ".tsx", ".js", ".html", ".css", ".log"}
SKIP = {"__pycache__", "node_modules", ".git", ".pristine-evidence", "work"}
JOBS, ACTIVE, LOCK = {}, {}, threading.Lock()
MAX_SECONDS = 1800

def sim_dir(n): return SIMS_DIR / SIMS[n]["dir"]

def login():
    """Is this laptop signed in to Claude? Asks the same CLI the SDK drives."""
    try:
        d = json.loads(subprocess.run(["claude", "auth", "status"], capture_output=True, text=True, timeout=20).stdout)
        return bool(d.get("loggedIn")), d.get("authMethod", "")
    except Exception:
        return False, ""

class Job:
    def __init__(self, sim, title):
        self.id = secrets.token_hex(6); self.sim, self.title = sim, title
        self.lines, self.events, self.evidence = [], [], []
        self.done, self.exit, self.stopped, self.proc = False, None, False, None
        self.started, self.ended, self.last, self.result = time.time(), None, time.time(), None
    def line(self, t):
        self.lines.append(t); self.last = time.time()
    def event(self, **e):
        self.events.append(e); self.last = time.time()
    def finish(self, code):
        self.exit, self.done, self.ended = code, True, time.time()
        with LOCK:
            if ACTIVE.get(self.sim) == self.id: ACTIVE.pop(self.sim, None)
    def stop(self):
        self.stopped = True
        if self.proc and self.proc.poll() is None:
            try: os.killpg(self.proc.pid, signal.SIGTERM)
            except ProcessLookupError: pass
        if not self.proc: self.finish(130)

def active(n):
    with LOCK: i = ACTIVE.get(n)
    return JOBS.get(i) if i else None

def latest(n):
    js = [j for j in JOBS.values() if j.sim == n]
    return max(js, key=lambda j: j.started) if js else None

def _claim(job):
    with LOCK:
        if job.sim in ACTIVE: return False
        ACTIVE[job.sim] = job.id; JOBS[job.id] = job
    return True

SF_DATALESS = 0x40000000  # macOS marks a file this way when only its iCloud placeholder is on disk
SKIP_FETCH = {"work", ".venv", "__pycache__", "node_modules", ".pristine-evidence"}

def placeholders(root):
    found = []
    for dirpath, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_FETCH]
        for f in files:
            p = os.path.join(dirpath, f)
            try:
                if getattr(os.stat(p), "st_flags", 0) & SF_DATALESS: found.append(p)
            except OSError: pass
    return found

def _touch(p):
    try:
        with open(p, "rb") as f: f.read(1)
    except OSError: pass

def fetch_from_icloud(n, say=print):
    """If this folder lives in iCloud, bring its evicted files back first, and say so. Otherwise this does nothing."""
    files = [p for p in (str(x) for x in HERE.glob("*.py")) if getattr(os.stat(p), "st_flags", 0) & SF_DATALESS] + placeholders(sim_dir(n))
    if not files: return
    say(f"  iCloud: downloading {len(files)} files this simulator needs...")
    began = time.time()
    with ThreadPoolExecutor(8) as pool:
        for i, _ in enumerate(pool.map(_touch, files), 1):
            if i % 10 == 0 and i < len(files): say(f"  iCloud: {i} of {len(files)} files")
    say(f"  iCloud: all {len(files)} files ready in {int(time.time() - began)}s.")

def snapshot(n):
    src, dst = sim_dir(n) / "evidence", sim_dir(n) / ".pristine-evidence"
    if src.exists() and not dst.exists(): shutil.copytree(src, dst)

def restore(n):
    d = sim_dir(n)
    if active(n): return "A run is in progress. Stop it first."
    if not (d / ".pristine-evidence").exists(): return "Nothing to restore: no live run has changed the evidence."
    shutil.rmtree(d / "evidence", ignore_errors=True); shutil.copytree(d / ".pristine-evidence", d / "evidence")
    return "Evidence restored to the shipped copy."

def to_argv(cmd):
    a = shlex.split(cmd.split(";")[0])
    if a[:3] == ["uv", "run", "python"]: a = [sys.executable, "-B"] + a[3:]
    elif a[:2] == ["uv", "run"]: a = [sys.executable, "-B"] + a[2:]
    return a

def run_steps(n, title, steps, model=None, evidence=(), live=True):
    """Run commands one after another in a background thread, streaming every line."""
    job = Job(n, title); job.evidence = list(evidence)
    if not _claim(job): return None
    env = dict(os.environ, PYTHONUNBUFFERED="1")
    for k in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDECODE"): env.pop(k, None)
    if model: env["LAB_MODEL"] = model
    def beat():  # silence reads as broken, so say we're alive
        while not job.done:
            time.sleep(1)
            quiet = int(time.time() - job.last)
            if live and quiet and quiet % 10 == 0 and not job.done: job.lines.append(f"  ... still working, {quiet}s since the last step")
    def work():
        code = 0
        try:
            threading.Thread(target=beat, daemon=True).start()
            if live:
                fetch_from_icloud(n, job.line)
                snapshot(n)
            for argv in steps:
                if job.stopped: break
                job.line("$ " + ("uv run " + " ".join(shlex.quote(x) for x in argv[2:]) if argv[0] == sys.executable else " ".join(shlex.quote(x) for x in argv)))
                if live: job.line("  starting Python and loading the simulator...")
                job.proc = subprocess.Popen(argv, cwd=sim_dir(n), env=env, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, errors="replace", bufsize=1, start_new_session=True)
                killer = threading.Timer(MAX_SECONDS, job.stop); killer.start()
                for l in job.proc.stdout: job.line(l.rstrip("\n"))
                rc = job.proc.wait(); killer.cancel()
                job.line(f"[finished, exit {rc}]"); code = code or rc
        except Exception as e:
            job.line(f"!! {e}"); code = 1
        finally:
            job.finish(code)
    threading.Thread(target=work, daemon=True).start()
    return job

def run_async(n, title, fn):
    """Run an Agent SDK coroutine in a background thread. fn receives the job."""
    job = Job(n, title)
    if not _claim(job): return None
    def work():
        code = 0
        try: asyncio.run(fn(job))
        except Exception as e:
            job.line(f"!! {e}"); job.event(k="error", text=str(e)); code = 1
        finally: job.finish(130 if job.stopped else code)
    threading.Thread(target=work, daemon=True).start()
    return job

def evidence_for(n, cmd):
    a = shlex.split(cmd.split(";")[0]); script = next((x for x in a if x.endswith(".py")), "")
    cases = [a[i + 1] for i, x in enumerate(a[:-1]) if x in ("--case", "--evaluate")]
    tag = a[a.index("--tag") + 1] if "--tag" in a else ""
    if n == 1 and script == "support_agent.py": return [f"evidence/runs/{c}{'-' + tag if tag else ''}.json" for c in cases]
    if cases: return [f"evidence/cases/{c}.json" for c in cases]
    if script == "evaluate.py": return ["evidence/evaluation.json"]
    if script == "case_review.py": return [f"evidence/case-review-{a[-1]}.txt"]
    if script == "triage.py":
        if "--batch" in a: return ["evidence/triage-batch.json"]
        tpl = a[a.index("--template") + 1] if "--template" in a else "prompts/triage_template.md"
        return [f"evidence/triage-{Path(tpl).stem}.json"]
    if script == "simulator.py": return ["evidence/run.json"]
    if script == "research_system.py":
        s = "-narrow" if "--narrow" in a else ""
        return [f"evidence/report{s}.md", f"evidence/run{s}.json"]
    if script == "rules_sim.py": return ["evidence/rules_sim.json"]
    if script == "explorer.py":
        p = next((x for x in a if x in ("explore", "edit", "fork", "recover")), "explore")
        return ["evidence/fork-a.json", "evidence/fork-b.json"] if p == "fork" else [f"evidence/{p}.json"]
    if script == "ci_subagents.py": return ["evidence/pr-comment-lossy.md"] if "--lossy" in a else ["evidence/pr-comment-pass-findings.md"]
    if script == "hook_gate.py": return ["evidence/hook_gate.json"]
    if script == "ci_review.py": return ["evidence/review-integration.json", "evidence/review.json"]
    if script == "extract.py": return ["evidence/accuracy.json", "evidence/batch.json" if "--batch" in a else "evidence/extraction.json"]
    if "json.tool" in cmd: return [a[-1]]
    return []

def lab_evidence(l):
    return sorted({p for c in l["cmds"] for p in evidence_for(l["sim"], c)})

def existing(n, paths): return [p for p in paths if (sim_dir(n) / p).exists()]

def run_lab(lab_id, model):
    l = LABS[lab_id]
    return run_steps(l["sim"], f"Lab {lab_id}", [to_argv(c) for c in l["cmds"]], model, lab_evidence(l))

LOOK = {"ls", "cat", "head", "tail", "grep", "wc", "pwd"}
TERMINAL_HELP = "This terminal runs `uv run`, `ls`, `cat`, `head`, `tail`, `grep`, `wc` and `pwd`, inside this simulator's folder."

def typed_command(n, text, model):
    """The built-in terminal. No shell, and nothing outside this simulator's folder. Returns (job, problem)."""
    text = text.strip()
    if not text: return None, "Type a command first."
    if re.search(r"[;|&<>`$]", text): return None, "One command at a time, please: no pipes or redirects. " + TERMINAL_HELP
    try: a = shlex.split(text)
    except ValueError: return None, "Check the quotes in that command."
    if a[0] == "cd": return None, "No need to change folder. You're already in this simulator's folder."
    if any(x.startswith(("/", "~")) or ".." in x or ".env" in x for x in a[1:]): return None, "That path is outside this simulator's folder. " + TERMINAL_HELP
    live = False
    if a[:2] == ["uv", "run"]:
        rest = a[2:]
        if rest[:1] == ["python"]: rest = rest[1:]
        if rest[:2] == ["-m", "json.tool"]: pass
        elif not rest or not rest[0].endswith(".py") or not (sim_dir(n) / rest[0]).is_file(): return None, "`uv run` needs a Python file from this folder. Try `ls` to see them."
        else: live = rest[0] != "verify.py"
        argv = [sys.executable, "-B"] + rest
    elif a[0] == "python3" and a[1:3] == ["-m", "json.tool"]:
        argv = [sys.executable, "-B"] + a[1:]
    elif a[0] in LOOK:
        argv = a
    else:
        return None, f"`{a[0]}` isn't available here. " + TERMINAL_HELP
    return run_steps(n, text, [argv], model, evidence_for(n, text) if live else [], live=live), None

def case_choices(n, glob):
    out = []
    files = sorted(sim_dir(n).glob(glob))
    if n == 1: files += sorted((sim_dir(1) / "my_cases").glob("MY-*.json"))
    for f in files:
        try:
            d = json.loads(f.read_text()); text = d.get("message") or d.get("situation") or ""
            exp = (d.get("expected") or {}).get("disposition") if isinstance(d.get("expected"), dict) else None
            out.append(dict(value=f.stem, label=f"{f.stem}: {d.get('title') or text[:60]}", detail=text, expected=exp))
        except Exception:
            out.append(dict(value=f.stem, label=f.stem, detail="", expected=None))
    return out

def run_bench(n, action, values, model):
    a = next(x for x in BENCH[n] if x["id"] == action)
    argv = [sys.executable, "-B", a["script"]] + a.get("fixed", []); tag = []
    for p in a.get("params", []):
        v = values.get(p["flag"] or p["label"])
        if p["type"] == "bool":
            if v: argv.append(p["flag"]); tag.append(p["flag"].strip("-").replace("no-", "no"))
        else:
            allowed = [c["value"] for c in case_choices(n, p["glob"])] if p["type"] == "cases" else p["choices"]
            if v in (None, ""): v = allowed[0]
            if v not in allowed: raise ValueError(f"{p['label']}: {v} is not one of the choices")
            if p["flag"] == "--prompt" and v != "prompts/system.md": tag.append("noguard")
            argv += [p["flag"], v] if p["flag"] else [v]
    if a.get("tag") and tag: argv += ["--tag", "-".join(tag)]
    cmd = " ".join(shlex.quote(x) for x in argv[2:])
    return run_steps(n, a["label"], [argv], model, evidence_for(n, cmd), live=a["cost"])

def tree(n):
    root = sim_dir(n); out = []
    for dp, dn, fs in os.walk(root):
        dn[:] = sorted(d for d in dn if d not in SKIP)
        for f in sorted(fs):
            p = Path(dp) / f
            if p.suffix in TEXT and not f.startswith(".env"): out.append(str(p.relative_to(root)))
    return out

def read(n, rel, shipped=False):
    """Read a file. shipped=True prefers the copy kept before any live run changed the evidence."""
    root = sim_dir(n).resolve(); p = (root / rel).resolve()
    if root not in p.parents or SKIP & set(p.parts): return None
    if shipped and rel.startswith("evidence/"):
        q = root / ".pristine-evidence" / rel[len("evidence/"):]
        if q.is_file(): p = q
    if not p.is_file(): return None
    return p.read_text(errors="replace")[:300000]

def copy_of(n, sub):
    """A throwaway copy for a live session, so the shipped files never change."""
    d = Path(tempfile.mkdtemp(prefix=f"sim{n}-")) / "repo"
    shutil.copytree(sim_dir(n) / sub, d, ignore=shutil.ignore_patterns("node_modules", "__pycache__", ".git"))
    subprocess.run("git init -q -b main && git add -A && git -c user.name=lab -c user.email=lab@example.com commit -qm baseline", shell=True, cwd=d, capture_output=True)
    return d

def changed_files(d):
    r = subprocess.run("git status --porcelain", shell=True, cwd=d, capture_output=True, text=True)
    return [l[3:] for l in r.stdout.splitlines()]
