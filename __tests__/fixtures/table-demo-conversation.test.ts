import { describe, expect, it } from "vitest";
import {
  TABLE_DEMO_CONVERSATION_ID,
  TABLE_DEMO_EVENTS,
  getTableDemoHistoryPage,
  isTableDemoConversationId,
} from "#/fixtures/table-demo-conversation";

describe("table demo conversation fixture", () => {
  it("identifies the demo conversation id", () => {
    expect(isTableDemoConversationId(TABLE_DEMO_CONVERSATION_ID)).toBe(true);
    expect(isTableDemoConversationId("other")).toBe(false);
  });

  it("seeds a user message and an agent reply with a wide markdown table", () => {
    const history = getTableDemoHistoryPage();

    expect(history.hasMore).toBe(false);
    expect(history.events).toHaveLength(2);
    expect(history.events[0]?.source).toBe("user");
    expect(history.events[1]?.source).toBe("agent");

    const agentText =
      "llm_message" in history.events[1]!
        ? history.events[1].llm_message.content[0]
        : null;
    expect(agentText).toMatchObject({ type: "text" });
    if (agentText && "text" in agentText) {
      expect(agentText.text).toContain("| Feature | OpenHands |");
      expect(agentText.text).toContain("| Continue |");
    }

    expect(TABLE_DEMO_EVENTS).toEqual(history.events);
  });
});
