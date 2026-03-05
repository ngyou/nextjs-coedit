"use client";

import { useEffect } from "react";
import type * as Y from "yjs";

import { SNAPSHOT_CHECKPOINT_EVERY_N } from "@/lib/constants";
import {
  saveSnapshot,
  type SaveSnapshotResult,
  upsertSnapshotMaterializedText,
} from "@/lib/snapshot";
import type { SaveStatus } from "@/lib/types";

type UseAutosaveProps = {
  docId: string;
  ydoc: Y.Doc | null;
  getCharCount: () => number;
  token?: string;
  onStatus: (status: SaveStatus) => void;
  onError: (message: string) => void;
  onSaved?: (result: SaveSnapshotResult) => void;
};

export function useAutosave({
  docId,
  ydoc,
  getCharCount,
  token,
  onStatus,
  onError,
  onSaved,
}: UseAutosaveProps) {
  useEffect(() => {
    if (!ydoc) return;

    let disposed = false;
    const saveNow = async () => {
      try {
        onStatus("saving");
        const result = await saveSnapshot({ docId, ydoc, charCount: getCharCount(), token });
        if (!disposed) onStatus("saved");
        onSaved?.(result);

        if (result.saved && typeof result.snapshot_id === "number") {
          const snapshotId = result.snapshot_id;
          const periodic = snapshotId % SNAPSHOT_CHECKPOINT_EVERY_N === 0;
          try {
            await upsertSnapshotMaterializedText({
              docId,
              snapshotId,
              fullText: ydoc.getText("codemirror").toString(),
              charCount: getCharCount(),
              checkpointEveryN: SNAPSHOT_CHECKPOINT_EVERY_N,
              isPeriodicCheckpoint: periodic,
              token,
            });
          } catch {
            // Primary binary snapshot is already saved; keep autosave status as saved.
          }
        }
      } catch (error) {
        if (!disposed) {
          onStatus("unsaved");
          onError(error instanceof Error ? error.message : "Autosave failed");
        }
      }
    };

    const interval = window.setInterval(saveNow, 30_000);

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
  }, [docId, getCharCount, onError, onSaved, onStatus, token, ydoc]);
}
