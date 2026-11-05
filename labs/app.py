"""The six simulators, in Python. Each page drives real Claude Agent SDK runs on this laptop."""
import json, re, time
import streamlit as st
import simkit, engine, live
from guides import GUIDES, PLAIN

st.set_page_config(page_title="Claude Certified Architect simulators", page_icon="logo.png", layout="wide")
SS = st.session_state

def _esc(t):
    """A dollar sign is money here, never maths. Leave code spans alone."""
    if not isinstance(t, str): return t
    return "".join(p if p.startswith("`") else p.replace("$", "\\$") for p in re.split(r"(`[^`]*`)", t))
if not getattr(st, "_dollars_safe", False):  # this script reruns, the st module doesn't: wrap once
    def _wrap(fn):
        return lambda body, *a, **k: fn(_esc(body), *a, **k)
    for _name in ("markdown", "info", "success", "warning", "error", "caption", "write"):
        setattr(st, _name, _wrap(getattr(st, _name)))
    st._dollars_safe = True

FIXED = ["Start here", "Play it live"]

def model_picker():
    st.sidebar.image("logo.png", width=56)
    ok, how = engine.login()
    if ok: st.sidebar.success(f"Signed in to Claude ({how})")
    else: st.sidebar.error("Not signed in. In a terminal, run: claude auth login")
    SS.setdefault("model", engine.MODELS[0])
    st.sidebar.selectbox("Model for live runs", engine.MODELS, key="model", help="Sonnet is a sensible default. Haiku spends least. Opus matches the course's saved evidence.")
    st.sidebar.caption("Live runs use your Claude allowance. Anything marked free makes no Claude call.")
    return ok

# ------------------------------------------------------------------ evidence
def show_trace(d):
    if d.get("message"): st.info(f"**Customer:** {d['message']}")
    for c in d["tool_calls"]:
        if c["tool"] == "ToolSearch": continue
        st.markdown(f"{'⚠️' if c.get('is_error') else '🔧'} `{c['tool']}` {PLAIN.get(c['tool'], '')}")
    for h in d.get("hooks", []):
        if h.get("decision") == "deny": st.error(f"**Hook blocked {h['tool']}:** {h['reason']}")
    if d.get("reply"): st.success(d["reply"])

def checks_in(d):
    for k in ("evaluation", "checks", "results", "rubric"):
        v = d.get(k)
        if isinstance(v, list) and v and isinstance(v[0], dict) and ({"pass", "passed"} & set(v[0])): return v
    return None

def show_file(n, path, shipped=False):
    text = engine.read(n, path, shipped)
    if text is None:
        st.warning(f"{path} isn't there yet. Run it first."); return
    st.caption(path)
    if path.endswith(".md"):
        with st.container(border=True, height=420): st.markdown(text)
    elif path.endswith(".json"):
        try: d = json.loads(text)
        except Exception:
            st.code(text); return
        special = False
        if isinstance(d, dict):
            if d.get("expected_outcome"): st.info(f"**Expected:** {d['expected_outcome']}")
            if isinstance(d.get("tool_calls"), list) and "message" in d: show_trace(d); special = True
            c = checks_in(d)
            if c:
                special = True
                for x in c:
                    p = x.get("pass", x.get("passed"))
                    st.markdown(f"{'✅' if p else ('➖' if p is None else '❌')} {x.get('criterion') or x.get('check') or x.get('name')}")
        with st.expander("Full evidence", expanded=not special): st.json(d, expanded=2)
    else:
        st.code(text[:40000], language=None)

