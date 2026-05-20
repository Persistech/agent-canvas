import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConversationClient } from "@openhands/typescript-client/clients";
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { AxiosError, AxiosHeaders } from "axios";
import toast from "react-hot-toast";
import AgentServerConversationService from "#/api/conversation-service/agent-server-conversation-service.api";
import { useUnifiedResumeConversation } from "#/hooks/mutation/use-unified-start-conversation";
import { ExecutionStatus } from "#/types/agent-server/core";

const { runConversationMock } = vi.hoisted(() => ({
  runConversationMock: vi.fn(),
}));

vi.mock("@openhands/typescript-client/clients", () => ({
  ConversationClient: vi.fn(function ConversationClientMock() {
    return { runConversation: runConversationMock };
  }),
}));

const stubAppConversation = {
  id: "conv-1",
  created_by_user_id: null,
  conversation_url: "http://localhost:3000",
  session_api_key: "test-key",
  sandbox_id: null,
  selected_repository: null,
  selected_branch: null,
  git_provider: null,
  title: "Test",
  public: false,
  execution_status: null,
  trigger: null,
  pr_number: [],
  llm_model: null,
  metrics: null,
  sub_conversation_ids: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("useUnifiedResumeConversation", () => {
  let queryClient: QueryClient;
  let successSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let loadingSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.restoreAllMocks();
    runConversationMock.mockReset().mockResolvedValue({ success: true });
    vi.mocked(ConversationClient).mockClear();
    vi.spyOn(
      AgentServerConversationService,
      "batchGetAppConversations",
    ).mockResolvedValue([stubAppConversation]);
    successSpy = vi.spyOn(toast, "success").mockImplementation(() => "1");
    errorSpy = vi.spyOn(toast, "error").mockImplementation(() => "1");
    loadingSpy = vi.spyOn(toast, "loading").mockImplementation(() => "1");
    vi.spyOn(toast, "dismiss").mockImplementation(() => {});
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("shows a loading toast, success toast, and patches execution_status on success", async () => {
    // Seed the conversation cache so we can verify the post-resume patch.
    queryClient.setQueryData(["user", "conversation", "conv-1", "", null], {
      ...stubAppConversation,
      execution_status: ExecutionStatus.PAUSED,
    });

    const { result } = renderHook(() => useUnifiedResumeConversation(), {
      wrapper,
    });

    result.current.mutate({ conversationId: "conv-1" });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(loadingSpy).toHaveBeenCalled();
    expect(successSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    // The optimistic cache patch flips execution_status to RUNNING.
    const cached = queryClient.getQueryData<{
      execution_status: ExecutionStatus;
    }>(["user", "conversation", "conv-1", "", null]);
    expect(cached?.execution_status).toBe(ExecutionStatus.RUNNING);
  });

  it("surfaces a generic error toast for unknown failures", async () => {
    runConversationMock.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() => useUnifiedResumeConversation(), {
      wrapper,
    });

    result.current.mutate({ conversationId: "conv-1" });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(errorSpy).toHaveBeenCalled();
    expect(successSpy).not.toHaveBeenCalled();
  });

  it("suppresses the generic toast when the error is a 409 lease conflict", async () => {
    const axiosError = new AxiosError(
      "Conversation already running. Wait for completion or pause first.",
      "ERR_BAD_REQUEST",
      undefined,
      undefined,
      {
        status: 409,
        statusText: "Conflict",
        headers: new AxiosHeaders(),
        config: { headers: new AxiosHeaders() },
        data: {
          message: "Conversation already running. Wait for completion or pause first.",
        },
      },
    );
    runConversationMock.mockRejectedValueOnce(axiosError);

    const onError = vi.fn();
    const { result } = renderHook(() => useUnifiedResumeConversation(), {
      wrapper,
    });

    result.current.mutate({ conversationId: "conv-1" }, { onError });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Generic toast is NOT shown — the caller is expected to render the
    // take-ownership modal via its own onError callback.
    expect(errorSpy).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
  });

  it("suppresses the generic toast when the error message indicates session/load failure", async () => {
    runConversationMock.mockRejectedValueOnce(
      new Error("acp_session_load_failed: upstream session JSONL is missing"),
    );

    const onError = vi.fn();
    const { result } = renderHook(() => useUnifiedResumeConversation(), {
      wrapper,
    });

    result.current.mutate({ conversationId: "conv-1" }, { onError });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(errorSpy).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
  });
});
