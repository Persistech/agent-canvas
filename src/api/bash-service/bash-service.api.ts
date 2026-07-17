import { BashClient } from "@openhands/typescript-client/clients";
import type {
  BashEvent,
  BashEventPage,
  BashOutput,
} from "@openhands/typescript-client";
import { getActiveBackend } from "../backend-registry/active-store";
import { callCloudProxy } from "../cloud/proxy";
import { getAgentServerClientOptions } from "../agent-server-client-options";

interface SearchOptions {
  kind__eq?: "BashCommand" | "BashOutput";
  command_id__eq?: string;
  sort_order?: "TIMESTAMP" | "TIMESTAMP_DESC";
  page_id?: string;
  limit?: number;
}

const MAX_OUTPUT_PAGES = 20; // safety cap; >2000 output events is unlikely.

function isBashOutput(event: BashEvent): event is BashOutput {
  return event.kind === "BashOutput";
}

class BashService {
  /**
   * Fetch all `BashOutput` events for a bash command, paginated and
   * sorted by timestamp. Returns events in command-emission order so
   * callers can concatenate `stdout` / `stderr` values directly.
   */
  static async listOutputs(
    conversationId: string,
    conversationUrl: string | null,
    sessionApiKey: string | null | undefined,
    bashCommandId: string,
  ): Promise<BashOutput[]> {
    const outputs: BashOutput[] = [];
    let pageId: string | undefined;
    for (let i = 0; i < MAX_OUTPUT_PAGES; i += 1) {
      const page = await BashService.searchEvents(
        conversationId,
        conversationUrl,
        sessionApiKey,
        {
          kind__eq: "BashOutput",
          command_id__eq: bashCommandId,
          sort_order: "TIMESTAMP",
          ...(pageId ? { page_id: pageId } : {}),
        },
      );
      page.items.forEach((event) => {
        if (isBashOutput(event)) outputs.push(event);
      });
      if (!page.next_page_id) break;
      pageId = page.next_page_id;
    }
    return outputs;
  }

  private static async searchEvents(
    conversationId: string,
    conversationUrl: string | null,
    sessionApiKey: string | null | undefined,
    options: SearchOptions,
  ): Promise<BashEventPage> {
    const active = getActiveBackend().backend;

    if (active.kind === "cloud") {
      const params = new URLSearchParams();
      Object.entries(options).forEach(([k, v]) => {
        if (v !== undefined && v !== null) params.set(k, String(v));
      });
      return callCloudProxy<BashEventPage>({
        backend: active,
        method: "GET",
        conversationId,
        path: `/api/bash/bash_events/search?${params.toString()}`,
      });
    }

    // Local mode: the active backend's agent-server hosts the bash
    // events. The optional `conversationUrl` is used when present (lets
    // us target a per-conversation sub-host), otherwise we fall through
    // to `backend.host` via `getAgentServerClientOptions`.
    return new BashClient(
      getAgentServerClientOptions({
        ...(conversationUrl ? { conversationUrl } : {}),
        sessionApiKey,
      }),
    ).searchEvents(options);
  }
}

export default BashService;