# ------------------------------------------------------------------ the one console for a simulator
def console(n):
    job = engine.active(n) or (engine.latest(n) if SS.get(f"show_job_{n}") else None)
    if not job: return
    def body():
        j = engine.active(n) or job
        secs = int((j.ended or time.time()) - j.started)
        if not j.done:
            c1, c2 = st.columns([5, 1])
            c1.info(f"**{j.title}** is running ({secs}s). Claude is working. Each step appears below as it happens, and a pause of a minute is normal.")
            if c2.button("Stop", key=f"stop_{j.id}", use_container_width=True): j.stop()
        elif j.stopped: st.warning(f"**{j.title}** stopped after {secs}s.")
        elif j.exit == 0: st.success(f"**{j.title}** finished in {secs}s.")
        else: st.warning(f"**{j.title}** finished with exit {j.exit} after {secs}s. Some gates exit 1 on purpose, so read the output.")
        log = "\n".join(j.lines[-250:]) or "Starting..."
        st.code(log, language=None, height=320, wrap_lines=True)
        if re.search(r"not logged in|please run /login|invalid api key", log, re.I): st.error("Claude isn't signed in. In a terminal, run: claude auth login")
        if j.done and SS.get(f"rendered_{n}") != j.id:
            SS[f"rendered_{n}"] = j.id; st.rerun()
    st.subheader("Live output")
    _frag(body, job)
    if job.done and job.evidence:
        st.subheader("What it produced")
        for p in engine.existing(n, job.evidence): show_file(n, p)

def _frag(body, job):
    st.fragment(body, run_every="1s" if not job.done else None)()

def started(n, job, where=None):
    if job is None: st.warning("This simulator is busy with another run. Its live output is below, with a Stop button.")
    SS[f"show_job_{n}"] = True; SS[f"output_at_{n}"] = where
    st.rerun()

# ------------------------------------------------------------------ Start here
def start_here(n):
    g = GUIDES[n]; s = engine.SIMS[n]
    st.markdown(f"#### The scenario\n{g['story']}")
    st.markdown(g["real"])
    st.markdown(f"**The rules of this world:** {g['rules']}")
    with st.expander("Who's who", expanded=True):
        for a, b in g["cast"]: st.markdown(f"- **{a}:** {b}")
    with st.expander("The official exam scenario, word for word"):
        st.write(s["scenario"]); st.caption(f"Primary domains: {s['domains']}")
    st.markdown("#### Follow these steps")
    for i, (title, do, act, see) in enumerate(g["steps"], 1):
        with st.container(border=True):
            st.markdown(f"**Step {i}. {title}**\n\n{do}")
            k = f"st_{n}_{i}"
            kind = act[0]
            if kind in ("file", "saved", "saved2"):
                lab = "Open it" if kind == "file" else "Open the saved run (free)"
                if st.button(lab, key=k): SS[k + "_open"] = not SS.get(k + "_open")
                if SS.get(k + "_open"):
                    for p in act[1:]: show_file(n, p)
                    st.markdown(f"**You should see:** {see}")
            elif kind == "run":
                if st.button("Run it live", key=k, type="primary"):
                    started(n, engine.run_bench(n, act[1], act[2], SS.model), where=k)
                st.markdown(f"**You should see:** {see}")
                if SS.get(f"output_at_{n}") == k: console(n)
            else:
                if st.button(f"Go to {act[1]}", key=k, type="primary"):
                    SS[f"view_{n}"] = act[1]; st.rerun()
                st.markdown(f"**Try this:** {see}")

# ------------------------------------------------------------------ Play it live
def chat_log(events):
    for e in events:
        k = e["k"]
        if k == "tool":
            q = json.dumps(e["input"], default=str); q = q if len(q) < 150 else q[:150] + "…"
            st.markdown(f"{'&nbsp;&nbsp;&nbsp;↳ ' if e.get('sub') else ''}🔧 **{e['name']}**: {PLAIN.get(e['name'], 'Uses a tool')}  \n`{q}`")
        elif k == "result" and e["error"]: st.warning(f"{e['name']} returned an error: {e['text'][:300]}")
        elif k == "deny": st.error(f"**A hook blocked {e['tool']}.** {e['reason']}")
        elif k == "text": pass
        elif k == "changed": st.info("Files changed in your temporary copy: " + ", ".join(e["files"]))
        elif k == "done":
            if e.get("reply"):
                st.markdown(e["reply"])
            st.caption(f"{e['turns']} turns · ${e['cost']:.4f}")
        elif k == "error": st.error(e["text"])

