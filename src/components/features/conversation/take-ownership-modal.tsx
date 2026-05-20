import { useTranslation } from "react-i18next";
import {
  BaseModalDescription,
  BaseModalTitle,
} from "#/components/shared/modals/confirmation-modals/base-modal";
import { ModalBackdrop } from "#/components/shared/modals/modal-backdrop";
import { ModalBody } from "#/components/shared/modals/modal-body";
import { BrandButton } from "#/components/features/settings/brand-button";
import { I18nKey } from "#/i18n/declaration";

interface TakeOwnershipModalProps {
  /**
   * Called when the user clicks "Take ownership" / Retry. The caller is
   * responsible for re-invoking the resume mutation; the modal does not
   * own that state so the same dialog can be reused from any resume
   * surface (sidebar row, chat header, …).
   *
   * The agent-server does NOT today expose an endpoint to forcibly clear
   * a stale lease — leases auto-expire after ~45 s. So in practice this
   * button simply re-issues the resume request; if the lease has just
   * expired (or the agent-server has been restarted), it will succeed.
   * A follow-up issue against software-agent-sdk tracks adding an
   * explicit lease-release endpoint (see PR description).
   */
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Surface shown when resuming a conversation fails because another
 * agent-server instance still holds the conversation's `owner_lease.json`
 * (HTTP 409). Per issue #601 this would otherwise present as an opaque
 * "conversation already running" toast — instead we explain the lease
 * mechanism, advise waiting briefly (the lease TTL is short) or
 * restarting the agent-server, and let the user retry inline.
 */
export function TakeOwnershipModal({
  onConfirm,
  onCancel,
}: TakeOwnershipModalProps) {
  const { t } = useTranslation("openhands");

  return (
    <ModalBackdrop onClose={onCancel}>
      <ModalBody className="items-start border border-[var(--oh-border)]">
        <div className="flex flex-col gap-2">
          <BaseModalTitle title={t(I18nKey.MODAL$TAKE_OWNERSHIP_TITLE)} />
          <BaseModalDescription
            description={t(I18nKey.MODAL$TAKE_OWNERSHIP_BODY)}
          />
        </div>
        <div
          className="flex justify-end gap-2 w-full"
          onClick={(event) => event.stopPropagation()}
        >
          <BrandButton
            type="button"
            variant="secondary"
            onClick={onCancel}
            testId="take-ownership-cancel-button"
          >
            {t(I18nKey.BUTTON$CANCEL)}
          </BrandButton>
          <BrandButton
            type="button"
            variant="primary"
            onClick={onConfirm}
            testId="take-ownership-confirm-button"
          >
            {t(I18nKey.BUTTON$TAKE_OWNERSHIP)}
          </BrandButton>
        </div>
      </ModalBody>
    </ModalBackdrop>
  );
}
