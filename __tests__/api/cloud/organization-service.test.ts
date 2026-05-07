import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCloudOrganizations,
  switchCloudOrganization,
} from "#/api/cloud/organization-service.api";
import type { Backend } from "#/api/backend-registry/types";

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
  vi.mocked(axios.post).mockReset();
});

afterEach(() => {
  vi.mocked(axios.post).mockReset();
});

describe("cloud organization-service via local proxy", () => {
  it("getCloudOrganizations posts the right envelope to the local proxy and returns normalized data", async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        items: [{ id: "org-1", name: "Personal" }],
        current_org_id: "org-1",
      },
    });

    const result = await getCloudOrganizations(cloudBackend);

    expect(axios.post).toHaveBeenCalledOnce();
    const [url, body, options] = vi.mocked(axios.post).mock.calls[0]!;

    // Should target the bundled local agent-server, not the cloud host.
    expect(url).toMatch(/\/api\/cloud-proxy$/);
    expect(url).not.toContain("app.all-hands.dev");

    // The envelope carries the cloud host + path + bearer header.
    expect(body).toMatchObject({
      host: cloudBackend.host,
      method: "GET",
      path: "/api/organizations",
      headers: { Authorization: "Bearer bearer-token" },
    });

    // The outer request to the local agent-server uses the local
    // X-Session-API-Key auth, NOT the cloud bearer.
    expect(
      (options as { headers?: Record<string, string> } | undefined)?.headers ??
        {},
    ).not.toHaveProperty("Authorization");

    expect(result).toEqual({
      items: [{ id: "org-1", name: "Personal" }],
      currentOrgId: "org-1",
    });
  });

  it("switchCloudOrganization posts to the org-switch path through the proxy", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: {} });

    await switchCloudOrganization("org-2", cloudBackend);

    const [, body] = vi.mocked(axios.post).mock.calls[0]!;
    expect(body).toMatchObject({
      host: cloudBackend.host,
      method: "POST",
      path: "/api/organizations/org-2/switch",
      headers: { Authorization: "Bearer bearer-token" },
    });
  });
});
