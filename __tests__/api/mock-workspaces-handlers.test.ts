import { afterEach, describe, expect, it } from "vitest";

import WorkspacesService from "#/api/workspaces-service/workspaces-service.api";
import { resetMockWorkspaces } from "#/mocks/handlers";

const postJson = (path: string, body: unknown) =>
  fetch(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("mock workspaces handlers", () => {
  afterEach(() => {
    resetMockWorkspaces();
  });

  it("starts with an empty workspaces list", async () => {
    const response = await WorkspacesService.listWorkspaces();
    expect(response.workspaces).toEqual([]);
    expect(response.workspaceParents).toEqual([]);
  });

  it("persists added workspaces across list calls", async () => {
    await WorkspacesService.addWorkspaces([
      { id: "w1", name: "Project", path: "/workspace/project" },
    ]);

    const response = await WorkspacesService.listWorkspaces();
    expect(response.workspaces).toEqual([
      { id: "w1", name: "Project", path: "/workspace/project" },
    ]);
  });

  it("upserts a workspace when path already exists", async () => {
    await WorkspacesService.addWorkspaces([
      { id: "w1", name: "Old", path: "/workspace/project" },
    ]);
    await WorkspacesService.addWorkspaces([
      { id: "w2", name: "New", path: "/workspace/project" },
    ]);
    const response = await WorkspacesService.listWorkspaces();
    expect(response.workspaces).toHaveLength(1);
    expect(response.workspaces[0].name).toBe("New");
  });

  it("treats omitted workspace and parent collections as no-op updates", async () => {
    const workspacesResponse = await postJson("/api/workspaces", {});

    expect(workspacesResponse.status).toBe(200);
    await expect(workspacesResponse.json()).resolves.toEqual({
      workspaces: [],
      workspaceParents: [],
    });

    const parentsResponse = await postJson("/api/workspaces/parents", {});

    expect(parentsResponse.status).toBe(200);
    await expect(parentsResponse.json()).resolves.toEqual({
      workspaces: [],
      workspaceParents: [],
    });
  });

  it("removes a workspace by path", async () => {
    await WorkspacesService.addWorkspaces([
      { id: "w1", name: "Project", path: "/workspace/project" },
      { id: "w2", name: "Other", path: "/workspace/other" },
    ]);

    await WorkspacesService.removeWorkspace("/workspace/project");

    const response = await WorkspacesService.listWorkspaces();
    expect(response.workspaces.map((w) => w.path)).toEqual([
      "/workspace/other",
    ]);
  });

  it("persists workspace parents and removes them by path", async () => {
    await WorkspacesService.addWorkspaceParents([
      { id: "p1", name: "Repos", path: "/workspace/repos" },
    ]);

    const afterAdd = await WorkspacesService.listWorkspaces();
    expect(afterAdd.workspaceParents).toEqual([
      { id: "p1", name: "Repos", path: "/workspace/repos" },
    ]);

    await WorkspacesService.removeWorkspaceParent("/workspace/repos");

    const afterRemove = await WorkspacesService.listWorkspaces();
    expect(afterRemove.workspaceParents).toEqual([]);
  });

  it("replaces a workspace parent when its path is already registered", async () => {
    await postJson("/api/workspaces/parents", {
      parents: [{ id: "p1", name: "Old", path: "/workspace/repos" }],
    });

    const response = await postJson("/api/workspaces/parents", {
      parents: [{ id: "p2", name: "New", path: "/workspace/repos" }],
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      workspaces: [],
      workspaceParents: [{ id: "p2", name: "New", path: "/workspace/repos" }],
    });
  });

  it("acknowledges workspace session creation and deletion", async () => {
    const createResponse = await fetch(
      "http://localhost:3000/api/auth/workspace-session",
      { method: "POST" },
    );

    expect(createResponse.status).toBe(200);
    await expect(createResponse.json()).resolves.toEqual({ ok: true });

    const deleteResponse = await fetch(
      "http://localhost:3000/api/auth/workspace-session",
      { method: "DELETE" },
    );

    expect(deleteResponse.status).toBe(204);
    await expect(deleteResponse.text()).resolves.toBe("");
  });
});
