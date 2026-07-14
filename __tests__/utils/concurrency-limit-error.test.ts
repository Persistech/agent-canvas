import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import {
  isConcurrencyLimitError,
  getConcurrencyLimit,
} from "#/utils/concurrency-limit-error";
import { DEFAULT_CONCURRENT_SANDBOX_LIMIT } from "#/utils/constants";

function makeAxiosError(status: number, data: unknown): AxiosError {
  return new AxiosError(
    `Request failed with status code ${status}`,
    "ERR_BAD_REQUEST",
    undefined,
    undefined,
    { status, data } as never,
  );
}

// limit deliberately differs from DEFAULT_CONCURRENT_SANDBOX_LIMIT so the
// "reads the detail" case can't pass by accidentally hitting the fallback.
const limitResponse = {
  detail: {
    error: "CONCURRENCY_LIMIT_REACHED",
    message: "You have reached your limit of 5 concurrent conversations.",
    limit: 5,
    current: 5,
  },
};

describe("isConcurrencyLimitError", () => {
  it("is true for a 429 whose detail.error is CONCURRENCY_LIMIT_REACHED", () => {
    expect(isConcurrencyLimitError(makeAxiosError(429, limitResponse))).toBe(
      true,
    );
  });

  it("is false for a 429 carrying a different detail.error", () => {
    expect(
      isConcurrencyLimitError(
        makeAxiosError(429, { detail: { error: "RATE_LIMITED" } }),
      ),
    ).toBe(false);
  });

  it("is false for the limit error code on a non-429 status", () => {
    expect(isConcurrencyLimitError(makeAxiosError(403, limitResponse))).toBe(
      false,
    );
  });

  it("is false for a non-Axios error", () => {
    expect(isConcurrencyLimitError(new Error("boom"))).toBe(false);
  });
});

describe("getConcurrencyLimit", () => {
  it("returns the limit carried in the error detail", () => {
    const error = makeAxiosError(429, limitResponse);
    if (!isConcurrencyLimitError(error))
      throw new Error("expected limit error");
    expect(getConcurrencyLimit(error)).toBe(5);
  });

  it("falls back to the default when the detail omits a limit", () => {
    const error = makeAxiosError(429, {
      detail: { error: "CONCURRENCY_LIMIT_REACHED" },
    });
    if (!isConcurrencyLimitError(error))
      throw new Error("expected limit error");
    expect(getConcurrencyLimit(error)).toBe(DEFAULT_CONCURRENT_SANDBOX_LIMIT);
  });
});
