import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { I18nKey } from "#/i18n/declaration";

interface ProfileActionsMenuProps {
  onEdit: () => void;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ProfileActionsMenu({
  onEdit,
  onRename,
  onDelete,
  onClose,
}: ProfileActionsMenuProps) {
  const { t } = useTranslation("openhands");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-1 z-10 bg-base-secondary border border-tertiary rounded-md shadow-lg py-1 min-w-[140px]"
      role="menu"
      aria-orientation="vertical"
    >
      <button
        type="button"
        onClick={() => handleAction(onEdit)}
        className="w-full text-left px-4 py-2 text-sm text-white hover:bg-tertiary cursor-pointer"
        role="menuitem"
        data-testid="profile-action-edit"
      >
        {t(I18nKey.BUTTON$EDIT)}
      </button>
      <button
        type="button"
        onClick={() => handleAction(onRename)}
        className="w-full text-left px-4 py-2 text-sm text-white hover:bg-tertiary cursor-pointer"
        role="menuitem"
        data-testid="profile-action-rename"
      >
        {t(I18nKey.BUTTON$RENAME)}
      </button>
      <button
        type="button"
        onClick={() => handleAction(onDelete)}
        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-tertiary cursor-pointer"
        role="menuitem"
        data-testid="profile-action-delete"
      >
        {t(I18nKey.BUTTON$DELETE)}
      </button>
    </div>
  );
}
