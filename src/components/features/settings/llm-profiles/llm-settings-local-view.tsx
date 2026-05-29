import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { LlmProfilesManager } from "./llm-profiles-manager";
import { ProfileNameInput } from "./profile-name-input";
import { BrandButton } from "#/components/features/settings/brand-button";
import { SettingsDropdownInput } from "#/components/features/settings/settings-dropdown-input";
import { LlmSettingsScreen } from "#/routes/llm-settings";
import {
  AcpProfileForm,
  type AcpProfileFormValue,
} from "#/components/features/settings/agent-profiles/acp-profile-form";
import { useSaveLlmProfile } from "#/hooks/mutation/use-save-llm-profile";
import { useLlmProfiles } from "#/hooks/query/use-llm-profiles";
import ProfilesService, {
  ProfileInfo,
} from "#/api/profiles-service/profiles-service.api";
import {
  ACP_PROVIDERS,
  ACP_CUSTOM_PRESET_KEY,
} from "#/constants/acp-providers";
import {
  displayErrorToast,
  displaySuccessToast,
} from "#/utils/custom-toast-handlers";
import { I18nKey } from "#/i18n/declaration";
import {
  deriveProfileNameFromModel,
  isProfileNameValid,
} from "#/utils/derive-profile-name";
import { SdkSectionSaveControl } from "../sdk-settings/sdk-section-page";
import { SettingsFormValues } from "#/utils/sdk-settings-schema";
import { ArrowLeft } from "lucide-react";
import { Typography } from "#/ui/typography";
import { useSettingsSectionHeader } from "#/contexts/settings-section-header-context";

type ViewMode = "list" | "create" | "edit";
type ProfileKind = "openhands" | "acp";

interface EditingProfile {
  profile: ProfileInfo;
  initialValues: SettingsFormValues;
}

