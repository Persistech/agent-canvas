import { describe, expect, it } from "vitest";
import {
  buildLlmTelemetryProperties,
  LLM_AUTH_TYPE_UNKNOWN,
} from "#/utils/llm-telemetry";

describe("buildLlmTelemetryProperties", () => {
  it("extracts model, provider, subscription auth, and non-sensitive credential flags", () => {
    expect(
      buildLlmTelemetryProperties({
        model: "openai/gpt-4.1",
        auth_type: "subscription",
        subscription_vendor: "openai",
        api_key: "",
        base_url: "",
      }),
    ).toEqual({
      llm_model: "openai/gpt-4.1",
      llm_model_provider: "openai",
      llm_model_name: "gpt-4.1",
      llm_auth_type: "subscription",
      llm_subscription_vendor: "openai",
      llm_api_key_set: false,
      llm_base_url_set: false,
    });
  });

  it("handles API-key profile list items without exposing secrets or URLs", () => {
    expect(
      buildLlmTelemetryProperties(
        {
          model: "anthropic/claude-sonnet-4.5",
          api_key_set: true,
          base_url: "https://llm.example.test",
        },
        { defaultAuthType: LLM_AUTH_TYPE_UNKNOWN },
      ),
    ).toEqual({
      llm_model: "anthropic/claude-sonnet-4.5",
      llm_model_provider: "anthropic",
      llm_model_name: "claude-sonnet-4.5",
      llm_auth_type: "unknown",
      llm_subscription_vendor: null,
      llm_api_key_set: true,
      llm_base_url_set: true,
    });
  });
});
