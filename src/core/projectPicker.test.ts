import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import { projectPickItems } from "./projectPicker";

describe("projectPickItems", () => {
  it("一覧の順のまま、プロジェクト名を項目にする", () => {
    assert.deepEqual(projectPickItems(["project-a", "project-b"], {}), [
      { label: "project-a" },
      { label: "project-b" },
    ]);
  });

  it("開いているフォルダのプロジェクトと表示中のプロジェクトに印を付ける", () => {
    assert.deepEqual(
      projectPickItems(["project-a", "project-b", "project-c"], {
        folderProject: "project-a",
        shownProject: "project-b",
      }),
      [
        { label: "project-a", description: "このフォルダ" },
        { label: "project-b", description: "表示中" },
        { label: "project-c" },
      ],
    );
  });

  it("このフォルダのプロジェクトを表示中なら、両方の印を付ける", () => {
    assert.deepEqual(
      projectPickItems(["project-a"], {
        folderProject: "project-a",
        shownProject: "project-a",
      }),
      [{ label: "project-a", description: "このフォルダ・表示中" }],
    );
  });
});
