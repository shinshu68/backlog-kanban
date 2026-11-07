import { readFileSync } from "node:fs";
import * as path from "node:path";

// テストは out/test/ にビルドされたものが動き、tsc は .md をコピーしないため、
// out/ ではなくプロジェクトのルートから src/test/fixtures/ を指す
const FIXTURES_DIR = path.resolve(__dirname, "../../src/test/fixtures");

/**
 * src/test/fixtures/ にあるフィクスチャのファイルを UTF-8 の文字列で読む。
 */
export function readFixture(name: string): string {
  return readFileSync(path.join(FIXTURES_DIR, name), "utf8");
}
