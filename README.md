# Backlog Kanban

backlog スキルが管理するバックログ (`~/.claude/backlog-data/<プロジェクト名>.md`) を、VSCode のエディタ部分に「未着手」「進行中」「完了」の3列のカンバンで表示する拡張機能です。表示専用で、バックログのファイルは書き換えません。

## 使い方

1. プロジェクトのフォルダを開く
2. コマンドパレットから `Backlog Kanban: カンバンを開く` を実行する

開いているフォルダから、origin のリポジトリ名 → git のトップディレクトリ名 → フォルダ名の順にバックログのファイル名を探し、最初に見つかったものを表示します。ファイルを書き換えたあとは、コマンドを実行し直すと最新の内容になります。

## インストール

Marketplace には公開していないので、.vsix を作って手元の VSCode にインストールします。

### .vsix を作る

```sh
npm install
npm run package
```

プロジェクトのフォルダに `backlog-kanban-<バージョン>.vsix` ができます。

### インストールする

WSL に接続したウィンドウで、エクスプローラーの `backlog-kanban-<バージョン>.vsix` を右クリックし、「VSIX のインストール」を選びます。WSL 側の VSCode Server にインストールされます。

ターミナルから入れるときは、WSL に接続したウィンドウの統合ターミナルで次を実行します。古いターミナルでは `Unable to connect to VS Code server` (`connect ENOENT ...vscode-ipc-....sock`) と出て失敗することがあります。そのときは新しいターミナルを開くか、上の画面からの方法を使います。

```sh
code --install-extension backlog-kanban-0.0.1.vsix
```

インストールしたあと、開いているウィンドウを再読み込み (コマンドパレットの `Developer: Reload Window`) すると使えるようになります。

同じバージョンを入れ直すときは `--force` を付けます。

```sh
code --install-extension backlog-kanban-0.0.1.vsix --force
```

### アンインストールする

```sh
code --uninstall-extension shinshu68.backlog-kanban
```

## 開発

ビルド・テスト・動作確認の方法は [CLAUDE.md](CLAUDE.md)、開発方針は [docs/plan.md](docs/plan.md)、マイルストーンは [docs/roadmap.md](docs/roadmap.md) を参照してください。
