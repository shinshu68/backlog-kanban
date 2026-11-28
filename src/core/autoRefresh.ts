import * as path from "node:path";

/**
 * バックログのフォルダのファイルが変わったときに、カンバンを読み直すかを決める。
 * shownFilePath はカンバンに表示中のファイルのパスで、カンバン以外の画面 (一覧から選ぶ画面など) では undefined。
 * カンバンの表示中は表示中のファイルの変更だけで読み直し、それ以外の画面ではどのファイルの変更でも読み直す。
 */
export function shouldReloadOnChange(
  changedPath: string,
  shownFilePath: string | undefined,
): boolean {
  return (
    shownFilePath === undefined ||
    path.resolve(changedPath) === path.resolve(shownFilePath)
  );
}

export interface Debouncer {
  /** 実行を予約する。予約済みなら取り消し、delayMs 待ち直す */
  schedule(): void;
  /** 予約を取り消す */
  cancel(): void;
}

/**
 * 続けて予約されたら、最後の予約から delayMs 待って fn を1回だけ実行する。
 */
export function createDebouncer(fn: () => void, delayMs: number): Debouncer {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };
  return {
    schedule() {
      cancel();
      timer = setTimeout(() => {
        timer = undefined;
        fn();
      }, delayMs);
    },
    cancel,
  };
}
