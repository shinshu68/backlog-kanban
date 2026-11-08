import { readFile } from "node:fs/promises";

import { findBacklogFile } from "./backlogLocation";
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
}

/**
 * 開いているフォルダに対応するバックログを探して読み、表示する状態を決める。
 */
export async function loadKanbanState(
  source: KanbanStateSource,
): Promise<KanbanState> {
  const { folderPath, backlogDir, getGitInfo } = source;
  if (folderPath === undefined) {
    return { kind: "noWorkspace" };
  }

  const candidates = projectNameCandidates(
    folderPath,
    await getGitInfo(folderPath),
  );
  const found = await findBacklogFile(backlogDir, candidates);
  if (!found) {
    return { kind: "notFound", backlogDir, candidates };
  }

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
