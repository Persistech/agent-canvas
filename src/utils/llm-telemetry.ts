import {
  LLM_AUTH_TYPE_API_KEY,
  type LlmAuthType,
  resolveLlmAuthType,
} from "#/constants/llm-subscription";
import { extractModelAndProvider } from "#/utils/extract-model-and-provider";

export const LLM_AUTH_TYPE_UNKNOWN = "unknown";

export type LlmTelemetryAuthType = LlmAuthType | typeof LLM_AUTH_TYPE_UNKNOWN;

export interface LlmTelemetryProperties {
  llm_model: string | null;
  llm_model_provider: string | null;
  llm_model_name: string | null;
  llm_auth_type: LlmTelemetryAuthType;
  llm_subscription_vendor: string | null;
  llm_api_key_set: boolean;
  llm_base_url_set: boolean;
}

export interface BuildLlmTelemetryOptions {
  defaultAuthType?: LlmAuthType | typeof LLM_AUTH_TYPE_UNKNOWN;
}

function getNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function hasKey(source: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function resolveTelemetryAuthType(
  source: Record<string, unknown>,
  defaultAuthType: BuildLlmTelemetryOptions["defaultAuthType"],
): LlmTelemetryAuthType {
  if (hasKey(source, "auth_type")) {
    return resolveLlmAuthType(source.auth_type);
  }

  if (defaultAuthType && defaultAuthType !== LLM_AUTH_TYPE_UNKNOWN) {
    return defaultAuthType;
  }

  return LLM_AUTH_TYPE_UNKNOWN;
}

export function buildLlmTelemetryProperties(
  source: Record<string, unknown> | null | undefined,
  options: BuildLlmTelemetryOptions = {},
): LlmTelemetryProperties {
  const llm = source ?? {};
  const model = getNonEmptyString(llm.model);
  const parsed = model ? extractModelAndProvider(model) : null;
  const authType = resolveTelemetryAuthType(
    llm,
    options.defaultAuthType ?? LLM_AUTH_TYPE_API_KEY,
  );
  const apiKeySet =
    typeof llm.api_key_set === "boolean"
      ? llm.api_key_set
      : getNonEmptyString(llm.api_key) !== null;

  return {
    llm_model: model,
    llm_model_provider: parsed?.provider || null,
    llm_model_name: parsed?.model ?? null,
    llm_auth_type: authType,
    llm_subscription_vendor:
      authType === "subscription"
        ? getNonEmptyString(llm.subscription_vendor)
        : null,
    llm_api_key_set: apiKeySet,
    llm_base_url_set: getNonEmptyString(llm.base_url) !== null,
  };
}
