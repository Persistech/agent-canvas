/**
 * Mock-LLM E2E test: ACP credential management on Settings → Agent.
 *
 * Covers user-facing changes from:
 *   - PR #1102: ACP credentials section, secret fields, conflict warnings
 *   - PR #1251: single Save for agent spec + credentials, no per-section button
 *
 * Tests exercise the Settings → Agent page through the real browser UI:
 *   1. Built-in preset credential fields render (Claude Code → ANTHROPIC_API_KEY)
 *   2. No separate "credentials save" button — the page-level Save covers both
 *   3. Custom preset hides the credential section entirely
 *   4. Switching providers resets credential fields
 *   5. Conflict warning appears for Claude Code OAuth + base URL
 *   6. Saving credentials alongside agent spec via the single Save button
 */

import { test, expect } from "@playwright/test";
import {
  seedLocalStorage,
  routeSessionApiKey,
  dismissAnalyticsModal,
  waitForTestId,
  selectDropdownOption,
  ensureMockLLMProfile,
  resetToOpenHandsAgentViaUI,
  resetMockLLM,
  BACKEND_URL,
  SESSION_API_KEY,
} from "./utils/mock-llm-helpers";

test.describe.configure({ mode: "serial" });

test.describe("ACP credential management on Settings → Agent", () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalStorage(page);
  });

  test.afterAll(async ({ request, browser }) => {
    // Reset back to OpenHands so subsequent specs are unaffected.
    const page = await browser.newPage();
    try {
      await seedLocalStorage(page);
      await resetToOpenHandsAgentViaUI(page);
      await ensureMockLLMProfile(page);
    } catch {
      // best-effort
    } finally {
      await page.close();
    }
    try {
      await resetMockLLM(request);
    } catch {
      // best-effort
    }
  });

  // ── Credential fields render for built-in providers ─────────────────

  test("credential fields appear for Claude Code preset and hide for Custom", async ({
    page,
  }) => {
    await ensureMockLLMProfile(page);
    await routeSessionApiKey(page);
    await page.goto("/settings/agent", { waitUntil: "domcontentloaded" });
    await dismissAnalyticsModal(page);
    await waitForTestId(page, "agent-settings-screen");

    // Switch to ACP — Claude Code is the default first preset.
    await test.step("switch agent type to ACP", async () => {
      await selectDropdownOption(page, /Agent/, /ACP/);
    });

    // Claude Code credential fields should be visible.
    await test.step("Claude Code credentials render", async () => {
      // Wait for the credentials section to appear (it renders after the
      // preset dropdown resolves to a built-in provider).
      const apiKeyField = page.getByTestId(
        "settings-acp-secret-ANTHROPIC_API_KEY",
      );
      await expect(apiKeyField).toBeVisible({ timeout: 5_000 });
      // The field is a password input for API keys.
      await expect(apiKeyField).toHaveAttribute("type", "password");

      // The OAuth token field should also be visible for Claude Code.
      await expect(
        page.getByTestId("settings-acp-secret-CLAUDE_CODE_OAUTH_TOKEN"),
      ).toBeVisible({ timeout: 3_000 });
    });

    // No per-section credential save button (PR #1251 removed it).
    await test.step("no separate credentials save button exists", async () => {
      await expect(
        page.getByTestId("acp-credentials-save-button"),
      ).not.toBeVisible();
    });

    // Switch to Custom preset — credential section should disappear.
    await test.step("Custom preset hides credential fields", async () => {
      await selectDropdownOption(page, /Preset/, /Custom/);

      // After switching to Custom, credential fields should not be visible.
      await expect(
        page.getByTestId("settings-acp-secret-ANTHROPIC_API_KEY"),
      ).not.toBeVisible({ timeout: 3_000 });
      await expect(
        page.getByTestId("settings-acp-secret-CLAUDE_CODE_OAUTH_TOKEN"),
      ).not.toBeVisible();
    });
  });

  // ── Switching providers resets credential fields ─────────────────────

  test("switching from Claude Code to Codex resets credential fields", async ({
    page,
  }) => {
    await ensureMockLLMProfile(page);
    await routeSessionApiKey(page);
    await page.goto("/settings/agent", { waitUntil: "domcontentloaded" });
    await dismissAnalyticsModal(page);
    await waitForTestId(page, "agent-settings-screen");

    await selectDropdownOption(page, /Agent/, /ACP/);

    // Verify Claude Code fields are visible.
    await expect(
      page.getByTestId("settings-acp-secret-ANTHROPIC_API_KEY"),
    ).toBeVisible({ timeout: 5_000 });

    // Type something into the API key field.
    const apiKeyField = page.getByTestId(
      "settings-acp-secret-ANTHROPIC_API_KEY",
    );
    await apiKeyField.fill("sk-ant-test-value");

    // Switch to Codex preset.
    await selectDropdownOption(page, /Preset/, /Codex/);

    // Codex has different credential fields (CODEX_AUTH_JSON, OPENAI_API_KEY).
    await expect(
      page.getByTestId("settings-acp-secret-CODEX_AUTH_JSON"),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByTestId("settings-acp-secret-OPENAI_API_KEY"),
    ).toBeVisible({ timeout: 3_000 });

    // Claude Code fields should no longer be visible.
    await expect(
      page.getByTestId("settings-acp-secret-ANTHROPIC_API_KEY"),
    ).not.toBeVisible();

    // The CODEX_AUTH_JSON field should be a textarea (multiline blob).
    const codexAuthField = page.getByTestId(
      "settings-acp-secret-CODEX_AUTH_JSON",
    );
    await expect(codexAuthField).toBeVisible();
    const tagName = await codexAuthField.evaluate((el) => el.tagName);
    expect(tagName).toBe("TEXTAREA");
  });

  // ── Conflict warning for Claude Code ────────────────────────────────

  test("conflict warning appears when both OAuth token and base URL are set", async ({
    page,
  }) => {
    await ensureMockLLMProfile(page);
    await routeSessionApiKey(page);
    await page.goto("/settings/agent", { waitUntil: "domcontentloaded" });
    await dismissAnalyticsModal(page);
    await waitForTestId(page, "agent-settings-screen");

    await selectDropdownOption(page, /Agent/, /ACP/);

    // Wait for Claude Code credential fields.
    const oauthField = page.getByTestId(
      "settings-acp-secret-CLAUDE_CODE_OAUTH_TOKEN",
    );
    await expect(oauthField).toBeVisible({ timeout: 5_000 });

    const baseUrlField = page.getByTestId(
      "settings-acp-secret-ANTHROPIC_BASE_URL",
    );
    await expect(baseUrlField).toBeVisible({ timeout: 3_000 });

    // No conflict warning initially.
    await expect(
      page.getByTestId("acp-credential-conflict-warning"),
    ).not.toBeVisible();

    // Type values into both conflicting fields.
    await oauthField.fill("oauth-token-value");
    await baseUrlField.fill("https://custom-base.example.com");

    // The conflict warning should now be visible.
    await expect(
      page.getByTestId("acp-credential-conflict-warning"),
    ).toBeVisible({ timeout: 3_000 });
  });

  // ── Single Save persists both agent spec and credentials ────────────

  test("single Save persists ACP credentials alongside agent settings", async ({
    page,
    request,
  }) => {
    await ensureMockLLMProfile(page);
    await routeSessionApiKey(page);
    await page.goto("/settings/agent", { waitUntil: "domcontentloaded" });
    await dismissAnalyticsModal(page);
    await waitForTestId(page, "agent-settings-screen");

    // Switch to ACP (Claude Code default).
    await selectDropdownOption(page, /Agent/, /ACP/);

    // Type a credential value.
    const apiKeyField = page.getByTestId(
      "settings-acp-secret-ANTHROPIC_API_KEY",
    );
    await expect(apiKeyField).toBeVisible({ timeout: 5_000 });
    await apiKeyField.fill("sk-ant-e2e-test-key");

    // Save via the page-level Save button.
    const saveBtn = page.getByTestId("agent-save-button");
    await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
    await saveBtn.click();

    // Wait for save to complete (button becomes disabled when form is clean).
    await expect(saveBtn).toBeDisabled({ timeout: 10_000 });

    // Verify via the settings API that agent_kind is ACP.
    await test.step("verify agent settings persisted as ACP", async () => {
      const resp = await request.get(`${BACKEND_URL}/api/settings`, {
        headers: {
          "X-Session-API-Key": SESSION_API_KEY,
          "X-Expose-Secrets": "encrypted",
        },
      });
      expect(resp.ok()).toBe(true);
      const settings = await resp.json();
      expect(settings?.agent_settings?.agent_kind).toBe("acp");
      expect(settings?.agent_settings?.acp_server).toBe("claude-code");
    });

    // Verify the secret was persisted via the secrets API.
    await test.step("verify credential secret was persisted", async () => {
      const resp = await request.get(`${BACKEND_URL}/api/settings/secrets`, {
        headers: { "X-Session-API-Key": SESSION_API_KEY },
      });
      expect(resp.ok()).toBe(true);
      const secrets = (await resp.json()) as Array<{ name: string }>;
      const found = secrets.some((s) => s.name === "ANTHROPIC_API_KEY");
      expect(
        found,
        `Expected ANTHROPIC_API_KEY in secrets list, got: ${JSON.stringify(secrets.map((s) => s.name))}`,
      ).toBe(true);
    });

    // Reload the page and verify the credential field shows the "already set"
    // placeholder rather than being empty.
    await test.step("reload shows credential as already set", async () => {
      await page.goto("/settings/agent", { waitUntil: "domcontentloaded" });
      await waitForTestId(page, "agent-settings-screen");

      const reloadedField = page.getByTestId(
        "settings-acp-secret-ANTHROPIC_API_KEY",
      );
      await expect(reloadedField).toBeVisible({ timeout: 5_000 });

      // The field value should be empty (secrets aren't echoed), but the
      // placeholder should indicate it's already saved.
      const value = await reloadedField.inputValue();
      expect(value).toBe("");
      const placeholder = await reloadedField.getAttribute("placeholder");
      expect(placeholder).toBeTruthy();
    });
  });
});
