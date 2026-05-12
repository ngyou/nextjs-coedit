"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { NamePrompt, getOrCreateLocalName } from "@/components/ui/NamePrompt";
import { ID_MAX_LEN, ID_MIN_LEN } from "@/lib/constants";

type RecentDoc = { id: string; ts: number };
const RECENT_KEY = "collab_recent_docs";

function loadRecentDocs(): RecentDoc[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as RecentDoc[];
    return parsed.filter((x) => x?.id).slice(0, 10);
  } catch {
    return [];
  }
}

function isValidId(id: string): boolean {
  return /^[A-Z2-9]{5,8}$/.test(id);
}

export default function HomePage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [openId, setOpenId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [recentDocs, setRecentDocs] = useState<RecentDoc[]>([]);

  useEffect(() => {
    async function hydrateClientState() {
      setDisplayName(getOrCreateLocalName());
      setRecentDocs(loadRecentDocs());
    }
    void hydrateClientState();
  }, []);

  const openDisabled = useMemo(() => !isValidId(openId.trim().toUpperCase()), [openId]);

  const createDoc = async () => {
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webrtc_fingerprint: null }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { id: string };
      router.push(`/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create document");
    } finally {
      setPending(false);
    }
  };

  const openDoc = () => {
    const id = openId.trim().toUpperCase();
    if (!isValidId(id)) return;
    router.push(`/${id}`);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-10">
      {displayName === "" ? (
        <NamePrompt
          onComplete={(name) => {
            setDisplayName(name);
          }}
        />
      ) : null}

      <h1 className="text-4xl font-semibold tracking-tight text-slate-900">CoEditor</h1>
      <p className="mt-2 text-slate-600">Create a document and share the link for real-time editing.</p>
      <p className="mt-1 text-sm text-slate-500">
        <Link href="/admin/login" className="underline">
          Admin console
        </Link>
      </p>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <button
          onClick={createDoc}
          disabled={pending}
          className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-70"
        >
          {pending ? "Creating..." : "New Document"}
        </button>
        <div className="mt-6 flex gap-2">
          <input
            value={openId}
            onChange={(e) => setOpenId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono uppercase"
            placeholder={`Open by ID (${ID_MIN_LEN}-${ID_MAX_LEN} chars)`}
          />
          <button
            onClick={openDoc}
            disabled={openDisabled}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm disabled:opacity-50"
          >
            Open
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Recent docs</h2>
        <ul className="mt-3 space-y-2">
          {recentDocs.length ? (
            recentDocs.map((d) => (
              <li key={d.id}>
                <Link className="font-mono text-slate-800 underline" href={`/${d.id}`}>
                  {d.id}
                </Link>
              </li>
            ))
          ) : (
            <li className="text-sm text-slate-500">No recent documents</li>
          )}
        </ul>
      </section>
    </main>
  );
}
