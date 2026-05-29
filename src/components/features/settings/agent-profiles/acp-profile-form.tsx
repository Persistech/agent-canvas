import React from "react";
import { useTranslation } from "react-i18next";
import { SettingsDropdownInput } from "#/components/features/settings/settings-dropdown-input";
import { SettingsInput } from "#/components/features/settings/settings-input";
import { Typography } from "#/ui/typography";
import { I18nKey } from "#/i18n/declaration";
import {
  ACP_PROVIDERS,
  ACP_CUSTOM_PRESET_KEY,
  getAcpProvider,
} from "#/constants/acp-providers";
import { parseCommand, formatCommand } from "#/utils/acp-command";

const ACP_CUSTOM_MODEL_KEY = "__custom_model__";

/** The ACP launch fields an ACP AgentProfile persists. */
export interface AcpProfileFormValue {
  /** Provider registry key, or {@link ACP_CUSTOM_PRESET_KEY} for a raw command. */
  acpServer: string;
  /** Resolved launch command tokens (``acp_command``). */
  command: string[];
  /** Selected ``acp_model`` (empty = provider default). */
  acpModel: string;
  /** Extra environment for the ACP subprocess (``acp_env``); carries creds. */
  env: Record<string, string>;
}

interface AcpProfileFormProps {
  value: AcpProfileFormValue;
  onChange: (value: AcpProfileFormValue) => void;
}

function parseEnvText(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

function formatEnvText(env: Record<string, string>): string {
  return Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
}

/**
 * Controlled editor for the ACP half of an AgentProfile: provider, launch
 * command, model and environment. The parent owns the value and turns it into
 * the ``agent_settings`` payload on save.
 */
export function AcpProfileForm({ value, onChange }: AcpProfileFormProps) {
  const { t } = useTranslation("openhands");
  const provider = getAcpProvider(value.acpServer);
  const models = provider?.available_models ?? [];
  const hasModelSuggestions = models.length > 0;
  // Editing an env textarea drops focus on every keystroke if we re-derive it
  // from the parsed map, so keep the raw text locally and only push the parsed
  // map up.
  const [envText, setEnvText] = React.useState(() => formatEnvText(value.env));
  React.useEffect(() => {
    // Re-sync only when the profile being edited changes underneath us
    // (parent swaps `value` wholesale), not on our own keystrokes.
    setEnvText(formatEnvText(value.env));
  }, [value.acpServer]);

  const modelIsKnown = models.some((m) => m.id === value.acpModel);
  const usingCustomModel = !hasModelSuggestions || !modelIsKnown;
  const selectedModelKey = usingCustomModel
    ? ACP_CUSTOM_MODEL_KEY
    : value.acpModel;

  const selectProvider = (key: string) => {
    const next = getAcpProvider(key);
    if (next) {
      onChange({
        acpServer: key,
        command: [...next.default_command],
        acpModel: next.default_model ?? "",
        env: value.env,
      });
    } else {
      // custom
      onChange({
        acpServer: ACP_CUSTOM_PRESET_KEY,
        command: [],
        acpModel: "",
        env: value.env,
      });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <SettingsDropdownInput
        testId="acp-provider-selector"
        name="acp-provider"
        label={t(I18nKey.SETTINGS$AGENT_PRESET)}
        items={[
          ...ACP_PROVIDERS.map((p) => ({ key: p.key, label: p.display_name })),
          {
            key: ACP_CUSTOM_PRESET_KEY,
            label: t(I18nKey.SETTINGS$AGENT_PRESET_CUSTOM),
          },
        ]}
        selectedKey={value.acpServer || ACP_PROVIDERS[0]?.key}
        onSelectionChange={(key) => key && selectProvider(String(key))}
      />

      <div className="flex flex-col gap-2.5">
        <Typography.Text className="text-sm">
          {t(I18nKey.SETTINGS$AGENT_COMMAND)}
        </Typography.Text>
        <textarea
          data-testid="acp-command-input"
          className="bg-tertiary border border-[#717888] rounded-sm p-2 text-sm font-mono text-white placeholder:text-[#717888] min-h-[60px] resize-y focus:outline-none focus:border-white"
          value={formatCommand(value.command)}
          onChange={(e) =>
            onChange({ ...value, command: parseCommand(e.target.value) })
          }
        />
        <Typography.Text className="text-xs text-[#717888]">
          {t(I18nKey.SETTINGS$AGENT_COMMAND_HINT)}
        </Typography.Text>
      </div>

      <div className="flex flex-col gap-1.5">
        {hasModelSuggestions && (
          <SettingsDropdownInput
            testId="acp-model-selector"
            name="acp-model"
            label={t(I18nKey.SETTINGS$AGENT_MODEL)}
            items={[
              ...models.map((m) => ({ key: m.id, label: m.label })),
              {
                key: ACP_CUSTOM_MODEL_KEY,
                label: t(I18nKey.SETTINGS$AGENT_PRESET_CUSTOM),
              },
            ]}
            selectedKey={selectedModelKey}
            onSelectionChange={(key) => {
              if (!key) return;
              const k = String(key);
              onChange({
                ...value,
                acpModel: k === ACP_CUSTOM_MODEL_KEY ? "" : k,
              });
            }}
          />
        )}
        {usingCustomModel && (
          <SettingsInput
            testId="acp-model-input"
            label={
              hasModelSuggestions
                ? t(I18nKey.SETTINGS$AGENT_CUSTOM_MODEL)
                : t(I18nKey.SETTINGS$AGENT_MODEL)
            }
            type="text"
            className="w-full"
            value={value.acpModel}
            showOptionalTag
            onChange={(v) => onChange({ ...value, acpModel: v })}
          />
        )}
        <Typography.Text className="text-xs text-[#717888]">
          {t(I18nKey.SETTINGS$AGENT_MODEL_HINT)}
        </Typography.Text>
      </div>

      <div className="flex flex-col gap-2.5">
        <Typography.Text className="text-sm">
          {t(I18nKey.SETTINGS$AGENT_ENV)}
        </Typography.Text>
        <textarea
          data-testid="acp-env-input"
          className="bg-tertiary border border-[#717888] rounded-sm p-2 text-sm font-mono text-white placeholder:text-[#717888] min-h-[60px] resize-y focus:outline-none focus:border-white"
          placeholder={"ANTHROPIC_API_KEY=sk-...\nKEY=value"}
          value={envText}
          onChange={(e) => {
            setEnvText(e.target.value);
            onChange({ ...value, env: parseEnvText(e.target.value) });
          }}
        />
        <Typography.Text className="text-xs text-[#717888]">
          {t(I18nKey.SETTINGS$AGENT_ENV_HINT)}
        </Typography.Text>
      </div>
    </div>
  );
}
