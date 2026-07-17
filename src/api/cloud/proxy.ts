import type { CloudRequestOptions } from "@openhands/typescript-client/clients";
import type { Backend } from "../backend-registry/types";
import { createCloudClient } from "./client";

const APP_CONVERSATIONS_API_PATH = "/api/v1/app-conversations";
const RUNTIME_PROXY_PATH = "/runtime";
const RUNTIME_PROXY_METHOD = "POST";

export interface CloudProxyRequest {
  backend: Backend;
  method: CloudRequestOptions["method"];
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutSeconds?: number;
  conversationId?: string;
  responseType?: "blob";
}

function getRuntimeProxyPath(conversationId: string): string {
  return `${APP_CONVERSATIONS_API_PATH}/${encodeURIComponent(conversationId)}${RUNTIME_PROXY_PATH}`;
}

export async function callCloudProxy<TResponse = unknown>(
  req: CloudProxyRequest,
): Promise<TResponse> {
  const client = createCloudClient(req.backend);

  if (req.conversationId) {
    return client.request<TResponse>({
      method: RUNTIME_PROXY_METHOD,
      path: getRuntimeProxyPath(req.conversationId),
      body: {
        method: req.method,
        path: req.path,
        ...(req.body === undefined ? {} : { body: req.body }),
      },
      timeoutSeconds: req.timeoutSeconds,
      responseType: req.responseType,
    });
  }

  return client.request<TResponse>({
    method: req.method,
    path: req.path,
    body: req.body,
    headers: req.headers,
    timeoutSeconds: req.timeoutSeconds,
    responseType: req.responseType,
  });
}
