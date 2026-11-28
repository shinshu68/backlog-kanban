import { describe, it, mock } from "node:test";
import * as assert from "node:assert/strict";
import * as path from "node:path";

import { createDebouncer, shouldReloadOnChange } from "./autoRefresh";

const DIR = path.join(path.sep, "home", "user", ".claude", "backlog-data");

describe("shouldReloadOnChange", () => {
  it("カンバンの表示中は、表示中のファイルが変わったら読み直す", () => {
    const shown = path.join(DIR, "project-a.md");

    assert.equal(shouldReloadOnChange(path.join(DIR, "project-a.md"), shown), true);
  });

  it("カンバンの表示中は、別のプロジェクトのファイルが変わっても読み直さない", () => {
    const shown = path.join(DIR, "project-a.md");

    assert.equal(shouldReloadOnChange(path.join(DIR, "project-b.md"), shown), false);
  });

  it("書き方が違っても同じパスなら、表示中のファイルとして扱う", () => {
    const shown = path.join(DIR, "project-a.md");

    assert.equal(
      shouldReloadOnChange(`${DIR}${path.sep}.${path.sep}project-a.md`, shown),
      true,
    );
  });

  it("カンバン以外の画面では、どのファイルが変わっても読み直す", () => {
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
