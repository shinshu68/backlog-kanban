/**
 * load の結果を、キーごとに ttlMs の間だけ覚えて返す関数を作る。
 * 読み込み中に同じキーで呼ばれたときは、同じ読み込みを待つ。
 * 読み込みが reject したときは覚えず、次の呼び出しで読み込み直す。
 */
export function createTtlCache<V>(
  load: (key: string) => Promise<V>,
  ttlMs: number,
  now: () => number = Date.now,
): (key: string) => Promise<V> {
  const entries = new Map<string, { value: Promise<V>; expiresAt: number }>();

  return (key) => {
    const cached = entries.get(key);
    if (cached && now() < cached.expiresAt) {
      return cached.value;
    }
    const value = load(key);
    entries.set(key, { value, expiresAt: now() + ttlMs });
    value.catch(() => {
      if (entries.get(key)?.value === value) {
        entries.delete(key);
      }
    });
    return value;
  };
}
