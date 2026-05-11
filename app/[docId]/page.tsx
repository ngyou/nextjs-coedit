"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CharLimitModal } from "@/components/editor/CharLimitModal";
import { CollabEditor } from "@/components/editor/CollabEditor";
import { EditHistoryCharts } from "@/components/editor/EditHistoryCharts";
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
  const [localEdits, setLocalEdits] = useState<Array<{ ts: number; charCount: number }>>([]);
  const runtimeRef = useRef<CollabRuntime | null>(null);
  const transportStatus = useMemo(() => {
    const mode = runtime?.getTransportMode();
    return {
      webRtcEnabled: mode === "webrtc" || mode === "both",
      ablyEnabled: mode === "ably" || mode === "both",
    };
  }, [runtime]);

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
    if (!meta || !unlocked || !name || runtimeRef.current) return;

    let cancelled = false;
    const created = createCollabRuntime(docId, name);
    runtimeRef.current = created;

    const run = async () => {
      try {
        await fetchSnapshot(docId, created.ydoc);
      } catch {
        // no snapshot yet
      }
      if (cancelled) {
        created.destroy();
        if (runtimeRef.current === created) runtimeRef.current = null;
        return;
      }
      setRuntime(created);
    };
    void run();

    return () => {
      cancelled = true;
      if (runtimeRef.current === created) runtimeRef.current = null;
      created.destroy();
      setRuntime((current) => (current === created ? null : current));
    };
  }, [docId, meta, name, unlocked]);

  useEffect(() => {
    return () => {
      const current = runtimeRef.current;
      if (current) {
        current.destroy();
        runtimeRef.current = null;
      }
    };
  }, []);

  const users = usePresence(runtime?.awareness ?? null, runtime?.peerId ?? null);

  useAutosave({
    docId,
    ydoc: runtime?.ydoc ?? null,
    token,
    getCharCount: () => charCount,
    onStatus: setSaveStatus,
    onError: setError,
  });

  useEffect(() => {
    if (!runtime || !name) return;

    const sessionId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    let stopped = false;

    const payload = () => ({
      session_id: sessionId,
      user_name: name,
      transport: runtime.getTransportMode(),
    });

    const begin = async () => {
      try {
        await fetch(`/api/docs/${encodeURIComponent(docId)}/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload()),
          keepalive: true,
        });
      } catch {
        // best effort telemetry
      }
    };

    void begin();

    const timer = setInterval(() => {
      if (stopped) return;
      void fetch(`/api/docs/${encodeURIComponent(docId)}/sessions/${encodeURIComponent(sessionId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
        keepalive: true,
      }).catch(() => {
        // best effort telemetry
      });
    }, 15_000);

    return () => {
      stopped = true;
      clearInterval(timer);
      void fetch(`/api/docs/${encodeURIComponent(docId)}/sessions/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
        keepalive: true,
      }).catch(() => {
        // best effort telemetry
      });
    };
  }, [docId, name, runtime]);

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

  const onDocChanged = useCallback((nextCharCount: number) => {
    setSaveStatus("unsaved");
    setLocalEdits((current) => [...current, { ts: Date.now(), charCount: nextCharCount }].slice(-240));
  }, []);
  const onHardLimit = useCallback(() => setShowLimit(true), []);
  const onSoftLimit = useCallback(() => setSoftWarned(true), []);
  const getDocumentText = useCallback(() => runtimeRef.current?.ytext.toString() ?? "", []);

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
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-3 py-4 sm:px-4 md:px-6">
      {name === "" ? <NamePrompt onComplete={setName} /> : null}
      {!unlocked && meta?.has_password ? <PasswordModal onSubmit={onAuth} error={authErr} /> : null}
      {showShare ? (
        <ShareModal
          docId={docId}
          token={token}
          getDocumentText={getDocumentText}
          onClose={() => setShowShare(false)}
        />
      ) : null}
      {showDelete ? <DeleteModal onConfirm={onDelete} onClose={() => setShowDelete(false)} error={deleteErr} /> : null}
      {showLimit ? <CharLimitModal onClose={() => setShowLimit(false)} /> : null}

      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="mb-1 inline-flex items-center rounded-full border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700">
            COEDIT
          </Link>
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
            onHardLimit={onHardLimit}
            onSoftLimit={onSoftLimit}
            onDocChanged={onDocChanged}
          />
          <section className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="rounded-xl border border-slate-200 bg-white p-2">
              <StatusBar
                charCount={charCount}
                saveStatus={saveStatus}
                peerCount={users.length}
                updatedAt={meta?.updated_at}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2 px-2 pb-1 text-[11px]">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Transport</span>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold ${
                    transportStatus.webRtcEnabled
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-slate-300 bg-slate-100 text-slate-600"
                  }`}
                >
                  WebRTC
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold ${
                    transportStatus.ablyEnabled
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-slate-300 bg-slate-100 text-slate-600"
                  }`}
                >
                  Ably
                </span>
              </div>
            </div>
            <EditHistoryCharts localEdits={localEdits} className="h-fit" />
          </section>
        </>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">
          {meta ? "Loading editor..." : "Loading document..."}
        </div>
      )}
    </main>
  );
}
