/**
 * electron-builder configuration for the Agent Canvas desktop app.
 *
 * `directories.app: 'electron'` tells electron-builder to use electron/package.json
 * as the app manifest (with `"main": "main.mjs"`). This sidesteps the root
 * package.json's `"main": "./dist/index.cjs"` without any afterPack patching,
 * and — because electron/package.json has no `dependencies` — electron-builder
 * does NOT auto-bundle node_modules (the backend scripts use only Node built-ins).
 *
 * Packaged app layout (Resources/app/ = electron/ contents):
 *   main.mjs        ← Electron entry point
 *   loading.html    ← loading splash
 *   package.json    ← {"main":"main.mjs"} (from electron/package.json)
 *   scripts/        ← backend scripts, Node.js built-ins only
 *   config/         ← defaults.json
 *   build/          ← static frontend (npm run build:app output)
 *
 * The bundled uv binary (resources/bin/) lands in <Resources>/bin/ via
 * extraResources so Electron can inject it into PATH on startup.
 */

/** @type {import('electron-builder').Configuration} */
const config = {
  appId: "dev.openhands.agent-canvas",
  productName: "Agent Canvas",
  copyright: "Copyright © 2025 All Hands AI",

  // Treat electron/ as the app root. electron/package.json provides the
  // Electron entry point without touching the npm-published root package.json.
  directories: {
    app: "electron",
    output: "dist-electron",
  },

  // Do not pack into asar — scripts are spawned as child processes by
  // dev-with-automation.mjs and must exist as real files on disk.
  asar: false,

  // Skip native-module rebuild — the app has no native deps.
  npmRebuild: false,

  // Files included in the packaged app.
  // Paths with `from` are relative to directories.app (electron/).
  // Bare globs are also relative to directories.app.
  files: [
    // electron/ base files (main.mjs, loading.html, package.json)
    "**/*",
    // Scripts from project root — Node.js built-ins only, no node_modules needed.
    { from: "../scripts", to: "scripts", filter: ["**/*.mjs", "**/*.cjs"] },
    // Centralised version / port / path config
    { from: "../config", to: "config" },
    // Pre-built static frontend (npm run build:app output)
    { from: "../build", to: "build" },
  ],

  // Bundled uv binary — placed in <Resources>/bin/ so Electron can inject
  // it into PATH before starting the backend stack.
  // `from` is relative to the project root (not directories.app).
  // Run `npm run download-uv` (called by build:desktop) to populate this.
  extraResources: [
    { from: "resources/bin/", to: "bin/", filter: ["**/*"] },
  ],

  // ── macOS ──────────────────────────────────────────────────────────────────
  mac: {
    category: "public.app-category.developer-tools",
    target: [
      { target: "dmg", arch: ["universal"] },
    ],
    // Add icon: "electron/build-resources/icon.icns" once a 512×512 source
    // image is available. Run: electron-icon-builder --input=icon.png --output=electron/build-resources
  },

  dmg: {
    title: "Agent Canvas",
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: "link", path: "/Applications" },
    ],
    window: { width: 540, height: 380 },
  },

  // ── Windows ────────────────────────────────────────────────────────────────
  win: {
    target: [
      { target: "nsis", arch: ["x64"] },
    ],
    // Add icon: "electron/build-resources/icon.ico" once artwork is available.
  },

  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
  },

  // ── Linux ──────────────────────────────────────────────────────────────────
  linux: {
    target: [
      { target: "AppImage", arch: ["x64"] },
      { target: "deb", arch: ["x64"] },
    ],
    category: "Development",
    // Add icon: "electron/build-resources/icon.png" once artwork is available.
  },
};

export default config;
