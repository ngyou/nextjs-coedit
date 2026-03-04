"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CharLimitModal } from "@/components/editor/CharLimitModal";
import { CollabEditor } from "@/components/editor/CollabEditor";
import { StatusBar } from "@/components/editor/StatusBar";
import { AvatarStack } from "@/components/presence/AvatarStack";
import { ShareModal } from "@/components/sharing/ShareModal";
import { DeleteModal } from "@/components/ui/DeleteModal";
import { getOrCreateLocalName, NamePrompt } from "@/components/ui/NamePrompt";
import { PasswordModal } from "@/components/ui/PasswordModal";
import { useAutosave } from "@/hooks/useAutosave";
import { usePresence } from "@/hooks/usePresence";
import { fetchSnapshot } from "@/lib/snapshot";
import type { CollabRuntime, DocumentMeta, SaveStatus } from "@/lib/types";
import { createCollabRuntime } from "@/lib/yjsProvider";

const RECENT_KEY = "collab_recent_docs";

function addRecentDoc(id: string) {
  const current = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as Array<{ id: string; ts: number }>;
  const next = [{ id, ts: Date.now() }, ...current.filter((x) => x.id !== id)].slice(0, 10);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export default function DocPage() {
  const params = useParams<{ docId: string }>();
  const router = useRouter();
  const docId = useMemo(() => (params.docId ?? "").toUpperCase(), [params.docId]);
  const validDocId = /^[A-Z2-9]{5,8}$/.test(docId);

  const [name, setName] = useState<string | null>(null);
  const [meta, setMeta] = useState<DocumentMeta | null>(null);
  const [token, setToken] = useState<string | undefined>();
  const [authErr, setAuthErr] = useState("");
  const [error, setError] = useState("");
  const [runtime, setRuntime] = useState<CollabRuntime | null>(null);
  const [charCount, setCharCount] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [showShare, setShowShare] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");
  const [showLimit, setShowLimit] = useState(false);
  const [softWarned, setSoftWarned] = useState(false);

  useEffect(() => {
    if (!validDocId) return;
    async function hydrateClientState() {
      setName(getOrCreateLocalName());
      addRecentDoc(docId);
    }
    void hydrateClientState();
  }, [docId, validDocId]);

  useEffect(() => {
    if (!validDocId) return;
    const loadMeta = async () => {
      setError("");
      const res = await fetch(`/api/docs/${encodeURIComponent(docId)}`, { cache: "no-store" });
      if (!res.ok) {
        setError("Document not found");
        return;
      }
      const next = (await res.json()) as DocumentMeta;
      setMeta(next);
      setCharCount(next.char_count);
      const stored = sessionStorage.getItem(`token_${docId}`) ?? undefined;
      setToken(stored);
    };
    void loadMeta();
  }, [docId, validDocId]);

  const unlocked = useMemo(() => {
    if (!meta) return false;
    if (!meta.has_password) return true;
    return Boolean(token);
  }, [meta, token]);

  useEffect(() => {
    if (!meta || !unlocked || !name || runtime) return;

    const run = async () => {
      const created = createCollabRuntime(docId, name);
      try {
        await fetchSnapshot(docId, created.ydoc);
      } catch {
        // no snapshot yet
      }
      setRuntime(created);
    };
    void run();

    return () => {
      if (runtime) runtime.destroy();
    };
  }, [docId, meta, name, runtime, unlocked]);

  useEffect(() => {
    return () => {
      if (runtime) runtime.destroy();
    };
  }, [runtime]);

  const users = usePresence(runtime?.awareness ?? null);

  useAutosave({
    docId,
    ydoc: runtime?.ydoc ?? null,
    token,
    getCharCount: () => charCount,
    onStatus: setSaveStatus,
    onError: setError,
  });

  const onAuth = async (password: string) => {
    setAuthErr("");
    const res = await fetch(`/api/docs/${encodeURIComponent(docId)}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      setAuthErr("Invalid password");
      return;
    }
    const data = (await res.json()) as { token: string };
    sessionStorage.setItem(`token_${docId}`, data.token);
    setToken(data.token);
  };

  const onDelete = async (password: string) => {
    setDeleteErr("");
    const res = await fetch(`/api/docs/${encodeURIComponent(docId)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      setDeleteErr("Delete failed. Check password.");
      return;
    }
    sessionStorage.removeItem(`token_${docId}`);
    router.push("/");
  };

  const onDocChanged = useCallback(() => setSaveStatus("unsaved"), []);

  if (!validDocId) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="text-red-700">Invalid document id.</p>
        <Link href="/" className="text-slate-700 underline">
          Back
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-4">
      {name === "" ? <NamePrompt onComplete={setName} /> : null}
      {!unlocked && meta?.has_password ? <PasswordModal onSubmit={onAuth} error={authErr} /> : null}
      {showShare ? <ShareModal docId={docId} onClose={() => setShowShare(false)} /> : null}
      {showDelete ? <DeleteModal onConfirm={onDelete} onClose={() => setShowDelete(false)} error={deleteErr} /> : null}
      {showLimit ? <CharLimitModal onClose={() => setShowLimit(false)} /> : null}

      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-bold tracking-wide text-slate-900">{docId}</h1>
          <p className="text-xs text-slate-500">Realtime collaborative text editor</p>
        </div>
        <div className="flex items-center gap-2">
          <AvatarStack users={users} />
          <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => setShowShare(true)}>
            Share
          </button>
          {meta?.has_password ? (
            <button
              className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700"
              onClick={() => setShowDelete(true)}
            >
              Delete
            </button>
          ) : null}
        </div>
      </header>

      {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
      {softWarned ? <p className="mb-3 text-sm text-amber-700">Approaching document size limit</p> : null}

      {runtime ? (
        <>
          <CollabEditor
            runtime={runtime}
            onCharCount={setCharCount}
            onHardLimit={() => setShowLimit(true)}
            onSoftLimit={() => setSoftWarned(true)}
            onDocChanged={onDocChanged}
          />
          <StatusBar
            charCount={charCount}
            saveStatus={saveStatus}
            peerCount={users.length}
            updatedAt={meta?.updated_at}
          />
        </>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">
          {meta ? "Loading editor..." : "Loading document..."}
        </div>
      )}
    </main>
  );
}
