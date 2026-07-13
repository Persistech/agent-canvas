import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CommandMenu,
  CommandMenuTrigger,
} from "#/components/features/command-menu";
import { COMMAND_MENU_ROUTE } from "#/components/features/command-menu/command-menu-items";
import { useCommandMenuStore } from "#/stores/command-menu-store";
import { useSidebarStore } from "#/stores/sidebar-store";
import { renderWithProviders } from "../../../../test-utils";

const OPEN_LABEL_KEY = "COMMAND_MENU$OPEN_LABEL";
const SEARCH_LABEL_KEY = "COMMAND_MENU$SEARCH_LABEL";
const CLEAR_SEARCH_LABEL_KEY = "COMMAND_MENU$CLEAR_SEARCH_LABEL";
const NO_RESULTS_TITLE_KEY = "COMMAND_MENU$NO_RESULTS_TITLE";
const AUTOMATIONS_TITLE_KEY = "COMMAND_MENU$AUTOMATIONS_TITLE";
const NEW_CHAT_TITLE_KEY = "COMMAND_MENU$NEW_CHAT_TITLE";
const SECRETS_TITLE_KEY = "COMMAND_MENU$SECRETS_SETTINGS_TITLE";
const TOGGLE_SIDEBAR_TITLE_KEY = "COMMAND_MENU$TOGGLE_SIDEBAR_TITLE";

const navigateMock = vi.fn();

function renderCommandMenu(navigate = navigateMock) {
  const view = renderWithProviders(<CommandMenu />, {
    navigation: { navigate },
  });

  return { ...view, navigate };
}

beforeEach(() => {
  navigateMock.mockReset();
  window.localStorage.clear();
  useCommandMenuStore.setState({ isOpen: false });
  useSidebarStore.setState({ collapsed: false });
});

describe("CommandMenu", () => {
  it("opens from the global command-k shortcut and closes with escape", async () => {
    renderCommandMenu();

    fireEvent.keyDown(window, { key: "k", metaKey: true });

    const searchInput = await screen.findByRole("combobox", {
      name: SEARCH_LABEL_KEY,
    });
    await waitFor(() => expect(searchInput).toHaveFocus());
    expect(screen.getByTestId("command-menu")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByTestId("command-menu")).not.toBeInTheDocument();
    });
  });

  it("opens from the global ctrl-k shortcut", async () => {
    renderCommandMenu();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    const searchInput = await screen.findByRole("combobox", {
      name: SEARCH_LABEL_KEY,
    });
    await waitFor(() => expect(searchInput).toHaveFocus());
  });

  it("filters commands by page and setting keywords", async () => {
    useCommandMenuStore.getState().open();
    renderCommandMenu();

    await userEvent.type(
      screen.getByRole("combobox", { name: SEARCH_LABEL_KEY }),
      "secrets",
    );

    expect(screen.getByText(SECRETS_TITLE_KEY)).toBeInTheDocument();
    expect(screen.queryByText(NEW_CHAT_TITLE_KEY)).not.toBeInTheDocument();
  });

  it("navigates to the selected command and closes the menu", async () => {
    useCommandMenuStore.getState().open();
    const { navigate } = renderCommandMenu();

    await userEvent.click(screen.getByText(AUTOMATIONS_TITLE_KEY));

    expect(navigate).toHaveBeenCalledWith(COMMAND_MENU_ROUTE.automations);
    await waitFor(() => {
      expect(screen.queryByTestId("command-menu")).not.toBeInTheDocument();
    });
  });

  it("supports arrow-key navigation and enter selection", async () => {
    useCommandMenuStore.getState().open();
    const { navigate } = renderCommandMenu();
    const searchInput = screen.getByRole("combobox", {
      name: SEARCH_LABEL_KEY,
    });

    await userEvent.type(searchInput, "settings");
    await userEvent.keyboard("{ArrowDown}{ArrowUp}{Enter}");

    expect(navigate).toHaveBeenCalledWith(COMMAND_MENU_ROUTE.settings);
    await waitFor(() => {
      expect(screen.queryByTestId("command-menu")).not.toBeInTheDocument();
    });
  });

  it("runs local actions from the menu", async () => {
    useCommandMenuStore.getState().open();
    renderCommandMenu();

    await userEvent.type(
      screen.getByRole("combobox", { name: SEARCH_LABEL_KEY }),
      "toggle",
    );
    await userEvent.click(screen.getByText(TOGGLE_SIDEBAR_TITLE_KEY));

    expect(useSidebarStore.getState().collapsed).toBe(true);
  });

  it("shows an empty state and ignores selection keys when nothing matches", async () => {
    const user = userEvent.setup();
    useCommandMenuStore.getState().open();
    const { navigate } = renderCommandMenu();
    const searchInput = screen.getByRole("combobox", {
      name: SEARCH_LABEL_KEY,
    });

    await user.type(searchInput, "no matching command");

    expect(screen.getByText(NO_RESULTS_TITLE_KEY)).toBeInTheDocument();
    expect(searchInput).not.toHaveAttribute("aria-activedescendant");

    await user.keyboard("{ArrowDown}{ArrowUp}{Enter}");

    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByTestId("command-menu")).toBeInTheDocument();
  });

  it("scrolls the newly active option into view", () => {
    useCommandMenuStore.getState().open();
    renderCommandMenu();
    const searchInput = screen.getByRole("combobox", {
      name: SEARCH_LABEL_KEY,
    });
    const options = screen.getAllByRole("option");
    const nextOption = options[1];
    const scrollIntoView = vi.fn();
    Object.defineProperty(nextOption, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    fireEvent.keyDown(searchInput, { key: "ArrowDown" });

    expect(nextOption).toHaveAttribute("aria-selected", "true");
    expect(searchInput).toHaveAttribute("aria-activedescendant", nextOption.id);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("clears the search and restores the full command list", async () => {
    const user = userEvent.setup();
    useCommandMenuStore.getState().open();
    renderCommandMenu();
    const searchInput = screen.getByRole("combobox", {
      name: SEARCH_LABEL_KEY,
    });

    await user.type(searchInput, "secrets");
    expect(screen.queryByText(NEW_CHAT_TITLE_KEY)).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: CLEAR_SEARCH_LABEL_KEY }),
    );

    expect(searchInput).toHaveValue("");
    expect(searchInput).toHaveFocus();
    expect(screen.getByText(NEW_CHAT_TITLE_KEY)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: CLEAR_SEARCH_LABEL_KEY }),
    ).not.toBeInTheDocument();
  });

  it("leaves modified command links to native browser behavior", () => {
    useCommandMenuStore.getState().open();
    const { navigate } = renderCommandMenu();
    const commandLink = screen.getByText(NEW_CHAT_TITLE_KEY).closest("a");
    expect(commandLink).not.toBeNull();
    commandLink?.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    });

    fireEvent.click(commandLink as HTMLAnchorElement, { metaKey: true });

    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByTestId("command-menu")).toBeInTheDocument();
  });
});

describe("CommandMenuTrigger", () => {
  it("opens the command menu from the sidebar trigger", async () => {
    renderWithProviders(
      <>
        <CommandMenuTrigger collapsed={false} />
        <CommandMenu />
      </>,
    );

    await userEvent.click(screen.getByRole("button", { name: OPEN_LABEL_KEY }));

    expect(
      await screen.findByRole("combobox", { name: SEARCH_LABEL_KEY }),
    ).toBeInTheDocument();
  });
});
