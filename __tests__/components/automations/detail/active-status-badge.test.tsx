import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ActiveStatusBadge } from "#/components/features/automations/detail/active-status-badge";
import { I18nKey } from "#/i18n/declaration";

describe("ActiveStatusBadge", () => {
  it.each([
    [true, I18nKey.AUTOMATIONS$DETAIL$ACTIVE],
    [false, I18nKey.AUTOMATIONS$DETAIL$INACTIVE],
  ])("renders the matching label when active=%s", (active, labelKey) => {
    render(<ActiveStatusBadge active={active} />);

    expect(screen.getByText(labelKey)).toBeInTheDocument();
  });
});
