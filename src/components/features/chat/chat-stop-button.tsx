import { useTranslation } from "react-i18next";
import PauseIcon from "#/icons/pause.svg?react";
import { I18nKey } from "#/i18n/declaration";

export interface ChatStopButtonProps {
  handleStop: () => void;
}

// Surfaced inline (next to the chat input) while the agent is mid-turn,
// distinct from the sidebar's "End conversation" action: both today call
// the same `/pause` endpoint (the SDK has no separate `cancel`), but the
// user-visible labelling preserves the issue #601 distinction between
// "stop generating this turn" and "end this conversation entirely". A
// follow-up issue against software-agent-sdk tracks adding a true
// `session/cancel` so this button can map to it directly.
export function ChatStopButton({ handleStop }: ChatStopButtonProps) {
  const { t } = useTranslation("openhands");
  const label = t(I18nKey.BUTTON$STOP_GENERATING);
  return (
    <button
      type="button"
      onClick={handleStop}
      data-testid="stop-button"
      className="cursor-pointer"
      aria-label={label}
      title={label}
    >
      <PauseIcon className="block max-w-none w-4 h-4 text-current" />
    </button>
  );
}
