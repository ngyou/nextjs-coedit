"use client";

import { useSyncExternalStore } from "react";
import type { Awareness } from "y-protocols/awareness";

import type { PresenceUser } from "@/lib/types";

const EMPTY_USERS: PresenceUser[] = [];
const snapshotCache = new WeakMap<Awareness, PresenceUser[]>();
const derivedSnapshotCache = new WeakMap<Awareness, Map<string, PresenceUser[]>>();

function computePresence(awareness: Awareness): PresenceUser[] {
  const next: PresenceUser[] = [];
  awareness.getStates().forEach((state, clientId) => {
    const user = (state as { user?: { name?: string; peerId?: string } }).user;
    const rawName = user?.name;
    next.push({
      clientId,
      name: rawName?.trim() || "Anon",
      peerId: user?.peerId,
      isSelf: false,
    });
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

function getSnapshotWithSelf(awareness: Awareness | null, selfPeerId?: string | null): PresenceUser[] {
  const base = getSnapshot(awareness);
  if (!awareness || !selfPeerId) return base;

  const key = selfPeerId;
  let cacheForAwareness = derivedSnapshotCache.get(awareness);
  if (!cacheForAwareness) {
    cacheForAwareness = new Map<string, PresenceUser[]>();
    derivedSnapshotCache.set(awareness, cacheForAwareness);
  }

  const cached = cacheForAwareness.get(key);
  if (cached) return cached;

  const derived = base.map((user) => ({
    ...user,
    isSelf: user.peerId === selfPeerId,
  }));
  cacheForAwareness.set(key, derived);
  return derived;
}

export function usePresence(awareness: Awareness | null, selfPeerId?: string | null): PresenceUser[] {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (!awareness) return () => {};
      const onChange = () => {
        snapshotCache.set(awareness, computePresence(awareness));
        derivedSnapshotCache.delete(awareness);
        onStoreChange();
      };
      awareness.on("change", onChange);
      return () => awareness.off("change", onChange);
    },
    () => getSnapshotWithSelf(awareness, selfPeerId),
    () => EMPTY_USERS,
  );
}
