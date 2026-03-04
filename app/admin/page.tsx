"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  adminFetch,
  getAdminToken,
  setAdminToken,
  type AdminDocumentItem,
  type AdminSessionItem,
  type AdminSignalingTestItem,
  type AdminSignalingUrlItem,
} from "@/lib/admin";

const TEST_ROOM = "__connectivity_test__";

async function testSignalingInBrowser(url: string, timeoutMs = 6000): Promise<AdminSignalingTestItem> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { url, ok: false, detail: "invalid URL", source: "frontend" };
  }
  if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
    return { url, ok: false, detail: "URL must start with ws:// or wss://", source: "frontend" };
  }

  return new Promise((resolve) => {
    const marker = `frontend-test-${Math.random().toString(36).slice(2)}`;
    const started = performance.now();
    const ws = new WebSocket(url);
    let done = false;

    const finish = (item: AdminSignalingTestItem) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // ignore close errors
      }
      resolve(item);
    };

    const timer = window.setTimeout(() => {
      finish({
        url,
        ok: false,
        connect_ms: Math.round(performance.now() - started),
        detail: "timeout waiting for room acknowledgement",
        source: "frontend",
      });
    }, timeoutMs);

    ws.onopen = () => {
      try {
        ws.send(JSON.stringify({ type: "subscribe", topics: [TEST_ROOM] }));
        ws.send(JSON.stringify({ type: "publish", topic: TEST_ROOM, data: marker }));
      } catch {
        finish({
          url,
          ok: false,
          connect_ms: Math.round(performance.now() - started),
          detail: "failed to send subscribe/publish",
          source: "frontend",
        });
      }
    };

    ws.onmessage = (event) => {
      let data: unknown;
      try {
        data = JSON.parse(String(event.data));
      } catch {
        return;
      }
      const msg = data as { type?: string; topic?: string; data?: string };
      if (msg.type === "publish" && msg.topic === TEST_ROOM && msg.data === marker) {
        finish({
          url,
          ok: true,
          connect_ms: Math.round(performance.now() - started),
          detail: "connected and acknowledged room publish",
          source: "frontend",
        });
      }
    };

    ws.onerror = () => {
      finish({
        url,
        ok: false,
        connect_ms: Math.round(performance.now() - started),
        detail: "websocket connection failed",
        source: "frontend",
      });
    };
  });
}

