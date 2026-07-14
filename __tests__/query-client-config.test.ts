import { AxiosError } from "axios";
import { MutationObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAgentServerQueryClient } from "#/query-client-config";
import { __resetActiveStoreForTests } from "#/api/backend-registry/active-store";
import * as ToastHandlers from "#/utils/custom-toast-handlers";
import { useConversationLimitStore } from "#/stores/conversation-limit-store";

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  __resetActiveStoreForTests();
  vi.restoreAllMocks();
});

describe("createAgentServerQueryClient", () => {
  it("does not show a toast when query meta disables toasts", async () => {
    const toastSpy = vi.spyOn(ToastHandlers, "displayErrorToast");
    const client = createAgentServerQueryClient();

    await expect(
      client.fetchQuery({
        queryKey: ["config", "suppressed"],
        queryFn: async () => {
          throw new AxiosError("suppressed query error");
        },
        meta: { disableToast: true },
        retry: false,
      }),
    ).rejects.toThrow("suppressed query error");

    expect(toastSpy).not.toHaveBeenCalled();
  });

  it("shows a toast when query meta does not disable toasts", async () => {
    const toastSpy = vi.spyOn(ToastHandlers, "displayErrorToast");
    const client = createAgentServerQueryClient();

    await expect(
      client.fetchQuery({
        queryKey: ["config", "toast"],
        queryFn: async () => {
          throw new AxiosError("query error with toast");
        },
        retry: false,
      }),
    ).rejects.toThrow("query error with toast");

    expect(toastSpy).toHaveBeenCalledWith("query error with toast");
  });

  it("does not show raw 401 toasts while the active cloud backend is logged out", async () => {
    const toastSpy = vi.spyOn(ToastHandlers, "displayErrorToast");
    const backend = {
      id: "cloud-expired",
      name: "OpenHands Cloud",
      host: "https://app.all-hands.dev",
      apiKey: "expired-token",
      kind: "cloud",
    };
    window.localStorage.setItem(
      "openhands-backends",
      JSON.stringify([backend]),
    );
    window.localStorage.setItem(
      "openhands-active-backend",
      JSON.stringify({ backendId: backend.id, orgId: null }),
    );
    window.sessionStorage.setItem(
      "openhands-active-backend",
      JSON.stringify({ backendId: backend.id, orgId: null }),
    );
    __resetActiveStoreForTests();
    const client = createAgentServerQueryClient();

    await expect(
      client.fetchQuery({
        queryKey: ["cloud", "logged-out"],
        queryFn: async () => {
          throw new AxiosError(
            "Request failed with status code 401",
            "ERR_BAD_REQUEST",
            undefined,
            undefined,
            { status: 401 } as never,
          );
        },
        retry: false,
      }),
    ).rejects.toThrow("Request failed with status code 401");

    expect(toastSpy).not.toHaveBeenCalled();
  });

  it("opens the conversation-limit modal instead of toasting on a cloud limit error", async () => {
    const toastSpy = vi.spyOn(ToastHandlers, "displayErrorToast");
    const client = createAgentServerQueryClient();
    const limitError = new AxiosError(
      "Request failed with status code 429",
      "ERR_BAD_REQUEST",
      undefined,
      undefined,
      {
        status: 429,
        data: {
          detail: {
            error: "CONCURRENCY_LIMIT_REACHED",
            message:
              "You have reached your limit of 3 concurrent conversations.",
            limit: 3,
            current: 3,
          },
        },
      } as never,
    );

    const observer = new MutationObserver(client, {
      mutationFn: async () => {
        throw limitError;
      },
    });
    await observer.mutate().catch(() => {});

    expect(useConversationLimitStore.getState()).toMatchObject({
      isOpen: true,
      limit: 3,
    });
    expect(toastSpy).not.toHaveBeenCalled();
  });
});
