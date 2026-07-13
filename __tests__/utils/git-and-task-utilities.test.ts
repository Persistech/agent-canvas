import { describe, expect, it } from "vitest";
import type { Provider } from "#/types/settings";
import type { SuggestedTask, SuggestedTaskGroup } from "#/utils/types";
import {
  buildSessionHeaders,
  constructBranchUrl,
  constructMicroagentUrl,
  constructPullRequestUrl,
  constructRepositoryUrl,
  extractRepositoryInfo,
  getConversationStatusLabel,
  getCreateNewBranchPrompt,
  getCreatePRPrompt,
  getDisplayedTaskGroups,
  getGitProviderBaseUrl,
  getGitPullPrompt,
  getGitPushPrompt,
  getLimitedTaskGroups,
  getOpenHandsQuery,
  getPR,
  getPRShort,
  getProviderName,
  getPushToPRPrompt,
  getRepoMdCreatePrompt,
  getStatusClassName,
  getStatusIcon,
  getTotalTaskCount,
  hasOpenHandsSuffix,
  isTaskPolling,
  shouldIncludeRepository,
} from "#/utils/utils";

const makeTask = (
  issueNumber: number,
  overrides: Partial<SuggestedTask> = {},
): SuggestedTask => ({
  git_provider: "github",
  issue_number: issueNumber,
  repo: "OpenHands/agent-canvas",
  title: `Issue ${issueNumber}`,
  task_type: "OPEN_ISSUE",
  ...overrides,
});

const makeGroup = (
  title: string,
  issueNumbers: number[],
): SuggestedTaskGroup => ({
  title,
  tasks: issueNumbers.map((issueNumber) => makeTask(issueNumber)),
});

type Repository = Parameters<typeof shouldIncludeRepository>[0];

const makeRepository = (fullName: string): Repository => ({
  id: fullName,
  full_name: fullName,
  git_provider: "github",
  is_public: true,
});

describe("Git provider naming and base URLs", () => {
  it.each<[Provider, string]>([
    ["github", "https://github.com"],
    ["gitlab", "https://gitlab.com"],
    ["bitbucket", "https://bitbucket.org"],
    ["azure_devops", "https://dev.azure.com"],
    ["forgejo", "https://codeberg.org"],
    ["bitbucket_data_center", ""],
  ])("uses the public default for %s", (provider, expected) => {
    expect(getGitProviderBaseUrl(provider)).toBe(expected);
  });

  it("normalizes a bare custom host and preserves an HTTP(S) host", () => {
    expect(getGitProviderBaseUrl("gitlab", "git.example.com")).toBe(
      "https://git.example.com",
    );
    expect(getGitProviderBaseUrl("gitlab", "http://git.internal")).toBe(
      "http://git.internal",
    );
    expect(getGitProviderBaseUrl("gitlab", "https://git.internal")).toBe(
      "https://git.internal",
    );
  });

  it("ignores blank and null custom hosts", () => {
    expect(getGitProviderBaseUrl("github", "   ")).toBe("https://github.com");
    expect(getGitProviderBaseUrl("github", null)).toBe("https://github.com");
  });

  it.each<[Provider, string]>([
    ["gitlab", "GitLab"],
    ["bitbucket", "Bitbucket"],
    ["bitbucket_data_center", "Bitbucket Data Center"],
    ["azure_devops", "Azure DevOps"],
    ["forgejo", "Forgejo"],
    ["github", "GitHub"],
  ])("formats the %s provider name", (provider, expected) => {
    expect(getProviderName(provider)).toBe(expected);
  });

  it("uses provider-appropriate pull request terminology", () => {
    expect(getPR(true)).toBe("merge request");
    expect(getPR(false)).toBe("pull request");
    expect(getPRShort(true)).toBe("MR");
    expect(getPRShort(false)).toBe("PR");
  });
});

