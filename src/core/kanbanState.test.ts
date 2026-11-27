import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { loadKanbanState, locateBacklog } from "./kanbanState";
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
      ["タスクB"],
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

  it(
    "ファイルは見つかったが読めないときは、ファイルのパスと理由を返す",
    // root は権限を外しても読めてしまうため、この確かめ方ができない
    { skip: process.getuid?.() === 0 },
    async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "backlog-kanban-"));
      const filePath = path.join(dir, "unreadable.md");
      fs.writeFileSync(filePath, "## 進行中\n");
      fs.chmodSync(filePath, 0o000);
      try {
        const state = await loadKanbanState({
          folderPath: "/home/user/work/unreadable",
          backlogDir: dir,
          getGitInfo: gitInfoOf({}),
        });

        assert.equal(state.kind, "readError");
        if (state.kind !== "readError") return;
        assert.equal(state.filePath, filePath);
        assert.match(state.message, /EACCES/);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  );

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

  it("プロジェクトを選んでいれば、開いているフォルダより選んだプロジェクトを読む", async () => {
    const state = await loadKanbanState({
      folderPath: "/home/user/work/project-a",
      backlogDir: BACKLOG_DIR,
      getGitInfo: gitInfoOf({}),
      selectedProject: "project-b",
    });

    assert.equal(state.kind, "board");
    if (state.kind !== "board") return;
    assert.equal(state.projectName, "project-b");
  });

  it("ワークスペースを開いていなくても、選んだプロジェクトは読める", async () => {
    const state = await loadKanbanState({
      folderPath: undefined,
      backlogDir: BACKLOG_DIR,
      getGitInfo: gitInfoOf({}),
      selectedProject: "project-a",
    });

    assert.equal(state.kind, "board");
  });

  it("選んだプロジェクトのファイルがなければ、その名前だけを探した候補として返す", async () => {
    const state = await loadKanbanState({
      folderPath: "/home/user/work/project-a",
      backlogDir: BACKLOG_DIR,
      getGitInfo: gitInfoOf({}),
      selectedProject: "removed",
    });

    assert.deepEqual(state, {
      kind: "notFound",
      backlogDir: BACKLOG_DIR,
      candidates: ["removed"],
    });
  });

  it("プロジェクトを選んでいれば、git の情報を問い合わせない", async () => {
    let asked = false;
    await loadKanbanState({
      folderPath: "/home/user/work/project-a",
      backlogDir: BACKLOG_DIR,
      getGitInfo: async () => {
        asked = true;
        return {};
      },
      selectedProject: "project-b",
    });

    assert.equal(asked, false);
  });
});

describe("locateBacklog", () => {
  it("見つかったファイルを、ファイルを読まずに返す", async () => {
    const location = await locateBacklog({
      folderPath: "/home/user/work/project-a",
      backlogDir: BACKLOG_DIR,
      getGitInfo: gitInfoOf({}),
    });

    assert.deepEqual(location, {
      kind: "found",
      found: {
        name: "project-a",
        filePath: path.join(BACKLOG_DIR, "project-a.md"),
      },
    });
  });
});
