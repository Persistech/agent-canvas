import { CloudClient } from "@openhands/typescript-client/clients";
import { getActiveBackend } from "../backend-registry/active-store";
import type { Backend } from "../backend-registry/types";

function requireCloudBackend(backend?: Backend): Backend {
  if (backend) return backend;
  const active = getActiveBackend().backend;
  if (active.kind !== "cloud") {
    throw new Error("Cloud calls require a cloud backend.");
  }
  return active;
}

/**
 * Send `X-Org-Id` so the upstream scopes per-request to the org the user
 * selected locally, instead of the user's globally-shared `current_org_id`
 * on the cloud backend. Restricted to calls against the active backend: the
 * selector also fans out per-backend bookkeeping calls (e.g.
 * `getCloudOrganizations(b)`) that would otherwise carry the active
 * backend's orgId across an unrelated API key, which the cloud backend
 * rejects when api_key_org_id and X-Org-Id disagree.
 */
function activeOrgForBackend(backend: Backend): string | null {
  const active = getActiveBackend();
  return active.backend.id === backend.id ? active.orgId : null;
}

export function createCloudClient(backend?: Backend): CloudClient {
  const target = requireCloudBackend(backend);

  return new CloudClient({
    host: target.host,
    apiKey: target.apiKey,
    orgId: activeOrgForBackend(target),
    timeout: 30_000,
  });
}
