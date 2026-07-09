import { MCPServerConfig } from "#/types/mcp-server";
import { MCPConfig } from "#/types/settings";

export function flattenMcpConfig(config: MCPConfig): MCPServerConfig[] {
  return [
    ...config.sse_servers.map((server, index) => ({
      id: `sse-${index}`,
      type: "sse" as const,
      sdkKey: typeof server === "object" ? server.sdkKey : undefined,
      name: typeof server === "object" ? server.name : undefined,
      url: typeof server === "string" ? server : server.url,
      headers: typeof server === "object" ? server.headers : undefined,
      auth: typeof server === "object" ? server.auth : undefined,
    })),
    ...config.stdio_servers.map((server, index) => ({
      id: `stdio-${index}`,
      type: "stdio" as const,
      sdkKey: server.sdkKey,
      name: server.name,
      command: server.command,
      args: server.args,
      env: server.env,
    })),
    ...config.shttp_servers.map((server, index) => ({
      id: `shttp-${index}`,
      type: "shttp" as const,
      sdkKey: typeof server === "object" ? server.sdkKey : undefined,
      name: typeof server === "object" ? server.name : undefined,
      url: typeof server === "string" ? server : server.url,
      headers: typeof server === "object" ? server.headers : undefined,
      timeout: typeof server === "object" ? server.timeout : undefined,
      auth: typeof server === "object" ? server.auth : undefined,
    })),
  ];
}
