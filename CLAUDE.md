# backlog-kanban

backlog スキルが管理するバックログ (`~/.claude/backlog-data/<プロジェクト名>.md`) を、VSCode のエディタ部分にカンバン形式で表示する拡張機能。表示専用で、バックログのファイルは書き換えない。

開発方針・スコープ・設計の詳細は docs/plan.md、マイルストーンと完了条件は docs/roadmap.md を参照する。

## 技術スタック

- TypeScript (VSCode 拡張機能)
- Webview は素の HTML/CSS/TypeScript。UI フレームワークは使わない
- 配布は .vsix のみ。Marketplace には公開しない
- 詳細なビルド・テストの構成は、ひな形を作成したあとに確定する (docs/plan.md の未決事項を参照)

## ディレクトリ構成

ひな形の作成後に確定する。設計上の分け方は docs/plan.md の「設計方針」を参照する。

## コマンド

ひな形の作成後に確定して、ここに書く。

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
  - この拡張機能のパーサー (場所はひな形の作成後に追記する)
  - 書式を前提にしている他のスキル: pj-status の `scripts/collect.sh`、repo-create の `scripts/create_backlog.sh`
- プロジェクト名からバックログのファイルを探す順序 (origin のリポジトリ名 → git のトップディレクトリ名 → ディレクトリ名) は、pj-status の `scripts/collect.sh` の `name_candidates` とそろえる
- テスト用のバックログのフィクスチャには、実際のバックログのタスク名を使わない。「タスクA」のような架空のタイトルにする
