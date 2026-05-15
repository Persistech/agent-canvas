import React from "react";
import { fireEvent, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "test-utils";

const useActiveConversationMock = vi.fn();
const useLlmProfilesMock = vi.fn();

vi.mock("#/hooks/query/use-active-conversation", () => ({
  useActiveConversation: () => useActiveConversationMock(),
}));

vi.mock("#/hooks/query/use-llm-profiles", () => ({
  useLlmProfiles: () => useLlmProfilesMock(),
}));

// eslint-disable-next-line import/first
import { ChatInputModel } from "#/components/features/chat/components/chat-input-model";

describe("ChatInputModel", () => {
  beforeEach(() => {
    useActiveConversationMock.mockReset();
    useLlmProfilesMock.mockReset();
    // Default: no profiles loaded
    useLlmProfilesMock.mockReturnValue({ data: undefined });
  });

  it("derives label from model name when no profiles exist", () => {
    useActiveConversationMock.mockReturnValue({
      data: {
        conversation_id: "test-conversation-id",
        llm_model: "openai/gpt-4o",
      },
    });

    renderWithProviders(<ChatInputModel />);

    const model = screen.getByTestId("chat-input-llm-model");
    expect(model).toBeInTheDocument();
    expect(model).toHaveTextContent("gpt-4o");
    expect(model).toHaveAttribute("title", "openai/gpt-4o");
    expect(screen.queryByTestId("chat-input-llm-model-popover")).not.toBeInTheDocument();

    fireEvent.click(model);
    const popover = screen.getByTestId("chat-input-llm-model-popover");
    expect(popover).toHaveTextContent("openai/gpt-4o");
    const llmSettingsLink = screen.getByRole("link", {
      name: /LLM Settings|SETTINGS\$LLM_SETTINGS/,
    });
    expect(llmSettingsLink).toHaveAttribute("href", "/settings");
  });

  it("shows profile name when a matching profile exists", () => {
    useActiveConversationMock.mockReturnValue({
      data: {
        conversation_id: "test-conversation-id",
        llm_model: "litellm_proxy/claude-opus-4-6",
      },
    });
    useLlmProfilesMock.mockReturnValue({
      data: {
        profiles: [
          { name: "my-opus", model: "litellm_proxy/claude-opus-4-6", base_url: null, api_key_set: true },
        ],
        active_profile: "my-opus",
      },
    });

    renderWithProviders(<ChatInputModel />);

    const model = screen.getByTestId("chat-input-llm-model");
    expect(model).toHaveTextContent("my-opus");
    expect(model).toHaveAttribute("title", "litellm_proxy/claude-opus-4-6");
  });

  it("prefers the active profile when multiple profiles match", () => {
    useActiveConversationMock.mockReturnValue({
      data: {
        conversation_id: "test-conversation-id",
        llm_model: "openai/gpt-4o",
      },
    });
    useLlmProfilesMock.mockReturnValue({
      data: {
        profiles: [
          { name: "other-gpt4", model: "openai/gpt-4o", base_url: null, api_key_set: true },
          { name: "main-gpt4", model: "openai/gpt-4o", base_url: null, api_key_set: true },
        ],
        active_profile: "main-gpt4",
      },
    });

    renderWithProviders(<ChatInputModel />);

    const model = screen.getByTestId("chat-input-llm-model");
    expect(model).toHaveTextContent("main-gpt4");
  });

  it("renders nothing when llm_model is missing", () => {
    useActiveConversationMock.mockReturnValue({
      data: { conversation_id: "test-conversation-id" },
    });

    renderWithProviders(<ChatInputModel />);

    expect(
      screen.queryByTestId("chat-input-llm-model"),
    ).not.toBeInTheDocument();
  });

  it("renders nothing when there is no active conversation", () => {
    useActiveConversationMock.mockReturnValue({ data: undefined });

    renderWithProviders(<ChatInputModel />);

    expect(
      screen.queryByTestId("chat-input-llm-model"),
    ).not.toBeInTheDocument();
  });
});
