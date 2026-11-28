import { readFile, readdir, stat } from "node:fs/promises";
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

export type BacklogRead =
  | { kind: "read"; name: string; filePath: string; text: string }
  | { kind: "error"; filePath: string; error: unknown };

/**
 * 候補の順に `<候補>.md` を読み、最初に読めたファイルの中身を返す。
 * ファイルがない・フォルダだったときは次の候補へ進み、それ以外の理由で読めなければ、そのファイルのエラーを返す。
 * どれも見つからなければ undefined を返す。
 */
export async function readBacklogFile(
  backlogDir: string,
  candidates: readonly string[],
): Promise<BacklogRead | undefined> {
  for (const name of candidates) {
    const filePath = path.join(backlogDir, `${name}.md`);
    try {
      const text = await readFile(filePath, "utf8");
      return { kind: "read", name, filePath, text };
    } catch (error) {
      if (!isMissingFileError(error)) {
        return { kind: "error", filePath, error };
      }
    }
  }
  return undefined;
}

function isMissingFileError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "ENOENT" || code === "EISDIR";
}

/**
 * フォルダにあるバックログのプロジェクト名 (`.md` のファイル名から拡張子を除いたもの) を名前順に返す。
 * フォルダが読めなければ空の一覧を返す。
 */
export async function listBacklogProjects(
  backlogDir: string,
): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(backlogDir);
  } catch {
    return [];
  }
  const names: string[] = [];
  for (const entry of entries) {
    if (
      entry.endsWith(".md") &&
      (await isFile(path.join(backlogDir, entry)))
    ) {
      names.push(entry.slice(0, -".md".length));
    }
  }
  return names.sort((a, b) => a.localeCompare(b));
}

async function isFile(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}
