"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as Y from "yjs";

import {
  adminFetch,
  getAdminToken,
  setAdminToken,
  type AdminDocumentDetail,
  type AdminDocumentSnapshotItem,
} from "@/lib/admin";

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function buildLinePoints(
  values: number[],
  width: number,
  height: number,
): { polyline: string; min: number; max: number } {
  if (!values.length) return { polyline: "", min: 0, max: 0 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const xDen = Math.max(1, values.length - 1);
  const polyline = values
    .map((value, i) => {
      const x = (i / xDen) * width;
      const y = height - ((value - min) / span) * height;
      return `${x},${y}`;
    })
    .join(" ");
  return { polyline, min, max };
}

function decodeSnapshotText(payload: ArrayBuffer): string {
  const doc = new Y.Doc();
  try {
    Y.applyUpdate(doc, new Uint8Array(payload));
    return doc.getText("codemirror").toString();
  } finally {
    doc.destroy();
  }
}

export default function AdminDocumentHistoryPage() {
  const router = useRouter();
  const params = useParams<{ docId: string }>();
  const docId = useMemo(() => (params.docId ?? "").toUpperCase(), [params.docId]);

  const [authReady, setAuthReady] = useState(false);
  const [detail, setDetail] = useState<AdminDocumentDetail | null>(null);
  const [snapshots, setSnapshots] = useState<AdminDocumentSnapshotItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(200);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [previewTextById, setPreviewTextById] = useState<Record<number, string>>({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const withAuth = useCallback((res: Response): boolean => {
    if (res.status === 401) {
      setAdminToken("");
      router.replace("/admin/login");
      return false;
    }
    return true;
  }, [router]);

  const loadData = async (nextOffset: number) => {
    if (!docId) return;
    setLoading(true);
    setError("");
    try {
      const [detailRes, snapshotRes] = await Promise.all([
        adminFetch(`/api/admin/documents/${encodeURIComponent(docId)}`),
        adminFetch(`/api/admin/documents/${encodeURIComponent(docId)}/snapshots?limit=${limit}&offset=${nextOffset}`),
      ]);
      if (!withAuth(detailRes) || !withAuth(snapshotRes)) return;
      if (!detailRes.ok || !snapshotRes.ok) {
        throw new Error(detailRes.status === 404 || snapshotRes.status === 404 ? "Document not found" : "Failed loading snapshots");
      }
      const detailData = (await detailRes.json()) as AdminDocumentDetail;
      const snapshotData = (await snapshotRes.json()) as { items: AdminDocumentSnapshotItem[] };
      setDetail(detailData);
      setSnapshots(snapshotData.items);
      setOffset(nextOffset);
      setSelectedId((current) => current ?? snapshotData.items[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed loading snapshots");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    setAuthReady(true);
    void loadData(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return snapshots;
    return snapshots.filter((item) => {
      return (
        String(item.id).includes(q) ||
        item.snapshot_hash.toLowerCase().includes(q) ||
        new Date(item.created_at).toLocaleString().toLowerCase().includes(q)
      );
    });
  }, [query, snapshots]);

  const selected = useMemo(() => filtered.find((item) => item.id === selectedId) ?? null, [filtered, selectedId]);
  const chartSeries = useMemo(() => [...filtered].reverse(), [filtered]);
  const chartWidth = 820;
  const chartHeight = 220;
  const charChart = useMemo(
    () => buildLinePoints(chartSeries.map((item) => item.char_count), chartWidth, chartHeight),
    [chartSeries],
  );
  const sizeChart = useMemo(
    () => buildLinePoints(chartSeries.map((item) => item.size_bytes), chartWidth, chartHeight),
    [chartSeries],
  );

  useEffect(() => {
    if (!selected || previewTextById[selected.id]) return;
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError("");

    (async () => {
      try {
        const res = await adminFetch(`/api/admin/documents/${encodeURIComponent(docId)}/snapshots/${selected.id}`);
        if (!withAuth(res) || cancelled) return;
        if (!res.ok) throw new Error("Failed loading snapshot payload");
        const buf = await res.arrayBuffer();
        const text = decodeSnapshotText(buf);
        if (!cancelled) {
          setPreviewTextById((current) => ({ ...current, [selected.id]: text }));
        }
      } catch (e) {
        if (!cancelled) {
          setPreviewError(e instanceof Error ? e.message : "Failed decoding snapshot");
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [docId, previewTextById, selected, withAuth]);

  const selectedPreview = selected ? previewTextById[selected.id] : "";

  if (!authReady) return null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Document Snapshot History</h1>
          <p className="text-sm text-slate-600">
            Doc ID: <span className="font-mono">{docId}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/docs" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            Back to Documents
          </Link>
          <Link href={`/${docId}`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            Open Live Doc
          </Link>
        </div>
      </header>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <section className="grid gap-3 md:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Total snapshots</p>
          <p className="text-2xl font-semibold text-slate-900">{detail?.snapshot_count ?? "-"}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Latest snapshot</p>
          <p className="text-sm font-medium text-slate-900">
            {detail?.latest_snapshot_at ? new Date(detail.latest_snapshot_at).toLocaleString() : "-"}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Document chars now</p>
          <p className="text-2xl font-semibold text-slate-900">{detail?.item.char_count ?? "-"}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Deleted status</p>
          <p className="text-sm font-medium text-slate-900">{detail?.item.deleted_at ? "Deleted" : "Active"}</p>
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by snapshot id/hash/time"
            className="min-w-[280px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button onClick={() => void loadData(offset)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            onClick={() => void loadData(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
          >
            Newer
          </button>
          <button
            onClick={() => void loadData(offset + limit)}
            disabled={snapshots.length < limit}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
          >
            Older
          </button>
          <p className="text-xs text-slate-500">
            Showing {snapshots.length} rows at offset {offset}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Char Count Trend</h2>
            <p className="mb-2 text-xs text-slate-500">
              Min {charChart.min} / Max {charChart.max}
            </p>
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-56 w-full rounded-md bg-white">
              {charChart.polyline ? (
                <polyline fill="none" stroke="#2563eb" strokeWidth="2" points={charChart.polyline} />
              ) : (
                <text x="12" y="24" fill="#64748b" fontSize="12">
                  No data
                </text>
              )}
            </svg>
          </article>
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Snapshot Size Trend</h2>
            <p className="mb-2 text-xs text-slate-500">
              Min {formatBytes(sizeChart.min)} / Max {formatBytes(sizeChart.max)}
            </p>
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-56 w-full rounded-md bg-white">
              {sizeChart.polyline ? (
                <polyline fill="none" stroke="#059669" strokeWidth="2" points={sizeChart.polyline} />
              ) : (
                <text x="12" y="24" fill="#64748b" fontSize="12">
                  No data
                </text>
              )}
            </svg>
          </article>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2">Snapshot ID</th>
                <th className="py-2">Created</th>
                <th className="py-2">Char Count</th>
                <th className="py-2">Size</th>
                <th className="py-2">Hash</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className={`border-t border-slate-100 ${selectedId === item.id ? "bg-slate-50" : ""}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <td className="py-2 font-mono">{item.id}</td>
                  <td className="py-2">{new Date(item.created_at).toLocaleString()}</td>
                  <td className="py-2">{item.char_count}</td>
                  <td className="py-2">{formatBytes(item.size_bytes)}</td>
                  <td className="py-2 font-mono text-xs">{item.snapshot_hash}</td>
                  <td className="py-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(item.id);
                      }}
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {!filtered.length ? (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={6}>
                    No snapshots found
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {selected ? (
          <aside className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Selected Snapshot</p>
            <p>
              Snapshot ID: <span className="font-mono">{selected.id}</span>
            </p>
            <p>Timestamp: {new Date(selected.created_at).toLocaleString()}</p>
            <p>Char Count: {selected.char_count}</p>
            <p>Payload Size: {formatBytes(selected.size_bytes)}</p>
            <p className="break-all font-mono text-xs">Hash: {selected.snapshot_hash}</p>

            <div className="mt-3">
              <p className="mb-1 font-semibold text-slate-900">Historical Content</p>
              {previewLoading ? <p className="text-xs text-slate-500">Loading snapshot preview...</p> : null}
              {previewError ? <p className="text-xs text-red-700">{previewError}</p> : null}
              {!previewLoading && !previewError ? (
                <pre className="max-h-96 overflow-auto rounded-md border border-slate-200 bg-white p-3 font-mono text-xs text-slate-800">
                  {selectedPreview || "(empty document)"}
                </pre>
              ) : null}
            </div>
          </aside>
        ) : null}
      </section>
    </main>
  );
}
