import { describe, expect, it } from "vitest";

import {
  CONTAINER_WORKSPACES_DIR,
  buildDockerHomePermissionCheckArgs,
  isDockerPermissionDenied,
  parseContainerUser,
} from "../../scripts/dev-docker.mjs";

describe("CONTAINER_WORKSPACES_DIR", () => {
  it("points at the dockerized agent-server's in-container persistence dir so the working_dir the GUI sends is one the container can mkdir (regression guard for the host-path leak that caused 500 on POST /api/conversations)", () => {
    expect(CONTAINER_WORKSPACES_DIR).toBe(
      "/home/openhands/.openhands/agent-canvas/workspaces",
    );
  });
});

describe("isDockerPermissionDenied", () => {
  it("detects Linux docker socket permission failures", () => {
    expect(
      isDockerPermissionDenied(
        "permission denied while trying to connect to the docker API at unix:///var/run/docker.sock",
      ),
    ).toBe(true);
  });

  it("does not treat a missing daemon as a permission failure", () => {
    expect(
      isDockerPermissionDenied(
        "failed to connect to the docker API at unix:///var/run/docker.sock; check if the path is correct and if the daemon is running",
      ),
    ).toBe(false);
  });
});

describe("buildDockerHomePermissionCheckArgs", () => {
  it("checks the individually mounted ~/.openhands directory by default", () => {
    const args = buildDockerHomePermissionCheckArgs({
      image: "ghcr.io/openhands/agent-server:1.22.0-python",
      home: "/home/test",
    });

    expect(args).toContain("-v");
    expect(args).toContain("/home/test/.openhands:/home/openhands/.openhands");
    expect(args).toContain("--entrypoint");
    expect(args).toContain("/bin/sh");
    expect(args).toContain("ghcr.io/openhands/agent-server:1.22.0-python");
    expect(args.at(-1)).toContain('chmod "$mode" "$target"');
    expect(args.at(-1)).toContain(".agent-canvas-permission-check");
  });

  it("checks the same in-container path when the full host home is mounted", () => {
    const args = buildDockerHomePermissionCheckArgs({
      image: "agent-server:test",
      home: "/Users/test",
      mountHostHome: true,
    });

    expect(args).toContain("/Users/test:/home/openhands");
    expect(args.at(-1)).toContain('target="/home/openhands/.openhands"');
  });
});

describe("parseContainerUser", () => {
  it("extracts the image user from permission probe output", () => {
    expect(parseContainerUser("container_user=10001:10001\n")).toBe(
      "10001:10001",
    );
  });

  it("returns null when the probe did not print a user", () => {
    expect(parseContainerUser("permission denied")).toBeNull();
  });
});
