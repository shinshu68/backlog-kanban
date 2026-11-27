import { readFile } from "node:fs/promises";

import { findBacklogFile, type FoundBacklog } from "./backlogLocation";
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
  const { folderPath, backlogDir, getGitInfo, selectedProject } = source;
  let candidates: string[];
  if (selectedProject !== undefined) {
    candidates = [selectedProject];
  } else if (folderPath === undefined) {
    return { kind: "noWorkspace" };
  } else {
    candidates = projectNameCandidates(
      folderPath,
      await getGitInfo(folderPath),
    );
  }

  const found = await findBacklogFile(backlogDir, candidates);
  return found
    ? { kind: "found", found }
    : { kind: "notFound", backlogDir, candidates };
}

/**
 * 表示するバックログを探して読み、表示する状態を決める。
 */
export async function loadKanbanState(
  source: KanbanStateSource,
): Promise<KanbanState> {
  const location = await locateBacklog(source);
  if (location.kind !== "found") {
    return location;
  }
  const { found } = location;

  try {
    const text = await readFile(found.filePath, "utf8");
    return {
      kind: "board",
      projectName: found.name,
      filePath: found.filePath,
      backlog: parseBacklog(text),
    };
  } catch (error) {
    return {
      kind: "readError",
      filePath: found.filePath,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
