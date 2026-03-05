import * as Y from "yjs";

import type { SnapshotHistoryItem } from "@/lib/types";

export async function fetchSnapshot(docId: string, ydoc: Y.Doc): Promise<boolean> {
  const res = await fetch(`/api/docs/${encodeURIComponent(docId)}/snapshot`, { cache: "no-store" });
  if (!res.ok) return false;
  const buf = await res.arrayBuffer();
  if (!buf.byteLength) return false;
  Y.applyUpdate(ydoc, new Uint8Array(buf));
  return true;
}

export type SaveSnapshotResult = {
  ok: boolean;
  saved: boolean;
  skipped_reason?: string;
  snapshot_id?: number;
  created_at?: string;
};

export type UpsertSnapshotMaterializedTextResult = {
  ok: boolean;
  unsupported?: boolean;
};

export async function saveSnapshot(opts: {
  docId: string;
  ydoc: Y.Doc;
  charCount: number;
  token?: string;
}): Promise<SaveSnapshotResult> {
  const { docId, ydoc, charCount, token } = opts;
  const payload = Y.encodeStateAsUpdate(ydoc);
  const body = new Uint8Array(payload).buffer;
  const headers: Record<string, string> = {
    "Content-Type": "application/octet-stream",
    "X-Char-Count": String(charCount),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`/api/docs/${encodeURIComponent(docId)}/snapshot`, {
    method: "PUT",
    headers,
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const reason = await response.text();
    throw new Error(reason || "Failed to save snapshot");
  }
  return (await response.json()) as SaveSnapshotResult;
}

export async function upsertSnapshotMaterializedText(opts: {
  docId: string;
  snapshotId: number;
  fullText: string;
  charCount: number;
  checkpointEveryN: number;
  isPeriodicCheckpoint: boolean;
  token?: string;
}): Promise<UpsertSnapshotMaterializedTextResult> {
  const {
    docId,
    snapshotId,
    fullText,
    charCount,
    checkpointEveryN,
    isPeriodicCheckpoint,
    token,
  } = opts;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`/api/docs/${encodeURIComponent(docId)}/snapshot-materialized`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      snapshot_id: snapshotId,
      full_text: fullText,
      char_count: charCount,
      checkpoint_every_n: checkpointEveryN,
      is_latest: true,
      is_periodic_checkpoint: isPeriodicCheckpoint,
    }),
    cache: "no-store",
  });

  if (response.status === 404 || response.status === 405 || response.status === 501) {
    return { ok: false, unsupported: true };
  }

  if (!response.ok) {
    const reason = await response.text();
    throw new Error(reason || "Failed to upsert snapshot materialized text");
  }

  return { ok: true };
}

export async function fetchSnapshotHistory(opts: {
  docId: string;
  limit?: number;
  token?: string;
}): Promise<SnapshotHistoryItem[]> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(
    `/api/docs/${encodeURIComponent(opts.docId)}/snapshot-history?limit=${opts.limit ?? 120}`,
    { cache: "no-store", headers },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: SnapshotHistoryItem[] };
  return data.items ?? [];
}

export function sendBeaconSnapshot(opts: {
  docId: string;
  ydoc: Y.Doc;
  charCount: number;
}): boolean {
  const { docId, ydoc } = opts;
  const payload = Y.encodeStateAsUpdate(ydoc);
  const url = `/api/docs/${encodeURIComponent(docId)}/snapshot`;
  const blob = new Blob([new Uint8Array(payload)], { type: "application/octet-stream" });
  if (!("sendBeacon" in navigator)) return false;
  return navigator.sendBeacon(url, blob);
}
