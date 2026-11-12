import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import { parseBacklog } from "../core/backlogParser";
import type { KanbanState } from "../core/kanbanState";
import { readFixture } from "../test/fixtures";
import { escapeHtml, renderKanbanHtml } from "./renderKanban";

function boardOf(text: string): KanbanState {
  return {
    kind: "board",
    projectName: "project-a",
    filePath: "/home/user/.claude/backlog-data/project-a.md",
    backlog: parseBacklog(text),
  };
}

/** data-status の列の section を抜き出す */
function columnHtml(html: string, status: string): string {
  const match = new RegExp(
    `<section class="column" data-status="${status}">([\\s\\S]*?)</section>`,
  ).exec(html);
  assert.ok(match, `${status} の列がない`);
  return match[1];
}

describe("renderKanbanHtml", () => {
  it("左から未着手・進行中・完了の順に3列を並べ、各列にタスクの件数を出す", () => {
    const html = renderKanbanHtml(boardOf(readFixture("backlog-full.md")));

    const order = ["todo", "inProgress", "done"].map((s) =>
      html.indexOf(`data-status="${s}"`),
    );
    assert.ok(order.every((i) => i >= 0));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    assert.match(columnHtml(html, "inProgress"), /進行中 <span class="count">2<\/span>/);
    assert.match(columnHtml(html, "todo"), /未着手 <span class="count">3<\/span>/);
    assert.match(columnHtml(html, "done"), /完了 <span class="count">1<\/span>/);
  });

  it("列の中のタスクは、ファイルの順に並べる", () => {
    const html = renderKanbanHtml(boardOf(readFixture("backlog-full.md")));
    const todo = columnHtml(html, "todo");

    const positions = ["#002", "#003", "#005"].map((id) => todo.indexOf(id));
    assert.ok(positions.every((i) => i >= 0));
    assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  });

  it("進行中のタスクのメモは、開閉なしで常に出す", () => {
    const inProgress = columnHtml(
      renderKanbanHtml(boardOf(readFixture("backlog-full.md"))),
      "inProgress",
    );

    assert.match(inProgress, /<li>タスクDのメモ1行目<\/li>/);
    assert.doesNotMatch(inProgress, /<details>/);
  });

  it("未着手・完了のタスクのメモは、開閉できる details の中に出す", () => {
    const html = renderKanbanHtml(boardOf(readFixture("backlog-full.md")));

    assert.match(
      columnHtml(html, "todo"),
      /<details><summary[^>]*>.*タスクB.*<\/summary><ul class="notes"><li>タスクBのメモ<\/li>/,
    );
    assert.match(
      columnHtml(html, "done"),
      /<details><summary[^>]*>.*タスクA.*<\/summary><ul class="notes"><li>タスクAのメモ<\/li>/,
    );
  });

  it("優先度の高・中・低にはバッジを付け、未設定には付けない", () => {
    const html = renderKanbanHtml(boardOf(readFixture("backlog-full.md")));

    assert.match(html, /<span class="priority priority-high">高<\/span>/);
    assert.match(html, /<span class="priority priority-medium">中<\/span>/);
    assert.match(html, /<span class="priority priority-low">低<\/span>/);
    assert.doesNotMatch(html, /未設定/);
  });

  it("解釈できなかった行があれば、件数と行番号付きの内容を出す", () => {
    const html = renderKanbanHtml(boardOf(readFixture("backlog-malformed.md")));

    assert.match(html, /解釈できなかった行が 6 件あります。/);
    assert.match(html, /2行目<\/span> <code>- \[ \] \*\*#009\*\*/);
  });

  it("解釈できなかった行がなければ、その欄を出さない", () => {
    const html = renderKanbanHtml(boardOf(readFixture("backlog-full.md")));

    assert.doesNotMatch(html, /解釈できなかった行/);
  });

  it("タスクのタイトルやメモの HTML の特殊文字はエスケープする", () => {
    const text = [
      "## 進行中",
      "- [ ] **#001** `優先度:高` <script>alert(1)</script>",
      "      > a & b",
    ].join("\n");

    const html = renderKanbanHtml(boardOf(text));

    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(html, /<li>a &amp; b<\/li>/);
  });

  it("バックログが見つからないときは、探した場所とファイル名の候補を出す", () => {
    const html = renderKanbanHtml({
      kind: "notFound",
      backlogDir: "/home/user/.claude/backlog-data",
      candidates: ["repo", "dir"],
    });

    assert.match(html, /バックログが見つかりません/);
    assert.match(html, /<code>\/home\/user\/\.claude\/backlog-data<\/code>/);
    assert.match(html, /<li><code>repo\.md<\/code><\/li><li><code>dir\.md<\/code><\/li>/);
  });

  it("ワークスペースを開いていないときは、その旨を出す", () => {
    assert.match(
      renderKanbanHtml({ kind: "noWorkspace" }),
      /ワークスペースを開いていません/,
    );
  });

  it("スクリプトを許さない Content-Security-Policy を付ける", () => {
    const html = renderKanbanHtml({ kind: "noWorkspace" });

    assert.match(html, /default-src 'none'; style-src 'unsafe-inline';/);
  });
});

describe("escapeHtml", () => {
  it("& < > \" ' をエスケープする", () => {
    assert.equal(escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
  });
});
