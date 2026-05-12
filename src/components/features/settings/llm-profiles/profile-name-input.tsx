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
  /** When true, empty values will show red validation styling (required field behavior). */
  isRequired?: boolean;
}

export function ProfileNameInput({
  testId,
  ruleTestId,
  value,
  onChange,
  placeholder,
  isDisabled,
  isOptional,
  isRequired = false,
}: ProfileNameInputProps) {
  const { t } = useTranslation("openhands");
  const trimmed = value.trim();
  // When required, empty string is invalid. Otherwise, empty is valid (optional).
  const isValid = isRequired
    ? trimmed !== "" && PROFILE_NAME_PATTERN.test(trimmed)
    : trimmed === "" || PROFILE_NAME_PATTERN.test(trimmed);
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
