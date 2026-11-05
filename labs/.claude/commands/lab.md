---
description: Run one course lab on its simulator. You answer first, then the simulator shows you.
argument-hint: <lab number, 1 to 61>
allowed-tools: Bash(uv run *), Read, Grep, Glob
---
Run lab $ARGUMENTS of the Claude Certified Architect Foundation course with the learner, from the `labs` folder.

1. Run `uv run run_lab.py $ARGUMENTS --question` and show the learner the situation and options. Do not read `labs.json` and do not run `--answer` yet.
2. Ask which option they pick and why. Stop and wait for their reply. Do not run anything until they answer.
3. Tell them the commands call Claude through their login and overwrite that lab's saved evidence. Run the printed commands in order from the printed simulator folder.
4. Open what the commands wrote under that simulator's `evidence/` folder. Quote what actually happened: the tool calls, hook denials, check results.
5. Run `uv run run_lab.py $ARGUMENTS --answer`. Compare what you saw with "What you should see", and say so plainly if they disagree. Tell the learner whether their pick was right, and where their reasoning held or broke.
6. Offer the "change one thing" step, and offer to run it.

Practice-exam questions in this course are third-party and unofficial. Say so when the source says SkillCertPro.
