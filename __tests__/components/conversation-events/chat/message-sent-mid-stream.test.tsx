import { describe, expect, it } from "vitest";
import { renderWithProviders } from "test-utils";
import { MessageEvent, OpenHandsEvent } from "#/types/agent-server/core";
import { StreamingDeltaEvent } from "#/types/agent-server/core/events/streaming-delta-event";
import { handleEventForUI } from "#/utils/handle-event-for-ui";
import { Messages } from "#/components/conversation-events/chat/messages";
import { shouldRenderEvent } from "#/components/conversation-events/chat/event-content-helpers/should-render-event";

// Regression for issue #1899. A message sent while the agent is streaming used
// to land on top of the live delta, so the next delta could not merge and
// started a second bubble — splitting the reply around the message. This test
// drives the real reducer (handleEventForUI) and renders the real <Messages>
// tree to assert the reply renders as one bubble, above the message.

const FIRST_HALF = "I am done with the refactor, and ";
const SECOND_HALF = "I also fixed the failing test.";
const REPLY = `${FIRST_HALF}${SECOND_HALF}`;

const countOccurrences = (haystack: string, needle: string): number =>
  haystack.split(needle).length - 1;

const openingMessage: MessageEvent = {
  id: "user-1",
  timestamp: "2026-06-12T12:00:00Z",
  source: "user",
  llm_message: {
    role: "user",
    content: [{ type: "text", text: "Refactor the parser." }],
  },
  activated_microagents: [],
  extended_content: [],
};

const makeDelta = (id: string, content: string): StreamingDeltaEvent => ({
  id,
  kind: "StreamingDeltaEvent",
  timestamp: "2026-06-12T12:00:01Z",
  source: "agent",
  content,
  reasoning_content: null,
});

// Sent while the agent was still streaming, so it arrives between two deltas.
const midStreamMessage: MessageEvent = {
  id: "user-2",
  timestamp: "2026-06-12T12:00:02Z",
  source: "user",
  llm_message: {
    role: "user",
    content: [{ type: "text", text: "also update the README" }],
  },
  activated_microagents: [],
  extended_content: [],
};

const finalMessage: MessageEvent = {
  id: "agent-1",
  timestamp: "2026-06-12T12:00:03Z",
  source: "agent",
  llm_message: { role: "assistant", content: [{ type: "text", text: REPLY }] },
  activated_microagents: [],
  extended_content: [],
};

const reduce = (events: OpenHandsEvent[]): OpenHandsEvent[] =>
  events.reduce<OpenHandsEvent[]>((ui, ev) => handleEventForUI(ev, ui), []);

// Mirrors the real pipeline in `use-filtered-events.ts`: the reducer's output is
// passed through `shouldRenderEvent` before it reaches <Messages>, which is what
// drops non-visual events like conversation-state snapshots.
const render = (allEvents: OpenHandsEvent[]) =>
  renderWithProviders(
    <Messages
      messages={reduce(allEvents).filter(shouldRenderEvent)}
      allEvents={allEvents}
    />,
  );

// The agent-server publishes a state snapshot right after it accepts the
// mid-stream message. Captured live: delta -> user MessageEvent -> this ->
// delta, ~13ms apart, with the agent still RUNNING. It sits between the two
// halves, so the reducer must see past it too.
const runningStateSnapshot = {
  id: "state-running",
  timestamp: "2026-06-12T12:00:02.5Z",
  source: "environment",
  kind: "ConversationStateUpdateEvent",
  key: "full_state",
  value: { execution_status: "running" },
} as unknown as OpenHandsEvent;

describe("issue #1899 — message sent mid-stream splits the reply", () => {
  const streaming = [
    openingMessage,
    makeDelta("delta-1", FIRST_HALF),
    midStreamMessage,
    runningStateSnapshot,
    makeDelta("delta-2", SECOND_HALF),
  ];

  it("renders the streamed reply as one bubble, not two", () => {
    const { container } = render(streaming);
    const text = container.textContent ?? "";

    // The whole reply is contiguous — the message no longer sits inside it.
    expect(countOccurrences(text, REPLY)).toBe(1);
    expect(text.indexOf(REPLY)).toBeLessThan(text.indexOf("also update"));
  });

  it("renders the reply exactly once when the final message arrives", () => {
    const { container } = render([...streaming, finalMessage]);
    const text = container.textContent ?? "";

    // The canonical final message supersedes both streamed halves; neither is
    // left orphaned above the message, so the text is not duplicated.
    expect(countOccurrences(text, REPLY)).toBe(1);
    expect(countOccurrences(text, SECOND_HALF)).toBe(1);
    // ...and it stays above the message rather than jumping below it.
    expect(text.indexOf(REPLY)).toBeLessThan(text.indexOf("also update"));
  });
});
