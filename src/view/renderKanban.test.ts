import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import { parseBacklog } from "../core/backlogParser";
import type { KanbanState } from "../core/kanbanState";
import { readFixture } from "../test/fixtures";
import {
  escapeHtml,
  renderKanbanContent,
  renderKanbanPage,
  renderMessage,
} from "./renderKanban";

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

describe("renderKanbanContent", () => {
  it("左から未着手・進行中・完了の順に3列を並べ、各列にタスクの件数を出す", () => {
    const html = renderKanbanContent(boardOf(readFixture("backlog-full.md")));

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
    const html = renderKanbanContent(boardOf(readFixture("backlog-full.md")));
    const todo = columnHtml(html, "todo");

    const positions = ["#002", "#003", "#005"].map((id) => todo.indexOf(id));
    assert.ok(positions.every((i) => i >= 0));
    assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  });

  it("進行中のタスクのメモは、開閉なしで常に出す", () => {
    const inProgress = columnHtml(
      renderKanbanContent(boardOf(readFixture("backlog-full.md"))),
      "inProgress",
    );

    assert.match(inProgress, /<li>タスクDのメモ1行目<\/li>/);
    assert.doesNotMatch(inProgress, /<details/);
  });

  it("未着手・完了のタスクのメモは、開閉できる details の中に出す", () => {
    const html = renderKanbanContent(boardOf(readFixture("backlog-full.md")));

    assert.match(
      columnHtml(html, "todo"),
      /<details[^>]*><summary[^>]*>.*タスクB.*<\/summary><ul class="notes"><li>タスクBのメモ<\/li>/,
    );
    assert.match(
      columnHtml(html, "done"),
      /<details[^>]*><summary[^>]*>.*タスクA.*<\/summary><ul class="notes"><li>タスクAのメモ<\/li>/,
    );
  });

  it("優先度の高・中・低にはバッジを付け、未設定には付けない", () => {
    const html = renderKanbanContent(boardOf(readFixture("backlog-full.md")));

    assert.match(html, /<span class="priority priority-high">高<\/span>/);
    assert.match(html, /<span class="priority priority-medium">中<\/span>/);
    assert.match(html, /<span class="priority priority-low">低<\/span>/);
    assert.doesNotMatch(html, /未設定/);
  });

  it("解釈できなかった行があれば、件数と行番号付きの内容を出す", () => {
    const html = renderKanbanContent(boardOf(readFixture("backlog-malformed.md")));

    assert.match(html, /解釈できなかった行が 6 件あります。/);
    assert.match(html, /2行目<\/span> <code>- \[ \] \*\*#009\*\*/);
  });

  it("解釈できなかった行がなければ、その欄を出さない", () => {
    const html = renderKanbanContent(boardOf(readFixture("backlog-full.md")));

    assert.doesNotMatch(html, /解釈できなかった行/);
  });

  it("タスクのタイトルやメモの HTML の特殊文字はエスケープする", () => {
    const text = [
      "## 進行中",
      "- [ ] **#001** `優先度:高` <script>alert(1)</script>",
      "      > a & b",
    ].join("\n");

    const html = renderKanbanContent(boardOf(text));

    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(html, /<li>a &amp; b<\/li>/);
  });

  it("バックログが見つからないときは、探した場所とファイル名の候補を出す", () => {
    const html = renderKanbanContent({
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
      renderKanbanContent({ kind: "noWorkspace" }),
      /ワークスペースを開いていません/,
    );
  });

  it("ワークスペースを開いていないときは、プロジェクトを切り替えるコマンドのリンクを名前ごとに並べる", () => {
    const html = renderKanbanContent({ kind: "noWorkspace" }, [
      "project-a",
      "project-b",
    ]);

    const hrefs = [...html.matchAll(/<a href="([^"]*)">([^<]*)<\/a>/g)].map(
      (m) => [m[1], m[2]],
    );
    assert.deepEqual(hrefs, [
      [
        `command:backlogKanban.switchProject?${encodeURIComponent('["project-a"]')}`,
        "project-a",
      ],
      [
        `command:backlogKanban.switchProject?${encodeURIComponent('["project-b"]')}`,
        "project-b",
      ],
    ]);
  });

  it("バックログが見つからないときも、探した場所と並べてプロジェクトのリンクを出す", () => {
    const html = renderKanbanContent(
      {
        kind: "notFound",
        backlogDir: "/home/user/.claude/backlog-data",
        candidates: ["repo"],
      },
      ["project-a"],
    );

    assert.match(html, /<code>repo\.md<\/code>/);
    assert.match(html, /<a href="command:backlogKanban\.switchProject\?[^"]*">project-a<\/a>/);
  });

  it("プロジェクト名の HTML の特殊文字は、リンクの先と表示の両方でエスケープする", () => {
    const html = renderKanbanContent({ kind: "noWorkspace" }, [`a'<b>`]);

    assert.match(html, /<a href="[^"<>]*&#39;[^"<>]*">a&#39;&lt;b&gt;<\/a>/);
  });

  it("選べるプロジェクトがなければ、リンクの代わりにその旨を出す", () => {
    const html = renderKanbanContent({ kind: "noWorkspace" }, []);

    assert.match(html, /選べるバックログがありません/);
    assert.doesNotMatch(html, /<a href=/);
  });

  it("読み込みに失敗したときは、その旨とエスケープしたエラーの内容を出す", () => {
    const html = renderKanbanContent({
      kind: "loadFailed",
      message: "<git> failed",
    });

    assert.match(html, /カンバンを表示できませんでした/);
    assert.match(html, /<pre>&lt;git&gt; failed<\/pre>/);
  });

  it("開閉できるカードには、開閉を覚えるためのタスクの ID を付ける", () => {
    const todo = columnHtml(
      renderKanbanContent(boardOf(readFixture("backlog-full.md"))),
      "todo",
    );

    assert.match(todo, /<details data-task-id="#002">/);
  });
});

describe("renderKanbanPage", () => {
  it("渡した nonce のスクリプトだけを許す Content-Security-Policy を付ける", () => {
    const html = renderKanbanPage("abc123");

    assert.match(
      html,
      /default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-abc123';/,
    );
    assert.match(html, /<script nonce="abc123">/);
    assert.equal(html.match(/<script/g)?.length, 1);
  });
});

describe("renderMessage", () => {
  it("中身の HTML と、表示中のプロジェクトで区別する画面の key を持つ", () => {
    const message = renderMessage(boardOf(readFixture("backlog-full.md")));

    assert.equal(message.type, "render");
    assert.equal(message.key, "board:project-a");
    assert.match(message.html, /data-status="todo"/);
  });

  it("カンバン以外の画面では、画面の種類を key にする", () => {
    assert.equal(renderMessage({ kind: "noWorkspace" }).key, "noWorkspace");
    assert.equal(
      renderMessage({ kind: "loadFailed", message: "x" }).key,
      "loadFailed",
    );
  });

  it("読み込み中は、覚えている開閉とスクロール位置を変えないよう key を null にする", () => {
    const message = renderMessage({ kind: "loading" });

    assert.equal(message.key, null);
    assert.match(message.html, /読み込み中/);
  });
});

describe("escapeHtml", () => {
  it("& < > \" ' をエスケープする", () => {
    assert.equal(escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
  });
});
