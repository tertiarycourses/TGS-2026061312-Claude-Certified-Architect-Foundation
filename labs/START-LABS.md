# Set up and start the course simulators (instructions for Claude)

A learner asked you to set up or start the Claude Certified Architect Foundation simulators. Most learners are on **Windows** and have never used a terminal. Do every step yourself. The learner should only approve your commands and, once, the Claude sign-in in the browser. Report each step in one short line.

Find the operating system first. On Windows you may be in PowerShell, not Bash: use PowerShell syntax there.

## 1. Git (first time only)

Run `git --version`. If Git is missing:

- **Windows:** `winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements`. Then refresh this shell's PATH:
  `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`
- **Mac:** run `xcode-select --install` and tell the learner to click **Install** in the dialog that appears. Wait until `git --version` works.

If winget isn't available, download the repository as a ZIP instead (step 2) and tell the learner that Simulators 2 and 5 need Git for Windows later.

## 2. Get the course (first time only)

Skip this if `labs/start-labs.cmd` already exists here.

The folder should be empty. Clone into it:

```
git clone https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation.git .
```

If the folder isn't empty, clone into a new subfolder called `ccar-f` and use that.

No Git? Download https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/archive/refs/heads/master.zip and unzip it here (PowerShell: `Invoke-WebRequest <url> -OutFile ccar-f.zip; Expand-Archive ccar-f.zip .`).

## 3. Start the simulators: run the start script in its own window

The start script does the rest. It installs uv if it's missing, installs the simulators (`uv sync`, about a minute the first time), checks the Claude sign-in and opens the website. Launch it in a **separate window**, so it keeps running after this chat ends:

- **Windows (PowerShell):** `Start-Process -FilePath "labs\start-labs.cmd" -WorkingDirectory "labs"`
- **Mac:** `open -a Terminal labs/start-labs.command`

Then tell the learner:

1. A window titled *Claude Certified Architect simulators* opened. **Keep it open during class.** Closing it stops the simulators.
2. The first time only, a browser page may ask them to approve the Claude sign-in. Use the same account as the desktop app.
3. The simulators open at http://localhost:8765 (or 8766, 8767 and so on if that port is busy). If the page is blank, wait 20 seconds and refresh.
4. **Next time:** double-click `labs\start-labs.cmd` (Windows) or `labs/start-labs.command` (Mac). No Claude needed.

## If something goes wrong

- **The window says "Install failed":** read the error in it. Usually the network blocked the download. Retry step 3.
- **"Not signed in" in the simulators' sidebar:** in the `labs` folder, run `uv run login.py --login` and have the learner approve the browser page, then refresh.
- **"No claude program found"** (Windows on ARM laptops, such as Snapdragon): install Claude Code with `irm https://claude.ai/install.ps1 | iex`, then run step 3 again.
- **Nothing opens in the browser:** look at the window for the line `Six simulators at http://localhost:PORT`, and open that address.
- **The course is in OneDrive or Dropbox:** the script handles it already, by keeping the Python environment in `%LOCALAPPDATA%\ccar-f-labs-venv`.
