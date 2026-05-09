import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BrandButton } from "#/components/features/settings/brand-button";
import { RenameProfileModal } from "./rename-profile-modal";
import { DeleteProfileModal } from "./delete-profile-modal";
import { LlmProfileSummary } from "#/api/profiles-service/profiles-service.api";
import { I18nKey } from "#/i18n/declaration";
import { LoadingSpinner } from "#/components/shared/loading-spinner";
import { useLlmProfiles } from "#/hooks/query/use-llm-profiles";
import { ProfileListRow } from "./profile-list-row";
import { useSaveSettings } from "#/hooks/mutation/use-save-settings";
import ProfilesService from "#/api/profiles-service/profiles-service.api";
import {
  displayErrorToast,
  displaySuccessToast,
} from "#/utils/custom-toast-handlers";

interface LlmProfilesListViewProps {
  profiles: LlmProfileSummary[];
  currentModel: string;
  onAddProfile: () => void;
  onEditProfile: (profile: LlmProfileSummary) => void;
}

export function LlmProfilesListView({
  profiles,
  currentModel,
  onAddProfile,
  onEditProfile,
}: LlmProfilesListViewProps) {
  const { t } = useTranslation("openhands");
  const { isLoading, error, refetch } = useLlmProfiles();
  const { mutateAsync: saveSettings } = useSaveSettings("personal");
  const [profileToRename, setProfileToRename] =
    useState<LlmProfileSummary | null>(null);
  const [profileToDelete, setProfileToDelete] =
    useState<LlmProfileSummary | null>(null);
  const [activatingProfile, setActivatingProfile] = useState<string | null>(
    null,
  );

  const handleActivate = async (profile: LlmProfileSummary) => {
    setActivatingProfile(profile.name);
    try {
      // Load the full profile config
      const profileDetail = await ProfilesService.getProfile(profile.name);
      const config = profileDetail.config as Record<string, unknown>;

      // Apply the profile's LLM settings
      await saveSettings({
        agent_settings_diff: {
          llm: config,
        },
      });

      displaySuccessToast(
        t(I18nKey.SETTINGS$PROFILE_ACTIVATED, { name: profile.name }),
      );
      refetch();
    } catch {
      displayErrorToast(t(I18nKey.ERROR$GENERIC));
    } finally {
      setActivatingProfile(null);
    }
  };

  const handleEdit = (profile: LlmProfileSummary) => {
    onEditProfile(profile);
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-white">
            {t(I18nKey.SETTINGS$AVAILABLE_PROFILES)}
          </h2>
          <BrandButton
            testId="add-llm-profile"
            type="button"
            variant="primary"
            className="ml-auto"
            onClick={onAddProfile}
          >
            {t(I18nKey.SETTINGS$ADD_LLM_PROFILE)}
          </BrandButton>
        </div>
        <div className="flex justify-center p-4">
          <LoadingSpinner size="large" />
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-white">
            {t(I18nKey.SETTINGS$AVAILABLE_PROFILES)}
          </h2>
          <BrandButton
            testId="add-llm-profile"
            type="button"
            variant="primary"
            className="ml-auto"
            onClick={onAddProfile}
          >
            {t(I18nKey.SETTINGS$ADD_LLM_PROFILE)}
          </BrandButton>
        </div>
        <p className="text-sm text-red-400">
          {t(I18nKey.SETTINGS$PROFILES_LOAD_ERROR)}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-white">
            {t(I18nKey.SETTINGS$AVAILABLE_PROFILES)}
          </h2>
          <BrandButton
            testId="add-llm-profile"
            type="button"
            variant="primary"
            className="ml-auto"
            onClick={onAddProfile}
          >
            {t(I18nKey.SETTINGS$ADD_LLM_PROFILE)}
          </BrandButton>
        </div>

        {profiles.length === 0 ? (
          <p className="text-sm text-gray-400 italic">
            {t(I18nKey.SETTINGS$PROFILES_EMPTY)}
          </p>
        ) : (
          <div className="border border-tertiary rounded-md divide-y divide-tertiary">
            {profiles.map((profile) => (
              <ProfileListRow
                key={profile.name}
                profile={profile}
                isActive={profile.model === currentModel}
                isActivating={activatingProfile === profile.name}
                onActivate={() => handleActivate(profile)}
                onEdit={() => handleEdit(profile)}
                onRename={() => setProfileToRename(profile)}
                onDelete={() => setProfileToDelete(profile)}
              />
            ))}
          </div>
        )}
      </div>

      <RenameProfileModal
        profile={profileToRename}
        onClose={() => setProfileToRename(null)}
      />
      <DeleteProfileModal
        profile={profileToDelete}
        onClose={() => setProfileToDelete(null)}
      />
    </>
  );
}
