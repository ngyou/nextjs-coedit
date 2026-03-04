"use client";

import { useEffect } from "react";
import type * as Y from "yjs";

import { saveSnapshot } from "@/lib/snapshot";
import type { SaveStatus } from "@/lib/types";

type UseAutosaveProps = {
  docId: string;
  ydoc: Y.Doc | null;
  getCharCount: () => number;
  token?: string;
  onStatus: (status: SaveStatus) => void;
  onError: (message: string) => void;
};

export function useAutosave({
  docId,
  ydoc,
  getCharCount,
  token,
  onStatus,
  onError,
}: UseAutosaveProps) {
  useEffect(() => {
    if (!ydoc) return;

    let disposed = false;
    const saveNow = async () => {
      try {
        onStatus("saving");
        await saveSnapshot({ docId, ydoc, charCount: getCharCount(), token });
        if (!disposed) onStatus("saved");
      } catch (error) {
        if (!disposed) {
          onStatus("unsaved");
          onError(error instanceof Error ? error.message : "Autosave failed");
        }
      }
    };

    const interval = window.setInterval(saveNow, 60_000);

    const onBeforeUnload = () => {
      // sendBeacon cannot include auth headers; protected docs still autosave on interval.
      void saveNow();
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [docId, getCharCount, onError, onStatus, token, ydoc]);
}

