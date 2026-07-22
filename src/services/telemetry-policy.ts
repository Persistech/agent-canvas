import { getLockedCloudHost } from "#/api/agent-server-config";
import type { Backend } from "#/api/backend-registry/types";

export function isTelemetryConsentRequired(
  backendKind?: Backend["kind"] | null,
): boolean {
  return backendKind === "cloud" || getLockedCloudHost() !== null;
}
