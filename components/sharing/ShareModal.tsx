"use client";

import { QRCodeSVG } from "qrcode.react";

export function ShareModal({ docId, onClose }: { docId: string; onClose: () => void }) {
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/${docId}`;

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
  };

  const downloadQR = () => {
    const svg = document.getElementById("share-qr") as SVGElement | null;
    if (!svg) return;
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 280;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 240, 280);

    const data = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 20, 20, 200, 200);
      ctx.fillStyle = "#111827";
      ctx.font = "bold 20px monospace";
      ctx.textAlign = "center";
      ctx.fillText(docId, 120, 252);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `collab-${docId}.png`;
      a.click();
    };
    img.src = `data:image/svg+xml;base64,${btoa(data)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Share Document</h2>
          <button className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="mt-4 text-center font-mono text-3xl font-bold tracking-widest text-slate-900">{docId}</p>
        <div className="mt-3 flex items-center gap-2">
          <input className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs" readOnly value={url} />
          <button className="rounded-lg border border-slate-300 px-2 py-1 text-xs" onClick={() => copy(url)}>
            Copy
          </button>
        </div>
        <div className="mt-4 flex justify-center">
          <QRCodeSVG id="share-qr" value={url} size={200} />
        </div>
        <button className="mt-4 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-white" onClick={downloadQR}>
          Download QR PNG
        </button>
      </div>
    </div>
  );
}

