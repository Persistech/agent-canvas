import { FileClient } from "@openhands/typescript-client/clients";
import { RemoteWorkspace } from "@openhands/typescript-client/workspace/remote-workspace";
import { getAgentServerClientOptions } from "#/api/agent-server-client-options";
import { getActiveBackend } from "#/api/backend-registry/active-store";
import { callCloudProxy } from "#/api/cloud/proxy";

export interface CommandResult {
  exit_code: number;
  stdout: string;
  stderr: string;
}

class AgentServerRuntimeService {
  static async executeCommand(
    conversationId: string | null | undefined,
    conversationUrl: string | null | undefined,
    sessionApiKey: string | null | undefined,
    command: string,
    cwd?: string,
    timeout = 30,
  ): Promise<CommandResult> {
    const active = getActiveBackend().backend;

    if (active.kind === "cloud" && conversationId) {
      const output = await callCloudProxy<{
        exit_code?: number;
        stdout?: string;
        stderr?: string;
      }>({
        backend: active,
        method: "POST",
        conversationId,
        path: "/api/bash/execute_bash_command",
        body: {
          command,
          ...(cwd ? { cwd } : {}),
          timeout: Math.floor(timeout),
        },
        timeoutSeconds: timeout + 10,
      });
      return {
        exit_code: output.exit_code ?? -1,
        stdout: output.stdout ?? "",
        stderr: output.stderr ?? "",
      };
    }

    const result = await new RemoteWorkspace(
      getAgentServerClientOptions({ conversationUrl, sessionApiKey }),
    ).executeCommand(command, cwd, timeout);
    return {
      exit_code: result.exit_code,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  static async downloadFile(
    conversationId: string | null | undefined,
    conversationUrl: string | null | undefined,
    sessionApiKey: string | null | undefined,
    path: string,
  ): Promise<ArrayBuffer> {
    const active = getActiveBackend().backend;

    if (active.kind === "cloud" && conversationId) {
      const blob = await callCloudProxy<Blob>({
        backend: active,
        method: "GET",
        conversationId,
        path: `/api/file/download?path=${encodeURIComponent(path)}`,
        responseType: "blob",
      });
      return blob.arrayBuffer();
    }

    return new FileClient(
      getAgentServerClientOptions({ conversationUrl, sessionApiKey }),
    ).downloadFile(path);
  }
}

export default AgentServerRuntimeService;