describe("Git navigation URLs", () => {
  it.each<[Provider, string]>([
    ["github", "https://github.com/acme/widget/pull/17"],
    ["forgejo", "https://codeberg.org/acme/widget/pull/17"],
    ["gitlab", "https://gitlab.com/acme/widget/-/merge_requests/17"],
    ["bitbucket", "https://bitbucket.org/acme/widget/pull-requests/17"],
  ])("builds the %s pull request URL", (provider, expected) => {
    expect(constructPullRequestUrl(17, provider, "acme/widget")).toBe(expected);
  });

  it("builds Bitbucket Data Center and Azure DevOps pull request URLs", () => {
    expect(
      constructPullRequestUrl(
        17,
        "bitbucket_data_center",
        "ACME/widget",
        "stash.acme.test",
      ),
    ).toBe(
      "https://stash.acme.test/projects/ACME/repos/widget/pull-requests/17",
    );
    expect(
      constructPullRequestUrl(17, "azure_devops", "acme/platform/widget"),
    ).toBe("https://dev.azure.com/acme/platform/_git/widget/pullrequest/17");
  });

  it("returns no pull request URL for malformed Azure coordinates or an unknown provider", () => {
    expect(constructPullRequestUrl(17, "azure_devops", "platform/widget")).toBe(
      "",
    );
    expect(
      constructPullRequestUrl(17, "unknown" as Provider, "acme/widget"),
    ).toBe("");
  });

  it.each<[Provider, string]>([
    [
      "github",
      "https://github.com/acme/widget/blob/main/.openhands/skills/review.md",
    ],
    [
      "forgejo",
      "https://codeberg.org/acme/widget/src/branch/main/.openhands/skills/review.md",
    ],
    [
      "gitlab",
      "https://gitlab.com/acme/widget/-/blob/main/.openhands/skills/review.md",
    ],
    [
      "bitbucket",
      "https://bitbucket.org/acme/widget/src/main/.openhands/skills/review.md",
    ],
  ])("builds the %s microagent URL", (provider, expected) => {
    expect(
      constructMicroagentUrl(
        provider,
        "acme/widget",
        ".openhands/skills/review.md",
      ),
    ).toBe(expected);
  });

  it("builds Bitbucket Data Center and Azure DevOps microagent URLs", () => {
    expect(
      constructMicroagentUrl(
        "bitbucket_data_center",
        "ACME/widget",
        ".openhands/skills/review.md",
        "stash.acme.test",
      ),
    ).toBe(
      "https://stash.acme.test/projects/ACME/repos/widget/browse/.openhands/skills/review.md?at=refs/heads/main",
    );
    expect(
      constructMicroagentUrl(
        "azure_devops",
        "acme/platform/widget",
        ".openhands/skills/review.md",
      ),
    ).toBe(
      "https://dev.azure.com/acme/platform/_git/widget?path=/.openhands/skills/review.md&version=GBmain",
    );
  });

  it("returns no microagent URL for malformed Azure coordinates or an unknown provider", () => {
    expect(
      constructMicroagentUrl("azure_devops", "platform/widget", "review.md"),
    ).toBe("");
    expect(
      constructMicroagentUrl("unknown" as Provider, "acme/widget", "review.md"),
    ).toBe("");
  });

  it("extracts repository and file coordinates and supplies empty missing values", () => {
    expect(
      extractRepositoryInfo(
        { full_name: "acme/widget" },
        { path: ".openhands/skills/review.md" },
      ),
    ).toEqual({
      owner: "acme",
      repo: "widget",
      filePath: ".openhands/skills/review.md",
    });
    expect(extractRepositoryInfo(null, undefined)).toEqual({
      owner: undefined,
      repo: undefined,
      filePath: "",
    });
  });

  it("builds repository URLs for hosted and Data Center repositories", () => {
    expect(constructRepositoryUrl("github", "acme/widget")).toBe(
      "https://github.com/acme/widget",
    );
    expect(
      constructRepositoryUrl(
        "bitbucket_data_center",
        "ACME/widget",
        "stash.acme.test",
      ),
    ).toBe("https://stash.acme.test/projects/ACME/repos/widget");
  });

  it.each<[Provider, string]>([
    ["github", "https://github.com/acme/widget/tree/feature/coverage"],
    ["forgejo", "https://codeberg.org/acme/widget/src/branch/feature/coverage"],
    ["gitlab", "https://gitlab.com/acme/widget/-/tree/feature/coverage"],
    ["bitbucket", "https://bitbucket.org/acme/widget/src/feature/coverage"],
  ])("builds the %s branch URL", (provider, expected) => {
    expect(
      constructBranchUrl(provider, "acme/widget", "feature/coverage"),
    ).toBe(expected);
  });

  it("builds Bitbucket Data Center and Azure DevOps branch URLs", () => {
    expect(
      constructBranchUrl(
        "bitbucket_data_center",
        "ACME/widget",
        "feature/coverage",
        "stash.acme.test",
      ),
    ).toBe(
      "https://stash.acme.test/projects/ACME/repos/widget/browse?at=refs/heads/feature/coverage",
    );
    expect(
      constructBranchUrl(
        "azure_devops",
        "acme/platform/widget",
        "feature/coverage",
      ),
    ).toBe(
      "https://dev.azure.com/acme/platform/_git/widget?version=GBfeature/coverage",
    );
  });

  it("returns no branch URL for incomplete repository coordinates or an unknown provider", () => {
    expect(
      constructBranchUrl(
        "bitbucket_data_center",
        "widget",
        "feature/coverage",
        "stash.acme.test",
      ),
    ).toBe("");
    expect(
      constructBranchUrl("azure_devops", "platform/widget", "coverage"),
    ).toBe("");
    expect(
      constructBranchUrl("unknown" as Provider, "acme/widget", "coverage"),
    ).toBe("");
  });
});

