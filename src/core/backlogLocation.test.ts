import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as path from "node:path";

import {
  defaultBacklogDir,
  findBacklogFile,
  listBacklogProjects,
} from "./backlogLocation";
import { fixturePath } from "../test/fixtures";

const BACKLOG_DIR = fixturePath("backlog-data");

describe("defaultBacklogDir", () => {
  it("ホームの下の .claude/backlog-data を指す", () => {
    assert.equal(
      defaultBacklogDir("/home/user"),
      path.join("/home/user", ".claude", "backlog-data"),
    );
  });
});

describe("findBacklogFile", () => {
  it("候補の順に探し、最初に見つかったファイルを返す", async () => {
    const found = await findBacklogFile(BACKLOG_DIR, [
      "missing",
      "project-b",
      "project-a",
    ]);

    assert.deepEqual(found, {
      name: "project-b",
      filePath: path.join(BACKLOG_DIR, "project-b.md"),
    });
  });

  it("どの候補のファイルもなければ undefined を返す", async () => {
    assert.equal(
      await findBacklogFile(BACKLOG_DIR, ["missing", "other"]),
      undefined,
    );
  });

  it("名前が .md で終わるフォルダはファイルとして扱わず、次の候補を探す", async () => {
    const found = await findBacklogFile(BACKLOG_DIR, [
      "folder-not-file",
      "project-a",
    ]);

    assert.equal(found?.name, "project-a");
  });

  it("フォルダ自体がなくても、エラーにならず undefined を返す", async () => {
    assert.equal(
      await findBacklogFile(path.join(BACKLOG_DIR, "no-such-dir"), [
        "project-a",
      ]),
      undefined,
    );
  });
});

describe("listBacklogProjects", () => {
  it("フォルダにある .md のファイルの名前を、拡張子を除いて名前順に返す", async () => {
    assert.deepEqual(await listBacklogProjects(BACKLOG_DIR), [
      "project-a",
      "project-b",
    ]);
  });

  it("フォルダ自体がなければ、エラーにならず空の一覧を返す", async () => {
    assert.deepEqual(
      await listBacklogProjects(path.join(BACKLOG_DIR, "no-such-dir")),
      [],
    );
  });
});
