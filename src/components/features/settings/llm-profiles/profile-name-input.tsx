import { useTranslation } from "react-i18next";
import { SettingsInput } from "#/components/features/settings/settings-input";
import { PROFILE_NAME_PATTERN } from "#/utils/derive-profile-name";
import { I18nKey } from "#/i18n/declaration";

interface ProfileNameInputProps {
  testId?: string;
  ruleTestId?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isDisabled?: boolean;
  /** Render label as "Name (Optional)" when this field isn't required. */
  isOptional?: boolean;
}

export function ProfileNameInput({
  testId,
  ruleTestId,
  value,
  onChange,
  placeholder,
  isDisabled,
  isOptional,
}: ProfileNameInputProps) {
  const { t } = useTranslation("openhands");
  const trimmed = value.trim();
  const isValid = trimmed === "" || PROFILE_NAME_PATTERN.test(trimmed);
  const label = isOptional
    ? `${t(I18nKey.SETTINGS$PROFILE_NAME_LABEL)} (${t(I18nKey.COMMON$OPTIONAL)})`
    : t(I18nKey.SETTINGS$PROFILE_NAME_LABEL);

  return (
    <div className="flex flex-col gap-2">
      <SettingsInput
        testId={testId}
        label={label}
        type="text"
        className="w-full"
        value={value}
        placeholder={
          placeholder ?? t(I18nKey.SETTINGS$PROFILE_NAME_PLACEHOLDER)
        }
        onChange={onChange}
        isDisabled={isDisabled}
      />
      <p
        data-testid={ruleTestId}
        className={`text-xs ${isValid ? "text-gray-400" : "text-red-400"}`}
      >
        {t(I18nKey.SETTINGS$PROFILE_NAME_RULE)}
      </p>
    </div>
  );
}
