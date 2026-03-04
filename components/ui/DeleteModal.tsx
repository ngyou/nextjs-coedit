"use client";

import { useState } from "react";

export function DeleteModal({
  onConfirm,
  onClose,
  error,
}: {
  onConfirm: (password: string) => Promise<void>;
  onClose: () => void;
  error?: string;
}) {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const confirm = async () => {
    setPending(true);
    try {
      await onConfirm(password);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-slate-900">Delete Document</h2>
        <p className="mt-2 text-sm text-slate-600">Enter password to permanently remove this document.</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2"
          maxLength={256}
        />
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
            onClick={confirm}
            disabled={pending || !password.trim()}
          >
            {pending ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

