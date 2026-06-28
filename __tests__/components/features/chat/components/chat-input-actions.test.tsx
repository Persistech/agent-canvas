import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "test-utils";
import { ActiveBackendProvider } from "#/contexts/active-backend-context";
import { contributionRegistry } from "#/extensions/contribution-registry";
import { MENU_SLOTS } from "#/extensions/menu-slots";
import type { MenuItem } from "#/extensions/types";
import {
  __resetActiveStoreForTests,
  setActiveSelection,
  setRegisteredBackends,
} from "#/api/backend-registry/active-store";
import type { Backend } from "#/api/backend-registry/types";

const useActiveConversationMock = vi.fn<
  () => {
    data:
      | {
          conversation_id: string;
          agent_kind?: "openhands" | "acp";
          llm_model: string | null;
        }
      | undefined;
  }
>(() => ({ data: undefined }));

vi.mock("#/components/features/controls/agent-status", () => ({
  AgentStatus: () => <div data-testid="agent-status-stub" />,
}));

vi.mock("#/components/features/chat/change-agent-button", () => ({
  ChangeAgentButton: () => <div data-testid="change-agent-button-stub" />,
}));

vi.mock(
  "#/components/features/chat/components/chat-input-profile-picker",
  () => ({
    ChatInputProfilePicker: () => (
      <div data-testid="agent-profile-picker-stub" />
    ),
    ChatInputProfileMenuContent: () => (
      <div data-testid="agent-profile-menu-stub" />
    ),
  }),
);

vi.mock(
  "#/components/features/chat/components/chat-input-llm-profile-picker",
  () => ({
    ChatInputLlmProfilePicker: () => (
      <div data-testid="llm-profile-picker-stub" />
    ),
    ChatInputLlmProfileMenuContent: () => (
      <div data-testid="llm-profile-menu-stub" />
    ),
  }),
);

vi.mock("#/hooks/query/use-active-conversation", () => ({
  useActiveConversation: () => useActiveConversationMock(),
}));

vi.mock("#/hooks/mutation/conversation-mutation-utils", () => ({
  pauseConversation: vi.fn(),
  resumeConversation: vi.fn(),
  askAgent: vi.fn(),
  updateConversationExecutionStatusInCache: vi.fn(),
  invalidateConversationQueries: vi.fn(),
}));

// eslint-disable-next-line import/first
import { ChatInputActions } from "#/components/features/chat/components/chat-input-actions";

const cloudBackend: Backend = {
  id: "prod",
  name: "Production",
  host: "https://app.all-hands.dev",
  apiKey: "bearer-token",
  kind: "cloud",
};

