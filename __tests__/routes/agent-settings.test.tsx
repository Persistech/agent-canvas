import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AgentSettingsRoute from "#/routes/agent-settings";
import * as activeBackendContext from "#/contexts/active-backend-context";
import * as useLlmProfilesHook from "#/hooks/query/use-llm-profiles";
import type { Backend } from "#/api/backend-registry/types";

vi.mock("#/hooks/query/use-llm-profiles");

const localBackend: Backend = {
  id: "local-1",
  name: "Local Backend",
  host: "http://localhost:18000",
  apiKey: "",
  kind: "local",
};
const cloudBackend: Backend = {
  id: "cloud-1",
  name: "Cloud Backend",
  host: "https://app.all-hands.dev",
  apiKey: "k",
  kind: "cloud",
};

function renderRoute() {
  return render(<AgentSettingsRoute />, {
    wrapper: ({ children }) => (
      <MemoryRouter>
        <QueryClientProvider
          client={
            new QueryClient({ defaultOptions: { queries: { retry: false } } })
          }
        >
          {children}
        </QueryClientProvider>
      </MemoryRouter>
    ),
  });
}

describe("AgentSettingsRoute (unified AgentProfile editor)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(useLlmProfilesHook.useLlmProfiles).mockReturnValue({
      data: { profiles: [], active_profile: null },
    } as unknown as ReturnType<typeof useLlmProfilesHook.useLlmProfiles>);
  });

  it("renders the AgentProfile manager (Add Profile) for local backends", async () => {
    vi.spyOn(activeBackendContext, "useActiveBackend").mockReturnValue({
      backend: localBackend,
      orgId: null,
    });
    renderRoute();
    expect(await screen.findByTestId("add-llm-profile")).toBeInTheDocument();
  });

  it("renders the standard LLM form (no profiles) for cloud backends", async () => {
    vi.spyOn(activeBackendContext, "useActiveBackend").mockReturnValue({
      backend: cloudBackend,
      orgId: "org-1",
    });
    renderRoute();
    expect(await screen.findByTestId("llm-settings-screen")).toBeInTheDocument();
    expect(screen.queryByTestId("add-llm-profile")).not.toBeInTheDocument();
  });
});
