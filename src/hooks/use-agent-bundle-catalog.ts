import { useMemo } from "react";
import { useActiveBackend } from "#/contexts/active-backend-context";
import { useLlmProfiles } from "#/hooks/query/use-llm-profiles";
import { ACP_PROVIDERS } from "#/constants/acp-providers";
import { bundleId, type AgentModelBundle } from "#/types/agent-model-bundle";

/** Catalog group rendered as one labelled section in the picker. */
export interface AgentBundleGroup {
  /** Stable group key — ``"openhands"`` or an ACP provider registry key. */
  key: string;
  /** Header label (a brand name: ``"OpenHands"`` / ``"Claude Code"``). */
  label: string;
  bundles: AgentModelBundle[];
}

/** Header for the native LLM-profile group (the OpenHands agent). */
const OPENHANDS_GROUP_LABEL = "OpenHands";

/**
 * Build the unified picker catalog by read-adapting the two existing storage
 * shapes into one grouped list of {@link AgentModelBundle}s:
 *
 *   - one **OpenHands** group of the user's native LLM profiles, and
 *   - one group per built-in **ACP provider** over its registry models.
 *
 * Local-backend only — profiles and ACP switching are both local-only (cloud
 * returns an empty catalog and the picker degrades to a read-only model
 * label). Empty groups are omitted.
 */
export function useAgentBundleCatalog(): AgentBundleGroup[] {
  const { backend } = useActiveBackend();
  const isLocal = backend.kind === "local";
  const { data: profilesData } = useLlmProfiles({ enabled: isLocal });
  const profiles = profilesData?.profiles ?? [];

  return useMemo<AgentBundleGroup[]>(() => {
    if (!isLocal) return [];

    const groups: AgentBundleGroup[] = [];

    if (profiles.length > 0) {
      groups.push({
        key: "openhands",
        label: OPENHANDS_GROUP_LABEL,
        bundles: profiles.map(
          (p): AgentModelBundle => ({
            kind: "openhands",
            id: bundleId.openhands(p.name),
            label: p.name,
            profileName: p.name,
            model: p.model ?? null,
          }),
        ),
      });
    }

    for (const provider of ACP_PROVIDERS) {
      const models = provider.available_models ?? [];
      if (models.length === 0) continue;
      // List the provider default first — it reads as the headline option and
      // is the model a collapsed "start a new conversation" fork launches with.
      const def = provider.default_model;
      const orderedModels = def
        ? [...models].sort(
            (a, b) => Number(b.id === def) - Number(a.id === def),
          )
        : models;
      groups.push({
        key: provider.key,
        label: provider.display_name,
        bundles: orderedModels.map(
          (m): AgentModelBundle => ({
            kind: "acp",
            id: bundleId.acp(provider.key, m.id),
            label: m.label,
            provider: provider.key,
            providerLabel: provider.display_name,
            model: m.id,
            icon: provider.icon,
            supportsRuntimeSwitch:
              provider.supports_runtime_model_switch ?? false,
          }),
        ),
      });
    }

    return groups;
  }, [isLocal, profiles]);
}
