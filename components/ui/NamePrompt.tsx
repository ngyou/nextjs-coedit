"use client";

import { useState } from "react";

const NAME_KEY = "collab_user_name";

function makeAnonName(): string {
  return `Anon${Math.floor(1000 + Math.random() * 9000)}`;
}

export function getOrCreateLocalName(): string {
  if (typeof window === "undefined") return "Anon0000";
  const existing = localStorage.getItem(NAME_KEY)?.trim();
  if (existing) return existing;
  const anon = makeAnonName();
  localStorage.setItem(NAME_KEY, anon);
  return anon;
}

export function NamePrompt({ onComplete }: { onComplete: (name: string) => void }) {
  const [name, setName] = useState("");

  const save = () => {
    const finalName = name.trim() || makeAnonName();
    localStorage.setItem(NAME_KEY, finalName);
    onComplete(finalName);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-slate-900">Choose a display name</h2>
        <p className="mt-2 text-sm text-slate-600">This name is only stored in this browser.</p>
        <input
          className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2"
          placeholder="e.g. Alex"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={32}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={save}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

