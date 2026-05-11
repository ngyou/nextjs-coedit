"use client";

import { useState } from "react";

export function PasswordModal({
  onSubmit,
  error,
}: {
  onSubmit: (password: string) => Promise<void>;
  error?: string;
}) {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setPending(true);
    try {
      await onSubmit(password);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-slate-900">Password Required</h2>
        <p className="mt-2 text-sm text-slate-600">Enter the document password to continue.</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2"
          maxLength={256}
        />
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <button
          className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
          onClick={submit}
          disabled={pending || !password.trim()}
        >
          {pending ? "Checking..." : "Unlock"}
        </button>
      </div>
    </div>
  );
}

