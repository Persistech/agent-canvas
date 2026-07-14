import { create } from "zustand";

/**
 * Drives the "conversation limit reached" modal. Opened when a cloud backend
 * rejects conversation creation for exceeding the user's concurrent-conversation
 * limit (see `isConcurrencyLimitError`). `limit` is the cap reported by the
 * backend, shown in the modal copy.
 */
interface ConversationLimitState {
  isOpen: boolean;
  limit: number | null;
}

interface ConversationLimitActions {
  showLimitModal: (limit: number) => void;
  closeLimitModal: () => void;
}

type ConversationLimitStore = ConversationLimitState & ConversationLimitActions;

const initialState: ConversationLimitState = {
  isOpen: false,
  limit: null,
};

export const useConversationLimitStore = create<ConversationLimitStore>(
  (set) => ({
    ...initialState,

    showLimitModal: (limit: number) => set(() => ({ isOpen: true, limit })),

    closeLimitModal: () => set(() => ({ ...initialState })),
  }),
);
