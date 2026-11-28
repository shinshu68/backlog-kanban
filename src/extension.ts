import { randomBytes } from "node:crypto";
import * as os from "node:os";
import * as vscode from "vscode";

import { OPEN_COMMAND_ID, SWITCH_COMMAND_ID } from "./commandIds";
import {
  defaultBacklogDir,
  listBacklogProjects,
} from "./core/backlogLocation";
import {
  createDebouncer,
  shouldReloadOnChange,
} from "./core/autoRefresh";
import { loadKanbanState, locateBacklog } from "./core/kanbanState";
import { readGitInfo } from "./core/projectName";
import { projectPickItems } from "./core/projectPicker";
import { createTtlCache } from "./core/ttlCache";
import {
  READY_MESSAGE_TYPE,
  renderKanbanPage,
  renderMessage,
  type RenderMessage,
  type ScreenState,
} from "./view/renderKanban";

const PANEL_VIEW_TYPE = "backlogKanban";
const GIT_INFO_TTL_MS = 60_000;
const RELOAD_DELAY_MS = 200;

const getGitInfo = createTtlCache(readGitInfo, GIT_INFO_TTL_MS);

let currentPanel: vscode.WebviewPanel | undefined;
/** 一覧から選んだプロジェクト名。カンバンのタブを閉じるまで保つ */
let selectedProject: string | undefined;
/** カンバンに表示中のプロジェクト名。バックログを表示していなければ undefined */
let shownProject: string | undefined;
/**
 * カンバンに表示中のファイルのパス。バックログを表示していないときと、読み込み中は undefined で、
 * どのファイルの変更でも読み直す
 */
let shownFilePath: string | undefined;
/**
 * 自動更新で読み直すプロジェクト名。undefined なら開いているフォルダから探す。
 * 表示中のファイルが消えても、別の候補のプロジェクトへ移らずに同じプロジェクトを待つために使う
 */
let followProject: string | undefined;
/** 最後に Webview へ送った中身。Webview が作り直されたときに送り直す */
let latestMessage: RenderMessage | undefined;
/** 最後に始めた読み込みの番号。古い読み込みの結果で描き直さないために使う */
let latestLoadId = 0;

/**
 * 拡張機能の起動時に呼ばれ、コマンドとステータスバーの入口を登録する。
 */
export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(OPEN_COMMAND_ID, openKanbanPanel),
    vscode.commands.registerCommand(SWITCH_COMMAND_ID, switchProject),
    createStatusBarEntry(),
  );
}

function createStatusBarEntry(): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(
    "backlogKanban.statusBar",
    vscode.StatusBarAlignment.Left,
  );
  item.name = "Backlog Kanban";
  item.text = "$(project) Backlog";
  item.tooltip = "カンバンを開く";
  item.command = OPEN_COMMAND_ID;
  item.show();
  return item;
}

async function openKanbanPanel(): Promise<void> {
  await showKanban();
}

/**
 * 表示するプロジェクトを切り替える。
 * 一覧から選ぶ画面のリンクからはプロジェクト名が渡され、そのまま表示する。
 * タイトルバーのボタンやコマンドパレットからは、クイックピックで選ばせる。
 */
async function switchProject(project?: unknown): Promise<void> {
  const backlogDir = backlogDirPath();
  const projects = await listBacklogProjects(backlogDir);
  if (typeof project === "string") {
    // 名前はそのままファイルのパスになるため、"../x" のような一覧にない名前で
    // backlog-data の外を読まないよう、一覧にある名前だけを受け付ける
    if (projects.includes(project)) {
      await showKanban(project);
    } else {
      void vscode.window.showWarningMessage(
        `バックログが見つかりません: ${project}`,
      );
    }
    return;
  }
  if (projects.length === 0) {
    void vscode.window.showInformationMessage(
      `バックログが見つかりません: ${backlogDir}`,
    );
    return;
  }

  const folderLocation = await locateBacklog({
    folderPath: firstLocalFolderPath(),
    backlogDir,
    getGitInfo,
  });
  const picked = await vscode.window.showQuickPick(
    projectPickItems(projects, {
      folderProject:
        folderLocation.kind === "found" ? folderLocation.found.name : undefined,
      shownProject,
    }),
    { placeHolder: "表示するプロジェクトを選ぶ" },
  );
  if (picked) {
    await showKanban(picked.label);
  }
}

