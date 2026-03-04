"use client";

import { useSyncExternalStore } from "react";
import type { Awareness } from "y-protocols/awareness";

import type { PresenceUser } from "@/lib/types";

const EMPTY_USERS: PresenceUser[] = [];
const snapshotCache = new WeakMap<Awareness, PresenceUser[]>();

function computePresence(awareness: Awareness): PresenceUser[] {
  const next: PresenceUser[] = [];
  awareness.getStates().forEach((state, clientId) => {
    const rawName = (state as { user?: { name?: string } }).user?.name;
    next.push({ clientId, name: rawName?.trim() || "Anon" });
  });
  return next.sort((a, b) => a.name.localeCompare(b.name));
}

function getSnapshot(awareness: Awareness | null): PresenceUser[] {
  if (!awareness) return EMPTY_USERS;
  const cached = snapshotCache.get(awareness);
  if (cached) return cached;
  const computed = computePresence(awareness);
  snapshotCache.set(awareness, computed);
  return computed;
}

export function usePresence(awareness: Awareness | null): PresenceUser[] {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (!awareness) return () => {};
      const onChange = () => {
        snapshotCache.set(awareness, computePresence(awareness));
        onStoreChange();
      };
      awareness.on("change", onChange);
      return () => awareness.off("change", onChange);
    },
    () => getSnapshot(awareness),
    () => EMPTY_USERS,
  );
}
