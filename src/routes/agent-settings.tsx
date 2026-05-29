import { useActiveBackend } from "#/contexts/active-backend-context";
import { LlmSettingsScreen } from "#/routes/llm-settings";
import { LlmSettingsLocalView } from "#/components/features/settings/llm-profiles/llm-settings-local-view";

/**
 * Settings → Agent is the single surface for building an AgentProfile (#669).
 *
 * - Local backends: the unified AgentProfile editor — list profiles and
 *   create/edit them with a kind toggle (OpenHands = LLM config, ACP =
 *   provider / command / model / env). Save persists + activates the profile.
 *   The former standalone "LLM" page is folded in here for the OpenHands kind.
 * - Cloud backends: the standard LLM settings form (named profiles aren't
 *   supported on cloud).
 */
export default function AgentSettingsRoute() {
  const { backend } = useActiveBackend();

  if (backend.kind === "cloud") {
    return <LlmSettingsScreen />;
  }

  return <LlmSettingsLocalView />;
}
