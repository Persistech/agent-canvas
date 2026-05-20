import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "test-utils";
import { SessionLoadFailedBanner } from "#/components/features/conversation/session-load-failed-banner";

describe("SessionLoadFailedBanner", () => {
  it("renders the warning copy", () => {
    renderWithProviders(<SessionLoadFailedBanner onDismiss={vi.fn()} />);

    expect(
      screen.getByTestId("session-load-failed-banner"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("BANNER$SESSION_LOAD_FAILED"),
    ).toBeInTheDocument();
  });

  it("calls onDismiss when the close button is clicked", () => {
    const onDismiss = vi.fn();
    renderWithProviders(<SessionLoadFailedBanner onDismiss={onDismiss} />);

    fireEvent.click(
      screen.getByTestId("session-load-failed-banner-dismiss"),
    );

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
