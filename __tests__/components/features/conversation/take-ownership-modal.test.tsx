import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "test-utils";
import { TakeOwnershipModal } from "#/components/features/conversation/take-ownership-modal";

describe("TakeOwnershipModal", () => {
  it("renders the explanatory body and both action buttons", () => {
    renderWithProviders(
      <TakeOwnershipModal onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    // The title and body are translation keys in the test harness; the
    // important part is that *both* are present so the user can see them.
    expect(
      screen.getByText("MODAL$TAKE_OWNERSHIP_TITLE"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("MODAL$TAKE_OWNERSHIP_BODY"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("take-ownership-confirm-button"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("take-ownership-cancel-button"),
    ).toBeInTheDocument();
  });

  it("invokes onConfirm when the Take ownership button is clicked", () => {
    const onConfirm = vi.fn();
    renderWithProviders(
      <TakeOwnershipModal onConfirm={onConfirm} onCancel={vi.fn()} />,
    );

    fireEvent.click(screen.getByTestId("take-ownership-confirm-button"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("invokes onCancel when the Cancel button is clicked", () => {
    const onCancel = vi.fn();
    renderWithProviders(
      <TakeOwnershipModal onConfirm={vi.fn()} onCancel={onCancel} />,
    );

    fireEvent.click(screen.getByTestId("take-ownership-cancel-button"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