describe("Git action prompts", () => {
  it("provides fixed pull and branch-creation instructions", () => {
    expect(getGitPullPrompt()).toBe(
      "Please pull the latest code from the repository.",
    );
    expect(getCreateNewBranchPrompt()).toBe(
      "Please create a new branch with a descriptive name related to the work you plan to do.",
    );
  });

  it("uses pull request wording for GitHub push and creation prompts", () => {
    expect(getGitPushPrompt("github")).toContain(
      "on GitHub, but do NOT create a pull request",
    );
    expect(getCreatePRPrompt("github")).toContain(
      "push the changes to GitHub and open a pull request",
    );
    expect(getCreatePRPrompt("github")).toContain("PR description");
    expect(getPushToPRPrompt("github")).toBe(
      "Please push the latest changes to the existing pull request.",
    );
  });

  it("uses merge request wording for GitLab prompts", () => {
    expect(getGitPushPrompt("gitlab")).toContain(
      "on GitLab, but do NOT create a merge request",
    );
    expect(getCreatePRPrompt("gitlab")).toContain(
      "push the changes to GitLab and open a merge request",
    );
    expect(getCreatePRPrompt("gitlab")).toContain("MR description");
    expect(getPushToPRPrompt("gitlab")).toBe(
      "Please push the latest changes to the existing merge request.",
    );
  });

  it("includes custom repository documentation and provider instructions", () => {
    const prompt = getRepoMdCreatePrompt(
      "gitlab",
      "Explain the mutation-testing workflow",
    );

    expect(prompt).toContain("- Explain the mutation-testing workflow");
    expect(prompt).toContain("branch on GitLab and create a merge request");
    expect(prompt).toContain("MR description");
  });

  it("supplies the default repository documentation outline", () => {
    const prompt = getRepoMdCreatePrompt("github");

    expect(prompt).toContain("- A description of the project");
    expect(prompt).toContain("- An overview of the file structure");
    expect(prompt).toContain("branch on GitHub and create a pull request");
    expect(prompt).toContain("PR description");
  });
});

