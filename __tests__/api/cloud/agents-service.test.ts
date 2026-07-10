import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetActiveStoreForTests,
  setActiveSelection,
  setRegisteredBackends,
} from "#/api/backend-registry/active-store";
import type { Backend } from "#/api/backend-registry/types";
import AgentsService from "#/api/agents-service";

vi.mock("axios");

const cloudBackend: Backend = {
  id: "prod",
  name: "Production",
  host: "https://app.all-hands.dev",
  apiKey: "bearer-token",
  kind: "cloud",
};

beforeEach(() => {
  window.localStorage.clear();
  __resetActiveStoreForTests();
  setRegisteredBackends([cloudBackend]);
  setActiveSelection({ backendId: cloudBackend.id });
  vi.mocked(axios.request).mockReset();
});

afterEach(() => {
  window.localStorage.clear();
  __resetActiveStoreForTests();
});

describe("AgentsService.getAgents against cloud backend", () => {
  it("paginates /api/v1/agents/search and returns the merged list", async () => {
    vi.mocked(axios.request)
      .mockResolvedValueOnce({
        data: {
          items: [
            { name: "general-purpose", level: "builtin" },
            { name: "changelog-writer", level: "project" },
          ],
          next_page_id: "changelog-writer",
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [{ name: "my-helper", level: "user" }],
          next_page_id: null,
        },
      });

    const agents = await AgentsService.getAgents();

    expect(vi.mocked(axios.request)).toHaveBeenCalledTimes(2);

    const [firstConfig] = vi.mocked(axios.request).mock.calls[0]!;
    expect(firstConfig).toMatchObject({
      method: "GET",
      headers: { Authorization: "Bearer bearer-token" },
    });
    expect((firstConfig as { url: string }).url).toMatch(
      /^https:\/\/app\.all-hands\.dev\/api\/v1\/agents\/search\?/,
    );
    expect((firstConfig as { url: string }).url).not.toContain("page_id=");

    // Second page request carries the cursor from the first response.
    const [secondConfig] = vi.mocked(axios.request).mock.calls[1]!;
    expect((secondConfig as { url: string }).url).toContain(
      "page_id=changelog-writer",
    );

    expect(agents.map((a) => a.name)).toEqual([
      "general-purpose",
      "changelog-writer",
      "my-helper",
    ]);
  });

  it("returns an empty list when the cloud returns no agents", async () => {
    vi.mocked(axios.request).mockResolvedValueOnce({
      data: { items: [], next_page_id: null },
    });

    const agents = await AgentsService.getAgents();

    expect(agents).toEqual([]);
  });
});
