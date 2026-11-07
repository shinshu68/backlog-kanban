import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import { parseBacklog } from "./backlogParser";
import { readFixture } from "../test/fixtures";

describe("parseBacklog", () => {
  it("タスクをセクションに応じた列に、ファイルの順のまま振り分ける", () => {
    const { columns } = parseBacklog(readFixture("backlog-full.md"));

    assert.deepEqual(
      columns.inProgress.map((t) => t.id),
      ["#004", "#006"],
    );
    assert.deepEqual(
      columns.todo.map((t) => t.id),
      ["#002", "#003", "#005"],
    );
    assert.deepEqual(
      columns.done.map((t) => t.id),
      ["#001"],
    );
  });

  it("各タスクの優先度・タイトル・詳細メモを読み取る", () => {
    const { columns } = parseBacklog(readFixture("backlog-full.md"));

    assert.deepEqual(columns.inProgress, [
      {
        id: "#004",
        priority: "高",
        title: "タスクD",
        notes: ["タスクDのメモ1行目", "タスクDのメモ2行目"],
      },
      { id: "#006", priority: "未設定", title: "タスクF", notes: [] },
    ]);
    assert.deepEqual(columns.todo[0], {
      id: "#002",
      priority: "中",
      title: "タスクB",
      notes: ["タスクBのメモ"],
    });
    assert.deepEqual(columns.done[0].notes, ["タスクAのメモ"]);
  });

  it("書式どおりのファイルでは、解釈できなかった行が出ない", () => {
    const { unparsed } = parseBacklog(readFixture("backlog-full.md"));

    assert.deepEqual(unparsed, []);
  });

  it("タスクが0件のバックログは、3列とも空になる", () => {
    const result = parseBacklog(readFixture("backlog-empty.md"));

    assert.deepEqual(result, {
      columns: { inProgress: [], todo: [], done: [] },
      unparsed: [],
    });
  });

  it("空のセクションがあっても、他のセクションのタスクを読み取る", () => {
    const { columns, unparsed } = parseBacklog(
      readFixture("backlog-one-empty-section.md"),
    );

    assert.deepEqual(columns.inProgress, []);
    assert.deepEqual(
      columns.todo.map((t) => t.id),
      ["#002"],
    );
    assert.deepEqual(
      columns.done.map((t) => t.id),
      ["#001"],
    );
    assert.deepEqual(unparsed, []);
  });

  it("空の文字列を渡しても、エラーにならず3列とも空になる", () => {
    const result = parseBacklog("");

    assert.deepEqual(result, {
      columns: { inProgress: [], todo: [], done: [] },
      unparsed: [],
    });
  });

  it("書式に合わない行を、行番号と内容のまま解釈できなかった行に残す", () => {
    const { unparsed } = parseBacklog(readFixture("backlog-malformed.md"));

    assert.deepEqual(unparsed, [
      { lineNumber: 2, text: "- [ ] **#009** `優先度:高` 見出しより前のタスク" },
      { lineNumber: 5, text: "> どのタスクにも付いていないメモ" },
      { lineNumber: 6, text: "- [ ] **#004** `優先度:最高` タスクD" },
      { lineNumber: 9, text: "- [ ] タスクFのIDなし" },
      { lineNumber: 11, text: "## 保留" },
      { lineNumber: 12, text: "- [ ] **#006** `優先度:中` タスクG" },
    ]);
  });

  it("書式に合わない行があっても、前後の正しいタスクは列に入る", () => {
    const { columns } = parseBacklog(readFixture("backlog-malformed.md"));

    assert.deepEqual(columns.inProgress, [
      { id: "#005", priority: "高", title: "タスクE", notes: ["タスクEのメモ"] },
    ]);
    assert.deepEqual(
      columns.todo.map((t) => t.id),
      ["#002"],
    );
    assert.deepEqual(columns.done, []);
  });

  it("CRLF の改行でも、LF と同じように読み取る", () => {
    const lf = readFixture("backlog-full.md");
    const crlf = lf.replace(/\n/g, "\r\n");

    assert.deepEqual(parseBacklog(crlf), parseBacklog(lf));
  });
});
