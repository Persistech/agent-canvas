# Sandboxes Extension

A UI extension for managing cloud sandboxes in Agent Canvas.

## Overview

Sandboxes are the compute environments that back cloud conversations. Each sandbox can host multiple conversations and has lifecycle states (running, paused, stopped). This extension provides a dedicated page for sandbox management.

## Features

- **View all sandboxes** with metadata (status, creation time, last active)
- **Name sandboxes** locally (the cloud API doesn't support names, so they're stored in extension storage)
- **Filter** by status (Running, Paused, Stopped/Error)
- **Sort** by Status, Last Active, or Created date
- **Expand sandboxes** to see their conversations
- **Manage lifecycle** - Pause running sandboxes, Resume/Wake paused ones
- **Auto-refresh** every 30 seconds

## Requirements

- **Cloud backend only**: This extension only appears when connected to a cloud backend (SaaS at `app.all-hands.dev` or enterprise deployments). The sidebar nav item is hidden when using a local backend.

## Capabilities

This extension requires the following capabilities:

| Capability | Purpose |
|------------|---------|
| `backend:cloud:read` | Fetch sandboxes and conversations from the cloud API |
| `backend:cloud:write` | Pause and resume sandboxes |
| `storage` | Persist custom sandbox names locally |

## Installation

### From npm (when published)

```
npm:@openhands/sandboxes-extension
```

### From GitHub

```
gh:OpenHands/agent-canvas/examples/extensions/sandboxes
```

### Development

For local development, add the extension URL to your `DEV_EXTENSION_BUNDLE_URLS` environment variable.

## API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/app-conversations/search` | GET | List all conversations with sandbox info |
| `/api/v1/sandboxes` | GET | Batch get sandbox details |
| `/api/v1/sandboxes/{id}/pause` | POST | Pause a running sandbox |
| `/api/v1/sandboxes/{id}/resume` | POST | Resume a paused sandbox |

## UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Sandboxes                                    [↻ Refresh]   │
├─────────────────────────────────────────────────────────────┤
│  Show: ☑ Running ☑ Paused ☐ Stopped    Sort by: [Status ▼] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ▶ sandbox-abc-123        RUNNING    2 hours ago     │   │
│  │                                     [⏸ Pause]       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ▼ My Dev Sandbox         PAUSED     Friday          │   │
│  │                                     [▶ Wake]        │   │
│  │   ┌─────────────────────────────────────────────┐   │   │
│  │   │ Conversations (2)                           │   │   │
│  │   ├─────────────────────────────────────────────┤   │   │
│  │   │ Fix auth bug                  3 hours ago   │   │   │
│  │   │ Refactor tests                Yesterday     │   │   │
│  │   └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Sandbox Naming

Click on any sandbox ID to give it a custom name. Names are stored locally in extension storage and persist across sessions. The original sandbox ID is shown below the custom name for reference.

## Status Badges

| Status | Color | Description |
|--------|-------|-------------|
| RUNNING | Green | Sandbox is active and ready |
| STARTING | Yellow | Sandbox is starting up |
| PAUSED | Gold | Sandbox is paused (can be resumed) |
| ERROR | Red | Sandbox encountered an error |
| MISSING | Gray | Sandbox no longer exists |

## Future Enhancements

- Sandbox creation (full conversation creation flow)
- Bulk actions (pause/resume multiple sandboxes)
- Search by name or ID
- Resource usage metrics (if API supports it)
- Auto-cleanup suggestions for old stopped sandboxes

## License

MIT