def chat_panel(n):
    key = f"sess_{n}_live"
    if key not in SS: SS[key] = live.new_session(n)
    s = SS[key]
    for t in s["turns"]:
        with st.chat_message("user"): st.write(t["user"])
        if t["job"].done:
            with st.chat_message("assistant"): chat_log(t["job"].events)
    busy = engine.active(n)
    if s["turns"] and not s["turns"][-1]["job"].done:
        j = s["turns"][-1]["job"]
        def tick():
            if j.done: st.rerun()
            with st.chat_message("assistant"): chat_log(j.events)
            c1, c2 = st.columns([5, 1])
            c1.caption(f"Claude is working ({int(time.time() - j.started)}s). Each step appears here as it happens.")
            if c2.button("Stop", key=f"stopc_{j.id}"): j.stop()
        st.fragment(tick, run_every="1s")()
    examples = GUIDES[n]["prompts"]
    if examples and not s["turns"]:
        st.caption("Not sure what to type? Press one:")
        for i, ex in enumerate(examples):
            if st.button(ex, key=f"ex_{key}_{i}"): SS[key + "_q"] = ex; st.rerun()
    q = st.chat_input("Type here and press Enter", key=f"in_{key}", disabled=bool(busy)) or SS.pop(key + "_q", None)
    if q:
        model = SS.model  # read it here: session state isn't available inside the worker thread
        j = engine.run_async(n, "Your request", lambda job: live.chat_turn(job, s, q, model))
        if j is None: st.warning("Another run is using this simulator. Wait for it, or stop it.")
        else: s["turns"].append(dict(user=q, job=j)); st.rerun()
    if s["turns"]:
        st.caption(f"This conversation has spent ${s['cost']:.4f}.")
        if st.button("Start a new conversation", key=f"new_{key}"): del SS[key]; st.rerun()

