import { useTranslation } from "react-i18next";
import { I18nKey } from "#/i18n/declaration";
import { BrandButton } from "#/components/features/settings/brand-button";
import { ModalBackdrop } from "#/components/shared/modals/modal-backdrop";
import { modalTitleClassName } from "#/utils/modal-classes";
import { DEFAULT_CONCURRENT_SANDBOX_LIMIT } from "#/utils/constants";

interface ConversationLimitModalProps {
  onClose: () => void;
  limit?: number;
}

export function ConversationLimitModal({
  onClose,
  limit = DEFAULT_CONCURRENT_SANDBOX_LIMIT,
}: ConversationLimitModalProps) {
  const { t } = useTranslation("openhands");

  return (
    <ModalBackdrop onClose={onClose}>
      <div
        data-testid="conversation-limit-modal"
        className="bg-base-secondary p-4 rounded-xl flex flex-col gap-4 border border-[var(--oh-border)] max-w-[460px]"
      >
        <h3 className={modalTitleClassName}>
          {t(I18nKey.CONVERSATION_LIMIT$TITLE)}
        </h3>
        <p className="text-sm leading-5 text-[var(--oh-muted)]">
          {t(I18nKey.CONVERSATION_LIMIT$DESCRIPTION, { limit })}
        </p>
        <div className="w-full flex justify-end">
          <BrandButton
            testId="conversation-limit-close-button"
            type="button"
            variant="primary"
            onClick={onClose}
          >
            {t(I18nKey.BUTTON$CLOSE)}
          </BrandButton>
        </div>
      </div>
    </ModalBackdrop>
  );
}
