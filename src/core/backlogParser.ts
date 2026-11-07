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
  /^- \[[ xX]\] \*\*(#\d+)\*\* `優先度:(高|中|低|未設定)` (.+?)\s*$/;
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
  let seenSection = false;
  let currentStatus: Status | undefined;
  let lastTask: Task | undefined;

  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const parsed = classifyLine(line);

    if (parsed.kind === "note" && lastTask) {
      if (parsed.text !== "") {
        lastTask.notes.push(parsed.text);
      }
      continue;
    }
    lastTask = undefined;

    if (isAccepted(parsed)) {
      continue;
    }
    result.unparsed.push({ lineNumber: index + 1, text: line });
  }

  return result;

  /** 行を取り込めたら true、解釈できなかった行に回すなら false を返す */
  function isAccepted(parsed: ClassifiedLine): boolean {
    switch (parsed.kind) {
      case "blank":
        return true;
      case "title":
        return !seenSection;
      case "section":
        seenSection = true;
        currentStatus = parsed.status;
        return currentStatus !== undefined;
      case "task":
        if (!currentStatus) {
          return false;
        }
        lastTask = parsed.task;
        result.columns[currentStatus].push(lastTask);
        return true;
      case "note":
      case "other":
        return false;
    }
  }
}

type ClassifiedLine =
  | { kind: "blank" }
  | { kind: "title" }
  | { kind: "section"; status: Status | undefined }
  | { kind: "task"; task: Task }
  | { kind: "note"; text: string }
  | { kind: "other" };

function classifyLine(line: string): ClassifiedLine {
  if (line.trim() === "") {
    return { kind: "blank" };
  }
  if (TITLE_PATTERN.test(line)) {
    return { kind: "title" };
  }
  const section = SECTION_PATTERN.exec(line);
  if (section) {
    return { kind: "section", status: SECTION_TO_STATUS.get(section[1]) };
  }
  const note = NOTE_PATTERN.exec(line);
  if (note) {
    return { kind: "note", text: note[1] };
  }
  const task = TASK_PATTERN.exec(line);
  if (task) {
    return {
      kind: "task",
      task: {
        id: task[1],
        priority: task[2] as Priority,
        title: task[3],
        notes: [],
      },
    };
  }
  return { kind: "other" };
}