def play(n):
    if n == 1:
        st.markdown("**You are the customer.** Write in, and watch the agent work the case. Change the switches to weaken it.")
        with st.expander("Switches", expanded=False):
            backend = json.loads(engine.read(1, "fixtures/backend.json")); cu = backend["customers"]
            opts = [""] + [c["email"] for c in cu.values()]
            who = st.selectbox("You are signed in as", opts, format_func=lambda x: x or "Nobody: the agent must identify you", key="live_who")
            sw = dict(email=who, gate=not st.checkbox("Switch off the identity gate", key="sw1"), limit=not st.checkbox("Switch off the $500 refund hook", key="sw2"), validation=not st.checkbox("Let refunds skip validation", key="sw3"), prompt="prompts/system-noguard.md" if st.checkbox("Delete the $500 rule from the prompt", key="sw4") else "prompts/system.md")
            st.caption("Press Start a new conversation after changing a switch.")
        if "sess_1_live" not in SS: SS["sess_1_live"] = live.new_session(1, sw)
        if not SS["sess_1_live"]["turns"]: SS["sess_1_live"]["switches"] = sw
        chat_panel(1)
    elif n == 2:
        st.markdown("**You are a developer on the team.** Claude Code's engine works on a temporary copy of the repo, so experiment freely.")
        chat_panel(2)
    elif n == 4:
        st.markdown("**You are new to this repo.** Ask anything. The agent follows the house rules, and the hooks stay on.")
        chat_panel(4)
    elif n == 3:
        st.markdown("**You are asking the research team a question.** The coordinator plans it, the specialists work the mock web, and you get a cited report. Allow a few minutes.")
        q = st.text_area("Your question", value=SS.get("q3", GUIDES[3]["prompts"][0]), key="q3")
        if st.button("Ask the team", type="primary"):
            started(3, engine.run_steps(3, "Research question", [[engine.sys.executable, "-B", "research_system.py", "--ask", f"Research this topic and deliver a cited report: {q}"]], SS.model, ["evidence/report-ask.md"]))
        console(3)
    elif n == 5:
        st.markdown("**You are the pipeline.** Pick a file from pull request 418, and Claude reviews it with the team's criteria and a fixed output schema.")
        files = ["stock/repository.py", "stock/totals.py", "stock/api.py", "stock/jobs.py"]
        f = st.selectbox("File to review", files, key="f5")
        with st.expander("See the file"): st.code(engine.read(5, "repo/" + f), language="python")
        if st.button("Run the CI reviewer", type="primary"):
            model = SS.model; SS["j5"] = engine.run_async(5, f"CI review of {f}", lambda job: live.review_file(job, f, model)); SS["show_job_5"] = True; st.rerun()
        console(5)
        j = SS.get("j5")
        if j and j.done and j.result is not None:
            fs = j.result.get("findings", [])
            blocking = [x for x in fs if x.get("severity") in ("critical", "high")]
            (st.error if blocking else st.success)(f"**Gate: {'BLOCKED, exit 1' if blocking else 'pass, exit 0'}.** {len(fs)} finding(s), {len(blocking)} blocking.")
            if fs: st.dataframe([{k: x.get(k) for k in ("line", "severity", "category", "issue")} for x in fs], use_container_width=True, hide_index=True)
    elif n == 6:
        st.markdown("**You are feeding the accounts system.** Pick a document or paste your own. Change a number, and see what the validator and router do.")
        raw = engine.read(6, "fixtures/invoices.txt"); docs = {b.partition("\n")[0].split(" | ")[0].strip(): b.partition("\n")[2].strip() for b in raw.split("=== ")[1:]}
        pick = st.selectbox("Start from", list(docs), index=2, key="d6")
        text = st.text_area("The document", value=docs[pick], height=200, key=f"text6_{pick}")
        c1, c2 = st.columns(2); typ = c1.selectbox("Document type", ["invoice", "receipt", "credit_note"], key="t6"); retries = c2.selectbox("Retries allowed", [2, 1, 0], key="r6")
        if st.button("Extract it", type="primary"):
            model = SS.model; SS["j6"] = engine.run_async(6, "Extraction", lambda job: live.extract_document(job, text, typ, model, retries)); SS["show_job_6"] = True; st.rerun()
        console(6)
        j = SS.get("j6")
        if j and j.done and j.result:
            r = j.result
            (st.warning if r["routing"] == "human_review" else st.success)(f"**Routed to: {r['routing'].replace('_', ' ')}.** Attempts: {len(r['attempts'])}. Validation errors left: {len(r['final_errors'])}.")
            for e in r["final_errors"]: st.markdown(f"- `{e.get('field')}`: {e.get('message')}")
            st.json(r["extraction"], expanded=1)

