import { describe, it, expect } from "vitest";
import {
  isFileTildeHost,
  isLocalPathInput,
  localExtensionBaseUrl,
  toRegisterableLocalPath,
  LOCAL_EXTENSION_REGISTER_PATH,
  LOCAL_EXTENSION_ROUTE_PREFIX,
} from "#/extensions/sources/local-path";

describe("isLocalPathInput", () => {
  it("recognizes home-relative, absolute, Windows, and file:/// forms", () => {
    expect(isLocalPathInput("~/code/my-ext")).toBe(true);
    expect(isLocalPathInput("~")).toBe(true);
    expect(isLocalPathInput("/Users/jp/code/my-ext")).toBe(true);
    expect(isLocalPathInput("C:\\code\\my-ext")).toBe(true);
    expect(isLocalPathInput("C:/code/my-ext")).toBe(true);
    expect(isLocalPathInput("file:///Users/jp/code/my-ext")).toBe(true);
  });

  it("recognizes the invalid file://~ form so it can be rejected downstream", () => {
    expect(isLocalPathInput("file://~/code/my-ext")).toBe(true);
  });

  it("does not treat remote sources as local paths", () => {
    expect(isLocalPathInput("npm:@acme/hello")).toBe(false);
    expect(isLocalPathInput("github:acme/hello")).toBe(false);
    expect(isLocalPathInput("https://cdn.example.com/ext")).toBe(false);
    expect(isLocalPathInput("")).toBe(false);
    expect(isLocalPathInput("acme/hello")).toBe(false);
  });
});

describe("isFileTildeHost", () => {
  it("is true only for the tilde-as-host form", () => {
    expect(isFileTildeHost("file://~/x")).toBe(true);
    expect(isFileTildeHost("FILE://~/x")).toBe(true);
    expect(isFileTildeHost("file:///abs")).toBe(false);
    expect(isFileTildeHost("~/x")).toBe(false);
  });
});

describe("toRegisterableLocalPath", () => {
  it("passes ~ through verbatim WITHOUT expanding it (server expands $HOME)", () => {
    // The browser must never resolve home; the raw ~ is forwarded to the server.
    expect(toRegisterableLocalPath("~/code/my-ext")).toBe("~/code/my-ext");
    expect(toRegisterableLocalPath("  ~/code/my-ext  ")).toBe("~/code/my-ext");
  });

  it("passes absolute paths through verbatim", () => {
    expect(toRegisterableLocalPath("/Users/jp/x")).toBe("/Users/jp/x");
  });

  it("decodes file:///abs to a filesystem path", () => {
    expect(toRegisterableLocalPath("file:///Users/jp/code/my-ext")).toBe(
      "/Users/jp/code/my-ext",
    );
    expect(toRegisterableLocalPath("file:///Users/jp/my%20ext")).toBe(
      "/Users/jp/my ext",
    );
  });

  it("rejects file://~ with an actionable message", () => {
    expect(() => toRegisterableLocalPath("file://~/code/my-ext")).toThrow(
      /file:\/\/~/,
    );
    expect(() => toRegisterableLocalPath("file://~/code/my-ext")).toThrow(
      /~\/path.*file:\/\/\/absolute\/path/s,
    );
  });
});

describe("localExtensionBaseUrl", () => {
  it("builds a same-origin dev URL under the fixed route prefix", () => {
    expect(localExtensionBaseUrl("http://localhost:3001", "abc123")).toBe(
      `http://localhost:3001${LOCAL_EXTENSION_ROUTE_PREFIX}abc123`,
    );
    // Tolerates a trailing slash on the origin.
    expect(localExtensionBaseUrl("http://localhost:3001/", "abc123")).toBe(
      `http://localhost:3001${LOCAL_EXTENSION_ROUTE_PREFIX}abc123`,
    );
  });

  it("keeps the register path stable", () => {
    expect(LOCAL_EXTENSION_REGISTER_PATH).toBe("/__ext-local/register");
  });
});
