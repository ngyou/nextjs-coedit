"use client";

import Link from "next/link";

export function CharLimitModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-slate-900">Character Limit Reached</h2>
        <p className="mt-2 text-sm text-slate-600">
          This document has reached the 100,000 character limit. You can keep reading but cannot add more text.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm" onClick={onClose}>
            OK
          </button>
          <Link href="/" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            New Document
          </Link>
        </div>
      </div>
    </div>
  );
}

