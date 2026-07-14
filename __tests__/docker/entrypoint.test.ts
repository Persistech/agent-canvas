import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const entrypointSource = readFileSync(
  resolve(repoRoot, "docker/entrypoint.sh"),
  "utf8",
);

describe("Docker agent-server startup", () => {
  it("keeps Canvas tools separate from operator Python paths", () => {
    expect(entrypointSource).not.toContain("export OH_EXTRA_PYTHON_PATH=");
    expect(entrypointSource).toContain(
      'CANVAS_TOOLS_DIR="/opt/agent-canvas/tools"',
    );
    expect(
      entrypointSource.match(/--extra-python-path "\$CANVAS_TOOLS_DIR"/g),
    ).toHaveLength(2);
  });
});
