import { describe, it, mock } from "node:test";
import * as assert from "node:assert/strict";
import * as path from "node:path";

import {
  createDebouncer,
  reloadTriggerPaths,
  shouldReloadOnChange,
} from "./autoRefresh";
import { parseBacklog } from "./backlogParser";
import type { KanbanState } from "./kanbanState";

const DIR = path.join(path.sep, "home", "user", ".claude", "backlog-data");

describe("reloadTriggerPaths", () => {
  function boardOf(
    projectName: string,
    candidates: string[],
  ): Extract<KanbanState, { kind: "board" }> {
    return {
      kind: "board",
      projectName,
      filePath: path.join(DIR, `${projectName}.md`),
      candidates,
      backlog: parseBacklog(""),
    };
  }

  it("カンバンの表示中は、表示中のファイルとそれより優先順位の高い候補のファイルを返す", () => {
    const state = boardOf("folder-x", ["origin-x", "top-x", "folder-x"]);

    assert.deepEqual(reloadTriggerPaths(state), [
      path.join(DIR, "origin-x.md"),
      path.join(DIR, "top-x.md"),
      path.join(DIR, "folder-x.md"),
    ]);
  });

  it("優先順位の低い候補のファイルは返さない", () => {
    const state = boardOf("origin-x", ["origin-x", "folder-x"]);

    assert.deepEqual(reloadTriggerPaths(state), [path.join(DIR, "origin-x.md")]);
  });

  it("選んだプロジェクトの表示中は、表示中のファイルだけを返す", () => {
    const state = boardOf("project-a", ["project-a"]);

    assert.deepEqual(reloadTriggerPaths(state), [path.join(DIR, "project-a.md")]);
  });
});

describe("shouldReloadOnChange", () => {
  const triggers = [path.join(DIR, "origin-x.md"), path.join(DIR, "folder-x.md")];

  it("きっかけのファイルのどれかが変わったら読み直す", () => {
    assert.equal(shouldReloadOnChange(path.join(DIR, "origin-x.md"), triggers), true);
    assert.equal(shouldReloadOnChange(path.join(DIR, "folder-x.md"), triggers), true);
  });

  it("きっかけでないファイルが変わっても読み直さない", () => {
    assert.equal(shouldReloadOnChange(path.join(DIR, "project-b.md"), triggers), false);
  });

  it("書き方が違っても同じパスなら、きっかけのファイルとして扱う", () => {
    assert.equal(
      shouldReloadOnChange(`${DIR}${path.sep}.${path.sep}folder-x.md`, triggers),
      true,
    );
  });

  it("ドライブ文字の大文字・小文字だけが違うパスは、同じファイルとして扱う", () => {
    assert.equal(
      shouldReloadOnChange("c:\\Users\\user\\backlog\\a.md", [
        "C:\\Users\\user\\backlog\\a.md",
      ]),
      true,
    );
  });

  it("ドライブ文字より後ろの大文字・小文字が違うパスは、別のファイルとして扱う", () => {
    assert.equal(
      shouldReloadOnChange(path.join(DIR, "Folder-X.md"), [path.join(DIR, "folder-x.md")]),
      false,
    );
  });

  it("きっかけが undefined なら、どのファイルが変わっても読み直す", () => {
    assert.equal(
      shouldReloadOnChange(path.join(DIR, "project-b.md"), undefined),
      true,
    );
  });
});

describe("createDebouncer", () => {
  it("続けて予約されたら、最後の予約から待ち時間が過ぎたときに1回だけ実行する", () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      let calls = 0;
      const debouncer = createDebouncer(() => calls++, 200);

      debouncer.schedule();
      mock.timers.tick(150);
      debouncer.schedule();
      mock.timers.tick(150);
      assert.equal(calls, 0);
      mock.timers.tick(50);
      assert.equal(calls, 1);
    } finally {
      mock.timers.reset();
    }
  });

  it("取り消した予約は実行しない", () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      let calls = 0;
      const debouncer = createDebouncer(() => calls++, 200);

      debouncer.schedule();
      debouncer.cancel();
      mock.timers.tick(500);
      assert.equal(calls, 0);
    } finally {
      mock.timers.reset();
    }
  });
});
