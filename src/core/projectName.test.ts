import { describe, it, before, after } from "node:test";
import * as assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  projectNameCandidates,
  readGitInfo,
  repoNameFromUrl,
} from "./projectName";

describe("projectNameCandidates", () => {
  it("origin のリポジトリ名 → git のトップディレクトリ名 → フォルダ名の順に並べる", () => {
    const candidates = projectNameCandidates("/home/user/work/repo-dir/sub", {
      originUrl: "git@github.com:user/RepoName.git",
      topLevel: "/home/user/work/repo-dir",
    });

    assert.deepEqual(candidates, ["RepoName", "repo-dir", "sub"]);
  });

  it("同じ名前が重なるときは、最初の1つだけを残す", () => {
    const candidates = projectNameCandidates("/home/user/work/repo", {
      originUrl: "https://github.com/user/repo.git",
      topLevel: "/home/user/work/repo",
    });

    assert.deepEqual(candidates, ["repo"]);
  });

  it("git の情報がなければ、フォルダ名だけを返す", () => {
    assert.deepEqual(projectNameCandidates("/home/user/notes", {}), ["notes"]);
  });

  it("Windows の形式のパスからも名前を取り出す", () => {
    const candidates = projectNameCandidates("C:\\Users\\user\\work\\app", {
      topLevel: "C:/Users/user/work/app-root",
    });

    assert.deepEqual(candidates, ["app-root", "app"]);
  });
});

describe("repoNameFromUrl", () => {
  const cases: [string, string | undefined][] = [
    ["https://github.com/user/repo.git", "repo"],
    ["https://github.com/user/repo", "repo"],
    ["git@github.com:user/repo.git", "repo"],
    ["git@host:repo.git", "repo"],
    ["ssh://git@github.com/user/repo.git", "repo"],
    ["/srv/git/repo.git", "repo"],
    ["https://github.com/user/repo/", undefined],
  ];

  for (const [url, expected] of cases) {
    it(`${url} から ${expected ?? "何も取り出さない"}`, () => {
      assert.equal(repoNameFromUrl(url), expected);
    });
  }
});

/**
 * 実行環境の git の設定や、一時フォルダより上のリポジトリに結果が左右されないようにする。
 * readGitInfo が起動する git も process.env を引き継ぐので、process.env を書き換える。
 */
function isolateGitEnv(ceiling: string): void {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("GIT_")) {
      delete process.env[key];
    }
  }
  process.env.GIT_CONFIG_GLOBAL = os.devNull;
  process.env.GIT_CONFIG_NOSYSTEM = "1";
  process.env.GIT_CEILING_DIRECTORIES = ceiling;
}

function restoreEnv(saved: NodeJS.ProcessEnv): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in saved)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, saved);
}

describe("readGitInfo", () => {
  let tmpRoot: string;
  let savedEnv: NodeJS.ProcessEnv;

  before(() => {
    tmpRoot = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), "backlog-kanban-")),
    );
    savedEnv = { ...process.env };
    isolateGitEnv(tmpRoot);
  });

  after(() => {
    restoreEnv(savedEnv);
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  function git(cwd: string, ...args: string[]): void {
    execFileSync("git", args, { cwd, stdio: "ignore" });
  }

  it("リポジトリのサブフォルダから、origin の URL とトップディレクトリを読む", async () => {
    const repo = path.join(tmpRoot, "with-origin");
    const sub = path.join(repo, "sub");
    fs.mkdirSync(sub, { recursive: true });
    git(repo, "init", "--quiet");
    git(repo, "remote", "add", "origin", "git@github.com:user/remote-name.git");

    const info = await readGitInfo(sub);

    assert.deepEqual(info, {
      originUrl: "git@github.com:user/remote-name.git",
      topLevel: repo,
    });
  });

  it("origin がないリポジトリでは、トップディレクトリだけを読む", async () => {
    const repo = path.join(tmpRoot, "no-origin");
    fs.mkdirSync(repo);
    git(repo, "init", "--quiet");

    const info = await readGitInfo(repo);

    assert.deepEqual(info, { originUrl: undefined, topLevel: repo });
  });

  it("リポジトリでないフォルダでは、どちらも読まない", async () => {
    const plain = path.join(tmpRoot, "plain");
    fs.mkdirSync(plain);

    const info = await readGitInfo(plain);

    assert.deepEqual(info, { originUrl: undefined, topLevel: undefined });
  });
});
