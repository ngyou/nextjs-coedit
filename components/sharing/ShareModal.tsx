"use client";

import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

type StaticFileExtension = "yaml" | "json" | "txt";

type ShareModalProps = {
  docId: string;
  token?: string;
  getDocumentText: () => string;
  onClose: () => void;
};

type StaticFileCreateResponse = {
  ok: boolean;
  url: string;
  generated_at: string;
};

export function ShareModal({ docId, token, getDocumentText, onClose }: ShareModalProps) {
  const websiteUrl = typeof window === "undefined" ? "" : `${window.location.origin}/${docId}`;
  const [activeTab, setActiveTab] = useState<"website" | "static">("website");

  const [extension, setExtension] = useState<StaticFileExtension>("yaml");
  const [isCreating, setIsCreating] = useState(false);
  const [staticPath, setStaticPath] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");
  const [error, setError] = useState("");

  const staticFileUrl = useMemo(() => {
    if (!staticPath || typeof window === "undefined") return "";
    if (staticPath.startsWith("http://") || staticPath.startsWith("https://")) return staticPath;
    return `${window.location.origin}${staticPath}`;
  }, [staticPath]);

  const copy = async (value: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
  };

  const createStaticFile = async () => {
    setError("");
    setIsCreating(true);
    try {
      const res = await fetch(`/api/docs/${encodeURIComponent(docId)}/static-files`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          extension,
          content: getDocumentText(),
        }),
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Failed to create static file");
      }

      const payload = (await res.json()) as StaticFileCreateResponse;
      setStaticPath(payload.url);
      setGeneratedAt(payload.generated_at);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create static file");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Share Document</h2>
          <button className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="mt-3 text-center font-mono text-xl font-bold tracking-widest text-slate-900">{docId}</p>

        <div className="mt-4 flex rounded-lg border border-slate-200 bg-slate-50 p-1">
          <button
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold ${
              activeTab === "website" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
            }`}
            onClick={() => setActiveTab("website")}
          >
            Website
          </button>
          <button
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold ${
              activeTab === "static" ? "bg-white text-emerald-800 shadow-sm" : "text-slate-600"
            }`}
            onClick={() => setActiveTab("static")}
          >
            Static File
          </button>
        </div>

        {activeTab === "website" ? (
          <section className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mt-3 flex items-center gap-2">
              <input className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs" readOnly value={websiteUrl} />
              <button className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs" onClick={() => copy(websiteUrl)}>
                Copy Link
              </button>
            </div>
            <div className="mt-3 flex justify-center rounded-xl border border-slate-300 bg-white p-3">
              <QRCodeSVG id="share-qr-website" value={websiteUrl} size={180} fgColor="#000000" bgColor="#ffffff" />
            </div>
          </section>
        ) : (
          <section className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2">
              <select
                className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1 text-xs"
                value={extension}
                onChange={(event) => setExtension(event.target.value as StaticFileExtension)}
              >
                <option value="yaml">YAML (.yaml)</option>
                <option value="json">JSON (.json)</option>
                <option value="txt">TXT (.txt)</option>
              </select>
              <button
                className="rounded-lg bg-emerald-700 px-3 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                onClick={createStaticFile}
                disabled={isCreating}
              >
                {isCreating ? "Creating..." : "Create"}
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1 text-xs" readOnly value={staticFileUrl} />
              <button
                className="rounded-lg border border-emerald-300 bg-white px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => copy(staticFileUrl)}
                disabled={!staticFileUrl}
              >
                Copy Link
              </button>
            </div>
            <div className="mt-3 flex justify-center rounded-xl border-2 border-emerald-600 bg-white p-3">
              {staticFileUrl ? (
                <QRCodeSVG id="share-qr-static" value={staticFileUrl} size={180} fgColor="#065f46" bgColor="#ffffff" />
              ) : (
                <div className="flex h-[180px] w-[180px] items-center justify-center text-center text-xs text-emerald-800/70">
                  Create a static file to generate QR code.
                </div>
              )}
            </div>
            <p className="mt-2 text-[11px] text-emerald-800/70">
              Generated on: {generatedAt ? new Date(generatedAt).toLocaleString() : "-"}
            </p>
            {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
          </section>
        )}
      </div>
    </div>
  );
}
