import { useTranslation } from "react-i18next";
import PlayIcon from "#/icons/play-solid.svg?react";
import { cn } from "#/utils/utils";
import { I18nKey } from "#/i18n/declaration";

export interface ChatResumeAgentButtonProps {
  onAgentResumed: () => void;
  disabled?: boolean;
}

export function ChatResumeAgentButton({
  onAgentResumed,
  disabled = false,
}: ChatResumeAgentButtonProps) {
  const { t } = useTranslation("openhands");
  const label = t(I18nKey.BUTTON$RESUME_CONVERSATION);
  return (
    <button
      type="button"
      onClick={onAgentResumed}
      data-testid="play-button"
      disabled={disabled}
      className={cn("cursor-pointer", disabled && "cursor-not-allowed")}
      aria-label={label}
      title={label}
    >
      <PlayIcon className="block max-w-none w-4 h-4 text-current" />
    </button>
  );
}
