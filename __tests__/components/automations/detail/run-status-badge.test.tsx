import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RunStatusBadge } from "#/components/features/automations/detail/run-status-badge";
import { AutomationRunStatus } from "#/types/automation";
import { I18nKey } from "#/i18n/declaration";

describe("RunStatusBadge", () => {
  it.each([
    [AutomationRunStatus.COMPLETED, I18nKey.AUTOMATIONS$DETAIL$SUCCESSFUL],
    [AutomationRunStatus.FAILED, I18nKey.AUTOMATIONS$DETAIL$FAILED],
    [AutomationRunStatus.PENDING, I18nKey.AUTOMATIONS$DETAIL$PENDING],
    [AutomationRunStatus.RUNNING, I18nKey.AUTOMATIONS$DETAIL$RUNNING],
  ])("renders the %s label for the matching status", (status, labelKey) => {
    render(<RunStatusBadge status={status} />);

    expect(screen.getByText(labelKey)).toBeInTheDocument();
  });
});
