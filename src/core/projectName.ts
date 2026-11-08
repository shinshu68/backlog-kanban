import { execFile } from "node:child_process";
import * as path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface GitInfo {
  /** origin の URL。リポジトリでない、origin がない、git がない場合は undefined */
  originUrl?: string;
  /** git のトップディレクトリのパス。リポジトリでない、git がない場合は undefined */
  topLevel?: string;
}

/**
 * バックログのファイル名の候補を、探す順に返す。
 * origin のリポジトリ名 → git のトップディレクトリ名 → フォルダ名の順で、重複は除く。
 */
export function projectNameCandidates(
  folderPath: string,
  git: GitInfo,
): string[] {
  const candidates = [
    git.originUrl === undefined ? undefined : repoNameFromUrl(git.originUrl),
    git.topLevel === undefined ? undefined : baseName(git.topLevel),
    baseName(folderPath),
  ];
  return [...new Set(candidates.filter((c): c is string => !!c))];
}

/**
 * origin の URL からリポジトリ名を取り出す。取り出せなければ undefined を返す。
 */
export function repoNameFromUrl(url: string): string | undefined {
  const withoutGit = url.endsWith(".git") ? url.slice(0, -".git".length) : url;
  const afterSlash = withoutGit.slice(withoutGit.lastIndexOf("/") + 1);
  const afterColon = afterSlash.slice(afterSlash.lastIndexOf(":") + 1);
  return afterColon || undefined;
}

/**
 * フォルダの git の情報を読む。読めなかった項目は undefined にする。
 */
export async function readGitInfo(folderPath: string): Promise<GitInfo> {
  const [originUrl, topLevel] = await Promise.all([
    runGit(folderPath, ["remote", "get-url", "origin"]),
    runGit(folderPath, ["rev-parse", "--show-toplevel"]),
  ]);
  return { originUrl, topLevel };
}

async function runGit(
  folderPath: string,
  args: string[],
): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", folderPath, ...args]);
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

// Windows の git は `C:/Users/...` のように `/` 区切りでパスを返すため、
// 実行環境の path ではなく、どちらの区切りも扱える win32 の basename を使う
function baseName(p: string): string {
  return path.win32.basename(p);
}
