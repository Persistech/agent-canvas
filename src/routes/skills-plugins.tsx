import { useTranslation } from "react-i18next";
import { I18nKey } from "#/i18n/declaration";

// Rendered inside the Agents hub (#1456); the hub supplies the nav + scroll
// container, and this page owns its own title.
export const handle = { hideTitle: true };

export default function SkillsPluginsScreen() {
  const { t } = useTranslation("openhands");

  return (
    <div data-testid="skills-plugins-screen" className="min-w-0">
      <div className="mb-4 min-w-0 space-y-1">
        <h2 className="text-xl font-medium leading-6 text-foreground">
          {t(I18nKey.SETTINGS$PLUGINS_TITLE)}
        </h2>
        <div className="max-w-2xl text-sm text-tertiary-light">
          {t(I18nKey.SETTINGS$PLUGINS_DESCRIPTION)}
        </div>
      </div>
    </div>
  );
}
