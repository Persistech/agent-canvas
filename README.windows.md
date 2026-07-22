# Windows quickstart (PowerShell)

This doc contains **Windows-specific** instructions for Agent Canvas: the **native desktop app installer** and the PowerShell command syntax for the **Docker sandbox**.

For the main install options and overall context, see [README.md](./README.md).

## Option 2: With a Docker Sandbox (Windows)

**Prerequisites**:

- Docker Desktop for Windows
- A host directory for `PROJECTS_PATH` containing the project folders you want the agent to access (create it before starting the container)

```powershell
docker pull ghcr.io/openhands/agent-canvas:1.5.2 # x-release-please-version

$env:PROJECTS_PATH = Join-Path $HOME "projects"  # directory containing your project folders
New-Item -ItemType Directory -Force -Path $env:PROJECTS_PATH, (Join-Path $env:USERPROFILE ".openhands") | Out-Null

docker run -it --rm `
  -p 8000:8000 `
  -v "$($env:USERPROFILE)\.openhands:/home/openhands/.openhands" `
  -v "$($env:PROJECTS_PATH):/projects" `
  ghcr.io/openhands/agent-canvas:1.5.2 # x-release-please-version
```

Open [http://localhost:8000/canvas](http://localhost:8000/canvas) in your browser.

The agent will be able to access any project under `PROJECTS_PATH`.

## Option 4: Windows Desktop App (Native Installer)

The desktop app runs the full Agent Canvas stack (agent server, automation backend, and UI) in a single native app — no Node.js, Docker, or uv required.

> [!WARNING]
> Like Options 1 and 3 in [README.md](./README.md), this runs the agent-server directly on your machine — the agent will have full access to your filesystem!

1. Download `Agent-Canvas-Setup-<version>.exe` from the [latest release](https://github.com/OpenHands/agent-canvas/releases/latest).
2. Run the installer. It is not code-signed yet, so Windows SmartScreen may warn you — click **More info → Run anyway**.
3. Pick an install location if you like (defaults to a per-user install under `%LOCALAPPDATA%\Programs\Agent Canvas`) and finish the wizard. Desktop and Start menu shortcuts are created.
4. Launch **Agent Canvas**.

**First launch:** the app uses the bundled `uv` to download the OpenHands agent server from PyPI. This needs an internet connection and can take several minutes; the loading screen streams progress. Later launches use the cache and start quickly.

The app serves its stack on ports **8000**, **18000**, and **18001** — if startup fails, make sure nothing else is using those ports.

### Building the installer from source (on Windows)

**Prerequisites**: Node.js 22.12.x or later, `npm`

```powershell
git clone https://github.com/OpenHands/agent-canvas.git
cd agent-canvas
npm ci
npm run build:desktop
```

The installer is written to `dist-electron\Agent-Canvas-Setup-<version>.exe`.
