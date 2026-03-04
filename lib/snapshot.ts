import * as Y from "yjs";

export async function fetchSnapshot(docId: string, ydoc: Y.Doc): Promise<boolean> {
  const res = await fetch(`/api/docs/${encodeURIComponent(docId)}/snapshot`, { cache: "no-store" });
  if (!res.ok) return false;
  const buf = await res.arrayBuffer();
  if (!buf.byteLength) return false;
  Y.applyUpdate(ydoc, new Uint8Array(buf));
  return true;
}

export async function saveSnapshot(opts: {
  docId: string;
  ydoc: Y.Doc;
  charCount: number;
  token?: string;
}) {
  const { docId, ydoc, charCount, token } = opts;
  const payload = Y.encodeStateAsUpdate(ydoc);
  const headers: Record<string, string> = {
    "Content-Type": "application/octet-stream",
    "X-Char-Count": String(charCount),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`/api/docs/${encodeURIComponent(docId)}/snapshot`, {
    method: "PUT",
    headers,
    body: payload,
    cache: "no-store",
  });

  if (!response.ok) {
    const reason = await response.text();
    throw new Error(reason || "Failed to save snapshot");
  }
}

export function sendBeaconSnapshot(opts: {
  docId: string;
  ydoc: Y.Doc;
  charCount: number;
}): boolean {
  const { docId, ydoc } = opts;
  const payload = Y.encodeStateAsUpdate(ydoc);
  const url = `/api/docs/${encodeURIComponent(docId)}/snapshot`;
  const blob = new Blob([payload], { type: "application/octet-stream" });
  if (!("sendBeacon" in navigator)) return false;
  return navigator.sendBeacon(url, blob);
}
