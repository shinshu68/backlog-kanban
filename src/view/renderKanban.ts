import { SWITCH_COMMAND_ID } from "../commandIds";
import type {
  Priority,
  Status,
  Task,
  UnparsedLine,
} from "../core/backlogParser";
import type { KanbanState } from "../core/kanbanState";

const COLUMNS: readonly { status: Status; label: string }[] = [
  { status: "todo", label: "未着手" },
  { status: "inProgress", label: "進行中" },
  { status: "done", label: "完了" },
];

const PRIORITY_CLASS: Readonly<Record<Priority, string | undefined>> = {
  高: "priority-high",
  中: "priority-medium",
  低: "priority-low",
  未設定: undefined,
};

/** 拡張機能から Webview へ、表示する中身を送るメッセージの種類 */
export const RENDER_MESSAGE_TYPE = "render";
/** Webview のスクリプトが動き始めたことを拡張機能に知らせるメッセージの種類 */
export const READY_MESSAGE_TYPE = "ready";

/** 画面に出す状態。バックログを読んだ結果に、読み込み中と読み込みの失敗を加えたもの */
export type ScreenState =
  | KanbanState
  | { kind: "loading" }
  | { kind: "loadFailed"; message: string };

export interface RenderMessage {
  type: typeof RENDER_MESSAGE_TYPE;
  /**
   * 表示している画面の区別。変わったら、覚えていたカードの開閉とスクロール位置を捨てる。
   * 読み込み中のような仮の画面では null で、覚えている開閉とスクロール位置を変えない
   */
  key: string | null;
  html: string;
}

/**
 * Webview に1回だけ設定するページを作る。中身は空で、renderMessage で作ったメッセージを受けて描く。
 * nonce は、ページの中のスクリプトだけを動かせるようにするための、表示ごとに作る乱数。
 */
