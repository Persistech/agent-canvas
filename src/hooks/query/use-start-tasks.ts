import { useQuery } from "@tanstack/react-query";
import AgentServerConversationService from "#/api/conversation-service/agent-server-conversation-service.api";

export const useStartTasks = (limit = 10) =>
  useQuery({
    queryKey: ["start-tasks", "search", limit],
    queryFn: () => AgentServerConversationService.searchStartTasks(limit),
    select: (tasks) =>
      tasks.filter(
        (task) => task.status !== "READY" && task.status !== "ERROR",
      ),
  });
