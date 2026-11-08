import { stat } from "node:fs/promises";
import * as path from "node:path";

export interface FoundBacklog {
  /** 見つかったファイルの名前に使われていた候補 (拡張子なし) */
  name: string;
  filePath: string;
}

/**
 * backlog スキルがバックログを保存するフォルダのパスを返す。
 */
export function defaultBacklogDir(homeDir: string): string {
  return path.join(homeDir, ".claude", "backlog-data");
}

/**
 * 候補の順に `<候補>.md` を探し、最初に見つかったファイルを返す。
 * どれも見つからなければ undefined を返す。
 */
export async function findBacklogFile(
  backlogDir: string,
  candidates: readonly string[],
): Promise<FoundBacklog | undefined> {
  for (const name of candidates) {
    const filePath = path.join(backlogDir, `${name}.md`);
    if (await isFile(filePath)) {
      return { name, filePath };
    }
  }
  return undefined;
}

async function isFile(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}
