import { useTranslation } from "react-i18next";
import { SettingsSwitch } from "#/components/features/settings/settings-switch";
import { SettingsInput } from "#/components/features/settings/settings-input";
import { Typography } from "#/ui/typography";
import { I18nKey } from "#/i18n/declaration";

/**
 * The condenser fields the profile editor surfaces. Every other
 * `CondenserSettingsConfig` field (keep_first, minimum_progress, the hard-reset
 * knobs, …) round-trips untouched at its default via the spread in `patch`.
 */
export interface ProfileCondenser {
  condenser_kind?: string;
  enabled?: boolean;
  max_size?: number;
  [key: string]: unknown;
}

/** Mirrors the SDK `LLMSummarizingCondenserSettings` defaults (enabled,
 * max_size=240, ge=20). */
export const DEFAULT_PROFILE_CONDENSER: ProfileCondenser = {
  condenser_kind: "llm_summarizing",
  enabled: true,
  max_size: 240,
};

/** Server enforces `max_size >= 20`; clamp before send to avoid a 422. */
export const CONDENSER_MIN_MAX_SIZE = 20;
export const CONDENSER_DEFAULT_MAX_SIZE = 240;

interface AgentProfileCondenserFieldsProps {
  value: ProfileCondenser;
  onChange: (next: ProfileCondenser) => void;
}

/**
 * Editor for an OpenHands profile's `condenser` block — the context-condensation
 * policy that only applies to the built-in OpenHands agent (ACP CLIs manage
 * their own context). The toggle picks the LLM summarizing condenser vs none;
 * "Max size" is the event count that triggers condensation. Labels reuse the
 * agent-settings schema's `SCHEMA$CONDENSER$*` i18n keys so they match the
 * (cloud) standalone Condenser page. The condenser reuses the profile's resolved
 * LLM at runtime, so it stores no model/credential of its own.
 */
export function AgentProfileCondenserFields({
  value,
  onChange,
}: AgentProfileCondenserFieldsProps) {
  const { t } = useTranslation("openhands");
  const enabled = value.enabled ?? true;
  const patch = (next: Partial<ProfileCondenser>) =>
    onChange({ ...value, ...next });

  return (
    <div className="flex flex-col gap-4">
      <Typography.Text className="text-sm font-medium text-white">
        {t(I18nKey.SCHEMA$CONDENSER$SECTION_LABEL)}
      </Typography.Text>

      <SettingsSwitch
        testId="agent-profile-condenser-enabled"
        isToggled={enabled}
        // Enabling means "use the LLM summarizing condenser"; disabling leaves
        // context uncondensed.
        onToggle={(on) =>
          patch(
            on
              ? { enabled: true, condenser_kind: "llm_summarizing" }
              : { enabled: false },
          )
        }
      >
        {t(I18nKey.SCHEMA$CONDENSER$ENABLED$LABEL)}
      </SettingsSwitch>

      {enabled && (
        <div className="flex flex-col gap-4 border-l border-[#3D4046] pl-4">
          <SettingsInput
            testId="agent-profile-condenser-max-size"
            label={t(I18nKey.SCHEMA$CONDENSER$MAX_SIZE$LABEL)}
            type="number"
            min={CONDENSER_MIN_MAX_SIZE}
            step={1}
            className="w-full"
            value={String(value.max_size ?? CONDENSER_DEFAULT_MAX_SIZE)}
            onChange={(raw) => {
              const num = Number(raw);
              // Store the raw (floored) value so typing isn't clamped mid-entry;
              // the editor enforces the >= 20 minimum at save time.
              if (!Number.isNaN(num))
                patch({ max_size: Math.max(0, Math.floor(num)) });
            }}
          />
        </div>
      )}
    </div>
  );
}
