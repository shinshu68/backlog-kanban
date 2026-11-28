import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import * as path from "node:path";

import { defaultBacklogDir } from "./backlogLocation";

/** WSL が止まっているときの起動を待つための上限 */
const WSL_TIMEOUT_MS = 10_000;
/** 失敗した解決を覚えておく時間。WSL を起動したあとに、開き直さずに戻れるよう短くする */
const WSL_FAILURE_TTL_MS = 60_000;

export type BacklogDirResolution =
  | { kind: "resolved"; dir: string }
  | {
      kind: "unavailable";
      /** 解決しようとしたパス。パスを求める前に失敗したときは undefined */
      dir?: string;
      message: string;
    };

export interface BacklogDirSource {
  /** 設定で指定したフォルダのパス。空なら undefined */
  settingDir: string | undefined;
  platform: NodeJS.Platform;
  homeDir: string;
  /** WSL 側の backlog-data のパスを Windows の形式で返す。求められなければ reject する */
  resolveWslDir: () => Promise<string>;
}

/**
 * backlog-data のフォルダのパスを決め、フォルダがあるかを確かめる。
 * 設定で指定していればその値を、なければ Windows では WSL 側のパスを、それ以外ではホームの下のパスを使う。
 */
export async function resolveBacklogDir(
  source: BacklogDirSource,
): Promise<BacklogDirResolution> {
  const { settingDir, platform, homeDir, resolveWslDir } = source;
  let dir: string;
  if (settingDir !== undefined) {
    if (!pathModule(platform).isAbsolute(settingDir)) {
      return {
        kind: "unavailable",
        dir: settingDir,
        message: "設定のパスは絶対パスで指定してください。",
      };
    }
    dir = settingDir;
  } else if (platform === "win32") {
    try {
      dir = await resolveWslDir();
    } catch (error) {
      return {
        kind: "unavailable",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  } else {
    dir = defaultBacklogDir(homeDir);
  }
  return (await isDirectory(dir))
    ? { kind: "resolved", dir }
    : { kind: "unavailable", dir, message: "フォルダがありません。" };
}

function pathModule(platform: NodeJS.Platform): path.PlatformPath {
  return platform === "win32" ? path.win32 : path.posix;
}

async function isDirectory(dir: string): Promise<boolean> {
  try {
    return (await stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

export interface CommandResult {
  exitCode: number | null;
  stdout: Buffer;
  stderr: Buffer;
  /** 上限の時間を過ぎて止めたとき true */
  timedOut: boolean;
  /** コマンドを起動できなかったとき (コマンドがないなど) の理由 */
  spawnError?: string;
}

export type RunCommand = (
  file: string,
  args: readonly string[],
  options: { timeoutMs: number; env: Readonly<Record<string, string>> },
) => Promise<CommandResult>;

/**
 * wsl.exe で WSL 側の `~/.claude/backlog-data` を Windows の形式のパスにして返す。
 * 求められなければ、理由を書いたエラーで reject する。
 */
export async function resolveWslBacklogDir(
  run: RunCommand = runCommand,
): Promise<string> {
  // `sh -c` に引用符付きの `$HOME/...` を渡すと Windows のコマンドラインで引用符が崩れるため、
  // `--cd ~` でホームに移ってから相対パスを渡す
  const result = await run(
    "wsl.exe",
    ["--cd", "~", "-e", "wslpath", "-a", "-w", ".claude/backlog-data"],
    // wsl.exe 自身のメッセージは既定では UTF-16LE で出るため、UTF-8 で出させる
    { timeoutMs: WSL_TIMEOUT_MS, env: { WSL_UTF8: "1" } },
  );
  if (result.spawnError !== undefined) {
    throw new Error(`wsl.exe を起動できませんでした: ${result.spawnError}`);
  }
  if (result.timedOut) {
    throw new Error(
      `wsl.exe が ${WSL_TIMEOUT_MS / 1000} 秒以内に応答しませんでした。`,
    );
  }
  const output = result.stdout.toString("utf8").trim();
  if (result.exitCode !== 0 || !output.startsWith("\\\\")) {
    const detail = result.stderr.toString("utf8").trim();
    throw new Error(
      `wsl.exe で backlog-data のパスを求められませんでした (終了コード ${result.exitCode})。${detail}`,
    );
  }
  return output;
}

function runCommand(
  file: string,
  args: readonly string[],
  options: { timeoutMs: number; env: Readonly<Record<string, string>> },
): Promise<CommandResult> {
  return new Promise((resolve) => {
    execFile(
      file,
      [...args],
      {
        encoding: "buffer",
        timeout: options.timeoutMs,
        env: { ...process.env, ...options.env },
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const code = (error as { code?: unknown } | null)?.code;
        const timedOut = !!(error as { killed?: boolean } | null)?.killed;
        resolve({
          exitCode: error ? (typeof code === "number" ? code : null) : 0,
          stdout,
          stderr,
          timedOut,
          spawnError:
            error && typeof code === "string" && !timedOut
              ? error.message
              : undefined,
        });
      },
    );
  });
}

/**
 * load の結果を覚えて返す関数を作る。成功した結果はずっと覚え、失敗 (reject) は failureTtlMs の間だけ覚える。
 * 読み込み中に呼ばれたときは、同じ読み込みを待つ。
 */
export function createResolveCache<V>(
  load: () => Promise<V>,
  failureTtlMs: number = WSL_FAILURE_TTL_MS,
  now: () => number = Date.now,
): () => Promise<V> {
  let cached: { value: Promise<V>; expiresAt: number } | undefined;
  return () => {
    if (cached && now() < cached.expiresAt) {
      return cached.value;
    }
    const value = load();
    const entry = { value, expiresAt: Infinity };
    cached = entry;
    value.catch(() => {
      entry.expiresAt = now() + failureTtlMs;
    });
    return value;
  };
}
