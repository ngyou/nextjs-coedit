"use client";

import { IndexeddbPersistence } from "y-indexeddb";
import { WebrtcProvider } from "y-webrtc";
import * as Y from "yjs";

import type { CollabRuntime } from "@/lib/types";

export function createCollabRuntime(docId: string, name: string): CollabRuntime {
  const peerId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const ydoc = new Y.Doc();
  const ytext = ydoc.getText("codemirror");
  const indexeddb = new IndexeddbPersistence(`collab-${docId}`, ydoc);

  const signalingServers =
    process.env.NEXT_PUBLIC_YJS_SIGNALING?.split(",").map((x) => x.trim()).filter(Boolean) ?? [];

  const webrtc = new WebrtcProvider(docId, ydoc, {
    signaling: signalingServers.length ? signalingServers : undefined,
    maxConns: 30,
  });

  webrtc.awareness.setLocalStateField("user", { name, peerId });

  const destroy = () => {
    indexeddb.destroy();
    webrtc.destroy();
    ydoc.destroy();
  };

  return {
    ydoc,
    ytext,
    webrtc,
    indexeddb,
    awareness: webrtc.awareness,
    peerId,
    destroy,
  };
}