describe("ChatInputActions", () => {
  afterEach(() => {
    window.localStorage.clear();
    __resetActiveStoreForTests();
    useActiveConversationMock.mockReset();
    useActiveConversationMock.mockReturnValue({ data: undefined });
  });

  it("renders the AgentProfile picker on the home page (local)", () => {
    useActiveConversationMock.mockReturnValue({ data: undefined });

    renderWithProviders(<ChatInputActions disabled={false} />, {
      navigation: { conversationId: null },
    });

    // Home keeps the start-new/activate AgentProfile picker (#3727).
    expect(screen.getByTestId("agent-profile-picker-stub")).toBeInTheDocument();
    expect(
      screen.queryByTestId("llm-profile-picker-stub"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("chat-input-llm-model"),
    ).not.toBeInTheDocument();
  });

  it("renders the LLM-profile switcher inside a local OpenHands conversation", () => {
    useActiveConversationMock.mockReturnValue({
      data: { conversation_id: "test-conversation-id", llm_model: "gpt-4o" },
    });

    renderWithProviders(<ChatInputActions disabled={false} />, {
      navigation: { conversationId: "test-conversation-id" },
    });

    // In a conversation the user live-switches the LLM profile, not start-new.
    expect(screen.getByTestId("llm-profile-picker-stub")).toBeInTheDocument();
    expect(
      screen.queryByTestId("agent-profile-picker-stub"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("chat-input-llm-model"),
    ).not.toBeInTheDocument();
  });

  it("renders the model switcher inside a local ACP conversation", () => {
    useActiveConversationMock.mockReturnValue({
      data: {
        conversation_id: "test-conversation-id",
        agent_kind: "acp",
        llm_model: "claude-sonnet-4-6",
      },
    });

    renderWithProviders(<ChatInputActions disabled={false} />, {
      navigation: { conversationId: "test-conversation-id" },
    });

    // ACP in a conversation live-switches the running model via ChatInputModel.
    expect(screen.getByTestId("chat-input-llm-model")).toBeInTheDocument();
    expect(
      screen.queryByTestId("agent-profile-picker-stub"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("llm-profile-picker-stub"),
    ).not.toBeInTheDocument();
  });

  it("renders the active conversation model in a cloud ACP conversation", () => {
    setRegisteredBackends([cloudBackend]);
    setActiveSelection({ backendId: cloudBackend.id });
    useActiveConversationMock.mockReturnValue({
      data: {
        conversation_id: "test-conversation-id",
        agent_kind: "acp",
        llm_model: "gpt-4o",
      },
    });

    renderWithProviders(
      <ActiveBackendProvider>
        <ChatInputActions disabled={false} />
      </ActiveBackendProvider>,
    );

    expect(screen.getByTestId("chat-input-llm-model")).toHaveTextContent(
      "gpt-4o",
    );
    expect(
      screen.queryByTestId("agent-profile-picker-stub"),
    ).not.toBeInTheDocument();
  });

  it("omits the model label on cloud when the active ACP conversation has no llm_model", () => {
    setRegisteredBackends([cloudBackend]);
    setActiveSelection({ backendId: cloudBackend.id });
    useActiveConversationMock.mockReturnValue({
      data: {
        conversation_id: "test-conversation-id",
        agent_kind: "acp",
        llm_model: null,
      },
    });

    renderWithProviders(
      <ActiveBackendProvider>
        <ChatInputActions disabled={false} />
      </ActiveBackendProvider>,
    );

    expect(
      screen.queryByTestId("chat-input-llm-model"),
    ).not.toBeInTheDocument();
  });

  it("renders the LLM-profile switcher inside a cloud OpenHands conversation", () => {
    // /switch_profile is a real endpoint on both backends (cloud proxies
    // POST /api/v1/app-conversations/{id}/switch_profile) — cloud OpenHands
    // conversations get the same live-switch picker as local (#1571 review).
    setRegisteredBackends([cloudBackend]);
    setActiveSelection({ backendId: cloudBackend.id });
    useActiveConversationMock.mockReturnValue({
      data: { conversation_id: "test-conversation-id", llm_model: "gpt-4o" },
    });

    renderWithProviders(
      <ActiveBackendProvider>
        <ChatInputActions disabled={false} />
      </ActiveBackendProvider>,
    );

    expect(screen.getByTestId("llm-profile-picker-stub")).toBeInTheDocument();
    expect(
      screen.queryByTestId("agent-profile-picker-stub"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("chat-input-llm-model"),
    ).not.toBeInTheDocument();
  });

  it("hides the Change Agent button on a local backend", () => {
    renderWithProviders(<ChatInputActions disabled={false} />);

    expect(
      screen.queryByTestId("change-agent-button-stub"),
    ).not.toBeInTheDocument();
  });

  it("shows the Change Agent button on a cloud backend", () => {
    setRegisteredBackends([cloudBackend]);
    setActiveSelection({ backendId: cloudBackend.id });

    renderWithProviders(
      <ActiveBackendProvider>
        <ChatInputActions disabled={false} />
      </ActiveBackendProvider>,
    );

    expect(screen.getByTestId("change-agent-button-stub")).toBeInTheDocument();
  });

  it("shows the Change Agent button on the home page on a cloud backend", () => {
    setRegisteredBackends([cloudBackend]);
    setActiveSelection({ backendId: cloudBackend.id });

    renderWithProviders(
      <ActiveBackendProvider>
        <ChatInputActions disabled={false} />
      </ActiveBackendProvider>,
      { navigation: { conversationId: null } },
    );

    expect(screen.getByTestId("change-agent-button-stub")).toBeInTheDocument();
  });

  describe("extension menu items (chatInput/actions slot)", () => {
    afterEach(() => contributionRegistry.clear());

    function registerItem(overrides: Partial<MenuItem> = {}): MenuItem {
      const item: MenuItem = {
        extensionId: "acme.hello",
        menu: MENU_SLOTS.chatInputActions,
        command: "hello.say",
        title: "Hello: Say hi",
        run: vi.fn(),
        ...overrides,
      };
      contributionRegistry.register(item.extensionId, { menus: [item] });
      return item;
    }

    it("surfaces a contributed item via the overflow menu", async () => {
      const user = userEvent.setup();
      registerItem();

      renderWithProviders(<ChatInputActions disabled={false} />);

      // A contributed item makes the overflow trigger appear even when the
      // toolbar otherwise fits inline.
      const trigger = screen.getByLabelText(
        "CHAT_INTERFACE$MORE_INPUT_ACTIONS",
      );
      await user.click(trigger);

      expect(
        screen.getByTestId("extension-menu-item-acme.hello-hello.say"),
      ).toBeInTheDocument();
    });

    it("does not surface an item whose when clause fails the UI-context", () => {
      // No ExtensionUiContextProvider here, so `backend` is unknown and a
      // `backend == cloud` clause is false — the item is filtered out and never
      // reaches the DOM, so the overflow trigger isn't forced open.
      registerItem({ when: "backend == cloud" });

      renderWithProviders(<ChatInputActions disabled={false} />);

      expect(
        screen.queryByLabelText("CHAT_INTERFACE$MORE_INPUT_ACTIONS"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("extension-menu-item-acme.hello-hello.say"),
      ).not.toBeInTheDocument();
    });
  });
});
