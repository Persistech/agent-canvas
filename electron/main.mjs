/**
 * Electron Main Process — Agent Canvas Desktop
 *
 * Starts the full Agent Canvas stack (agent-server + automation via uvx,
 * static frontend, ingress proxy), then opens a native BrowserWindow once
 * the ingress is ready. Shows a loading screen while backends start.
 *
 * Path layout (electron-builder uses directories.app: 'electron'):
 *
 *   Packaged (macOS example):
 *     Contents/Resources/app/     ← __dirname (main.mjs lives here)
 *       main.mjs
 *       loading.html
 *       scripts/                  ← copied from repo scripts/
 *       config/                   ← copied from repo config/
 *       build/                    ← static frontend
 *     Contents/Resources/bin/     ← process.resourcesPath/bin
 *       uv  uvx                   ← bundled via extraResources
 *
 *   Dev (npm run desktop  →  electron electron/main.mjs):
 *     electron/main.mjs           ← __dirname = <repo>/electron/
 *     scripts/ config/ build/     ← one level up: <repo>/
 *     system uvx from PATH
 *
 * When packaged, scripts/config/build are siblings of main.mjs so
 * projectRoot === __dirname. In dev they are one level up.
 */

import {
  app,
  BrowserWindow,
  dialog,
  nativeTheme,
  shell,
} from "electron";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Path resolution ───────────────────────────────────────────────────────────
// Packaged (directories.app: 'electron'): scripts/config/build are SIBLINGS of
// main.mjs inside Resources/app/, so projectRoot === __dirname.
// Dev (electron electron/main.mjs): those directories are one level UP in the
// repo root, so projectRoot === join(__dirname, '..').

const projectRoot = app.isPackaged ? __dirname : join(__dirname, "..");
const buildDir = join(projectRoot, "build");
const scriptsDir = join(projectRoot, "scripts");

// ── Bundled uv ────────────────────────────────────────────────────────────────

/**
 * Inject the bundled uv binary into PATH so that uvx calls inside
 * dev-with-automation.mjs resolve to our bundled binary.
 * No-op in dev mode (falls back to system uv).
 */
function injectBundledUv() {
  if (!app.isPackaged) return;

  const isWin = process.platform === "win32";
  const uvName = isWin ? "uv.exe" : "uv";
  const uvxName = isWin ? "uvx.exe" : "uvx";
  const binDir = join(process.resourcesPath, "bin");
  const uvPath = join(binDir, uvName);

  if (!existsSync(uvPath)) {
    console.warn("[desktop] Bundled uv not found at", uvPath);
    return;
  }

  // electron-builder copies files without preserving the +x bit on Unix.
  if (!isWin) {
    try {
      chmodSync(uvPath, 0o755);
      const uvxPath = join(binDir, uvxName);
      if (existsSync(uvxPath)) chmodSync(uvxPath, 0o755);
    } catch {}
  }

  const sep = isWin ? ";" : ":";
  process.env.PATH = `${binDir}${sep}${process.env.PATH ?? ""}`;
  console.log("[desktop] Injected bundled uv from", binDir);
}

/**
 * Verify uvx is reachable (either bundled or system).
 * Returns true/false — callers show a dialog on false.
 */
function uvxAvailable() {
  const cmd = process.platform === "win32" ? "uvx.exe" : "uvx";
  const r = spawnSync(cmd, ["--version"], { stdio: "pipe" });
  return r.status === 0;
}

/**
 * Ensure `node` is available in PATH for spawning backend scripts.
 *
 * When the app runs as a packaged .app on macOS, the system PATH is minimal
 * (/usr/bin:/bin only) — Homebrew, nvm, and other Node installs are absent.
 * The dev-with-automation.mjs stack spawns `node scripts/ingress.mjs` and
 * `node scripts/static-server.mjs`; if `node` is not found those processes
 * fail silently and port 8000 never responds.
 *
 * Electron ships its own Node.js runtime. Setting ELECTRON_RUN_AS_NODE=1
 * makes the Electron binary behave as plain Node. We create a thin wrapper
 * script in a temp directory and prepend that directory to PATH so that any
 * subsequent `node` call resolves to Electron's built-in runtime.
 */
