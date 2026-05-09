import React from "react";
import { useTranslation } from "react-i18next";
import { FaChevronLeft } from "react-icons/fa6";
import { ModelSelector } from "#/components/shared/modals/settings/model-selector";
import { useAgentSettingsSchema } from "#/hooks/query/use-agent-settings-schema";
import { useSettings } from "#/hooks/query/use-settings";
import { SettingsInput } from "#/components/features/settings/settings-input";
import { HelpLink } from "#/ui/help-link";
import { KeyStatusIcon } from "#/components/features/settings/key-status-icon";
import {
  SdkSectionHeaderProps,
  SdkSectionPage,
} from "#/components/features/settings/sdk-settings/sdk-section-page";
import { I18nKey } from "#/i18n/declaration";
import { Settings, SettingsSchema, SettingsScope } from "#/types/settings";
import { extractModelAndProvider } from "#/utils/extract-model-and-provider";
import {
  inferInitialView,
  type SettingsView,
} from "#/utils/sdk-settings-schema";
import { DEFAULT_SETTINGS } from "#/services/settings";
import { LlmProfilesManager } from "#/components/features/settings/llm-profiles-manager";
import { ProfileNameInput } from "#/components/features/settings/profile-name-input";
import { useActivateLlmProfile } from "#/hooks/mutation/use-activate-llm-profile";
import { useRenameLlmProfile } from "#/hooks/mutation/use-rename-llm-profile";
import { useSaveLlmProfile } from "#/hooks/mutation/use-save-llm-profile";
import {
  deriveProfileNameFromModel,
  PROFILE_NAME_PATTERN,
} from "#/utils/derive-profile-name";
import type { LlmProfileSummary } from "#/api/settings-service/profiles-service.api";

const LLM_EXCLUDED_KEYS = new Set(["llm.model", "llm.api_key", "llm.base_url"]);

const buildModelId = (provider: string | null, model: string | null) => {
  if (!provider || !model) return null;
  return `${provider}/${model}`;
};

const getSchemaFieldDefaultValue = (
  schema: SettingsSchema | null | undefined,
  fieldKey: string,
) =>
  schema?.sections
    .flatMap((section) => section.fields)
    .find((field) => field.key === fieldKey)?.default ?? null;

const KNOWN_PROVIDER_DEFAULT_BASE_URLS: Partial<Record<string, Set<string>>> = {
  openai: new Set(["https://api.openai.com", "https://api.openai.com/v1"]),
  openhands: new Set([
    "https://llm-proxy.app.all-hands.dev",
    "https://llm-proxy.app.all-hands.dev/v1",
  ]),
  litellm_proxy: new Set([
    "https://llm-proxy.app.all-hands.dev",
    "https://llm-proxy.app.all-hands.dev/v1",
  ]),
};

const normalizeBaseUrl = (baseUrl: string) => {
  try {
    const parsedUrl = new URL(baseUrl);
    const normalizedPath = parsedUrl.pathname.replace(/\/+$/, "") || "";
    return `${parsedUrl.origin}${normalizedPath}`;
  } catch {
    return baseUrl.trim().replace(/\/+$/, "");
  }
};

const isProviderDefaultBaseUrl = (model: string, baseUrl: string) => {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const { provider } = extractModelAndProvider(model);

  if (provider) {
    const knownDefaults = KNOWN_PROVIDER_DEFAULT_BASE_URLS[provider];
    if (knownDefaults) {
      return knownDefaults.has(normalizedBaseUrl);
    }
  }

  return Object.values(KNOWN_PROVIDER_DEFAULT_BASE_URLS).some((knownDefaults) =>
    knownDefaults?.has(normalizedBaseUrl),
  );
};

interface OpenHandsApiKeyHelpProps {
  testId: string;
}

function OpenHandsApiKeyHelp({ testId }: OpenHandsApiKeyHelpProps) {
  const { t } = useTranslation("openhands");

  return (
    <HelpLink
      testId={testId}
      text={t(I18nKey.SETTINGS$OPENHANDS_API_KEY_HELP_TEXT)}
      linkText={t(I18nKey.SETTINGS$NAV_API_KEYS)}
      href="https://app.all-hands.dev/settings/api-keys"
      suffix={` ${t(I18nKey.SETTINGS$OPENHANDS_API_KEY_HELP_SUFFIX)}`}
    />
  );
}