/**
 * カンバンのタブを開き (開いていれば前に出し)、表示するバックログを読み直して描く。
 * project を渡すと、タブを閉じるまでそのプロジェクトを表示する。
 * 新しく開いたときと project を渡したときは、読み終わるまで「読み込み中」を出す。
 */
async function showKanban(project?: string): Promise<void> {
  const showLoading = currentPanel === undefined || project !== undefined;
  const panel = currentPanel ?? createPanel();
  if (project !== undefined) {
    selectedProject = project;
  }
  panel.reveal();
  if (showLoading) {
    postScreen(panel, { kind: "loading" });
  }
  followProject = selectedProject;
  shownFilePath = undefined;
  await reloadKanban(panel, selectedProject);
}

/**
 * タブを前に出さずに、バックログを読み直して描く。
 * project を渡すとそのプロジェクトを、undefined なら開いているフォルダに対応するプロジェクトを読む。
 */
async function reloadKanban(
  panel: vscode.WebviewPanel,
  project: string | undefined,
): Promise<void> {
  const loadId = ++latestLoadId;
  let screen: ScreenState;
  let projects: string[] = [];
  try {
    const state = await loadKanbanState({
      folderPath: firstLocalFolderPath(),
      backlogDir: backlogDirPath(),
      getGitInfo,
      selectedProject: project,
    });
    if (state.kind === "noWorkspace" || state.kind === "notFound") {
      projects = await listBacklogProjects(backlogDirPath());
    }
    screen = state;
  } catch (error) {
    screen = {
      kind: "loadFailed",
      message: error instanceof Error ? error.message : String(error),
    };
  }
  if (panel !== currentPanel || loadId !== latestLoadId) {
    return;
  }
  shownProject = screen.kind === "board" ? screen.projectName : undefined;
  shownFilePath = screen.kind === "board" ? screen.filePath : undefined;
  followProject = screen.kind === "board" ? screen.projectName : project;
  panel.title =
    screen.kind === "board"
      ? `Backlog: ${screen.projectName}`
      : "Backlog Kanban";
  postScreen(panel, screen, projects);
}

function postScreen(
  panel: vscode.WebviewPanel,
  screen: ScreenState,
  projects: readonly string[] = [],
): void {
  latestMessage = renderMessage(screen, projects);
  void panel.webview.postMessage(latestMessage);
}

function createPanel(): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    PANEL_VIEW_TYPE,
    "Backlog Kanban",
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      enableCommandUris: [SWITCH_COMMAND_ID],
      localResourceRoots: [],
    },
  );
  panel.webview.html = renderKanbanPage(randomBytes(16).toString("base64"));
  // 隠れていたタブが再び表示されると Webview は作り直されて中身が空になるため、
  // スクリプトが動き始めた知らせを受けて最新の中身を送り直す
  panel.webview.onDidReceiveMessage((message: unknown) => {
    if (
      (message as { type?: unknown } | undefined)?.type ===
        READY_MESSAGE_TYPE &&
      latestMessage
    ) {
      void panel.webview.postMessage(latestMessage);
    }
  });
  const reload = createDebouncer(
    () => void reloadKanban(panel, followProject),
    RELOAD_DELAY_MS,
  );
  const watcher = watchBacklogDir((changedPath) => {
    if (shouldReloadOnChange(changedPath, shownFilePath)) {
      reload.schedule();
    }
  });
  panel.onDidDispose(() => {
    reload.cancel();
    watcher.dispose();
    currentPanel = undefined;
    selectedProject = undefined;
    shownProject = undefined;
    shownFilePath = undefined;
    followProject = undefined;
    latestMessage = undefined;
  });
  currentPanel = panel;
  return panel;
}

/**
 * バックログのフォルダ直下の .md のファイルの変更・作成・削除を監視し、変わったファイルのパスを渡す。
 */
function watchBacklogDir(
  onChange: (changedPath: string) => void,
): vscode.Disposable {
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(vscode.Uri.file(backlogDirPath()), "*.md"),
  );
  const listener = (uri: vscode.Uri) => onChange(uri.fsPath);
  return vscode.Disposable.from(
    watcher,
    watcher.onDidChange(listener),
    watcher.onDidCreate(listener),
    watcher.onDidDelete(listener),
  );
}

function backlogDirPath(): string {
  return defaultBacklogDir(os.homedir());
}

function firstLocalFolderPath(): string | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  return folder?.uri.scheme === "file" ? folder.uri.fsPath : undefined;
}
