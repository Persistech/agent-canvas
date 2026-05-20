import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { I18nKey } from "#/i18n/declaration";

interface SessionLoadFailedBannerProps {
  onDismiss: () => void;
}

/**
 * One-line dismissible banner shown above the chat input when an ACP
 * resume call falls through to a fresh upstream session (e.g. the CLI's
 * own session JSONL was wiped under `~/.claude/projects/` or `~/.codex/
 * sessions/`). Canvas keeps its full event history; the warning is that
 * the agent itself may not be able to see it.
 *
 * Per issue #601 this is co-located with the conversation route's local
 * state — there's deliberately no global store for it.
 */
export function SessionLoadFailedBanner({
  onDismiss,
}: SessionLoadFailedBannerProps) {
  const { t } = useTranslation("openhands");

  return (
    <div
      data-testid="session-load-failed-banner"
      className="w-full rounded-lg p-2 border border-[var(--oh-border)] bg-[var(--oh-surface)] flex gap-2 items-start text-white"
    >
      <div className="min-w-0 flex-1 text-sm">
        {t(I18nKey.BANNER$SESSION_LOAD_FAILED)}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-md p-1 hover:bg-black/10 cursor-pointer"
        aria-label={t(I18nKey.BUTTON$CLOSE)}
        data-testid="session-load-failed-banner-dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
