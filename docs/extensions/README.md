# UI Extensions Documentation

Complete documentation for the Agent Canvas UI extensions system.

---

## Documentation by Audience

### 📘 For End Users

**[User Guide](./USER_GUIDE.md)** — How to install, manage, and use extensions
- Enabling extensions
- Installing from npm, GitHub, or URLs
- Permission model and security
- Managing installed extensions
- Troubleshooting

### 📗 For Extension Authors

**[Author Guide](./AUTHOR_GUIDE.md)** — How to create and publish extensions
- Quick start
- Manifest schema (extension.json)
- Contribution points (sidebar, panels, commands, menus, settings)
- Worker logic and webview UI
- Capabilities (permissions)
- Testing and debugging
- Publishing to npm or GitHub

### 📕 For Contributors

**[Architecture Reference](./ARCHITECTURE.md)** — Technical implementation details
- System overview and architecture
- Source resolution pipeline (npm, GitHub, URL)
- Asset relay system (GitHub sources)
- File map and module structure
- RPC system and host API
- Extension manager and lifecycle
- Testing and production requirements

**[Security Model](./SECURITY.md)** — How extensions are sandboxed
- Isolation layers (Worker, Iframe, CSP, Capabilities)
- Asset relay security
- Threat model and attack scenarios
- Trust boundaries

**[Extension Points Roadmap](../EXTENSION_POINTS.md)** — Adding new contribution points
- Current contribution points
- How to add a new extension point
- Future roadmap

---

## Quick Links

### Getting Started

- **I want to try an extension** → [User Guide § Prerequisites](./USER_GUIDE.md#prerequisites)
- **I want to build an extension** → [Author Guide § Quick Start](./AUTHOR_GUIDE.md#quick-start)
- **I want to understand the code** → [Architecture Reference](./ARCHITECTURE.md)

### Key Concepts

- **What are capabilities?** → [User Guide § Permissions](./USER_GUIDE.md#reviewing-and-approving-permissions)
- **How does sandboxing work?** → [Security Model](./SECURITY.md)
- **How do GitHub extensions work?** → [Architecture § Asset Relay](./ARCHITECTURE.md#asset-relay-system-github-sources)
- **How do I add a menu slot?** → [Extension Points Roadmap](../EXTENSION_POINTS.md)

### Examples

- **Example extension:** [`examples/extensions/hello-sidebar/`](../../examples/extensions/hello-sidebar/)
- **Example marketplace:** [`examples/extensions/.plugin/marketplace.json`](../../examples/extensions/.plugin/marketplace.json)

---

## Feature Status

**Stable (Production-Ready):**
- ✅ npm and GitHub source installation
- ✅ Versioned installs with update detection
- ✅ Capability-based permission model
- ✅ Sidebar panels and commands
- ✅ Menu items (conversation tabs, chat input)
- ✅ Settings pages
- ✅ Asset relay for GitHub sources
- ✅ Theme integration

**Experimental (Flag-Gated):**
- ⚠️ Entire extensions system (requires `VITE_ENABLE_EXTENSIONS=true`)

**Planned:**
- 🔜 Permission model for external service access
- 🔜 Private GitHub repository support
- 🔜 First-party registry and marketplace
- 🔜 Content integrity verification

---

## Architecture at a Glance

```
extension.json (manifest)
    │
    ├──▶ Declarative Contributions ──▶ Host UI (sidebar, menus, etc.)
    │
    └──▶ Worker Logic ──RPC──▶ Capability-Gated Host API
              │
              └──▶ Webview UI (sandboxed iframe)
                        │
                        └──▶ Asset Relay (for GitHub sources)
```

**Key Properties:**
- **Declarative-first** — UI contributions are static JSON
- **Isolated execution** — Workers run in Web Workers (no DOM)
- **Sandboxed UI** — Webviews are iframes with strict CSP
- **Capability-gated** — All privileged API calls require explicit permission

See [Architecture Reference](./ARCHITECTURE.md) for full details.

---

## Related Documentation

### In this Repository

- **[Design Proposal](../proposals/ui-extensions.md)** — Original design document
- **[Extension Points Roadmap](../EXTENSION_POINTS.md)** — How to add new contribution points
- **[Issues & Decisions](../issues/README.md)** — Implementation issues and architecture decisions

### External References

- **VS Code Extension API** — https://code.visualstudio.com/api
  - Agent Canvas extensions follow the VS Code model (declarative manifest, sandboxed execution, capability-gated API)
- **OpenHands Plugin Marketplace** — https://github.com/OpenHands/OpenHands
  - Extensions can be distributed via the same marketplace format

---

## Contributing

See [Extension Points Roadmap](../EXTENSION_POINTS.md) for how to add new contribution points.

**Key files for contributors:**
- `src/extensions/manifest.ts` — Manifest schema and validation
- `src/extensions/contribution-registry.ts` — Registry of loaded extensions
- `src/extensions/loader.ts` — Manifest parsing and contribution building
- `src/extensions/host/host-api.ts` — Capability-gated API implementation

**Before adding a new feature:**
1. Read the [Architecture Reference](./ARCHITECTURE.md)
2. Check the [Extension Points Roadmap](../EXTENSION_POINTS.md)
3. Follow the established patterns (declarative-first, least-privilege)

---

## Support

- **Bug reports:** GitHub Issues
- **Security issues:** See [Security Model](./SECURITY.md) and report privately
- **Questions:** GitHub Discussions

---

## License

Agent Canvas is licensed under the MIT License. Extensions created by third parties have their own licenses.
