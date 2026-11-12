import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import { createTtlCache } from "./ttlCache";

/** 呼ばれたキーを記録し、`<キー>:<回数>` を返す読み込み */
function countingLoader() {
  const calls: string[] = [];
  const load = async (key: string): Promise<string> => {
    calls.push(key);
    return `${key}:${calls.filter((k) => k === key).length}`;
  };
  return { calls, load };
}

describe("createTtlCache", () => {
  it("期限内に同じキーで呼ばれたら、読み込み直さずに前の結果を返す", async () => {
    let time = 0;
    const { calls, load } = countingLoader();
    const get = createTtlCache(load, 1000, () => time);

    assert.equal(await get("a"), "a:1");
    time = 999;
    assert.equal(await get("a"), "a:1");
    assert.deepEqual(calls, ["a"]);
  });

  it("期限が切れたら読み込み直す", async () => {
    let time = 0;
    const { calls, load } = countingLoader();
    const get = createTtlCache(load, 1000, () => time);

    await get("a");
    time = 1000;
    assert.equal(await get("a"), "a:2");
    assert.deepEqual(calls, ["a", "a"]);
  });

  it("キーが違えば、それぞれ読み込む", async () => {
    const { calls, load } = countingLoader();
    const get = createTtlCache(load, 1000, () => 0);

    assert.equal(await get("a"), "a:1");
    assert.equal(await get("b"), "b:1");
    assert.deepEqual(calls, ["a", "b"]);
  });

  it("読み込み中に同じキーで呼ばれたら、同じ読み込みを待つ", async () => {
    const { calls, load } = countingLoader();
    const get = createTtlCache(load, 1000, () => 0);

    const results = await Promise.all([get("a"), get("a")]);

    assert.deepEqual(results, ["a:1", "a:1"]);
    assert.deepEqual(calls, ["a"]);
  });

  it("読み込みが失敗したら覚えず、次の呼び出しで読み込み直す", async () => {
    let attempts = 0;
    const get = createTtlCache(
      async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error("一時的な失敗");
        }
        return "ok";
      },
      1000,
      () => 0,
    );

    await assert.rejects(get("a"));
    assert.equal(await get("a"), "ok");
    assert.equal(attempts, 2);
  });
});
