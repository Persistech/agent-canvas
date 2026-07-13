import { describe, it, expect } from "vitest";
import { getStatusColor, getStatusText } from "#/utils/utils";
import { AgentState } from "#/types/agent-state";
import { I18nKey } from "#/i18n/declaration";
import {
  OH_STATUS_ERROR_COLOR,
  OH_STATUS_SUCCESS_COLOR,
} from "#/constants/status-colors";

const t = (key: string) => {
  const translations: { [key: string]: string } = {
    COMMON$STOPPING: "Stopping",
    COMMON$STARTING: "Starting",
    COMMON$SERVER_STOPPED: "Server stopped",
    COMMON$RUNNING: "Running",
    CONVERSATION$READY: "Ready",
    CONVERSATION$STARTING_CONVERSATION: "Starting",
    CONVERSATION$ERROR_STARTING_CONVERSATION: "Error starting conversation",
  };
  return translations[key] || key;
};

describe("getStatusText", () => {
  it("returns STOPPING when pausing", () => {
    const result = getStatusText({
      isPausing: true,
      isTask: false,
      taskStatus: null,
      taskDetail: null,
      isStartingStatus: false,
      isStopStatus: false,
      curAgentState: AgentState.RUNNING,
      t,
    });

    expect(result).toBe(t(I18nKey.COMMON$STOPPING));
  });

  it("localizes task status when polling a task", () => {
    const result = getStatusText({
      isPausing: false,
      isTask: true,
      taskStatus: "STARTING_CONVERSATION",
      taskDetail: null,
      isStartingStatus: false,
      isStopStatus: false,
      curAgentState: AgentState.RUNNING,
      t,
    });

    expect(result).toBe(t(I18nKey.CONVERSATION$STARTING_CONVERSATION));
  });

  it("prefers task detail over the localized status while polling", () => {
    const result = getStatusText({
      isPausing: false,
      isTask: true,
      taskStatus: "STARTING_CONVERSATION",
      taskDetail: "Cloning repository",
      isStartingStatus: false,
      isStopStatus: false,
      curAgentState: AgentState.RUNNING,
      t,
    });

    expect(result).toBe("Cloning repository");
  });

  it("returns task detail when task status is ERROR and detail exists", () => {
    const result = getStatusText({
      isPausing: false,
      isTask: true,
      taskStatus: "ERROR",
      taskDetail: "Setup failed",
      isStartingStatus: false,
      isStopStatus: false,
      curAgentState: AgentState.RUNNING,
      t,
    });

    expect(result).toBe("Setup failed");
  });

  it("returns translated error when task status is ERROR and no detail", () => {
    const result = getStatusText({
      isPausing: false,
      isTask: true,
      taskStatus: "ERROR",
      taskDetail: null,
      isStartingStatus: false,
      isStopStatus: false,
      curAgentState: AgentState.RUNNING,
      t,
    });

    expect(result).toBe(t(I18nKey.CONVERSATION$ERROR_STARTING_CONVERSATION));
  });

  it("returns READY translation when task is ready", () => {
    const result = getStatusText({
      isPausing: false,
      isTask: true,
      taskStatus: "READY",
      taskDetail: null,
      isStartingStatus: false,
      isStopStatus: false,
      curAgentState: AgentState.RUNNING,
      t,
    });

    expect(result).toBe(t(I18nKey.CONVERSATION$READY));
  });

  it("returns STARTING when starting status is true", () => {
    const result = getStatusText({
      isPausing: false,
      isTask: false,
      taskStatus: null,
      taskDetail: null,
      isStartingStatus: true,
      isStopStatus: false,
      curAgentState: AgentState.INIT,
      t,
    });

    expect(result).toBe(t(I18nKey.COMMON$STARTING));
  });

  it("returns SERVER_STOPPED when stop status is true", () => {
    const result = getStatusText({
      isPausing: false,
      isTask: false,
      taskStatus: null,
      taskDetail: null,
      isStartingStatus: false,
      isStopStatus: true,
      curAgentState: AgentState.STOPPED,
      t,
    });

    expect(result).toBe(t(I18nKey.COMMON$SERVER_STOPPED));
  });

  it("returns errorMessage when agent state is ERROR", () => {
    const result = getStatusText({
      isPausing: false,
      isTask: false,
      taskStatus: null,
      taskDetail: null,
      isStartingStatus: false,
      isStopStatus: false,
      curAgentState: AgentState.ERROR,
      errorMessage: "Something broke",
      t,
    });

    expect(result).toBe("Something broke");
  });

  it("returns the translated error when the agent has no error message", () => {
    const result = getStatusText({
      isPausing: false,
      isTask: false,
      taskStatus: null,
      taskDetail: null,
      isStartingStatus: false,
      isStopStatus: false,
      curAgentState: AgentState.ERROR,
      errorMessage: null,
      t,
    });

    expect(result).toBe(t(I18nKey.COMMON$ERROR));
  });

  it("continues to agent status when task polling has no task status", () => {
    const result = getStatusText({
      isPausing: false,
      isTask: true,
      taskStatus: null,
      taskDetail: "Not applicable without a task status",
      isStartingStatus: false,
      isStopStatus: false,
      curAgentState: AgentState.RUNNING,
      t,
    });

    expect(result).toBe(t(I18nKey.COMMON$RUNNING));
  });

  it("defaults an omitted pausing flag to false", () => {
    const result = getStatusText({
      isTask: false,
      taskStatus: null,
      taskDetail: null,
      isStartingStatus: false,
      isStopStatus: false,
      curAgentState: AgentState.RUNNING,
      t,
    } as Parameters<typeof getStatusText>[0]);

    expect(result).toBe(t(I18nKey.COMMON$RUNNING));
  });

  it("returns default RUNNING status", () => {
    const result = getStatusText({
      isPausing: false,
      isTask: false,
      taskStatus: null,
      taskDetail: null,
      isStartingStatus: false,
      isStopStatus: false,
      curAgentState: AgentState.RUNNING,
      t,
    });

    expect(result).toBe(t(I18nKey.COMMON$RUNNING));
  });
});

