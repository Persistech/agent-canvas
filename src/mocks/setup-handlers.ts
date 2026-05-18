import { http, HttpResponse } from "msw";
import type { Backend } from "#/api/backend-registry/types";

function readMockCloudBackends() {
  try {
    const raw = window.localStorage.getItem("openhands-backends");
    const backends = raw ? (JSON.parse(raw) as Backend[]) : [];
    return backends
      .filter((backend) => backend.kind === "cloud")
      .map((backend) => ({
        id: backend.id,
        name: backend.name,
        host: backend.host,
        kind: "cloud" as const,
        api_key: backend.apiKey,
      }));
  } catch {
    return [];
  }
}

export const SETUP_HANDLERS = [
  http.get("*/setup/backends", async () =>
    HttpResponse.json({ backends: readMockCloudBackends() }),
  ),
  http.post("*/setup/backends", async ({ request }) =>
    HttpResponse.json({ backend: await request.json() }),
  ),
  http.delete("*/setup/backends/:id", async () =>
    HttpResponse.json({ ok: true }),
  ),
];
