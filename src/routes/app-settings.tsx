import React from "react";
import { useTranslation } from "react-i18next";
import { useSaveSettings } from "#/hooks/mutation/use-save-settings";
import { useSettings } from "#/hooks/query/use-settings";
import { AvailableLanguages } from "#/i18n";
import { DEFAULT_SETTINGS } from "#/services/settings";
import { setTelemetryConsent } from "#/services/telemetry";
import { BrandButton } from "#/components/features/settings/brand-button";
import { SettingsSwitch } from "#/components/features/settings/settings-switch";
import { SettingsInput } from "#/components/features/settings/settings-input";
import { I18nKey } from "#/i18n/declaration";
import { LanguageInput } from "#/components/features/settings/app-settings/language-input";
import { ThemeInput } from "#/components/features/settings/app-settings/theme-input";
import {
  displayErrorToast,
  displaySuccessToast,
} from "#/utils/custom-toast-handlers";
import { retrieveAxiosErrorMessage } from "#/utils/retrieve-axios-error-message";
import { AppSettingsInputsSkeleton } from "#/components/features/settings/app-settings/app-settings-inputs-skeleton";

export function AppSettingsScreen() {
  const { t } = useTranslation("openhands");

  const { mutate: saveSettings, isPending } = useSaveSettings();
  const { data: settings, isLoading } = useSettings();

  const [languageInputHasChanged, setLanguageInputHasChanged] =
    React.useState(false);
  const [analyticsSwitchHasChanged, setAnalyticsSwitchHasChanged] =
    React.useState(false);
  const [
    soundNotificationsSwitchHasChanged,
    setSoundNotificationsSwitchHasChanged,
  ] = React.useState(false);
  const [ttsSwitchHasChanged, setTtsSwitchHasChanged] = React.useState(false);
  const [ttsHoldMusicSwitchHasChanged, setTtsHoldMusicSwitchHasChanged] =
    React.useState(false);
  const [ttsStepsSwitchHasChanged, setTtsStepsSwitchHasChanged] =
    React.useState(false);
  const [ttsResponsesSwitchHasChanged, setTtsResponsesSwitchHasChanged] =
    React.useState(false);
  const [gitUserNameHasChanged, setGitUserNameHasChanged] =
    React.useState(false);
  const [gitUserEmailHasChanged, setGitUserEmailHasChanged] =
    React.useState(false);

  const formAction = (formData: FormData) => {
    const languageLabel = formData.get("language-input")?.toString();
    const languageValue = AvailableLanguages.find(
      ({ label }) => label === languageLabel,
    )?.value;
    const language = languageValue || DEFAULT_SETTINGS.language;

    const enableAnalytics =
      formData.get("enable-analytics-switch")?.toString() === "on";
    const enableSoundNotifications =
      formData.get("enable-sound-notifications-switch")?.toString() === "on";
    const enableTts = formData.get("enable-tts-switch")?.toString() === "on";
    const enableTtsHoldMusic =
      formData.get("enable-tts-hold-music-switch")?.toString() === "on";
    const enableTtsSteps =
      formData.get("enable-tts-steps-switch")?.toString() === "on";
    const enableTtsResponses =
      formData.get("enable-tts-responses-switch")?.toString() === "on";

    const gitUserName =
      formData.get("git-user-name-input")?.toString() ||
      DEFAULT_SETTINGS.git_user_name;
    const gitUserEmail =
      formData.get("git-user-email-input")?.toString() ||
      DEFAULT_SETTINGS.git_user_email;

    saveSettings(
      {
        language,
        user_consents_to_analytics: enableAnalytics,
        enable_sound_notifications: enableSoundNotifications,
        enable_tts: enableTts,
        enable_tts_hold_music: enableTtsHoldMusic,
        enable_tts_steps: enableTtsSteps,
        enable_tts_responses: enableTtsResponses,
        git_user_name: gitUserName,
        git_user_email: gitUserEmail,
      },
      {
        onSuccess: () => {
          void setTelemetryConsent(enableAnalytics ? "granted" : "denied");
          displaySuccessToast(t(I18nKey.SETTINGS$SAVED));
        },
        onError: (error) => {
          const errorMessage = retrieveAxiosErrorMessage(error);
          displayErrorToast(errorMessage || t(I18nKey.ERROR$GENERIC));
        },
        onSettled: () => {
          setLanguageInputHasChanged(false);
          setAnalyticsSwitchHasChanged(false);
          setSoundNotificationsSwitchHasChanged(false);
          setTtsSwitchHasChanged(false);
          setTtsHoldMusicSwitchHasChanged(false);
          setTtsStepsSwitchHasChanged(false);
          setTtsResponsesSwitchHasChanged(false);
          setGitUserNameHasChanged(false);
          setGitUserEmailHasChanged(false);
        },
      },
    );
  };

  const checkIfTtsSwitchHasChanged = (checked: boolean) => {
    const currentTts = !!settings?.enable_tts;
    setTtsSwitchHasChanged(checked !== currentTts);
  };

  const checkIfTtsHoldMusicSwitchHasChanged = (checked: boolean) => {
    const currentHoldMusic = !!settings?.enable_tts_hold_music;
    setTtsHoldMusicSwitchHasChanged(checked !== currentHoldMusic);
  };

  const checkIfTtsStepsSwitchHasChanged = (checked: boolean) => {
    const currentSteps = !!settings?.enable_tts_steps;
    setTtsStepsSwitchHasChanged(checked !== currentSteps);
  };

  const checkIfTtsResponsesSwitchHasChanged = (checked: boolean) => {
    const currentResponses = !!settings?.enable_tts_responses;
    setTtsResponsesSwitchHasChanged(checked !== currentResponses);
  };

  const checkIfLanguageInputHasChanged = (value: string) => {
    const selectedLanguage = AvailableLanguages.find(
      ({ label: langValue }) => langValue === value,
    )?.label;
    const currentLanguage = AvailableLanguages.find(
      ({ value: langValue }) => langValue === settings?.language,
    )?.label;

    setLanguageInputHasChanged(selectedLanguage !== currentLanguage);
  };

  const checkIfAnalyticsSwitchHasChanged = (checked: boolean) => {
    // Treat null as true since analytics is opt-in by default
    const currentAnalytics = settings?.user_consents_to_analytics ?? true;
    setAnalyticsSwitchHasChanged(checked !== currentAnalytics);
  };

  const checkIfSoundNotificationsSwitchHasChanged = (checked: boolean) => {
    const currentSoundNotifications = !!settings?.enable_sound_notifications;
    setSoundNotificationsSwitchHasChanged(
      checked !== currentSoundNotifications,
    );
  };

  const checkIfGitUserNameHasChanged = (value: string) => {
    const currentValue = settings?.git_user_name;
    setGitUserNameHasChanged(value !== currentValue);
  };

  const checkIfGitUserEmailHasChanged = (value: string) => {
    const currentValue = settings?.git_user_email;
    setGitUserEmailHasChanged(value !== currentValue);
  };

  const formIsClean =
    !languageInputHasChanged &&
    !analyticsSwitchHasChanged &&
    !soundNotificationsSwitchHasChanged &&
    !ttsSwitchHasChanged &&
    !ttsHoldMusicSwitchHasChanged &&
    !ttsStepsSwitchHasChanged &&
    !ttsResponsesSwitchHasChanged &&
    !gitUserNameHasChanged &&
    !gitUserEmailHasChanged;

  const shouldBeLoading = !settings || isLoading || isPending;

  return (
    <form
      data-testid="app-settings-screen"
      action={formAction}
      className="flex flex-col gap-6"
    >
      {shouldBeLoading && <AppSettingsInputsSkeleton />}
      {!shouldBeLoading && (
        <div className="flex flex-col gap-6">
          <LanguageInput
            name="language-input"
            defaultKey={settings.language}
            onChange={checkIfLanguageInputHasChanged}
          />

          <ThemeInput />

          <SettingsSwitch
            testId="enable-analytics-switch"
            name="enable-analytics-switch"
            defaultIsToggled={settings.user_consents_to_analytics ?? true}
            onToggle={checkIfAnalyticsSwitchHasChanged}
          >
            {t(I18nKey.ANALYTICS$SEND_ANONYMOUS_DATA)}
          </SettingsSwitch>

          <SettingsSwitch
            testId="enable-sound-notifications-switch"
            name="enable-sound-notifications-switch"
            defaultIsToggled={!!settings.enable_sound_notifications}
            onToggle={checkIfSoundNotificationsSwitchHasChanged}
          >
            {t(I18nKey.SETTINGS$SOUND_NOTIFICATIONS)}
          </SettingsSwitch>

          <SettingsSwitch
            testId="enable-tts-switch"
            name="enable-tts-switch"
            defaultIsToggled={!!settings.enable_tts}
            onToggle={checkIfTtsSwitchHasChanged}
          >
            {t(I18nKey.SETTINGS$TTS_ENABLE)}
          </SettingsSwitch>

          <SettingsSwitch
            testId="enable-tts-steps-switch"
            name="enable-tts-steps-switch"
            defaultIsToggled={!!settings.enable_tts_steps}
            onToggle={checkIfTtsStepsSwitchHasChanged}
          >
            {t(I18nKey.SETTINGS$TTS_READ_STEPS)}
          </SettingsSwitch>

          <SettingsSwitch
            testId="enable-tts-responses-switch"
            name="enable-tts-responses-switch"
            defaultIsToggled={!!settings.enable_tts_responses}
            onToggle={checkIfTtsResponsesSwitchHasChanged}
          >
            {t(I18nKey.SETTINGS$TTS_READ_RESPONSES)}
          </SettingsSwitch>

          <SettingsSwitch
            testId="enable-tts-hold-music-switch"
            name="enable-tts-hold-music-switch"
            defaultIsToggled={!!settings.enable_tts_hold_music}
            onToggle={checkIfTtsHoldMusicSwitchHasChanged}
          >
            {t(I18nKey.SETTINGS$TTS_HOLD_MUSIC)}
          </SettingsSwitch>

          <div className="border-t border-[var(--oh-border)] pt-6 mt-2">
            <h3 className="text-lg font-medium mb-2">
              {t(I18nKey.SETTINGS$GIT_SETTINGS)}
            </h3>
            <p className="mb-4 text-sm leading-5 text-tertiary-light">
              {t(I18nKey.SETTINGS$GIT_SETTINGS_DESCRIPTION)}
            </p>
            <div className="flex flex-col gap-6">
              <SettingsInput
                testId="git-user-name-input"
                name="git-user-name-input"
                type="text"
                label={t(I18nKey.SETTINGS$GIT_USERNAME)}
                defaultValue={settings.git_user_name || ""}
                onChange={checkIfGitUserNameHasChanged}
                placeholder={t(I18nKey.SETTINGS$GIT_USERNAME_PLACEHOLDER)}
                className="w-full min-w-0"
              />
              <SettingsInput
                testId="git-user-email-input"
                name="git-user-email-input"
                type="email"
                label={t(I18nKey.SETTINGS$GIT_EMAIL)}
                defaultValue={settings.git_user_email || ""}
                onChange={checkIfGitUserEmailHasChanged}
                placeholder={t(I18nKey.SETTINGS$GIT_EMAIL_PLACEHOLDER)}
                className="w-full min-w-0"
              />
            </div>
            <div className="flex justify-start pt-4">
              <BrandButton
                testId="submit-button"
                variant="primary"
                type="submit"
                isDisabled={isPending || formIsClean}
              >
                {!isPending && t(I18nKey.SETTINGS$SAVE_CHANGES)}
                {isPending && t(I18nKey.SETTINGS$SAVING)}
              </BrandButton>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

export default AppSettingsScreen;
