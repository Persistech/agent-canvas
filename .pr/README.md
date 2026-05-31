PR-specific QA artifacts for pull request #951.

These screenshots and GIFs were captured locally after deleting
`~/.openhands/agent-canvas` and starting from a clean agent-canvas state. The
agent server was configured with the local `.env` LLM settings before each run.

## `npm run dev`

- `qa/npm-run-dev-conversation.gif` - slow walkthrough from first load through a live agent response.
- `qa/npm-run-dev-01-onboarding-agent.png` - clean first load.
- `qa/npm-run-dev-02-onboarding-backend-connected.png` - launcher-managed same-origin backend connected during onboarding.
- `qa/npm-run-dev-03-home-ready.png` - home screen after dismissing onboarding.
- `qa/npm-run-dev-04-message-ready.png` - prompt entered before starting the conversation.
- `qa/npm-run-dev-05-conversation-started.png` - conversation route after launch.
- `qa/npm-run-dev-06-conversation-response.png` - live LLM response received.

## `npm run dev:frontend`

- `qa/npm-run-dev-frontend-conversation.gif` - slow walkthrough from manual backend setup through a live agent response.
- `qa/npm-run-dev-frontend-01-add-backend-dialog.png` - frontend-only start state with no configured backend.
- `qa/npm-run-dev-frontend-02-add-backend-filled.png` - remote agent-server connection filled in, with the session key masked.
- `qa/npm-run-dev-frontend-03-onboarding-agent.png` - onboarding after the remote backend is added.
- `qa/npm-run-dev-frontend-04-onboarding-backend-connected.png` - remote backend connected during onboarding.
- `qa/npm-run-dev-frontend-05-home-remote-ready.png` - home screen with the remote backend active.
- `qa/npm-run-dev-frontend-06-remote-message-ready.png` - prompt entered before starting the conversation.
- `qa/npm-run-dev-frontend-07-remote-conversation-started.png` - conversation route after launch.
- `qa/npm-run-dev-frontend-08-remote-conversation-response.png` - live LLM response received.
