"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { adminFetch, getAdminToken, setAdminToken, type AdminDocumentItem, type AdminSessionItem } from "@/lib/admin";

type SignalingResult = {
  url: string;
  ok: boolean;
  connect_ms?: number | null;
  detail: string;
};

export default function AdminConsolePage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [sessions, setSessions] = useState<AdminSessionItem[]>([]);
  const [docs, setDocs] = useState<AdminDocumentItem[]>([]);
  const [docQuery, setDocQuery] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(true);
  const [urls, setUrls] = useState("wss://signaling.yjs.dev");
  const [signalResults, setSignalResults] = useState<SignalingResult[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadData = async () => {
    setBusy(true);
    setError("");
    try {
      const [sessionRes, docRes] = await Promise.all([
        adminFetch("/api/admin/sessions"),
        adminFetch(
          `/api/admin/documents?limit=100&offset=0&include_deleted=${includeDeleted ? "true" : "false"}&q=${encodeURIComponent(docQuery)}`,
        ),
      ]);
      if (sessionRes.status === 401 || docRes.status === 401) {
        setAdminToken("");
        router.replace("/admin/login");
        return;
      }
      if (!sessionRes.ok || !docRes.ok) {
        throw new Error("Failed loading admin data");
      }
      const sessionData = (await sessionRes.json()) as { sessions: AdminSessionItem[] };
      const docData = (await docRes.json()) as { items: AdminDocumentItem[] };
      setSessions(sessionData.sessions);
      setDocs(docData.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed loading admin data");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    setAuthReady(true);
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeDocIds = useMemo(() => Array.from(new Set(sessions.map((s) => s.doc_id))), [sessions]);

  const testSignaling = async () => {
    setError("");
    const parsed = urls
      .split(/[,\n]/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (!parsed.length) return;
    const res = await adminFetch("/api/admin/signaling/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: parsed, timeout_ms: 6000 }),
    });
    if (res.status === 401) {
      setAdminToken("");
      router.replace("/admin/login");
      return;
    }
    if (!res.ok) {
      setError("Signaling test failed");
      return;
    }
    const data = (await res.json()) as { results: SignalingResult[] };
    setSignalResults(data.results);
  };

  const deleteDoc = async (id: string, hard: boolean) => {
    const res = await adminFetch(`/api/admin/documents/${encodeURIComponent(id)}?hard=${hard ? "true" : "false"}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setError(`Failed deleting ${id}`);
      return;
    }
    void loadData();
  };

  const restoreDoc = async (id: string) => {
    const res = await adminFetch(`/api/admin/documents/${encodeURIComponent(id)}/restore`, {
      method: "POST",
    });
    if (!res.ok) {
      setError(`Failed restoring ${id}`);
      return;
    }
    void loadData();
  };

  if (!authReady) return null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Admin Console</h1>
          <p className="text-sm text-slate-600">Manage sessions, documents, and signaling connectivity tests.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            Home
          </Link>
          <button
            onClick={() => {
              setAdminToken("");
              router.replace("/admin/login");
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            Logout
          </button>
        </div>
      </header>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Current Active Sessions</h2>
          <button onClick={() => void loadData()} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            {busy ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <p className="mb-2 text-sm text-slate-600">
          Active sessions: {sessions.length} across {activeDocIds.length} documents
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2">Doc</th>
                <th className="py-2">User</th>
                <th className="py-2">Transport</th>
                <th className="py-2">Last Seen</th>
                <th className="py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.session_id} className="border-t border-slate-100">
                  <td className="py-2 font-mono">{s.doc_id}</td>
                  <td className="py-2">{s.user_name}</td>
                  <td className="py-2">{s.transport}</td>
                  <td className="py-2">{new Date(s.last_seen_at).toLocaleString()}</td>
                  <td className="py-2">{s.client_ip ?? "-"}</td>
                </tr>
              ))}
              {!sessions.length ? (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={5}>
                    No active sessions
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
          <input
            value={docQuery}
            onChange={(e) => setDocQuery(e.target.value)}
            placeholder="Search by ID"
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
          />
          <label className="text-sm text-slate-700">
            <input
              className="mr-1"
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
            />
            Include deleted
          </label>
          <button onClick={() => void loadData()} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            Apply
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2">ID</th>
                <th className="py-2">Chars</th>
                <th className="py-2">Updated</th>
                <th className="py-2">Deleted</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-t border-slate-100">
                  <td className="py-2 font-mono">{d.id}</td>
                  <td className="py-2">{d.char_count}</td>
                  <td className="py-2">{new Date(d.updated_at).toLocaleString()}</td>
                  <td className="py-2">{d.deleted_at ? new Date(d.deleted_at).toLocaleString() : "-"}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <Link href={`/${d.id}`} className="rounded border border-slate-300 px-2 py-1 text-xs">
                        Open
                      </Link>
                      {d.deleted_at ? (
                        <button
                          onClick={() => void restoreDoc(d.id)}
                          className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700"
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          onClick={() => void deleteDoc(d.id, false)}
                          className="rounded border border-amber-300 px-2 py-1 text-xs text-amber-700"
                        >
                          Soft Delete
                        </button>
                      )}
                      <button
                        onClick={() => void deleteDoc(d.id, true)}
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                      >
                        Hard Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!docs.length ? (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={5}>
                    No documents found
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">Test y-webrtc Signaling URLs</h2>
        <p className="mt-1 text-sm text-slate-600">One URL per line or comma-separated list.</p>
        <textarea
          className="mt-3 h-28 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
        />
        <button onClick={() => void testSignaling()} className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">
          Run Test
        </button>
        <ul className="mt-3 space-y-2 text-sm">
          {signalResults.map((r) => (
            <li key={r.url} className="rounded border border-slate-200 px-3 py-2">
              <span className={r.ok ? "text-emerald-700" : "text-red-700"}>{r.ok ? "OK" : "FAIL"}</span>{" "}
              <span className="font-mono">{r.url}</span> - {r.detail}
              {typeof r.connect_ms === "number" ? ` (${r.connect_ms}ms)` : ""}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
