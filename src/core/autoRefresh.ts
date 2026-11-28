import * as path from "node:path";

import type { KanbanState } from "./kanbanState";

/**
 * 表示中のカンバンを変えうるファイルのパスを返す。
 * 表示中のファイルと、それより優先順位の高い候補のファイルを返す。
 * 優先順位の低い候補のファイルは、表示中のファイルがある限り表示に使われないため含めない。
 */
export function reloadTriggerPaths(
  state: Extract<KanbanState, { kind: "board" }>,
): string[] {
  const backlogDir = path.dirname(state.filePath);
  const shownIndex = state.candidates.indexOf(state.projectName);
  return state.candidates
    .slice(0, shownIndex + 1)
    .map((name) => path.join(backlogDir, `${name}.md`));
}

/**
 * バックログのフォルダのファイルが変わったときに、カンバンを読み直すかを決める。
 * triggerPaths は reloadTriggerPaths で求めたパスで、undefined ならどのファイルの変更でも読み直す。
 */
export function shouldReloadOnChange(
  changedPath: string,
  triggerPaths: readonly string[] | undefined,
): boolean {
  if (triggerPaths === undefined) {
    return true;
  }
  const changed = comparablePath(changedPath);
  return triggerPaths.some(
    (triggerPath) => comparablePath(triggerPath) === changed,
  );
}

// Windows では、監視から届くパスはドライブ文字が小文字 (c:\...)、設定の値などから作るパスは大文字 (C:\...) のことがあるため、
// ドライブ文字だけ大文字にそろえる。ほかの部分は、大文字・小文字を区別する WSL 側のパスもあるためそろえない
function comparablePath(p: string): string {
  return path.resolve(p.replace(/^[a-z](?=:)/, (drive) => drive.toUpperCase()));
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
