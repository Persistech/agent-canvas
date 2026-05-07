import { getActiveBackend } from "../backend-registry/active-store";
import type { Backend } from "../backend-registry/types";
import { callCloudProxy } from "./proxy";
import type { CloudOrganization, CloudOrganizationsResponse } from "./types";

interface OrganizationsResult {
  items: CloudOrganization[];
  currentOrgId: string | null;
}

function normalizeResult(
  data: CloudOrganizationsResponse | undefined | null,
): OrganizationsResult {
  return {
    items: data?.items ?? [],
    currentOrgId: data?.current_org_id ?? null,
  };
}

function resolveBackend(backend?: Backend): Backend {
  if (backend) return backend;
  const active = getActiveBackend().backend;
  if (active.kind !== "cloud") {
    throw new Error(
      "Cloud organization calls require a cloud backend. Active backend is local.",
    );
  }
  return active;
}

/**
 * Fetch the org list for a cloud backend. With no argument, uses the active
 * cloud backend; pass `backend` explicitly to fetch for an inactive cloud
 * (used by the selector to flatten all cloud rows).
 *
 * Routed through the bundled agent-server's `/api/cloud-proxy` to avoid
 * cross-origin browser calls.
 */
export async function getCloudOrganizations(
  backend?: Backend,
): Promise<OrganizationsResult> {
  const target = resolveBackend(backend);
  const data = await callCloudProxy<CloudOrganizationsResponse>({
    backend: target,
    method: "GET",
    path: "/api/organizations",
  });
  return normalizeResult(data);
}

export async function switchCloudOrganization(
  orgId: string,
  backend?: Backend,
): Promise<void> {
  const target = resolveBackend(backend);
  await callCloudProxy<unknown>({
    backend: target,
    method: "POST",
    path: `/api/organizations/${encodeURIComponent(orgId)}/switch`,
  });
}

/**
 * Fetch `GET /api/organizations/{orgId}/me`. Identifies the calling user as
 * a member of `orgId`. The GUI uses `me.org_id === me.user_id` to decide
 * whether `orgId` is the user's personal workspace — that's the SaaS
 * contract (the auto-generated personal-workspace org has the same id as
 * the user).
 */
export async function getCloudOrganizationMe(
  orgId: string,
  backend?: Backend,
): Promise<{ orgId: string; userId: string }> {
  const target = resolveBackend(backend);
  const data = await callCloudProxy<{ org_id: string; user_id: string }>({
    backend: target,
    method: "GET",
    path: `/api/organizations/${encodeURIComponent(orgId)}/me`,
  });
  return {
    orgId: data?.org_id ?? orgId,
    userId: data?.user_id ?? "",
  };
}
