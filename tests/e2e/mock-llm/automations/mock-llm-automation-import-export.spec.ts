import { test, expect, type APIRequestContext } from "@playwright/test";
import {
  BACKEND_URL,
  SESSION_API_KEY,
  seedLocalStorage,
  routeSessionApiKey,
  dismissAnalyticsModal,
  waitForTestId,
} from "../utils/mock-llm-helpers";

const AUTOMATION_API_BASE = `${BACKEND_URL}/api/automation/v1`;
const SOURCE_AUTOMATION_NAME = "E2E export source automation";
const IMPORTED_AUTOMATION_NAME = "E2E imported automation copy";
const SOURCE_PROMPT = "Summarize recent automation export coverage.";
const IMPORTED_PROMPT = "Summarize recent automation import coverage.";
const SOURCE_SCHEDULE = "15 8 * * *";
const IMPORTED_SCHEDULE = "30 7 * * 1";

interface AutomationRecord {
  id: string;
  name: string;
  prompt?: string;
  enabled: boolean;
  trigger?: {
    type: string;
    schedule?: string;
    timezone?: string;
  };
}

function authHeaders() {
  return { "X-Session-API-Key": SESSION_API_KEY };
}

async function createPromptAutomation(
  request: APIRequestContext,
  name: string,
): Promise<AutomationRecord> {
  const resp = await request.post(`${AUTOMATION_API_BASE}/preset/prompt`, {
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
    },
    data: {
      name,
      prompt: SOURCE_PROMPT,
      trigger: {
        type: "cron",
        schedule: SOURCE_SCHEDULE,
        timezone: "UTC",
      },
    },
  });
  expect(resp.ok(), `create automation ${name}: ${resp.status()}`).toBe(true);
  return resp.json();
}

async function listAutomations(
  request: APIRequestContext,
): Promise<AutomationRecord[]> {
  const resp = await request.get(AUTOMATION_API_BASE, {
    headers: authHeaders(),
    params: { limit: "100", offset: "0" },
  });
  expect(resp.ok(), `list automations: ${resp.status()}`).toBe(true);
  const data = await resp.json();
  return data.automations ?? data.items ?? [];
}

async function deleteAutomation(request: APIRequestContext, id: string) {
  await request.delete(`${AUTOMATION_API_BASE}/${encodeURIComponent(id)}`, {
    headers: authHeaders(),
  });
}

test.describe.configure({ mode: "serial" });

test.describe("mock-LLM automation import/export", () => {
  const automationIds = new Set<string>();

  test.beforeEach(async ({ page }) => {
    await seedLocalStorage(page);
  });

  test.afterEach(async ({ request }) => {
    for (const id of Array.from(automationIds)) {
      try {
        await deleteAutomation(request, id);
      } catch {
        // best-effort cleanup
      }
      automationIds.delete(id);
    }
  });

  test("exports an automation and imports the JSON back as a disabled automation", async ({
    page,
    request,
  }) => {
    const source = await createPromptAutomation(
      request,
      SOURCE_AUTOMATION_NAME,
    );
    automationIds.add(source.id);

    await routeSessionApiKey(page);
    await page.goto("/automations", { waitUntil: "domcontentloaded" });
    await dismissAnalyticsModal(page);
    await waitForTestId(page, "automations-import-automation", 15_000);

    await test.step("export the source automation from its actions menu", async () => {
      const sourceCard = page.getByTestId(`automation-card-${source.id}`);
      await expect(sourceCard).toBeVisible({ timeout: 15_000 });

      const downloadPromise = page.waitForEvent("download");
      await sourceCard.getByRole("button", { name: "Actions menu" }).click();
      await page.getByRole("button", { name: "Export" }).click();
      const download = await downloadPromise;

      const suggestedName = download.suggestedFilename();
      expect(suggestedName).toMatch(/\.automation\.json$/);

      const stream = await download.createReadStream();
      expect(stream, "download stream should be available").toBeTruthy();
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        stream!.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        stream!.on("end", resolve);
        stream!.on("error", reject);
      });
      const exported = JSON.parse(Buffer.concat(chunks).toString("utf8"));

      expect(exported).toMatchObject({
        version: 1,
        kind: "automation",
        spec: {
          name: SOURCE_AUTOMATION_NAME,
          prompt: SOURCE_PROMPT,
          trigger: {
            type: "cron",
            schedule: SOURCE_SCHEDULE,
          },
        },
      });
      expect(exported.spec).not.toHaveProperty("id");
      expect(exported.spec).not.toHaveProperty("created_at");

      const importFileContents = JSON.stringify(
        {
          ...exported,
          spec: {
            ...exported.spec,
            name: IMPORTED_AUTOMATION_NAME,
            prompt: IMPORTED_PROMPT,
            trigger: {
              type: "cron",
              schedule: IMPORTED_SCHEDULE,
              schedule_human: "Every Monday at 7:30 AM",
            },
            timezone: "UTC",
          },
        },
        null,
        2,
      );

      const fileChooserPromise = page.waitForEvent("filechooser");
      await page.getByTestId("automations-import-automation").click();
      const chooser = await fileChooserPromise;
      await chooser.setFiles({
        name: "imported-copy.automation.json",
        mimeType: "application/json",
        buffer: Buffer.from(importFileContents),
      });
    });

    await test.step("preview and confirm the imported automation", async () => {
      const modal = page.getByTestId("import-automation-modal");
      await expect(modal).toBeVisible({ timeout: 10_000 });
      await expect(modal).toContainText(IMPORTED_AUTOMATION_NAME);
      await expect(modal).toContainText(IMPORTED_PROMPT);
      await expect(modal).toContainText(IMPORTED_SCHEDULE);
      await expect(modal).toContainText(/disabled/i);

      await page.getByTestId("import-automation-confirm").click();
      await expect(modal).toBeHidden({ timeout: 15_000 });
    });

    await test.step("verify the imported automation is persisted disabled", async () => {
      await expect(page.getByText(IMPORTED_AUTOMATION_NAME)).toBeVisible({
        timeout: 15_000,
      });

      const automations = await listAutomations(request);
      const imported = automations.find(
        (automation) => automation.name === IMPORTED_AUTOMATION_NAME,
      );
      expect(imported, "imported automation should exist").toBeTruthy();
      automationIds.add(imported!.id);
      expect(imported!.enabled).toBe(false);
      expect(imported!.prompt).toBe(IMPORTED_PROMPT);
      expect(imported!.trigger).toMatchObject({
        type: "cron",
        schedule: IMPORTED_SCHEDULE,
        timezone: "UTC",
      });
    });
  });
});