export function renderKanbanPage(nonce: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <style>${STYLE}</style>
</head>
<body>
<div id="root"></div>
<script nonce="${nonce}">${SCRIPT}</script>
</body>
</html>`;
}

/**
 * 表示する状態から、Webview に送るメッセージを作る。
 */
export function renderMessage(
  state: ScreenState,
  projects: readonly string[] = [],
): RenderMessage {
  return {
    type: RENDER_MESSAGE_TYPE,
    key: screenKey(state),
    html: renderKanbanContent(state, projects),
  };
}

function screenKey(state: ScreenState): string | null {
  switch (state.kind) {
    case "board":
      return `board:${state.projectName}`;
    case "loading":
      return null;
    default:
      return state.kind;
  }
}

/**
 * 表示する状態から、ページの中に差し込む HTML を作る。
 * projects は、ワークスペースを開いていないときやバックログが見つからないときに、選べるように並べるプロジェクト名。
 */
export function renderKanbanContent(
  state: ScreenState,
  projects: readonly string[] = [],
): string {
  switch (state.kind) {
    case "board":
      return [
        `<header><h1>${escapeHtml(state.projectName)}</h1>`,
        `<p class="path">${escapeHtml(state.filePath)}</p></header>`,
        renderUnparsed(state.backlog.unparsed),
        `<main class="board">`,
        ...COLUMNS.map(({ status, label }) =>
          renderColumn(label, state.backlog.columns[status], status),
        ),
        `</main>`,
      ].join("\n");
    case "noWorkspace":
      return [
        `<p class="message">ワークスペースを開いていません。表示するプロジェクトを一覧から選んでください。</p>`,
        renderProjectLinks(projects),
      ].join("\n");
    case "notFound":
      return [
        `<p class="message">このプロジェクトのバックログが見つかりません。</p>`,
        `<p>探した場所: <code>${escapeHtml(state.backlogDir)}</code></p>`,
        `<p>探したファイル名:</p>`,
        `<ul>${state.candidates
          .map((c) => `<li><code>${escapeHtml(c)}.md</code></li>`)
          .join("")}</ul>`,
        renderProjectLinks(projects),
      ].join("\n");
    case "loading":
      return `<p class="message">読み込み中…</p>`;
    case "loadFailed":
      return [
        `<p class="message">カンバンを表示できませんでした。</p>`,
        `<pre>${escapeHtml(state.message)}</pre>`,
      ].join("\n");
    case "readError":
      return [
        `<p class="message">バックログを読み込めませんでした。</p>`,
        `<p><code>${escapeHtml(state.filePath)}</code></p>`,
        `<pre>${escapeHtml(state.message)}</pre>`,
      ].join("\n");
  }
}

function renderProjectLinks(projects: readonly string[]): string {
  if (projects.length === 0) {
    return `<section class="projects"><h2>プロジェクトを選ぶ</h2><p>選べるバックログがありません。</p></section>`;
  }
  const links = projects
    .map((name) => {
      const href = `command:${SWITCH_COMMAND_ID}?${encodeURIComponent(JSON.stringify([name]))}`;
      return `<li><a href="${escapeHtml(href)}">${escapeHtml(name)}</a></li>`;
    })
    .join("");
  return `<section class="projects"><h2>プロジェクトを選ぶ</h2><ul>${links}</ul></section>`;
}

function renderUnparsed(unparsed: readonly UnparsedLine[]): string {
  if (unparsed.length === 0) {
    return "";
  }
  const lines = unparsed
    .map(
      (u) =>
        `<li><span class="line-number">${u.lineNumber}行目</span> <code>${escapeHtml(u.text)}</code></li>`,
    )
    .join("");
  return `<section class="unparsed"><p>解釈できなかった行が ${unparsed.length} 件あります。</p><ul>${lines}</ul></section>`;
}

function renderColumn(
  label: string,
  tasks: readonly Task[],
  status: Status,
): string {
  const cards = tasks.map((task) => renderCard(task, status)).join("\n");
  return `<section class="column" data-status="${status}">
<h2>${label} <span class="count">${tasks.length}</span></h2>
${cards}
</section>`;
}

function renderCard(task: Task, status: Status): string {
  const heading = `<span class="id">${escapeHtml(task.id)}</span>${renderPriority(task.priority)}<span class="title">${escapeHtml(task.title)}</span>`;
  if (task.notes.length === 0) {
    return `<article class="card"><div class="heading">${heading}</div></article>`;
  }
  const notes = `<ul class="notes">${task.notes
    .map((note) => `<li>${escapeHtml(note)}</li>`)
    .join("")}</ul>`;
  if (status === "inProgress") {
    return `<article class="card"><div class="heading">${heading}</div>${notes}</article>`;
  }
  return `<article class="card"><details data-task-id="${escapeHtml(task.id)}"><summary class="heading">${heading}</summary>${notes}</details></article>`;
}

function renderPriority(priority: Priority): string {
  const className = PRIORITY_CLASS[priority];
  return className
    ? `<span class="priority ${className}">${priority}</span>`
    : "";
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 中身を丸ごと差し替えると開いた details が閉じるため、タスクの ID で開閉を覚えて開き直す。
// タブが隠れると Webview は作り直されるため、開閉とスクロール位置は setState にも残す
const SCRIPT = `
(() => {
  const vscode = acquireVsCodeApi();
  const root = document.getElementById("root");
  let saved = vscode.getState() || { key: undefined, openIds: [], scrollY: 0 };
  let restoreScroll = true;
  let placeholder = false;
  const save = () => vscode.setState(saved);

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || message.type !== ${JSON.stringify(RENDER_MESSAGE_TYPE)}) {
      return;
    }
    if (message.key === null) {
      placeholder = true;
      restoreScroll = true;
      root.innerHTML = message.html;
      return;
    }
    placeholder = false;
    const sameScreen = message.key === saved.key;
    if (!sameScreen) {
      saved = { key: message.key, openIds: [], scrollY: 0 };
    }
    root.innerHTML = message.html;
    const openIds = new Set(saved.openIds);
    for (const details of root.querySelectorAll("details[data-task-id]")) {
      details.open = openIds.has(details.dataset.taskId);
    }
    if (!sameScreen) {
      window.scrollTo(0, 0);
    } else if (restoreScroll) {
      window.scrollTo(0, saved.scrollY);
    }
    restoreScroll = false;
    save();
  });

  root.addEventListener("toggle", (event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.dataset.taskId) {
      return;
    }
    const openIds = new Set(saved.openIds);
    if (details.open) {
      openIds.add(details.dataset.taskId);
    } else {
      openIds.delete(details.dataset.taskId);
    }
    saved.openIds = [...openIds];
    save();
  }, true);

  let scrollTimer;
  window.addEventListener("scroll", () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      if (placeholder) {
        return;
      }
      saved.scrollY = window.scrollY;
      save();
    }, 100);
  });

  vscode.postMessage({ type: ${JSON.stringify(READY_MESSAGE_TYPE)} });
})();
`;

const STYLE = `
body {
  color: var(--vscode-foreground);
  background-color: var(--vscode-editor-background);
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  padding: 0 16px 16px;
}
header h1 { font-size: 1.4em; margin: 12px 0 0; }
.path { color: var(--vscode-descriptionForeground); margin: 4px 0 12px; word-break: break-all; }
.board {
  display: grid;
  grid-template-columns: repeat(3, minmax(220px, 1fr));
  gap: 12px;
  align-items: start;
}
.column {
  background-color: var(--vscode-sideBar-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  padding: 8px;
}
.column h2 { font-size: 1.1em; margin: 4px 4px 8px; }
.count { color: var(--vscode-descriptionForeground); font-weight: normal; }
.card {
  background-color: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  padding: 6px 8px;
  margin-bottom: 6px;
}
.heading { display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; }
summary.heading { display: list-item; cursor: pointer; }
summary.heading > span { margin-right: 6px; }
.id { color: var(--vscode-descriptionForeground); font-family: var(--vscode-editor-font-family); }
.priority {
  border: 1px solid currentColor;
  border-radius: 3px;
  padding: 0 4px;
  font-size: 0.85em;
}
.priority-high { color: var(--vscode-charts-red); }
.priority-medium { color: var(--vscode-charts-orange); }
.priority-low { color: var(--vscode-charts-blue); }
.notes {
  margin: 6px 0 0;
  padding-left: 18px;
  color: var(--vscode-descriptionForeground);
}
.unparsed {
  border: 1px solid var(--vscode-inputValidation-warningBorder);
  background-color: var(--vscode-inputValidation-warningBackground);
  border-radius: 4px;
  padding: 4px 12px;
  margin-bottom: 12px;
}
.unparsed ul { padding-left: 18px; }
.line-number { color: var(--vscode-descriptionForeground); }
.message { font-size: 1.1em; margin-top: 16px; }
.projects h2 { font-size: 1.1em; margin: 16px 0 4px; }
.projects a { color: var(--vscode-textLink-foreground); }
.projects a:hover { color: var(--vscode-textLink-activeForeground); }
code, pre { font-family: var(--vscode-editor-font-family); }
`;
