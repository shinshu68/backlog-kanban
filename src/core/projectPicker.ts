export interface ProjectPickItem {
  /** プロジェクト名 */
  label: string;
  /** 「このフォルダ」「表示中」の印。どちらでもなければ undefined */
  description?: string;
}

export interface ProjectMarks {
  /** 開いているフォルダに対応するプロジェクト名 */
  folderProject?: string;
  /** カンバンに表示中のプロジェクト名 */
  shownProject?: string;
}

/**
 * プロジェクトの一覧から、切り替えのクイックピックに並べる項目を作る。
 */
export function projectPickItems(
  projects: readonly string[],
  marks: ProjectMarks,
): ProjectPickItem[] {
  return projects.map((name) => {
    const labels = [
      name === marks.folderProject ? "このフォルダ" : undefined,
      name === marks.shownProject ? "表示中" : undefined,
    ].filter((l): l is string => l !== undefined);
    return labels.length > 0
      ? { label: name, description: labels.join("・") }
      : { label: name };
  });
}