export default function AdminConsolePage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [sessions, setSessions] = useState<AdminSessionItem[]>([]);
  const [docs, setDocs] = useState<AdminDocumentItem[]>([]);
  const [signalingUrls, setSignalingUrls] = useState<AdminSignalingUrlItem[]>([]);
  const [signalResults, setSignalResults] = useState<AdminSignalingTestItem[]>([]);
  const [docQuery, setDocQuery] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(true);
  const [newSignalUrl, setNewSignalUrl] = useState("");
  const [newSignalLabel, setNewSignalLabel] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [testingBackend, setTestingBackend] = useState(false);
  const [testingFrontend, setTestingFrontend] = useState(false);

  const withAuth = (res: Response) => {
    if (res.status === 401) {
      setAdminToken("");
      router.replace("/admin/login");
      return false;
    }
    return true;
  };

  const loadData = async () => {
    setBusy(true);
    setError("");
    try {
      const [sessionRes, docRes, signalRes] = await Promise.all([
        adminFetch("/api/admin/sessions"),
        adminFetch(
          `/api/admin/documents?limit=100&offset=0&include_deleted=${includeDeleted ? "true" : "false"}&q=${encodeURIComponent(docQuery)}`,
        ),
        adminFetch("/api/admin/signaling/urls"),
      ]);
      if (!withAuth(sessionRes) || !withAuth(docRes) || !withAuth(signalRes)) return;
      if (!sessionRes.ok || !docRes.ok || !signalRes.ok) throw new Error("Failed loading admin data");

      const sessionData = (await sessionRes.json()) as { sessions: AdminSessionItem[] };
      const docData = (await docRes.json()) as { items: AdminDocumentItem[] };
      const signalData = (await signalRes.json()) as { items: AdminSignalingUrlItem[] };
      setSessions(sessionData.sessions);
      setDocs(docData.items);
      setSignalingUrls(signalData.items);
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
  const activeSignalUrls = useMemo(() => signalingUrls.filter((u) => u.is_active).map((u) => u.url), [signalingUrls]);

  const addSignalingUrl = async () => {
    const url = newSignalUrl.trim();
    if (!url) return;
    const res = await adminFetch("/api/admin/signaling/urls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, label: newSignalLabel.trim() || null, is_active: true }),
    });
    if (!withAuth(res)) return;
    if (!res.ok) {
      setError("Failed to add signaling URL");
      return;
    }
    setNewSignalUrl("");
    setNewSignalLabel("");
    void loadData();
  };

  const updateSignalingUrl = async (urlId: number, patch: { label?: string | null; is_active?: boolean }) => {
    const res = await adminFetch(`/api/admin/signaling/urls/${urlId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!withAuth(res)) return;
    if (!res.ok) {
      setError("Failed to update signaling URL");
      return;
    }
    void loadData();
  };

  const deleteSignalingUrl = async (urlId: number) => {
    const res = await adminFetch(`/api/admin/signaling/urls/${urlId}`, { method: "DELETE" });
    if (!withAuth(res)) return;
    if (!res.ok) {
      setError("Failed to delete signaling URL");
      return;
    }
    void loadData();
  };

  const persistFrontendResults = async (results: AdminSignalingTestItem[]) => {
    if (!results.length) return;
    const res = await adminFetch("/api/admin/signaling/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "frontend",
        results: results.map((r) => ({
          url: r.url,
          ok: r.ok,
          connect_ms: r.connect_ms ?? null,
          detail: r.detail,
        })),
      }),
    });
    if (!withAuth(res)) return;
  };

  const testSignalingBackend = async () => {
    setError("");
    if (!activeSignalUrls.length) {
      setError("No active signaling URLs to test");
      return;
    }
    setTestingBackend(true);
    const res = await adminFetch("/api/admin/signaling/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: activeSignalUrls, timeout_ms: 6000, persist: true }),
    });
    setTestingBackend(false);
    if (!withAuth(res)) return;
    if (!res.ok) {
      setError("Backend signaling test failed");
      return;
    }
    const data = (await res.json()) as { results: AdminSignalingTestItem[] };
    setSignalResults(data.results);
    void loadData();
  };

  const testSignalingFrontend = async () => {
    setError("");
    if (!activeSignalUrls.length) {
      setError("No active signaling URLs to test");
      return;
    }
    setTestingFrontend(true);
    const results = await Promise.all(activeSignalUrls.map((url) => testSignalingInBrowser(url, 6000)));
    setTestingFrontend(false);
    setSignalResults(results);
    await persistFrontendResults(results);
    void loadData();
  };

  const deleteDoc = async (id: string, hard: boolean) => {
    const res = await adminFetch(`/api/admin/documents/${encodeURIComponent(id)}?hard=${hard ? "true" : "false"}`, {
      method: "DELETE",
    });
    if (!withAuth(res)) return;
    if (!res.ok) {
      setError(`Failed deleting ${id}`);
      return;
    }
    void loadData();
  };

  const restoreDoc = async (id: string) => {
    const res = await adminFetch(`/api/admin/documents/${encodeURIComponent(id)}/restore`, { method: "POST" });
    if (!withAuth(res)) return;
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
        <h2 className="text-lg font-semibold text-slate-900">y-webrtc Signaling URLs</h2>
        <p className="mt-1 text-sm text-slate-600">Stored URLs used for admin tests. Activate/deactivate as needed.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={newSignalUrl}
            onChange={(e) => setNewSignalUrl(e.target.value)}
            placeholder="ws://localhost:4444 or wss://..."
            className="min-w-[320px] flex-1 rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
          />
          <input
            value={newSignalLabel}
            onChange={(e) => setNewSignalLabel(e.target.value)}
            placeholder="Optional label"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button onClick={() => void addSignalingUrl()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            Add URL
          </button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2">Active</th>
                <th className="py-2">URL</th>
                <th className="py-2">Label</th>
                <th className="py-2">Last Test</th>
                <th className="py-2">Result</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {signalingUrls.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="py-2">
                    <input
                      type="checkbox"
                      checked={u.is_active}
                      onChange={(e) => void updateSignalingUrl(u.id, { is_active: e.target.checked })}
                    />
                  </td>
                  <td className="py-2 font-mono">{u.url}</td>
                  <td className="py-2">
                    <input
                      defaultValue={u.label ?? ""}
                      onBlur={(e) => void updateSignalingUrl(u.id, { label: e.target.value.trim() || null })}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                  </td>
                  <td className="py-2">
                    {u.last_tested_at ? `${new Date(u.last_tested_at).toLocaleString()} (${u.last_test_source ?? "?"})` : "-"}
                  </td>
                  <td className="py-2">
                    {u.last_test_ok === null || typeof u.last_test_ok === "undefined"
                      ? "-"
                      : `${u.last_test_ok ? "OK" : "FAIL"}${typeof u.last_test_connect_ms === "number" ? ` ${u.last_test_connect_ms}ms` : ""}`}
                    {u.last_test_detail ? ` - ${u.last_test_detail}` : ""}
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() => void deleteSignalingUrl(u.id)}
                      className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!signalingUrls.length ? (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={6}>
                    No signaling URLs stored
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => void testSignalingBackend()}
            disabled={testingBackend}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {testingBackend ? "Testing Backend..." : "Test Active URLs (Backend Python)"}
          </button>
          <button
            onClick={() => void testSignalingFrontend()}
            disabled={testingFrontend}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-60"
          >
            {testingFrontend ? "Testing Frontend..." : "Test Active URLs (Frontend JavaScript)"}
          </button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2">Source</th>
                <th className="py-2">URL</th>
                <th className="py-2">Status</th>
                <th className="py-2">Connect</th>
                <th className="py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {signalResults.map((r) => (
                <tr key={`${r.source}-${r.url}`} className="border-t border-slate-100">
                  <td className="py-2">{r.source}</td>
                  <td className="py-2 font-mono">{r.url}</td>
                  <td className={`py-2 ${r.ok ? "text-emerald-700" : "text-red-700"}`}>{r.ok ? "OK" : "FAIL"}</td>
                  <td className="py-2">{typeof r.connect_ms === "number" ? `${r.connect_ms}ms` : "-"}</td>
                  <td className="py-2">{r.detail}</td>
                </tr>
              ))}
              {!signalResults.length ? (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={5}>
                    No test results yet
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