export function LlmSettingsScreen({
  scope = "personal",
}: {
  scope?: SettingsScope;
}) {
  const { t } = useTranslation("openhands");

  const { data: settings } = useSettings(scope);
  const { data: schema } = useAgentSettingsSchema(
    settings?.agent_settings_schema,
  );
  const saveProfile = useSaveLlmProfile();
  const activateProfile = useActivateLlmProfile();
  const renameProfile = useRenameLlmProfile();
  const lastSavedModelRef = React.useRef<string | null>(null);

  const [showProfiles, setShowProfiles] = React.useState(scope === "personal");
  const [profileName, setProfileName] = React.useState("");
  const [initialProfileName, setInitialProfileName] = React.useState("");
  const [initialViewHint, setInitialViewHint] =
    React.useState<SettingsView | null>(null);

  const defaultModel = String(
    (DEFAULT_SETTINGS.agent_settings?.llm as Record<string, unknown>)?.model ??
      "",
  );

  const getInitialView = React.useCallback(
    (
      currentSettings: Settings,
      filteredSchema: SettingsSchema,
    ): SettingsView => {
      if (initialViewHint) {
        return initialViewHint;
      }

      const schemaView = inferInitialView(currentSettings, filteredSchema);
      if (schemaView !== "basic") {
        return schemaView;
      }

      const currentModel = currentSettings.llm_model ?? "";
      const trimmedBaseUrl = currentSettings.llm_base_url?.trim() ?? "";
      const hasCustomBaseUrl =
        trimmedBaseUrl.length > 0 &&
        !isProviderDefaultBaseUrl(currentModel, trimmedBaseUrl);

      return hasCustomBaseUrl ? "all" : "basic";
    },
    [initialViewHint],
  );

  const buildHeader = React.useCallback(
    ({ values, isDisabled, view, onChange }: SdkSectionHeaderProps) => {
      const modelValue =
        typeof values["llm.model"] === "string" ? values["llm.model"] : "";
      const baseUrlValue =
        typeof values["llm.base_url"] === "string"
          ? values["llm.base_url"]
          : "";
      const showOpenHandsApiKeyHelp = modelValue.startsWith("openhands/");
      const profileNamePlaceholder =
        deriveProfileNameFromModel(modelValue) ?? "";

      const renderApiKeyInput = (testId: string, helpTestId: string) => (
        <>
          <SettingsInput
            testId={testId}
            label={t(I18nKey.SETTINGS_FORM$API_KEY)}
            type="password"
            className="w-full"
            value={
              typeof values["llm.api_key"] === "string"
                ? values["llm.api_key"]
                : ""
            }
            placeholder={settings?.llm_api_key_set ? "<hidden>" : ""}
            onChange={(value) => onChange("llm.api_key", value)}
            isDisabled={isDisabled}
            startContent={
              settings?.llm_api_key_set ? (
                <KeyStatusIcon isSet={settings.llm_api_key_set} />
              ) : undefined
            }
          />

          <HelpLink
            testId={helpTestId}
            text={t(I18nKey.SETTINGS$DONT_KNOW_API_KEY)}
            linkText={t(I18nKey.SETTINGS$CLICK_FOR_INSTRUCTIONS)}
            href="https://docs.openhands.dev/usage/local-setup#getting-an-api-key"
          />
        </>
      );

      return (
        <div className="flex flex-col gap-6">
          <ProfileNameInput
            testId="llm-profile-name-input"
            ruleTestId="llm-profile-name-rule"
            value={profileName}
            placeholder={profileNamePlaceholder}
            onChange={setProfileName}
            isDisabled={isDisabled}
            isOptional
          />

          {view === "basic" ? (
            <div
              className="flex flex-col gap-6"
              data-testid="llm-settings-form-basic"
            >
              <ModelSelector
                currentModel={modelValue || undefined}
                currentBaseUrl={baseUrlValue || undefined}
                onChange={(provider, model) => {
                  const nextModel = buildModelId(provider, model);
                  if (nextModel) {
                    onChange("llm.model", nextModel);
                  }
                }}
                wrapperClassName="!flex-col !gap-6"
                isDisabled={isDisabled}
              />

              {showOpenHandsApiKeyHelp ? (
                <OpenHandsApiKeyHelp testId="openhands-api-key-help" />
              ) : null}

              {renderApiKeyInput(
                "llm-api-key-input",
                "llm-api-key-help-anchor",
              )}
            </div>
          ) : (
            <div
              className="flex flex-col gap-6"
              data-testid="llm-settings-form-advanced"
            >
              <SettingsInput
                testId="llm-custom-model-input"
                label={t(I18nKey.SETTINGS$CUSTOM_MODEL)}
                type="text"
                className="w-full"
                value={modelValue}
                placeholder={defaultModel}
                onChange={(value) => onChange("llm.model", value)}
                isDisabled={isDisabled}
              />

              {showOpenHandsApiKeyHelp ? (
                <OpenHandsApiKeyHelp testId="openhands-api-key-help-2" />
              ) : null}

              <SettingsInput
                testId="base-url-input"
                label={t(I18nKey.SETTINGS$BASE_URL)}
                type="text"
                className="w-full"
                value={baseUrlValue}
                placeholder="https://api.openai.com"
                onChange={(value) => onChange("llm.base_url", value)}
                isDisabled={isDisabled}
              />

              {renderApiKeyInput(
                "llm-api-key-input",
                "llm-api-key-help-anchor-advanced",
              )}
            </div>
          )}
        </div>
      );
    },
    [defaultModel, profileName, settings?.llm_api_key_set, t],
  );

  const buildPayload = React.useCallback(
    (
      basePayload: Record<string, unknown>,
      context: {
        values: Record<string, string | boolean>;
        dirty: Record<string, boolean>;
        view: SettingsView;
      },
    ) => {
      const modelValue =
        typeof context.values["llm.model"] === "string"
          ? context.values["llm.model"]
          : "";
      lastSavedModelRef.current = modelValue || null;

      if (Object.keys(context.dirty).length === 0) {
        return { agent_settings_diff: {} };
      }

      const agentSettings = structuredClone(basePayload);
      const llm = (agentSettings.llm ?? {}) as Record<string, unknown>;

      if (context.view === "basic") {
        llm.base_url = getSchemaFieldDefaultValue(schema, "llm.base_url");
        agentSettings.llm = llm;
      }

      return { agent_settings_diff: agentSettings };
    },
    [schema],
  );

  const handleSaveSuccess = React.useCallback(async () => {
    const savedModel = lastSavedModelRef.current;
    const trimmedUserName = profileName.trim();
    const userName = PROFILE_NAME_PATTERN.test(trimmedUserName)
      ? trimmedUserName
      : null;
    const derivedName = savedModel
      ? deriveProfileNameFromModel(savedModel)
      : null;
    const name = userName ?? derivedName;

    if (name) {
      try {
        if (initialProfileName && initialProfileName !== name) {
          await renameProfile.mutateAsync({
            name: initialProfileName,
            newName: name,
          });
        }
        await saveProfile.mutateAsync({
          name,
          request: { include_secrets: true },
        });
        await activateProfile.mutateAsync(name);
      } catch {
        // Settings were saved. Profile persistence is best-effort because the
        // server may be full, temporarily locked, or older than profile support.
      }
    }

    setProfileName("");
    setInitialProfileName("");
    setInitialViewHint(null);
    setShowProfiles(true);
  }, [
    activateProfile,
    initialProfileName,
    profileName,
    renameProfile,
    saveProfile,
  ]);

  const openForm = (view: SettingsView | null, name = "") => {
    setProfileName(name);
    setInitialProfileName(name);
    setInitialViewHint(view);
    setShowProfiles(false);
  };

  const openProfileForEdit = (profile: LlmProfileSummary) => {
    activateProfile
      .mutateAsync(profile.name)
      .catch(() => null)
      .finally(() => {
        openForm(null, profile.name);
      });
  };

  if (scope === "personal" && showProfiles) {
    return (
      <LlmProfilesManager
        onAddProfile={() => openForm(null)}
        onEditProfile={openProfileForEdit}
      />
    );
  }

  const backToProfiles =
    scope === "personal" ? (
      <button
        data-testid="llm-back-to-profiles"
        type="button"
        onClick={() => {
          setInitialViewHint(null);
          setShowProfiles(true);
        }}
        className="flex items-center gap-2 self-start text-sm text-gray-300 hover:text-white cursor-pointer"
      >
        <FaChevronLeft size={12} aria-hidden="true" />
        {t(I18nKey.SETTINGS$BACK_TO_LLM_LIST)}
      </button>
    ) : null;

  return (
    <div className="flex flex-col gap-4">
      {backToProfiles}
      <SdkSectionPage
        scope={scope}
        sectionKeys={["llm"]}
        excludeKeys={LLM_EXCLUDED_KEYS}
        header={buildHeader}
        buildPayload={buildPayload}
        extraDirty={profileName.trim() !== initialProfileName.trim()}
        onSaveSuccess={handleSaveSuccess}
        getInitialView={getInitialView}
        forceShowAdvancedView
        allowAllView
        testId="llm-settings-screen"
      />
    </div>
  );
}

export default LlmSettingsScreen;