# ------------------------------------------------------------------ Labs
def lab_page(n, lid):
    l = engine.LABS[lid]
    st.subheader(f"Lab {lid}: {l['title']}")
    unofficial = " · Third-party practice question, unofficial" if l["src"].startswith("P") else ""
    st.caption(f"Topic {l['topic']}: {l['topic_name']} · Task {l['task']} · {'Run in class' if l['core'] else 'Self-practice'}{unofficial}")
    with st.expander("Lab instructions"):
        st.markdown(f"**What you're doing:** answering one question about {l['task_title'][0].lower()}{l['task_title'][1:]}, then watching the right answer work on the {l['sim_name']} simulator.")
        st.markdown("1. Read the question and click the answer you'd choose.\n2. Read why that answer is right or wrong. The page shows you straight away.\n3. Press **Simulate it live**. Each step appears in the output as it happens, usually within a minute or two.\n4. Read what it produced, and compare it with **You should see**.\n5. Short on time or budget? Press **Show the saved run**. It's free.\n6. Want to look closer? Use the built-in terminal under the buttons. You don't need to open anything else.")
        st.markdown("**The command this lab runs:**")
        st.code("\n".join(c.split(";")[0] for c in l["cmds"]), language=None)
    st.markdown(l["stem"])
    pick = st.radio("Pick your answer", list(l["options"]), format_func=lambda k: f"{k}. {l['options'][k]}", index=None, key=f"pick_{lid}")
    if pick is None:
        st.caption("Click an answer, and you'll see straight away whether it's right, and why.")
        return
    if pick == l["answer"]: st.success(f"**Yes, {pick} is right.** {l['fix']}")
    else: st.error(f"**Not quite. The answer is {l['answer']}.** {l['fix']}")
    if l.get("why"): st.markdown(l["why"])
    if l.get("wrong"):
        with st.expander("Why the other answers fall short"):
            for k, v in l["wrong"].items(): st.markdown(f"**{k}.** {v}")
    st.divider()
    st.markdown("#### Watch the right answer work")
    st.markdown("Press Simulate, and this page will " + " Then it will ".join(what_it_does(n, c) for c in l["cmds"]) + f"  \n**You should see:** {l['see']}")
    where = f"lab{lid}"
    c1, c2 = st.columns(2)
    if c1.button("▶ Simulate it live", type="primary", key=f"run_{lid}", use_container_width=True): started(n, engine.run_lab(lid, SS.model), where=where)
    if c2.button("Show the saved run (free)", key=f"sv_{lid}", use_container_width=True): SS[f"saved_{lid}"] = not SS.get(f"saved_{lid}")
    terminal(n, lid, where)
    if SS.get(f"output_at_{n}") == where or engine.active(n): console(n)
    if SS.get(f"saved_{lid}"):
        st.markdown("#### The saved run")
        ps = engine.existing(n, engine.lab_evidence(l))
        for p in ps: show_file(n, p, shipped=True)
        if not ps: st.info("This lab has no saved file. Press Simulate it live to see it run.")
    st.divider()
    st.markdown(f"**Try this next:** {l['try']}")
    st.caption(f"Prefer Claude Code? Open it in the labs folder and type /lab {lid}.")

def terminal(n, lid, where):
    """A terminal on the page, so nobody has to leave the browser."""
    l = engine.LABS[lid]
    with st.form(f"term_{lid}", border=True):
        st.markdown("**Built-in terminal**, already in this simulator's folder. Change the command, or press Enter to run it.")
        cmd = st.text_input("Command", value=l["cmds"][0].split(";")[0], key=f"cmd_{lid}", label_visibility="collapsed")
        go = st.form_submit_button("Run command")
        st.caption("Try `ls`, `ls evidence`, or `cat` with any file you see.")
    if go:
        job, problem = engine.typed_command(n, cmd, SS.model)
        if problem: st.warning(problem)
        elif job is None: st.warning("This simulator is still busy. Wait for it to finish, or press Stop above.")
        else: started(n, job, where=where)

