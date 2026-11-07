export type Status = "inProgress" | "todo" | "done";

export type Priority = "高" | "中" | "低" | "未設定";

export interface Task {
  /** `#004` のような ID */
  id: string;
  priority: Priority;
  title: string;
  /** タイトル行の下に続く `>` 行の本文 (先頭の `>` と空白を除いたもの) */
  notes: string[];
}

export interface UnparsedLine {
  /** 1 始まりの行番号 */
  lineNumber: number;
  text: string;
}

export interface ParsedBacklog {
  columns: Record<Status, Task[]>;
  /** 書式に合わず、どの列にも入れられなかった行 */
  unparsed: UnparsedLine[];
}

// 素のオブジェクトで引くと、`## constructor` などがプロトタイプのメンバーに当たるため Map にする
const SECTION_TO_STATUS: ReadonlyMap<string, Status> = new Map([
  ["進行中", "inProgress"],
  ["未着手", "todo"],
  ["完了", "done"],
]);

const TITLE_PATTERN = /^# /;
const SECTION_PATTERN = /^## (.+?)\s*$/;
const TASK_PATTERN =
  /^- \[[ x]\] \*\*(#\d+)\*\* `優先度:(高|中|低|未設定)` (.+?)\s*$/;
const NOTE_PATTERN = /^\s*>\s?(.*?)\s*$/;

/**
 * backlog スキルの書式のバックログを、ステータスごとのタスク一覧に分ける。
 * 並び順はファイルの順を保ち、書式に合わない行は捨てずに unparsed に残す。
 */
export function parseBacklog(text: string): ParsedBacklog {
  const result: ParsedBacklog = {
    columns: { inProgress: [], todo: [], done: [] },
    unparsed: [],
  };
  let currentStatus: Status | undefined;
  let lastTask: Task | undefined;

  text.split(/\r?\n/).forEach((line, index) => {
    const markUnparsed = (): void => {
      result.unparsed.push({ lineNumber: index + 1, text: line });
      lastTask = undefined;
    };

    if (line.trim() === "" || TITLE_PATTERN.test(line)) {
      return;
    }

    const section = SECTION_PATTERN.exec(line);
    if (section) {
      currentStatus = SECTION_TO_STATUS.get(section[1]);
      lastTask = undefined;
      if (!currentStatus) {
        markUnparsed();
      }
      return;
    }

    const note = NOTE_PATTERN.exec(line);
    if (note) {
      if (lastTask) {
        lastTask.notes.push(note[1]);
      } else {
        markUnparsed();
      }
      return;
    }

    const task = TASK_PATTERN.exec(line);
    if (task && currentStatus) {
      lastTask = {
        id: task[1],
        priority: task[2] as Priority,
        title: task[3],
        notes: [],
      };
      result.columns[currentStatus].push(lastTask);
      return;
    }

    markUnparsed();
  });

  return result;
}
