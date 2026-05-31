import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  FileClient,
  isAgentServerVersionError,
} from "@openhands/typescript-client/clients";

import { getAgentServerClientOptions } from "#/api/agent-server-client-options";
import { useLocalWorkspaces } from "#/hooks/query/use-local-workspaces";
import { LocalWorkspace } from "#/types/workspace";

interface UseResolvedWorkspacesResult {
  workspaces: LocalWorkspace[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

/**
 * Returns the merged list of workspaces to display:
 *   - workspaces explicitly added by the user (from the persisted store),
 *   - the immediate subdirectories of every saved "workspace parent",
 *     fetched dynamically.
 *
 * Static workspaces always take precedence over a dynamic child with the
 * same path so that user-selected names/ids are preserved.
 */
export function useResolvedWorkspaces(): UseResolvedWorkspacesResult {
  const {
    data,
    isLoading: isLoadingList,
    isError: isErrorList,
    error: listError,
  } = useLocalWorkspaces();
  const workspacesUnsupported = isAgentServerVersionError(listError);
  const workspaces = data?.workspaces ?? [];
  const storedParents = data?.workspaceParents ?? [];

  // Skip dynamic child scans entirely when the current agent-server does not
  // support the workspaces API.
  const workspaceParents = useMemo(() => {
    if (workspacesUnsupported) return [];
    return storedParents;
  }, [storedParents, workspacesUnsupported]);

  const parentQueries = useQueries({
    queries: workspacesUnsupported
      ? []
      : workspaceParents.map((parent) => ({
          queryKey: ["file", "search_subdirs", parent.path],
          queryFn: () =>
            new FileClient(getAgentServerClientOptions()).searchSubdirectories(
              parent.path,
            ),
          retry: false,
          meta: { disableToast: true },
        })),
  });

  const isLoading = isLoadingList || parentQueries.some((q) => q.isLoading);
  const isError = isErrorList || parentQueries.some((q) => q.isError);

  // Stable string fingerprint that changes whenever any parent's subdir
  // results change. Avoids spreading timestamps into the `useMemo` deps,
  // which would change the array length as parents are added/removed.
  const queriesFingerprint = parentQueries
    .map((q) => `${q.dataUpdatedAt ?? 0}:${q.status}`)
    .join("|");

  const merged = useMemo(() => {
    const byPath = new Map<string, LocalWorkspace>();
    const resultsByParent = new Map(
      workspaceParents.map((parent, index) => [
        parent.path,
        parentQueries[index],
      ]),
    );

    workspaceParents.forEach((parent) => {
      const result = resultsByParent.get(parent.path);
      const items = result?.data?.items ?? [];
      items.forEach((entry) => {
        if (byPath.has(entry.path)) return;
        byPath.set(entry.path, {
          id: entry.path,
          name: entry.name,
          path: entry.path,
          parentPath: parent.path,
        });
      });
    });

    // Static workspaces win on duplicate paths.
    workspaces.forEach((w) => {
      byPath.set(w.path, w);
    });

    return Array.from(byPath.values());
  }, [workspaces, workspaceParents, queriesFingerprint]);

  return { workspaces: merged, isLoading, isError, error: listError };
}
