import * as vscode from "vscode";

/**
 * 拡張機能の起動時に呼ばれ、カンバンを開くコマンドを登録する。
 */
export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("backlogKanban.open", openKanbanPanel),
  );
}

export function deactivate(): void {}

function openKanbanPanel(): void {
  const panel = vscode.window.createWebviewPanel(
    "backlogKanban",
    "Backlog Kanban",
    vscode.ViewColumn.Active,
  );
  panel.webview.html = renderPlaceholderHtml();
}

function renderPlaceholderHtml(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <style>
    body {
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
    }
  </style>
</head>
<body>
  <p>バックログの読み込みは未実装です。</p>
</body>
</html>`;
}
