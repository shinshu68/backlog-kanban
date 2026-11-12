import type { Priority, Status, Task } from "../core/backlogParser";
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

/**
 * 表示する状態から、Webview に渡す HTML の文書全体を作る。
 */
export function renderKanbanHtml(state: KanbanState): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <style>${STYLE}</style>
</head>
<body>
${renderBody(state)}
</body>
</html>`;
}

function renderBody(state: KanbanState): string {
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
      return `<p class="message">ワークスペースを開いていません。プロジェクトのフォルダを開いてから、もう一度カンバンを開いてください。</p>`;
    case "notFound":
      return [
        `<p class="message">このプロジェクトのバックログが見つかりません。</p>`,
        `<p>探した場所: <code>${escapeHtml(state.backlogDir)}</code></p>`,
        `<p>探したファイル名:</p>`,
        `<ul>${state.candidates
          .map((c) => `<li><code>${escapeHtml(c)}.md</code></li>`)
          .join("")}</ul>`,
      ].join("\n");
    case "readError":
      return [
        `<p class="message">バックログを読み込めませんでした。</p>`,
        `<p><code>${escapeHtml(state.filePath)}</code></p>`,
        `<pre>${escapeHtml(state.message)}</pre>`,
      ].join("\n");
  }
}

function renderUnparsed(
  unparsed: readonly { lineNumber: number; text: string }[],
): string {
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
  return `<article class="card"><details><summary class="heading">${heading}</summary>${notes}</details></article>`;
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
code, pre { font-family: var(--vscode-editor-font-family); }
`;
