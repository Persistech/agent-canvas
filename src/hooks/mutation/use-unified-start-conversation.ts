import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Provider } from "#/types/settings";
import { useErrorMessageStore } from "#/stores/error-message-store";
import { ExecutionStatus } from "#/types/agent-server/core";
import { I18nKey } from "#/i18n/declaration";
import { TOAST_OPTIONS } from "#/utils/custom-toast-handlers";
import { categorizeResumeError, ResumeErrorInfo } from "#/utils/resume-error";
import {
  resumeConversation,
  updateConversationExecutionStatusInCache,
  invalidateConversationQueries,
} from "./conversation-mutation-utils";

/**
 * Resume a paused conversation, with toast UX and optimistic cache
 * patching that mirrors `useUnifiedPauseConversation`.
 *
 * Errors are categorised via `categorizeResumeError`: 409 (lease conflict)
 * and "session/load" failures suppress the generic error toast so the
 * caller can render a dedicated UI surface (take-ownership modal or
 * session-load-failed banner) via the mutation's `onError` callback. All
 * other errors still surface a generic toast.
 */
export const useUnifiedResumeConversation = () => {
  const { t } = useTranslation("openhands");
  const queryClient = useQueryClient();
  const removeErrorMessage = useErrorMessageStore(
    (state) => state.removeErrorMessage,
  );

  return useMutation<
    Awaited<ReturnType<typeof resumeConversation>>,
    Error,
    { conversationId: string; providers?: Provider[] },
    { previousConversations: unknown; toastId: string }
  >({
    mutationKey: ["start-conversation"],
    mutationFn: async (variables) =>
      resumeConversation(variables.conversationId),
    onMutate: async () => {
      const toastId = toast.loading(
        t(I18nKey.TOAST$RESUMING_CONVERSATION),
        TOAST_OPTIONS,
      );

      await queryClient.cancelQueries({ queryKey: ["user", "conversations"] });
      const previousConversations = queryClient.getQueryData([
        "user",
        "conversations",
      ]);

      return { previousConversations, toastId };
    },
    onError: (error, _variables, context) => {
      if (context?.toastId) {
        toast.dismiss(context.toastId);
      }

      // Roll back the optimistic update.
      if (context?.previousConversations) {
        queryClient.setQueryData(
          ["user", "conversations"],
          context.previousConversations,
        );
      }

      // Only surface a generic error toast for unknown errors. Lease and
      // session-load failures have their own UI surfaces (the
      // take-ownership modal and the session-load banner respectively),
      // which the caller wires up by inspecting the categorised error
      // returned via React Query's `.error` (still a real Error) plus
      // its own onError callback.
      const info: ResumeErrorInfo = categorizeResumeError(error);
      if (info.kind === "unknown") {
        toast.error(
          t(I18nKey.TOAST$FAILED_TO_RESUME_CONVERSATION),
          TOAST_OPTIONS,
        );
      }
    },
    onSettled: (_, __, variables) => {
      invalidateConversationQueries(queryClient, variables.conversationId);
    },
    onSuccess: (_, variables, context) => {
      if (context?.toastId) {
        toast.dismiss(context.toastId);
      }
      toast.success(t(I18nKey.TOAST$CONVERSATION_RESUMED), TOAST_OPTIONS);

      removeErrorMessage();

      updateConversationExecutionStatusInCache(
        queryClient,
        variables.conversationId,
        ExecutionStatus.RUNNING,
      );
    },
  });
};
