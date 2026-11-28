# Backlog Kanban

backlog スキルが管理するバックログ (`~/.claude/backlog-data/<プロジェクト名>.md`) を、VSCode のエディタ部分に「未着手」「進行中」「完了」の3列のカンバンで表示する拡張機能です。表示専用で、バックログのファイルは書き換えません。

## 使い方

1. プロジェクトのフォルダを開く
2. ステータスバーの左側にある `Backlog` をクリックするか、コマンドパレットから `Backlog Kanban: カンバンを開く` を実行する

開いているフォルダから、origin のリポジトリ名 → git のトップディレクトリ名 → フォルダ名の順にバックログのファイル名を探し、最初に見つかったものを表示します。カンバンのタブを開いている間は、表示中のバックログのファイルが書き換わると、自動で最新の内容に描き直します。

別のプロジェクトのバックログを見るときは、カンバンのタブのタイトルバーにある切り替えのボタンを押すか、コマンドパレットから `Backlog Kanban: プロジェクトを切り替える` を実行し、一覧から選びます。選んだプロジェクトは、カンバンのタブを閉じるまで表示し続けます。ワークスペースを開いていないときや、開いているフォルダのバックログが見つからないときは、カンバンのタブにプロジェクトの一覧が出るので、そこから選べます。

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