function ensureNodeWrapper() {
  // If node is already reachable (dev mode, or system install in PATH) do nothing.
  const check = spawnSync("node", ["--version"], { stdio: "pipe" });
  if (check.status === 0) return;

  const wrapperDir = join(app.getPath("temp"), "agent-canvas-node-wrapper");
  mkdirSync(wrapperDir, { recursive: true });

  if (process.platform === "win32") {
    const bat = join(wrapperDir, "node.cmd");
    writeFileSync(bat, `@echo off\nset ELECTRON_RUN_AS_NODE=1\n"${process.execPath}" %*\n`);
  } else {
    const sh = join(wrapperDir, "node");
    writeFileSync(
      sh,
      `#!/bin/sh\nexec env ELECTRON_RUN_AS_NODE=1 "${process.execPath}" "$@"\n`
    );
    chmodSync(sh, 0o755);
  }

  const sep = process.platform === "win32" ? ";" : ":";
  process.env.PATH = `${wrapperDir}${sep}${process.env.PATH ?? ""}`;
  console.log("[desktop] node wrapper →", wrapperDir);
}

// ── Readiness polling ─────────────────────────────────────────────────────────

async function waitForUrl(url, timeoutMs = 120_000, intervalMs = 600) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `Timed out waiting for ${url} to become ready (${timeoutMs / 1000}s).`
  );
}

// ── Windows ───────────────────────────────────────────────────────────────────

let loadingWin = null;
let mainWin = null;

function createLoadingWindow() {
  loadingWin = new BrowserWindow({
    width: 420,
    height: 280,
    resizable: false,
    frame: false,
    center: true,
    show: false,
    backgroundColor: "#0d0d1a",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  loadingWin.loadFile(join(__dirname, "loading.html"));
  loadingWin.once("ready-to-show", () => loadingWin?.show());
}

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWin.loadURL("http://localhost:8000");

  mainWin.once("ready-to-show", () => {
    loadingWin?.destroy();
    loadingWin = null;
    mainWin?.show();
    mainWin?.maximize();
  });

  // Route window.open() calls appropriately.
  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    // The "Login with OpenHands Cloud" device-flow opens about:blank immediately
    // on the user's click (to beat popup blockers), then navigates the popup to
    // the OAuth verification URL once it has one.  We must allow about:blank
    // through so window.open() returns a non-null WindowProxy; the did-create-window
    // handler below redirects the popup to the system browser when it navigates.
    if (url === "about:blank") {
      return {
        action: "allow",
        overrideBrowserWindowOptions: { width: 800, height: 700 },
      };
    }
    // All other external URLs open directly in the system browser.
    if (
      !url.startsWith("http://localhost") &&
      !url.startsWith("http://127.0.0.1")
    ) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // When the renderer opens a popup (the about:blank above), watch for its
  // first navigation away from about:blank.  That navigation will be to the
  // OAuth verification URL — open it in the system browser and close the
  // now-unneeded Electron popup.
  mainWin.webContents.on("did-create-window", (popupWin) => {
    popupWin.webContents.on("will-navigate", (_event, url) => {
      if (
        url !== "about:blank" &&
        !url.startsWith("http://localhost") &&
        !url.startsWith("http://127.0.0.1")
      ) {
        _event.preventDefault();
        shell.openExternal(url);
        popupWin.close();
      }
    });
  });

  mainWin.on("closed", () => {
    mainWin = null;
  });
}

// ── Backend stack ─────────────────────────────────────────────────────────────

async function startStack() {
  const entryUrl = pathToFileURL(
    join(scriptsDir, "dev-with-automation.mjs")
  ).href;
  const { main } = await import(entryUrl);

  // main() starts agent-server + automation backend + static server + ingress.
  // skipNpmCheck: npm is not needed at runtime in static mode.
  await main({
    bannerTitle: "Agent Canvas",
    staticMode: true,
    staticDir: buildDir,
    mode: "agent-canvas",
    isPublic: false,
    skipNpmCheck: true,
  });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  nativeTheme.themeSource = "dark";

  injectBundledUv();
  ensureNodeWrapper();

  if (!uvxAvailable()) {
    dialog.showErrorBox(
      "Missing prerequisite: uv",
      app.isPackaged
        ? "The bundled uv binary could not be found. Please reinstall Agent Canvas."
        : "uv (uvx) is not installed.\n\nInstall it from https://docs.astral.sh/uv/ then restart."
    );
    app.quit();
    return;
  }

  createLoadingWindow();

  try {
    await startStack();
    await waitForUrl("http://localhost:8000");
    createMainWindow();
  } catch (err) {
    const msg =
      err.message +
      "\n\nEnsure ports 8000, 18000, and 18001 are free, then try again.";
    dialog.showErrorBox("Agent Canvas failed to start", msg);
    app.quit();
  }
});

// Quit when all windows are closed; backend child processes are cleaned up
// by the signal handlers registered inside dev-with-automation.mjs.
app.on("window-all-closed", () => {
  app.quit();
});

// macOS: clicking the dock icon when no window is open re-launches the app.
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    // The backend is already running — just open a new renderer window.
    if (mainWin === null) createMainWindow();
  }
});