describe("suggested task grouping", () => {
  const groups = [
    makeGroup("Urgent", [1, 2]),
    makeGroup("Empty", []),
    makeGroup("Later", [3, 4]),
  ];

  it("counts all tasks and treats missing suggestions as empty", () => {
    expect(getTotalTaskCount(groups)).toBe(4);
    expect(getTotalTaskCount([])).toBe(0);
    expect(getTotalTaskCount(undefined)).toBe(0);
  });

  it("limits tasks across groups while preserving group information", () => {
    expect(getLimitedTaskGroups(groups, 3)).toEqual([
      makeGroup("Urgent", [1, 2]),
      makeGroup("Later", [3]),
    ]);
  });

  it("returns no groups when the task limit is already reached", () => {
    expect(getLimitedTaskGroups(groups, 0)).toEqual([]);
  });

  it("handles missing and empty displayed task groups", () => {
    expect(getDisplayedTaskGroups(undefined, false)).toEqual([]);
    expect(getDisplayedTaskGroups([], true)).toEqual([]);
  });

  it("returns every group when expanded and three tasks when collapsed", () => {
    expect(getDisplayedTaskGroups(groups, true)).toBe(groups);
    expect(getDisplayedTaskGroups(groups, false)).toEqual([
      makeGroup("Urgent", [1, 2]),
      makeGroup("Later", [3]),
    ]);
  });
});

describe("repository filtering and OpenHands conventions", () => {
  it("includes every repository for an empty search", () => {
    expect(shouldIncludeRepository(makeRepository("acme/widget"), "  ")).toBe(
      true,
    );
  });

  it("matches normalized repository URLs and rejects other repositories", () => {
    const repository = makeRepository("OpenHands/agent-canvas");

    expect(
      shouldIncludeRepository(
        repository,
        "https://github.com/openhands/agent-canvas.git",
      ),
    ).toBe(true);
    expect(shouldIncludeRepository(repository, "other/project")).toBe(false);
  });

  it("selects the provider-specific OpenHands repository suffix", () => {
    expect(getOpenHandsQuery("gitlab")).toBe("openhands-config");
    expect(getOpenHandsQuery("azure_devops")).toBe("openhands-config");
    expect(getOpenHandsQuery("github")).toBe(".openhands");
    expect(getOpenHandsQuery(null)).toBe(".openhands");
  });

  it("recognizes repositories that use the provider's expected suffix", () => {
    expect(
      hasOpenHandsSuffix(makeRepository("acme/openhands-config"), "gitlab"),
    ).toBe(true);
    expect(
      hasOpenHandsSuffix(makeRepository("acme/.openhands"), "github"),
    ).toBe(true);
    expect(hasOpenHandsSuffix(makeRepository("acme/widget"), "github")).toBe(
      false,
    );
  });
});

describe("conversation and task labels", () => {
  it.each([
    ["STOPPED", "COMMON$STOPPED"],
    ["RUNNING", "COMMON$RUNNING"],
    ["STARTING", "COMMON$STARTING"],
    ["ERROR", "COMMON$ERROR"],
    ["ARCHIVED", "COMMON$ARCHIVED"],
    ["PAUSED", "COMMON$UNKNOWN"],
  ] as const)("labels %s as %s", (status, label) => {
    expect(getConversationStatusLabel(status)).toBe(label);
  });

  it.each([
    ["todo", "⏳"],
    ["in_progress", "🔄"],
    ["done", "✅"],
    ["blocked", "❓"],
  ])("uses the expected icon for %s", (status, icon) => {
    expect(getStatusIcon(status)).toBe(icon);
  });

  it.each([
    ["done", "bg-green-800 text-green-200"],
    ["in_progress", "bg-yellow-800 text-yellow-200"],
    ["todo", "bg-tertiary text-[var(--oh-text-tertiary)]"],
  ])("uses the expected class for %s", (status, className) => {
    expect(getStatusClassName(status)).toBe(className);
  });

  it.each([
    ["WORKING", true],
    ["PREPARING_REPOSITORY", true],
    ["ERROR", false],
    ["READY", false],
    ["", false],
    [null, false],
    [undefined, false],
  ])("reports whether task status %s is polling", (status, expected) => {
    expect(isTaskPolling(status)).toBe(expected);
  });
});

describe("session authentication headers", () => {
  it("adds a non-empty session API key", () => {
    expect(buildSessionHeaders("session-secret")).toEqual({
      "X-Session-API-Key": "session-secret",
    });
  });

  it.each([undefined, null, ""])("omits a missing key (%s)", (key) => {
    expect(buildSessionHeaders(key)).toEqual({});
  });
});
