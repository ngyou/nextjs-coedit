"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { adminFetch, getAdminToken, setAdminToken, type AdminDocumentItem } from "@/lib/admin";

export default function AdminDocumentsPage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [docs, setDocs] = useState<AdminDocumentItem[]>([]);
  const [docQuery, setDocQuery] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const withAuth = (res: Response) => {
    if (res.status === 401) {
      setAdminToken("");
      router.replace("/admin/login");
      return false;
    }
    return true;
  };

  const loadDocs = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await adminFetch(
        `/api/admin/documents?limit=200&offset=0&include_deleted=${includeDeleted ? "true" : "false"}&q=${encodeURIComponent(docQuery)}`,
      );
      if (!withAuth(res)) return;
      if (!res.ok) throw new Error("Failed loading documents");
      const data = (await res.json()) as { items: AdminDocumentItem[] };
      setDocs(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed loading documents");
    } finally {
      setBusy(false);
    }
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
    void loadDocs();
  };

  const restoreDoc = async (id: string) => {
    const res = await adminFetch(`/api/admin/documents/${encodeURIComponent(id)}/restore`, { method: "POST" });
    if (!withAuth(res)) return;
    if (!res.ok) {
      setError(`Failed restoring ${id}`);
      return;
    }
    void loadDocs();
  };

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    setAuthReady(true);
    void loadDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!authReady) return null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Admin Documents</h1>
          <p className="text-sm text-slate-600">Browse and manage documents, then open detailed snapshot history.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            Back to Admin
          </Link>
          <Link href="/" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            Home
          </Link>
        </div>
      </header>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
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
          <button onClick={() => void loadDocs()} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            {busy ? "Refreshing..." : "Apply"}
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
                      <Link href={`/admin/docs/${d.id}`} className="rounded border border-slate-300 px-2 py-1 text-xs">
                        History
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
    </main>
  );
}

