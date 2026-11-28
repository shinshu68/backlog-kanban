import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as path from "node:path";

import {
  defaultBacklogDir,
  findBacklogFile,
  listBacklogProjects,
  readBacklogFile,
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

describe("readBacklogFile", () => {
  it("候補の順に読み、最初に読めたファイルの名前・パス・中身を返す", async () => {
    const read = await readBacklogFile(BACKLOG_DIR, ["missing", "project-b"]);

    assert.equal(read?.kind, "read");
    if (read?.kind !== "read") return;
    assert.equal(read.name, "project-b");
    assert.equal(read.filePath, path.join(BACKLOG_DIR, "project-b.md"));
    assert.match(read.text, /タスクB/);
  });

  it("名前が .md で終わるフォルダは読まずに、次の候補を読む", async () => {
    const read = await readBacklogFile(BACKLOG_DIR, [
      "folder-not-file",
      "project-a",
    ]);

    assert.equal(read?.kind === "read" ? read.name : undefined, "project-a");
  });

  it("どの候補のファイルもなければ undefined を返す", async () => {
    assert.equal(
      await readBacklogFile(BACKLOG_DIR, ["missing", "other"]),
      undefined,
    );
  });

  it("フォルダ自体がなくても、エラーにならず undefined を返す", async () => {
    assert.equal(
      await readBacklogFile(path.join(BACKLOG_DIR, "no-such-dir"), [
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
