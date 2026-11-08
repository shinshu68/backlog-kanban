# backlog-kanban

backlog スキルが管理するバックログ (`~/.claude/backlog-data/<プロジェクト名>.md`) を、VSCode のエディタ部分にカンバン形式で表示する拡張機能。表示専用で、バックログのファイルは書き換えない。

開発方針・スコープ・設計の詳細は docs/plan.md、マイルストーンと完了条件は docs/roadmap.md を参照する。

## 技術スタック

- TypeScript (VSCode 拡張機能)
- Webview は素の HTML/CSS/TypeScript。UI フレームワークは使わない
- 配布は .vsix のみ。Marketplace には公開しない
- テストは Node 標準の `node:test` で書く (docs/plan.md の「テスト」を参照)
- ビルドは `tsc` だけで、バンドラーは使わない。`src/` を `out/` に出力する

## ディレクトリ構成

設計上の分け方は docs/plan.md の「設計方針」を参照する。

- `src/extension.ts`: エントリーポイント。コマンドの登録
- `src/core/`: VSCode の API に依存しない処理 (パーサー、プロジェクト名の解決、データの置き場所の解決)。`vscode` を import しない
- `src/view/`: Webview の表示
- テストは対象と同じフォルダに `*.test.ts` で置く。フィクスチャは `src/test/fixtures/` に置く
  - テストは `out/` にビルドしたものを実行し、`tsc` はフィクスチャを `out/` へコピーしない。そのためテストから `__dirname` の相対パスでフィクスチャを読まず、プロジェクトのルートを起点にパスを解決するヘルパー (`src/test/fixtures.ts` の `readFixture`) を経由して読む

## コマンド

- 依存の導入: `npm install`
- ビルド: `npm run compile` (変更を監視するなら `npm run watch`)
- テスト: `npm test` (ビルドしてから `node --test` で `out/` の `*.test.js` を実行する)
- .vsix の作成: `npm run package`
- 手元で動かす: VSCode で F5 (Extension Development Host が開く)

## 動作確認

- パーサー・プロジェクト名の解決・データの置き場所の解決は、フィクスチャのファイルを使う単体テストで確かめる。実際の `~/.claude/backlog-data/` は読まない
- Webview の表示 (カンバンの見た目、テーマの切り替え、自動更新) は Claude からは見られないため、ユーザーに確認を頼む
  - 手順: Extension Development Host (F5) か、.vsix をインストールした VSCode でコマンドからカンバンを開く
  - 確かめてほしい点は、docs/roadmap.md の各マイルストーンの `実機:` の項目に書く
- WSL に接続したウィンドウと、Windows ローカルのウィンドウの両方で使うため、環境に関わる変更をしたときは、どちらのウィンドウで確かめてほしいかを明示して頼む

## プロジェクト固有のルール

- 拡張機能からバックログのファイルを書き換えない。作成・更新は backlog スキルだけが行う
- バックログの書式は、次のファイルの間でそろえる。片方だけ変えると、エラーが出ずに表示が崩れる
  - backlog スキルの SKILL.md の「ファイルフォーマット」 (dotfiles 側の `~/.claude/skills/backlog/SKILL.md`)
  - この拡張機能のパーサー (`src/core/backlogParser.ts`) と、そのテストのフィクスチャ (`src/test/fixtures/backlog-*.md`)
  - 書式を前提にしている他のスキル: pj-status の `scripts/collect.sh`、repo-create の `scripts/create_backlog.sh`
- 次の値は、対でそろえる
  - コマンドの ID (`backlogKanban.open`): `package.json` の `contributes.commands` と `src/extension.ts` の `registerCommand`。片方だけ変えると、エラーが出ずにコマンドが動かなくなる
  - VSCode の版: `package.json` の `engines.vscode` と `devDependencies` の `@types/vscode`。型の版を engines より新しくすると .vsix を作れない
- プロジェクト名からバックログのファイルを探す順序 (origin のリポジトリ名 → git のトップディレクトリ名 → ディレクトリ名) は、この拡張機能の `src/core/projectName.ts` と、pj-status の `scripts/collect.sh` の `name_candidates` とでそろえる。origin の URL からリポジトリ名を取り出す方法 (末尾の `.git` を除き、最後の `/` と `:` より後ろを取る) も同じにする
- テスト用のバックログのフィクスチャには、実際のバックログのタスク名を使わない。「タスクA」のような架空のタイトルにする