function defaultAcpValue(): AcpProfileFormValue {
  const first = ACP_PROVIDERS[0];
  return {
    acpServer: first?.key ?? ACP_CUSTOM_PRESET_KEY,
    command: first ? [...first.default_command] : [],
    acpModel: first?.default_model ?? "",
    env: {},
  };
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * Unified AgentProfile editor for local agent-server mode (Settings → Agent).
 * Lists profiles and creates/edits them; a kind toggle switches the form
 * between an OpenHands profile (LLM config) and an ACP profile
 * (provider / command / model / env). Saving persists the profile via
 * /api/profiles (kind-aware) and activates it, so "save" is all the user needs.
 */
export function LlmSettingsLocalView() {
  const { t } = useTranslation("openhands");
  const { setHideSectionHeader } = useSettingsSectionHeader();
  const saveProfile = useSaveLlmProfile();
  const { data: profilesData } = useLlmProfiles();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [profileName, setProfileName] = useState("");
  const [kind, setKind] = useState<ProfileKind>("openhands");
  const [acpValue, setAcpValue] =
    useState<AcpProfileFormValue>(defaultAcpValue);
  const [editingProfile, setEditingProfile] = useState<EditingProfile | null>(
    null,
  );
  const [saveControl, setSaveControl] = useState<SdkSectionSaveControl | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setHideSectionHeader(viewMode !== "list");
    return () => setHideSectionHeader(false);
  }, [viewMode, setHideSectionHeader]);

  const existingNames = useMemo(
    () => new Set(profilesData?.profiles.map((p) => p.name) ?? []),
    [profilesData],
  );

  const isNameValid = useMemo(() => {
    if (!isProfileNameValid(profileName, { isRequired: true })) return false;
    if (viewMode === "create" && existingNames.has(profileName)) return false;
    if (
      viewMode === "edit" &&
      profileName !== editingProfile?.profile.name &&
      existingNames.has(profileName)
    ) {
      return false;
    }
    return true;
  }, [profileName, viewMode, existingNames, editingProfile?.profile.name]);

  const handleAddProfile = useCallback(() => {
    setProfileName("");
    setKind("openhands");
    setAcpValue(defaultAcpValue());
    setEditingProfile(null);
    setViewMode("create");
  }, []);

  const handleEditProfile = useCallback(
    async (profile: ProfileInfo) => {
      try {
        const detail = await ProfilesService.getProfile(
          profile.name,
          "encrypted",
        );
        const config = (detail.config ?? {}) as Record<string, unknown>;

        if (config.agent_kind === "acp" || profile.kind === "acp") {
          setKind("acp");
          setAcpValue({
            acpServer: asString(config.acp_server) || ACP_CUSTOM_PRESET_KEY,
            command: Array.isArray(config.acp_command)
              ? (config.acp_command as unknown[]).map((c) => String(c))
              : [],
            acpModel: asString(config.acp_model),
            env:
              config.acp_env && typeof config.acp_env === "object"
                ? (config.acp_env as Record<string, string>)
                : {},
          });
          setEditingProfile({ profile, initialValues: {} });
        } else {
          setKind("openhands");
          setEditingProfile({
            profile,
            initialValues: {
              "llm.model": asString(config.model),
              "llm.api_key": asString(config.api_key),
              "llm.base_url": asString(config.base_url),
            },
          });
        }
        setProfileName(profile.name);
        setViewMode("edit");
      } catch (error) {
        console.error("Failed to fetch profile details:", error);
        displayErrorToast(t(I18nKey.ERROR$GENERIC));
      }
    },
    [t],
  );

  const handleBackToList = useCallback(() => {
    setViewMode("list");
    setEditingProfile(null);
    setProfileName("");
    setSaveControl(null);
  }, []);

  const handleSaveControlChange = useCallback(
    (control: SdkSectionSaveControl) => {
      setSaveControl(control);
      if (viewMode === "create" && kind === "openhands" && !profileName) {
        const modelValue = control.values["llm.model"];
        if (typeof modelValue === "string" && modelValue) {
          const derived = deriveProfileNameFromModel(modelValue);
          if (!existingNames.has(derived)) setProfileName(derived);
        }
      }
    },
    [viewMode, kind, profileName, existingNames],
  );

  const handleSave = useCallback(async () => {
    if (!isNameValid) return;
    const trimmedName = profileName.trim();
    const originalName = editingProfile?.profile.name;
    const isRename =
      viewMode === "edit" && originalName && originalName !== trimmedName;

    // Build the kind-aware save request.
    let request: Parameters<typeof saveProfile.mutateAsync>[0]["request"];
    if (kind === "acp") {
      if (!acpValue.acpServer || acpValue.command.length === 0) {
        displayErrorToast(t(I18nKey.SETTINGS$AGENT_COMMAND));
        return;
      }
      request = {
        agent_settings: {
          agent_kind: "acp",
          acp_server: acpValue.acpServer,
          acp_command: acpValue.command,
          acp_args: [],
          acp_model: acpValue.acpModel.trim() || null,
          acp_env: acpValue.env,
        },
        include_secrets: true,
      };
    } else {
      if (!saveControl) return;
      const values = saveControl.values;
      const model = asString(values["llm.model"]);
      if (!model) {
        displayErrorToast(t(I18nKey.SETTINGS$MODEL_REQUIRED));
        return;
      }
      const apiKey = asString(values["llm.api_key"]);
      const baseUrl = asString(values["llm.base_url"]);
      const llm: Record<string, unknown> = { model };
      if (apiKey) llm.api_key = apiKey;
      else if (
        viewMode === "edit" &&
        editingProfile?.initialValues["llm.api_key"]
      )
        llm.api_key = editingProfile.initialValues["llm.api_key"];
      if (baseUrl) llm.base_url = baseUrl;
      request = {
        llm: llm as { model: string; api_key?: string; base_url?: string },
        include_secrets: true,
      };
    }

    setIsSaving(true);
    try {
      if (isRename) {
        await ProfilesService.renameProfile(originalName, trimmedName);
      }
      await saveProfile.mutateAsync({ name: trimmedName, request });
      // "Save and that's it": the saved profile becomes the active one.
      await ProfilesService.activateProfile(trimmedName);

      displaySuccessToast(
        viewMode === "create"
          ? t(I18nKey.SETTINGS$PROFILE_CREATED, { name: trimmedName })
          : t(I18nKey.SETTINGS$PROFILE_UPDATED, { name: trimmedName }),
      );
      handleBackToList();
    } catch (error) {
      console.error("Failed to save profile:", error);
      displayErrorToast(t(I18nKey.ERROR$GENERIC));
    } finally {
      setIsSaving(false);
    }
  }, [
    isNameValid,
    profileName,
    kind,
    acpValue,
    saveControl,
    viewMode,
    editingProfile,
    saveProfile,
    t,
    handleBackToList,
  ]);

  if (viewMode === "list") {
    return (
      <LlmProfilesManager
        onAddProfile={handleAddProfile}
        onEditProfile={handleEditProfile}
      />
    );
  }

  const saveDisabled =
    !isNameValid ||
    isSaving ||
    (kind === "openhands"
      ? !saveControl
      : !acpValue.acpServer || acpValue.command.length === 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleBackToList}
          className="flex items-center gap-2 self-start rounded-lg p-2 text-[var(--oh-muted)] transition-colors hover:bg-tertiary hover:text-white"
          data-testid="back-to-profiles"
        >
          <ArrowLeft size={20} aria-hidden />
          <span className="text-sm leading-5">{t(I18nKey.BUTTON$BACK)}</span>
        </button>
        <Typography.H2 testId="profile-editor-title">
          {viewMode === "edit"
            ? t(I18nKey.SETTINGS$EDIT_LLM_PROFILE)
            : t(I18nKey.SETTINGS$ADD_LLM_PROFILE)}
        </Typography.H2>
        <p
          data-testid="profile-editor-description"
          className="text-sm leading-5 text-tertiary-light"
        >
          {viewMode === "edit" && editingProfile
            ? t(I18nKey.SETTINGS$PROFILE_LOADED, {
                name: editingProfile.profile.name,
              })
            : t(I18nKey.SETTINGS$PROFILE_SAVE_HINT)}
        </p>
      </div>

      <ProfileNameInput
        testId="profile-name-input"
        value={profileName}
        onChange={setProfileName}
        isRequired
      />

      {/* Agent kind toggle: OpenHands profile (LLM) vs ACP profile. */}
      <SettingsDropdownInput
        testId="profile-kind-selector"
        name="profile-kind"
        label={t(I18nKey.SETTINGS$NAV_AGENT)}
        items={[
          { key: "openhands", label: t(I18nKey.SETTINGS$AGENT_TYPE_OPENHANDS) },
          { key: "acp", label: t(I18nKey.SETTINGS$AGENT_TYPE_ACP) },
        ]}
        selectedKey={kind}
        onSelectionChange={(key) => key && setKind(key as ProfileKind)}
      />

      {kind === "openhands" ? (
        <LlmSettingsScreen
          key={
            viewMode === "edit"
              ? `edit-${editingProfile?.profile.name}`
              : "new-profile"
          }
          embedded
          hideSaveButton
          initialValueOverrides={
            viewMode === "edit" && editingProfile?.initialValues
              ? editingProfile.initialValues
              : { "llm.model": "", "llm.api_key": "", "llm.base_url": "" }
          }
          onSaveControlChange={handleSaveControlChange}
        />
      ) : (
        <AcpProfileForm value={acpValue} onChange={setAcpValue} />
      )}

      <div className="flex justify-start gap-3 pt-4 border-t border-[var(--oh-border)]">
        <BrandButton
          testId="cancel-profile-btn"
          type="button"
          variant="tertiary"
          onClick={handleBackToList}
        >
          {t(I18nKey.BUTTON$CANCEL)}
        </BrandButton>
        <BrandButton
          testId="save-profile-btn"
          type="button"
          variant="primary"
          onClick={handleSave}
          isDisabled={saveDisabled}
          aria-busy={isSaving}
        >
          {isSaving ? t(I18nKey.STATUS$SAVING) : t(I18nKey.BUTTON$SAVE)}
        </BrandButton>
      </div>
    </div>
  );
}