def what_it_does(n, c):
    a = c.split(";")[0].split(); s = next((x for x in a if x.endswith(".py")), "")
    cs = re.findall(r"--case (\S+)", c); case = cs[0] if cs else None
    if "json.tool" in c: return "show the accuracy file." if "accuracy" in c else "show the evidence file."
    if s == "support_agent.py" and len(cs) > 1: return "send tickets " + ", ".join(cs[:-1]) + f" and {cs[-1]} to the agent."
    if s == "support_agent.py" and case:
        extra = " with the $500 rule deleted from the prompt, so only the hook can stop it" if "noguard" in c else ""
        return f"send ticket {case} to the agent{extra}."
    return {"casekit.py": f"set up use case {case} in a temporary copy, run it, and score it." if case else "score the saved run.", "simulator.py": f"run configuration check {a[-1]}.", "research_system.py": f"run the research team on use case {case}." if case else "run the whole research team on a broad plan.",
            "rules_sim.py": "put the testing rule in one file with path patterns, and check when it loads.", "explorer.py": f"run use case {case} against a fresh copy of the repo.", "ci_review.py": "review pull request 418 and report the exit code.", "ci_subagents.py": "run the reviewer team and pass every finding through to the PR comment.", "hook_gate.py": "try to approve the PR with and without passing tests.",
            "extract.py": f"run use case {case}." if case else "extract the documents, validate them and route them.", "triage.py": "send the transcripts through the batch workflow." if "--batch" in c else "pilot the refined prompt template on ten transcripts.", "evaluate.py": "score every saved run.", "backend_tools.py": "call the mock tools directly, with no Claude.", "case_review.py": "run the /case-review skill on a saved case."}.get(s, f"run {c}.")

# ------------------------------------------------------------------ pages
def sim_page(n):
    def page():
        model_picker()
        s = engine.SIMS[n]
        st.caption(f"SIMULATOR {n} · {len([l for l in engine.LABS.values() if l['sim'] == n])} LABS · POWERED BY THE CLAUDE AGENT SDK")
        st.title(s["name"])
        st.markdown(f"#### {s['tagline']}")
        st.markdown(" → ".join(f"`{x}`" for x in s["flow"]))
        mine = [l["id"] for l in engine.LABS.values() if l["sim"] == n]
        names = FIXED + [f"Lab {i}" for i in mine]
        qp = st.query_params.get("lab")
        if qp and qp.isdigit() and int(qp) in mine and not SS.get(f"qp_{n}_{qp}"):
            SS[f"qp_{n}_{qp}"] = True; SS[f"view_{n}"] = f"Lab {qp}"
        SS.setdefault(f"view_{n}", names[0])
        st.caption("Start here first. Lab numbers match the slides and the Learner Guide.")
        v = st.pills("View", names, key=f"view_{n}", label_visibility="collapsed") or names[0]
        st.divider()
        if v == "Start here": start_here(n)
        elif v == "Play it live": play(n)
        else: lab_page(n, int(v.split()[1]))
    return page

def home():
    ok = model_picker()
    st.caption("TGS-2026061312 · CLAUDE CERTIFIED ARCHITECT FOUNDATION")
    st.title("Six real systems. 61 labs. Break them on purpose.")
    st.markdown("Each simulator is one official exam scenario, running on this laptop. The customers and data are fake. **Claude is real**, driven by the Claude Agent SDK through your own login.")
    if not ok: st.error("You're not signed in yet. In a terminal, run: claude auth login, then reload this page.")
    st.markdown("**New here?** Open Simulator 1 and follow Start here. It takes about ten minutes, and most steps are free.\n\nEach simulator holds a set of labs. In a lab, you pick an answer, see at once why it's right or wrong, then watch the right answer work. Everything happens on this page.")
    cols = st.columns(3)
    for i, (n, s) in enumerate(engine.SIMS.items()):
        with cols[i % 3].container(border=True):
            st.caption(f"SIMULATOR {n}")
            st.markdown(f"**{s['name']}**\n\n{s['tagline']}")
            st.page_link(PAGES[n], label=f"Open Simulator {n}", icon="▶️")
    st.divider()
    st.markdown("**Prefer Claude Code?** Open it in the `labs` folder and type `/lab 9`.  \nEvery lab also has a built-in terminal, so you never need to open one yourself.")
    st.caption("© Tertiary Infotech Academy Pte Ltd · UEN 201200696W. Practice-exam questions are third-party and unofficial.")

PAGES = {n: st.Page(sim_page(n), title=f"{n}. {s['name']}", url_path=f"sim{n}") for n, s in engine.SIMS.items()}
st.navigation([st.Page(home, title="All six simulators", default=True)] + list(PAGES.values())).run()
