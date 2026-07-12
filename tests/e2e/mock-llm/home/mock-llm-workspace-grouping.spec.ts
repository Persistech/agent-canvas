import { test, expect, type APIRequestContext } from "@playwright/test";
import {
  BACKEND_URL,
  SESSION_API_KEY,
  seedLocalStorage,
  routeSessionApiKey,
  dismissAnalyticsModal,
  waitForTestId,
} from "../utils/mock-llm-helpers";

const WORKSPACES_API = `${BACKEND_URL}/api/workspaces`;
const TEST_PREFIX = "e2e-grouping";
const ALPHA_PARENT = {
  id: `${TEST_PREFIX}-parent-alpha`,
  name: "E2E Alpha Parent",
  path: `/tmp/${TEST_PREFIX}-alpha`,
};
const BETA_PARENT = {
  id: `${TEST_PREFIX}-parent-beta`,
  name: "E2E Beta Parent",
  path: `/tmp/${TEST_PREFIX}-beta`,
};
const ALPHA_WORKSPACE = {
  id: `${TEST_PREFIX}-alpha-api`,
  name: `${TEST_PREFIX}-alpha-api`,
  path: `${ALPHA_PARENT.path}/api`,
  parentPath: ALPHA_PARENT.path,
};
const BETA_WORKSPACE = {
  id: `${TEST_PREFIX}-beta-worker`,
  name: `${TEST_PREFIX}-beta-worker`,
  path: `${BETA_PARENT.path}/worker`,
  parentPath: BETA_PARENT.path,
};
const STANDALONE_WORKSPACE = {
  id: `${TEST_PREFIX}-standalone`,
  name: `${TEST_PREFIX}-standalone`,
  path: `/tmp/${TEST_PREFIX}-standalone`,
};
const WORKSPACES = [ALPHA_WORKSPACE, BETA_WORKSPACE, STANDALONE_WORKSPACE];
const PARENTS = [ALPHA_PARENT, BETA_PARENT];

function authHeaders() {
  return {
    "X-Session-API-Key": SESSION_API_KEY,
    "Content-Type": "application/json",
  };
}

async function seedGroupedWorkspaces(request: APIRequestContext) {
  const parentsResp = await request.post(`${WORKSPACES_API}/parents`, {
    headers: authHeaders(),
    data: { parents: PARENTS },
  });
  expect(parentsResp.ok(), `seed workspace parents: ${parentsResp.status()}`).toBe(
    true,
  );

  const workspacesResp = await request.post(WORKSPACES_API, {
    headers: authHeaders(),
    data: { workspaces: WORKSPACES },
  });
  expect(
    workspacesResp.ok(),
    `seed workspaces: ${workspacesResp.status()}`,
  ).toBe(true);
}

async function cleanupGroupedWorkspaces(request: APIRequestContext) {
  for (const workspace of WORKSPACES) {
    await request.delete(WORKSPACES_API, {
      headers: authHeaders(),
      params: { path: workspace.path },
    });
  }

  for (const parent of PARENTS) {
    await request.delete(`${WORKSPACES_API}/parents`, {
      headers: authHeaders(),
      params: { path: parent.path },
    });
  }
}

test.describe.configure({ mode: "serial" });

test.describe("mock-LLM grouped workspace dropdown", () => {
  test.beforeEach(async ({ page, request }) => {
    await cleanupGroupedWorkspaces(request).catch(() => {});
    await seedGroupedWorkspaces(request);
    await seedLocalStorage(page);
  });

  test.afterEach(async ({ request }) => {
    await cleanupGroupedWorkspaces(request).catch(() => {});
  });

  test("groups workspaces by parent and keeps keyboard selection on real options", async ({
    page,
  }) => {
    await routeSessionApiKey(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await dismissAnalyticsModal(page);
    await waitForTestId(page, "home-chat-launcher", 15_000);

    await test.step("open the workspace dropdown", async () => {
      await page.getByTestId("open-workspace-button").click();
      await expect(page.getByTestId("open-workspace-dialog-body")).toBeVisible({
        timeout: 10_000,
      });

      const dropdown = page.getByTestId("workspace-dropdown");
      await expect(dropdown).toBeVisible({ timeout: 10_000 });
      await dropdown.click();
      await dropdown.fill(TEST_PREFIX);
    });

    await test.step("verify grouped headers and accessible option names", async () => {
      const menu = page.getByTestId("workspace-dropdown-menu");
      await expect(menu).toBeVisible({ timeout: 10_000 });

      await expect(
        page.getByRole("option", {
          name: `${ALPHA_PARENT.name}, ${ALPHA_WORKSPACE.name}`,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("option", {
          name: `${BETA_PARENT.name}, ${BETA_WORKSPACE.name}`,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("option", {
          name: `Other, ${STANDALONE_WORKSPACE.name}`,
        }),
      ).toBeVisible();

      const headerTexts = (await page
        .getByTestId("workspace-group-header")
        .allTextContents()).map((text) => text.trim());
      expect(headerTexts).toEqual(
        expect.arrayContaining([ALPHA_PARENT.name, BETA_PARENT.name, "Other"]),
      );
      expect(headerTexts.indexOf(ALPHA_PARENT.name)).toBeLessThan(
        headerTexts.indexOf("Other"),
      );
      expect(headerTexts.indexOf(BETA_PARENT.name)).toBeLessThan(
        headerTexts.indexOf("Other"),
      );
    });

    await test.step("select the first option with the keyboard", async () => {
      const dropdown = page.getByTestId("workspace-dropdown");
      await dropdown.press("ArrowDown");
      await dropdown.press("Enter");
      await expect(dropdown).toHaveValue(ALPHA_WORKSPACE.name);
    });
  });
});
