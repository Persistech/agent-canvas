import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BrandButton } from "#/components/features/settings/brand-button";
import { LoadingSpinner } from "#/components/shared/loading-spinner";
import { useMetaProfiles } from "#/hooks/query/use-meta-profiles";
import { useLlmProfiles } from "#/hooks/query/use-llm-profiles";
import { useSaveMetaProfile } from "#/hooks/mutation/use-save-meta-profile";
import { useActivateMetaProfile } from "#/hooks/mutation/use-activate-meta-profile";
import MetaProfilesService, {
  type MetaProfile,
  type MetaProfileInfo,
} from "#/api/meta-profiles-service/meta-profiles-service.api";
import {
  displayErrorToast,
  displaySuccessToast,
} from "#/utils/custom-toast-handlers";
import { I18nKey } from "#/i18n/declaration";
import { cn } from "#/utils/utils";
import { MetaProfileEditor } from "./meta-profile-editor";
import { DeleteMetaProfileModal } from "./delete-meta-profile-modal";

type ViewMode = "list" | "create" | "edit";

interface EditingMetaProfile {
  name: string;
  config: MetaProfile;
}

function MetaProfileSummary({ info }: { info: MetaProfileInfo }) {
  const { t } = useTranslation("openhands");
  const route = [info.classifier_model, info.default_model]
    .filter(Boolean)
    .join(" → ");
  return (
    <span className="text-xs text-[var(--oh-muted)]">
      {route}
      {route ? " · " : ""}
      {`${info.num_classes} ${t(I18nKey.SETTINGS$META_PROFILE_CLASSES)}`}
    </span>
  );
}

export function MetaLlmSettingsView() {
  const { t } = useTranslation("openhands");
  const { data, isLoading, error } = useMetaProfiles();
  const { data: llmProfilesData } = useLlmProfiles();
  const saveMetaProfile = useSaveMetaProfile();
  const activateMetaProfile = useActivateMetaProfile();

  const [view, setView] = useState<ViewMode>("list");
  const [editing, setEditing] = useState<EditingMetaProfile | null>(null);
  const [nameToDelete, setNameToDelete] = useState<string | null>(null);

  const metaProfiles = data?.meta_profiles ?? [];
  const active = data?.active_meta_profile ?? null;
  const availableProfiles = (llmProfilesData?.profiles ?? []).map(
    (p) => p.name,
  );

  const handleActivate = async (name: string) => {
    try {
      await activateMetaProfile.mutateAsync(name);
      displaySuccessToast(t(I18nKey.SETTINGS$META_PROFILE_ACTIVATED, { name }));
    } catch (activateError) {
      const message =
        activateError instanceof Error
          ? activateError.message
          : t(I18nKey.ERROR$GENERIC);
      displayErrorToast(message);
    }
  };

  const handleEdit = async (name: string) => {
    try {
      const detail = await MetaProfilesService.getMetaProfile(name);
      setEditing({ name: detail.name, config: detail.config });
      setView("edit");
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : t(I18nKey.ERROR$GENERIC);
      displayErrorToast(message);
    }
  };

  const handleSave = async (name: string, config: MetaProfile) => {
    try {
      await saveMetaProfile.mutateAsync({ name, config });
      displaySuccessToast(t(I18nKey.SETTINGS$META_PROFILE_SAVED, { name }));
      setView("list");
      setEditing(null);
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : t(I18nKey.ERROR$GENERIC);
      displayErrorToast(message);
    }
  };

  const handleCancel = () => {
    setView("list");
    setEditing(null);
  };

  if (view === "create" || view === "edit") {
    return (
      <MetaProfileEditor
        mode={view === "edit" ? "edit" : "create"}
        initialName={editing?.name}
        initialConfig={editing?.config}
        availableProfiles={availableProfiles}
        isSaving={saveMetaProfile.isPending}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {availableProfiles.length === 0 ? (
          <p
            data-testid="meta-profile-no-llm-profiles"
            className="text-sm text-[var(--oh-muted)]"
          >
            {t(I18nKey.SETTINGS$META_PROFILE_NO_LLM_PROFILES)}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-medium text-white">
            {t(I18nKey.SETTINGS$META_PROFILES_AVAILABLE)}
          </h2>
          <BrandButton
            testId="add-meta-profile"
            type="button"
            variant="secondary"
            className="ml-auto"
            onClick={() => {
              setEditing(null);
              setView("create");
            }}
          >
            {t(I18nKey.SETTINGS$ADD_META_PROFILE)}
          </BrandButton>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <LoadingSpinner size="small" />
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-red-400">{t(I18nKey.ERROR$GENERIC)}</p>
        ) : null}

        {!isLoading && !error && metaProfiles.length === 0 ? (
          <p
            data-testid="meta-profile-empty"
            className="text-sm text-[var(--oh-muted)]"
          >
            {t(I18nKey.SETTINGS$META_PROFILE_NO_PROFILES)}
          </p>
        ) : null}

        {metaProfiles.length > 0 ? (
          <ul className="flex flex-col gap-2" data-testid="meta-profile-list">
            {metaProfiles.map((info) => {
              const isActive = info.name === active;
              return (
                <li
                  key={info.name}
                  data-testid={`meta-profile-row-${info.name}`}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3",
                    isActive ? "border-primary" : "border-[var(--oh-border)]",
                  )}
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {info.name}
                      </span>
                      {isActive ? (
                        <span
                          data-testid="meta-profile-active-badge"
                          className="rounded-full bg-primary px-2 py-0.5 text-xs text-[var(--oh-color-base)]"
                        >
                          {t(I18nKey.SETTINGS$META_PROFILE_ACTIVE)}
                        </span>
                      ) : null}
                    </div>
                    <MetaProfileSummary info={info} />
                  </div>

                  <div className="flex items-center gap-2">
                    <BrandButton
                      testId={`activate-meta-profile-${info.name}`}
                      type="button"
                      variant="secondary"
                      onClick={() => handleActivate(info.name)}
                      isDisabled={isActive || activateMetaProfile.isPending}
                    >
                      {t(I18nKey.SETTINGS$META_PROFILE_ACTIVATE)}
                    </BrandButton>
                    <BrandButton
                      testId={`edit-meta-profile-${info.name}`}
                      type="button"
                      variant="secondary"
                      onClick={() => handleEdit(info.name)}
                    >
                      {t(I18nKey.BUTTON$EDIT)}
                    </BrandButton>
                    <BrandButton
                      testId={`delete-meta-profile-${info.name}`}
                      type="button"
                      variant="danger"
                      onClick={() => setNameToDelete(info.name)}
                    >
                      {t(I18nKey.BUTTON$DELETE)}
                    </BrandButton>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <DeleteMetaProfileModal
        name={nameToDelete}
        onClose={() => setNameToDelete(null)}
      />
    </>
  );
}
