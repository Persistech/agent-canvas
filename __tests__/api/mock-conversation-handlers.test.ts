import { describe, expect, it, vi } from "vitest";
import AgentServerConversationService from "#/api/conversation-service/agent-server-conversation-service.api";
import AgentServerGitService from "#/api/git-service/agent-server-git-service.api";
import EventService from "#/api/event-service/event-service.api";
import { TABLE_DEMO_CONVERSATION_ID } from "#/fixtures/table-demo-conversation";

const API_BASE = "http://localhost:3000";

const requestJson = async <T>(path: string, init?: RequestInit) => {
  const response = await fetch(`${API_BASE}${path}`, init);
  return {
    body: (await response.json()) as T,
    status: response.status,
  };
};

const cloudProxy = <T>(path?: string) =>
  requestJson<T>("/api/cloud-proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(path === undefined ? {} : { method: "GET", path }),
  });

describe("mock conversation handlers", () => {
  it("returns adapted conversations for batch lookups", async () => {
    const [conversation] =
      await AgentServerConversationService.batchGetAppConversations(["1"]);

    expect(conversation?.id).toBe("1");
    expect(conversation?.title).toBe("My New Project");
    expect(conversation?.conversation_url).toContain("/api/conversations/1");
    expect(conversation?.workspace?.working_dir).toBe("workspace/project");
  });

  it("returns adapted conversation pages for search", async () => {
    const page = await AgentServerConversationService.searchConversations(10);

    expect(page.items.length).toBeGreaterThan(0);
    expect(page.next_page_id).toBeNull();
    expect(page.items[0]?.title).toBeTruthy();
  });

  it("returns pre-seeded git changes for mock conversations", async () => {
    // MOCK_GIT_CHANGES is pre-seeded in git-repository-handlers.ts with three
    // representative entries (UPDATED→M, ADDED→A, DELETED→D) so mock mode
    // exercises the full diff-viewer UI without per-test manipulation.
    const changes = await AgentServerGitService.getGitChanges(
      "1",
      "http://localhost:3000/api/conversations/1",
      null,
      "workspace/project",
    );

    expect(changes).toHaveLength(3);
    expect(changes.map((c) => c.status)).toEqual(["M", "A", "D"]);
    expect(changes.map((c) => c.path)).toEqual([
      "src/components/hello.tsx",
      "src/utils/new-helper.ts",
      "src/old-module.py",
    ]);
  });

  it("returns the table demo conversation via MSW batch lookup", async () => {
    const [conversation] =
      await AgentServerConversationService.batchGetAppConversations([
        TABLE_DEMO_CONVERSATION_ID,
      ]);

    expect(conversation?.id).toBe(TABLE_DEMO_CONVERSATION_ID);
    expect(conversation?.title).toBe("Wide table demo");
  });

  it("returns table demo events sorted for conversation history", async () => {
    const page = await EventService.searchEvents(
      TABLE_DEMO_CONVERSATION_ID,
      null,
      null,
      { limit: 50, sortOrder: "TIMESTAMP_DESC" },
    );

    expect(page.items).toHaveLength(2);
    expect(page.items[0]?.source).toBe("agent");
    expect(page.items[1]?.source).toBe("user");
  });

  it("lists conversations in update order and honors the requested limit", async () => {
    const defaultPage = await requestJson<{
      items: { id: string; updated_at: string }[];
      next_page_id: string | null;
    }>("/api/conversations/search");
    const limitedPage = await requestJson<{
      items: { id: string; updated_at: string }[];
      next_page_id: string | null;
    }>("/api/conversations/search?limit=2");

    expect(defaultPage.status).toBe(200);
    expect(defaultPage.body.items.length).toBeGreaterThan(2);
    expect(defaultPage.body.items.map(({ updated_at }) => updated_at)).toEqual(
      [...defaultPage.body.items]
        .map(({ updated_at }) => updated_at)
        .sort((a, b) => b.localeCompare(a)),
    );
    expect(defaultPage.body.next_page_id).toBeNull();
    expect(limitedPage.body.items).toEqual(defaultPage.body.items.slice(0, 2));
  });

  it("supports unfiltered, plain, and bracketed batch conversation lookups", async () => {
    const all = await requestJson<
      {
        id: string;
        sandbox_status: string | null;
        workspace: { working_dir: string } | null;
      }[]
    >("/api/conversations");
    const plainIds = await requestJson<({ id: string } | null)[]>(
      "/api/conversations?ids=1&ids=missing",
    );
    const bracketedIds = await requestJson<({ id: string } | null)[]>(
      "/api/conversations?ids%5B%5D=2&ids%5B%5D=missing",
    );

    expect(all.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "4",
          sandbox_status: "MISSING",
          workspace: null,
        }),
        expect.objectContaining({
          id: "pagination-local",
          sandbox_status: null,
          workspace: { working_dir: "/workspace/project" },
        }),
      ]),
    );
    expect(plainIds.body).toEqual([expect.objectContaining({ id: "1" }), null]);
    expect(bracketedIds.body).toEqual([
      expect.objectContaining({ id: "2" }),
      null,
    ]);
  });

  it("returns a conversation by id and reports an unknown id", async () => {
    const found = await requestJson<{
      id: string;
      title: string | null;
      execution_status: string;
    }>("/api/conversations/5");
    const missing = await requestJson<null>(
      "/api/conversations/does-not-exist",
    );

    expect(found).toEqual({
      body: expect.objectContaining({
        id: "5",
        title: "Errored Project",
        execution_status: "idle",
      }),
      status: 200,
    });
    expect(missing).toEqual({ body: null, status: 404 });
  });

  it("creates, renames, and deletes a conversation through its lifecycle", async () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.42424);

    try {
      const created = await requestJson<{
        id: string;
        title: string;
        execution_status: string;
      }>("/api/conversations", { method: "POST" });

      expect(created).toEqual({
        body: expect.objectContaining({
          id: "42424",
          title: "New Conversation",
          execution_status: "idle",
        }),
        status: 201,
      });

      const renamed = await requestJson<null>("/api/conversations/42424", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Renamed Conversation" }),
      });
      const afterRename = await requestJson<{ title: string }>(
        "/api/conversations/42424",
      );
      const deleted = await requestJson<null>("/api/conversations/42424", {
        method: "DELETE",
      });
      const afterDelete = await requestJson<null>("/api/conversations/42424");
      const deletedAgain = await requestJson<null>("/api/conversations/42424", {
        method: "DELETE",
      });

      expect(renamed).toEqual({ body: null, status: 200 });
      expect(afterRename.body.title).toBe("Renamed Conversation");
      expect(deleted).toEqual({ body: null, status: 200 });
      expect(afterDelete).toEqual({ body: null, status: 404 });
      expect(deletedAgain).toEqual({ body: null, status: 404 });
    } finally {
      random.mockRestore();
    }
  });

  it("rejects empty rename payloads without changing the conversation", async () => {
    const nullPayload = await requestJson<null>("/api/conversations/2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "null",
    });
    const emptyTitle = await requestJson<null>("/api/conversations/2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });
    const missing = await requestJson<null>(
      "/api/conversations/does-not-exist",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Ignored" }),
      },
    );
    const unchanged = await requestJson<{ title: string }>(
      "/api/conversations/2",
    );

    expect(nullPayload).toEqual({ body: null, status: 404 });
    expect(emptyTitle).toEqual({ body: null, status: 404 });
    expect(missing).toEqual({ body: null, status: 404 });
    expect(unchanged.body.title).toBe("Repo Testing");
  });

  it("paginates local events in ascending and descending timestamp order", async () => {
    const ascending = await requestJson<{
      items: { id: string; timestamp: string }[];
      next_page_id: string | null;
    }>("/api/conversations/pagination-local/events/search");
    const descending = await requestJson<{
      items: { id: string; timestamp: string }[];
      next_page_id: string | null;
    }>(
      "/api/conversations/pagination-local/events/search?limit=2&sort_order=TIMESTAMP_DESC",
    );

    expect(ascending.body.items).toHaveLength(100);
    expect(ascending.body.items[0]?.id).toBe("local-pagination-message-1");
    expect(ascending.body.items.at(-1)?.id).toBe(
      "local-pagination-message-100",
    );
    expect(ascending.body.next_page_id).toBeNull();
    expect(descending.body.items.map(({ id }) => id)).toEqual([
      "local-pagination-message-100",
      "local-pagination-message-99",
    ]);
    expect(descending.body.next_page_id).toBe("next-page");
  });

  it("returns only pagination events older than the requested timestamp", async () => {
    const page = await requestJson<{
      items: { id: string }[];
      next_page_id: string | null;
    }>(
      "/api/conversations/pagination-local/events/search?timestamp__lt=2026-05-13T00%3A03%3A00.000Z&limit=10&sort_order=TIMESTAMP_DESC",
    );

    expect(page.body).toEqual({
      items: [
        expect.objectContaining({ id: "local-pagination-message-2" }),
        expect.objectContaining({ id: "local-pagination-message-1" }),
      ],
      next_page_id: null,
    });
  });

  it("paginates static events and returns an empty page for unknown conversations", async () => {
    const staticPage = await requestJson<{
      items: { source: string }[];
      next_page_id: string | null;
    }>(
      `/api/conversations/${TABLE_DEMO_CONVERSATION_ID}/events/search?limit=1`,
    );
    const unknownPage = await requestJson<{
      items: unknown[];
      next_page_id: string | null;
    }>("/api/conversations/unknown/events/search");

    expect(staticPage.body.items).toHaveLength(1);
    expect(staticPage.body.next_page_id).toBe("next-page");
    expect(unknownPage.body).toEqual({ items: [], next_page_id: null });
  });

  it("serves cloud conversations and their paginated events through the proxy", async () => {
    const batch = await cloudProxy<({ id: string } | null)[]>(
      "/api/v1/app-conversations?ids=pagination-cloud&ids=unknown",
    );
    const emptyBatch = await cloudProxy<Record<string, never>>(
      "/api/v1/app-conversations",
    );
    const search = await cloudProxy<{
      items: { id: string; execution_status: string }[];
      next_page_id: string | null;
    }>("/api/v1/app-conversations/search");
    const events = await cloudProxy<{
      items: { id: string }[];
      next_page_id: string | null;
    }>(
      "/api/v1/conversation/pagination-cloud/events/search?limit=2&sort_order=TIMESTAMP_DESC",
    );

    expect(batch.body).toEqual([
      expect.objectContaining({
        id: "pagination-cloud",
        execution_status: "idle",
        workspace: { working_dir: "/workspace/project" },
      }),
      null,
    ]);
    expect(emptyBatch.body).toEqual({});
    expect(search.body).toEqual({
      items: [expect.objectContaining({ id: "pagination-cloud" })],
      next_page_id: null,
    });
    expect(events.body.items.map(({ id }) => id)).toEqual([
      "cloud-pagination-message-100",
      "cloud-pagination-message-99",
    ]);
    expect(events.body.next_page_id).toBe("next-page");
  });

  it("serves cloud account bootstrap data through the proxy", async () => {
    const settings = await cloudProxy<{
      llm_model: string;
      user_consents_to_analytics: boolean;
      provider_tokens_set: Record<string, string>;
    }>("/api/v1/settings");
    const key = await cloudProxy<{ id: string; auth_type: string }>(
      "/api/keys/current",
    );
    const organizations = await cloudProxy<{
      items: { id: string; is_personal: boolean }[];
      current_org_id: string;
    }>("/api/organizations");
    const membership = await cloudProxy<{ org_id: string; user_id: string }>(
      "/api/organizations/org-1/me",
    );
    const authenticated = await cloudProxy<{ ok: boolean }>(
      "/api/authenticate",
    );
    const missingPath = await cloudProxy<Record<string, never>>();
    const unknownPath = await cloudProxy<Record<string, never>>(
      "/api/not-implemented",
    );

    expect(settings.body).toMatchObject({
      llm_model: "openhands/claude-haiku-4-5-20251001",
      user_consents_to_analytics: false,
      provider_tokens_set: { github: "" },
    });
    expect(key.body).toEqual(
      expect.objectContaining({ id: "mock-key", auth_type: "api_key" }),
    );
    expect(organizations.body).toEqual({
      items: [{ id: "org-1", name: "Mock Org", is_personal: true }],
      current_org_id: "org-1",
    });
    expect(membership.body).toEqual({ org_id: "org-1", user_id: "org-1" });
    expect(authenticated.body).toEqual({ ok: true });
    expect(missingPath.body).toEqual({});
    expect(unknownPath.body).toEqual({});
  });

  it("supports conversation controls and auxiliary conversation resources", async () => {
    const [
      count,
      event,
      paused,
      interrupted,
      run,
      agentAnswer,
      vscode,
      skills,
      pendingMessage,
      microagents,
    ] = await Promise.all([
      requestJson<number>("/api/conversations/1/events/count"),
      requestJson<{ ok: boolean }>("/api/conversations/1/events", {
        method: "POST",
      }),
      requestJson<{ success: boolean }>("/api/conversations/1/pause", {
        method: "POST",
      }),
      requestJson<{ success: boolean }>("/api/conversations/1/interrupt", {
        method: "POST",
      }),
      requestJson<{ success: boolean }>("/api/conversations/1/run", {
        method: "POST",
      }),
      requestJson<{ response: string }>("/api/conversations/1/ask_agent", {
        method: "POST",
      }),
      requestJson<{ url: string | null }>("/api/vscode/url"),
      requestJson<{ skills: unknown[] }>("/api/skills", { method: "POST" }),
      requestJson<{ id: string; position: number }>(
        "/api/v1/conversations/1/pending-messages",
        { method: "POST" },
      ),
      requestJson<{
        microagents: {
          name: string;
          type: string;
          triggers: string[];
        }[];
      }>("/api/conversations/1/microagents"),
    ]);

    expect(count.body).toBe(0);
    expect(event.body).toEqual({ ok: true });
    expect(paused.body).toEqual({ success: true });
    expect(interrupted.body).toEqual({ success: true });
    expect(run.body).toEqual({ success: true });
    expect(agentAnswer.body).toEqual({ response: "Mock agent response" });
    expect(vscode.body).toEqual({ url: null });
    expect(skills.body).toEqual({ skills: [] });
    expect(pendingMessage.body).toEqual({ id: "mock-pending-id", position: 0 });
    expect(microagents.body.microagents).toHaveLength(7);
    expect(microagents.body.microagents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "test-runner",
          type: "agentskills",
          triggers: ["/test"],
        }),
        expect.objectContaining({
          name: "code-search",
          type: "knowledge",
          triggers: ["/search"],
        }),
        expect.objectContaining({
          name: "work_hosts",
          type: "repo",
          triggers: [],
        }),
      ]),
    );
  });
});
