/**
 * Typical per-origin `localStorage` ceiling in Chromium and Firefox. Safari is
 * often similar; there is no reliable API for the real quota, so this is the
 * figure we show and use for pressure-based retention.
 */
export const LOCAL_STORAGE_QUOTA_BYTES = 5 * 1024 * 1024;

/** UTF-16 code units × 2 — the usual browser accounting for string storage. */
export function stringStorageBytes(value: string): number {
  return value.length * 2;
}

export type LocalStorageUsage = {
  /** Bytes across every key in this origin's `localStorage`. */
  totalBytes: number;
  /** Bytes for one named key (typically the Macro Tracker persist key). */
  appBytes: number;
  quotaBytes: number;
  /** `totalBytes / quotaBytes`, clamped to 0–1 for display. */
  usedRatio: number;
};

function entryBytes(key: string, value: string): number {
  return stringStorageBytes(key) + stringStorageBytes(value);
}

/** Walks `localStorage` and reports total and optional app-key usage vs quota. */
export function measureLocalStorageUsage(
  appKey: string,
  storage: Storage = localStorage,
  quotaBytes: number = LOCAL_STORAGE_QUOTA_BYTES,
): LocalStorageUsage {
  let totalBytes = 0;
  let appBytes = 0;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key === null) continue;
    const value = storage.getItem(key) ?? '';
    const bytes = entryBytes(key, value);
    totalBytes += bytes;
    if (key === appKey) appBytes = bytes;
  }
  const usedRatio = quotaBytes > 0 ? Math.min(1, Math.max(0, totalBytes / quotaBytes)) : 0;
  return { totalBytes, appBytes, quotaBytes, usedRatio };
}

/** Human-readable size, e.g. `12.4 KB` or `1.2 MB`. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(2) : Math.round(mb)} MB`;
}
