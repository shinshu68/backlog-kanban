import * as os from "node:os";
import * as vscode from "vscode";

import { defaultBacklogDir } from "./core/backlogLocation";
import { loadKanbanState } from "./core/kanbanState";
import { readGitInfo } from "./core/projectName";
import { createTtlCache } from "./core/ttlCache";
import { renderKanbanHtml } from "./view/renderKanban";

const GIT_INFO_TTL_MS = 60_000;

const getGitInfo = createTtlCache(readGitInfo, GIT_INFO_TTL_MS);

let currentPanel: vscode.WebviewPanel | undefined;
/** 最後に始めた読み込みの番号。古い読み込みの結果で描き直さないために使う */
let latestLoadId = 0;

/**
 * 拡張機能の起動時に呼ばれ、カンバンを開くコマンドを登録する。
 */
export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("backlogKanban.open", openKanbanPanel),
  );
}

async function openKanbanPanel(): Promise<void> {
  const panel = currentPanel ?? createPanel();
  panel.reveal();

  const loadId = ++latestLoadId;
  const state = await loadKanbanState({
    folderPath: firstLocalFolderPath(),
    backlogDir: defaultBacklogDir(os.homedir()),
    getGitInfo,
  });
  if (panel !== currentPanel || loadId !== latestLoadId) {
    return;
  }
  panel.title =
    state.kind === "board" ? `Backlog: ${state.projectName}` : "Backlog Kanban";
  panel.webview.html = renderKanbanHtml(state);
}

function createPanel(): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    "backlogKanban",
    "Backlog Kanban",
    vscode.ViewColumn.Active,
  );
  panel.onDidDispose(() => {
    currentPanel = undefined;
  });
  currentPanel = panel;
  return panel;
}

function firstLocalFolderPath(): string | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  return folder?.uri.scheme === "file" ? folder.uri.fsPath : undefined;
}
