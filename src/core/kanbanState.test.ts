import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as path from "node:path";

import { loadKanbanState } from "./kanbanState";
import type { GitInfo } from "./projectName";
import { fixturePath } from "../test/fixtures";

const BACKLOG_DIR = fixturePath("backlog-data");

function gitInfoOf(info: GitInfo) {
  return async (): Promise<GitInfo> => info;
}

describe("loadKanbanState", () => {
  it("ワークスペースを開いていなければ noWorkspace になる", async () => {
    const state = await loadKanbanState({
      folderPath: undefined,
      backlogDir: BACKLOG_DIR,
      getGitInfo: gitInfoOf({}),
    });

    assert.deepEqual(state, { kind: "noWorkspace" });
  });

  it("origin のリポジトリ名のバックログを優先して読み、パースした結果を返す", async () => {
    const state = await loadKanbanState({
      folderPath: "/home/user/work/project-a",
      backlogDir: BACKLOG_DIR,
      getGitInfo: gitInfoOf({
        originUrl: "git@github.com:user/project-b.git",
      }),
    });

    assert.equal(state.kind, "board");
    if (state.kind !== "board") return;
    assert.equal(state.projectName, "project-b");
    assert.equal(state.filePath, path.join(BACKLOG_DIR, "project-b.md"));
    assert.deepEqual(
      state.backlog.columns.todo.map((t) => t.title),
      ["タスクA"],
    );
  });

  it("どの候補のファイルもなければ、探した場所と候補を返す", async () => {
    const state = await loadKanbanState({
      folderPath: "/home/user/work/sub",
      backlogDir: BACKLOG_DIR,
      getGitInfo: gitInfoOf({ topLevel: "/home/user/work/missing" }),
    });

    assert.deepEqual(state, {
      kind: "notFound",
      backlogDir: BACKLOG_DIR,
      candidates: ["missing", "sub"],
    });
  });

  it("git の情報はフォルダのパスで問い合わせる", async () => {
    const asked: string[] = [];
    await loadKanbanState({
      folderPath: "/home/user/work/project-a",
      backlogDir: BACKLOG_DIR,
      getGitInfo: async (folderPath) => {
        asked.push(folderPath);
        return {};
      },
    });

    assert.deepEqual(asked, ["/home/user/work/project-a"]);
  });
});