describe("getStatusColor", () => {
  const getOptions = (
    overrides: Partial<Parameters<typeof getStatusColor>[0]> = {},
  ): Parameters<typeof getStatusColor>[0] => ({
    isPausing: false,
    isTask: false,
    taskStatus: null,
    isStartingStatus: false,
    isStopStatus: false,
    curAgentState: AgentState.RUNNING,
    ...overrides,
  });

  it("shows yellow while a pause is being requested", () => {
    expect(getStatusColor(getOptions({ isPausing: true }))).toBe("#FFD600");
  });

  it("shows the error color for a failed polled task", () => {
    expect(
      getStatusColor(
        getOptions({
          isTask: true,
          taskStatus: "ERROR",
        }),
      ),
    ).toBe(OH_STATUS_ERROR_COLOR);
  });

  it("shows yellow for any non-error polled task", () => {
    expect(
      getStatusColor(
        getOptions({
          isTask: true,
          taskStatus: "WORKING",
        }),
      ),
    ).toBe("#FFD600");
  });

  it("ignores task coloring when no task status is present", () => {
    expect(
      getStatusColor(
        getOptions({
          isTask: true,
          taskStatus: null,
        }),
      ),
    ).toBe(OH_STATUS_SUCCESS_COLOR);
  });

  it("shows yellow while the conversation starts", () => {
    expect(getStatusColor(getOptions({ isStartingStatus: true }))).toBe(
      "#FFD600",
    );
  });

  it("shows white for a stopped conversation", () => {
    expect(getStatusColor(getOptions({ isStopStatus: true }))).toBe("#ffffff");
  });

  it("shows the error color for an agent error", () => {
    expect(
      getStatusColor(getOptions({ curAgentState: AgentState.ERROR })),
    ).toBe(OH_STATUS_ERROR_COLOR);
  });

  it("shows the success color for a running agent", () => {
    expect(getStatusColor(getOptions())).toBe(OH_STATUS_SUCCESS_COLOR);
  });
});
