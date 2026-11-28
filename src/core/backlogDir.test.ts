import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  createResolveCache,
  resolveBacklogDir,
  resolveWslBacklogDir,
  type CommandResult,
  type RunCommand,
} from "./backlogDir";
import { fixturePath } from "../test/fixtures";

const BACKLOG_DIR = fixturePath("backlog-data");

function failingWslDir(): () => Promise<string> {
  return async () => {
    throw new Error("WSL の解決は呼ばれないはず");
  };
}

describe("resolveBacklogDir", () => {
  it("設定でパスを指定していれば、WSL の解決より設定の値を使う", async () => {
    let wslCalls = 0;
    const resolution = await resolveBacklogDir({
      settingDir: BACKLOG_DIR,
      platform: "win32",
      homeDir: "/home/user",
      resolveWslDir: async () => {
        wslCalls++;
        return "\\\\wsl.localhost\\Ubuntu\\home\\user\\.claude\\backlog-data";
      },
    });

    assert.deepEqual(resolution, { kind: "resolved", dir: BACKLOG_DIR });
    assert.equal(wslCalls, 0);
  });

  it("設定でパスを指定していれば、ホームの下のパスより設定の値を使う", async () => {
    const resolution = await resolveBacklogDir({
      settingDir: BACKLOG_DIR,
      platform: "linux",
      homeDir: "/home/no-such-user",
      resolveWslDir: failingWslDir(),
    });

    assert.deepEqual(resolution, { kind: "resolved", dir: BACKLOG_DIR });
  });

  it("設定のパスが相対パスなら、使えないことを返す", async () => {
    const resolution = await resolveBacklogDir({
      settingDir: "backlog-data",
      platform: "linux",
      homeDir: "/home/user",
      resolveWslDir: failingWslDir(),
    });

    assert.equal(resolution.kind, "unavailable");
    assert.equal(resolution.kind === "unavailable" && resolution.dir, "backlog-data");
  });

  it("設定のフォルダがなければ、使えないことと探したパスを返す", async () => {
    const missing = path.join(BACKLOG_DIR, "no-such-dir");
    const resolution = await resolveBacklogDir({
      settingDir: missing,
      platform: "linux",
      homeDir: "/home/user",
      resolveWslDir: failingWslDir(),
    });

    assert.deepEqual(resolution, {
      kind: "unavailable",
      dir: missing,
      message: "フォルダがありません。",
    });
  });

  it("設定のパスがファイルなら、使えないことを返す", async () => {
    const resolution = await resolveBacklogDir({
      settingDir: path.join(BACKLOG_DIR, "project-a.md"),
      platform: "linux",
      homeDir: "/home/user",
      resolveWslDir: failingWslDir(),
    });

    assert.equal(resolution.kind, "unavailable");
  });

  it("Windows で設定がなければ、WSL 側のパスを使う", async () => {
    const resolution = await resolveBacklogDir({
      settingDir: undefined,
      platform: "win32",
      homeDir: "C:\\Users\\user",
      resolveWslDir: async () => BACKLOG_DIR,
    });

    assert.deepEqual(resolution, { kind: "resolved", dir: BACKLOG_DIR });
  });

  it("Windows で WSL 側のパスを求められなければ、その理由を返す", async () => {
    const resolution = await resolveBacklogDir({
      settingDir: undefined,
      platform: "win32",
      homeDir: "C:\\Users\\user",
      resolveWslDir: async () => {
        throw new Error("wsl.exe を起動できませんでした");
      },
    });

    assert.deepEqual(resolution, {
      kind: "unavailable",
      message: "wsl.exe を起動できませんでした",
    });
  });

  it("Windows 以外で設定がなければ、ホームの下の .claude/backlog-data を使う", async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "backlog-kanban-"));
    try {
      const dir = path.join(home, ".claude", "backlog-data");
      fs.mkdirSync(dir, { recursive: true });

      const resolution = await resolveBacklogDir({
        settingDir: undefined,
        platform: "linux",
        homeDir: home,
        resolveWslDir: failingWslDir(),
      });

      assert.deepEqual(resolution, { kind: "resolved", dir });
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("resolveWslBacklogDir", () => {
  function runReturning(result: Partial<CommandResult>): {
    run: RunCommand;
    calls: Parameters<RunCommand>[];
  } {
    const calls: Parameters<RunCommand>[] = [];
    return {
      calls,
      run: async (...call) => {
        calls.push(call);
        return {
          exitCode: 0,
          stdout: Buffer.alloc(0),
          stderr: Buffer.alloc(0),
          timedOut: false,
          ...result,
        };
      },
    };
  }

  it("wsl.exe の wslpath の出力から、末尾の改行を除いたパスを返す", async () => {
    const { run, calls } = runReturning({
      stdout: Buffer.from(
        "\\\\wsl.localhost\\Ubuntu\\home\\user\\.claude\\backlog-data\r\n",
      ),
    });

    assert.equal(
      await resolveWslBacklogDir(run),
      "\\\\wsl.localhost\\Ubuntu\\home\\user\\.claude\\backlog-data",
    );
    const [file, args, options] = calls[0];
    assert.equal(file, "wsl.exe");
    assert.ok(args.includes("wslpath"));
    assert.equal(options.env.WSL_UTF8, "1");
  });

  it("終了コードが 0 以外なら、エラーのメッセージを添えて reject する", async () => {
    const { run } = runReturning({
      exitCode: 4294967295,
      stderr: Buffer.from("エラーE\r\n"),
    });

    await assert.rejects(resolveWslBacklogDir(run), /終了コード 4294967295.*エラーE/);
  });

  it("出力が Windows の UNC パスでなければ reject する", async () => {
    const { run } = runReturning({ stdout: Buffer.from("/home/user\n") });

    await assert.rejects(resolveWslBacklogDir(run));
  });

  it("時間内に応答しなければ reject する", async () => {
    const { run } = runReturning({ exitCode: null, timedOut: true });

    await assert.rejects(resolveWslBacklogDir(run), /応答しませんでした/);
  });

  it("wsl.exe を起動できなければ、その理由で reject する", async () => {
    const { run } = runReturning({
      exitCode: null,
      spawnError: "spawn wsl.exe ENOENT",
    });

    await assert.rejects(resolveWslBacklogDir(run), /起動できませんでした.*ENOENT/);
  });
});

describe("createResolveCache", () => {
  it("成功した結果は、時間が経っても読み込み直さない", async () => {
    let time = 0;
    let calls = 0;
    const get = createResolveCache(async () => ++calls, 60_000, () => time);

    assert.equal(await get(), 1);
    time += 24 * 60 * 60 * 1000;
    assert.equal(await get(), 1);
    assert.equal(calls, 1);
  });

  it("失敗は覚えておく時間の間だけ返し、過ぎたら読み込み直す", async () => {
    let time = 0;
    let calls = 0;
    const get = createResolveCache(
      async () => {
        calls++;
        throw new Error("失敗");
      },
      60_000,
      () => time,
    );

    await assert.rejects(get());
    time += 59_999;
    await assert.rejects(get());
    assert.equal(calls, 1);
    time += 1;
    await assert.rejects(get());
    assert.equal(calls, 2);
  });

  it("読み込み中に呼ばれたら、同じ読み込みを待つ", async () => {
    let calls = 0;
    const get = createResolveCache(async () => ++calls);

    const [a, b] = await Promise.all([get(), get()]);

    assert.equal(a, 1);
    assert.equal(b, 1);
    assert.equal(calls, 1);
  });
});
