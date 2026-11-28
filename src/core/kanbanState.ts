import {
  findBacklogFile,
  readBacklogFile,
  type FoundBacklog,
} from "./backlogLocation";
import { parseBacklog, type ParsedBacklog } from "./backlogParser";
import { projectNameCandidates, type GitInfo } from "./projectName";

export type KanbanState =
  | {
      kind: "board";
      projectName: string;
      filePath: string;
      backlog: ParsedBacklog;
    }
  | { kind: "noWorkspace" }
  | { kind: "notFound"; backlogDir: string; candidates: string[] }
  | { kind: "readError"; filePath: string; message: string };

export interface KanbanStateSource {
  /** 開いているフォルダのパス。ワークスペースを開いていなければ undefined */
  folderPath: string | undefined;
  backlogDir: string;
  getGitInfo: (folderPath: string) => Promise<GitInfo>;
  /** 一覧から選んだプロジェクト名。選んでいなければ undefined で、開いているフォルダから探す */
  selectedProject?: string;
}

export type BacklogLocation =
  | { kind: "found"; found: FoundBacklog }
  | Extract<KanbanState, { kind: "noWorkspace" | "notFound" }>;

/**
 * 表示するバックログのファイルを探す。
 * プロジェクトを選んでいればその名前のファイルを、選んでいなければ開いているフォルダに対応するファイルを探す。
 */
export async function locateBacklog(
  source: KanbanStateSource,
): Promise<BacklogLocation> {
  const candidates = await backlogCandidates(source);
  if (candidates === undefined) {
    return { kind: "noWorkspace" };
  }
  const found = await findBacklogFile(source.backlogDir, candidates);
  return found
    ? { kind: "found", found }
    : { kind: "notFound", backlogDir: source.backlogDir, candidates };
}

/**
 * 表示するバックログを探して読み、表示する状態を決める。
 */
export async function loadKanbanState(
  source: KanbanStateSource,
): Promise<KanbanState> {
  const candidates = await backlogCandidates(source);
  if (candidates === undefined) {
    return { kind: "noWorkspace" };
  }
  const read = await readBacklogFile(source.backlogDir, candidates);
  if (read === undefined) {
    return { kind: "notFound", backlogDir: source.backlogDir, candidates };
  }
  if (read.kind === "error") {
    return {
      kind: "readError",
      filePath: read.filePath,
      message:
        read.error instanceof Error ? read.error.message : String(read.error),
    };
  }
  return {
    kind: "board",
    projectName: read.name,
    filePath: read.filePath,
    backlog: parseBacklog(read.text),
  };
}

/**
 * 探すファイル名の候補を返す。ワークスペースを開いておらず、プロジェクトも選んでいなければ undefined を返す。
 */
async function backlogCandidates(
  source: KanbanStateSource,
): Promise<string[] | undefined> {
  const { folderPath, getGitInfo, selectedProject } = source;
  if (selectedProject !== undefined) {
    return [selectedProject];
  }
  if (folderPath === undefined) {
    return undefined;
  }
  return projectNameCandidates(folderPath, await getGitInfo(folderPath));
}
