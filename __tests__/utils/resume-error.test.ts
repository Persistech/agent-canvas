import { describe, expect, it } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { categorizeResumeError } from "#/utils/resume-error";

const makeAxiosError = (status: number, body: object | string): AxiosError =>
  new AxiosError(
    typeof body === "string" ? body : JSON.stringify(body),
    "ERR",
    undefined,
    undefined,
    {
      status,
      statusText: "",
      headers: new AxiosHeaders(),
      config: { headers: new AxiosHeaders() },
      data: body,
    },
  );

describe("categorizeResumeError", () => {
  it("classifies a 409 axios response as lease_held", () => {
    const error = makeAxiosError(409, { message: "anything" });
    expect(categorizeResumeError(error).kind).toBe("lease_held");
  });

  it("classifies a 'Conversation already running' axios response as lease_held even without 409", () => {
    const error = makeAxiosError(500, {
      message: "Conversation already running on this host",
    });
    expect(categorizeResumeError(error).kind).toBe("lease_held");
  });

  it("classifies 'acp_session_load_failed' as session_load_failed", () => {
    const error = new Error("acp_session_load_failed: missing JSONL");
    expect(categorizeResumeError(error).kind).toBe("session_load_failed");
  });

  it("classifies messages mentioning session/load as session_load_failed", () => {
    const error = new Error("ACP error: session/load returned -32603");
    expect(categorizeResumeError(error).kind).toBe("session_load_failed");
  });

  it("falls back to unknown for everything else", () => {
    expect(categorizeResumeError(new Error("network down")).kind).toBe(
      "unknown",
    );
    expect(categorizeResumeError("string error").kind).toBe("unknown");
    expect(categorizeResumeError(null).kind).toBe("unknown");
  });

  it("preserves the message field for downstream callers", () => {
    const info = categorizeResumeError(new Error("hello"));
    expect(info.message).toBe("hello");
  });
});
