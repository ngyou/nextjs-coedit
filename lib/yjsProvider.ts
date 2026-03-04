"use client";

import * as Ably from "ably";
import * as awarenessProtocol from "y-protocols/awareness.js";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebrtcProvider } from "y-webrtc";
import * as Y from "yjs";

import type { CollabRuntime } from "@/lib/types";

const ABLY_MSG_UPDATE = "y-update";
const ABLY_MSG_SYNC = "y-sync";
const ABLY_MSG_AWARENESS = "y-awareness";
const ABLY_REMOTE_ORIGIN = Symbol("ably-remote");

function encodeBase64(bytes: Uint8Array): string {
  let text = "";
  for (let i = 0; i < bytes.length; i += 1) text += String.fromCharCode(bytes[i]);
  return btoa(text);
}

function decodeBase64(text: string): Uint8Array {
  const bin = atob(text);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function createCollabRuntime(docId: string, name: string): CollabRuntime {
  const peerId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const ydoc = new Y.Doc();
  const ytext = ydoc.getText("codemirror");
  const indexeddb = new IndexeddbPersistence(`collab-${docId}`, ydoc);

  const signalingServers =
    process.env.NEXT_PUBLIC_YJS_SIGNALING?.split(",").map((x) => x.trim()).filter(Boolean) ?? [];

  const webrtc = new WebrtcProvider(docId, ydoc, {
    signaling: signalingServers,
    maxConns: 30,
  });

  webrtc.awareness.setLocalStateField("user", { name, peerId });

  const ablyKey = process.env.NEXT_PUBLIC_ABLY_API_KEY?.trim();
  let stopAbly: (() => void) | null = null;

  if (ablyKey) {
    const ably = new Ably.Realtime({
      key: ablyKey,
      clientId: peerId,
      autoConnect: true,
    });
    const channel = ably.channels.get(`coedit:${docId}`);

    const publishBytes = async (eventName: string, bytes: Uint8Array) => {
      try {
        await channel.publish(eventName, {
          from: peerId,
          payload: encodeBase64(bytes),
        });
      } catch {
        // best-effort relay
      }
    };

    const onDocUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === ABLY_REMOTE_ORIGIN) return;
      void publishBytes(ABLY_MSG_UPDATE, update);
    };

    const onAwarenessUpdate = ({
      added,
      updated,
      removed,
    }: {
      added: number[];
      updated: number[];
      removed: number[];
    }) => {
      const changed = [...added, ...updated, ...removed];
      if (!changed.length) return;
      const update = awarenessProtocol.encodeAwarenessUpdate(webrtc.awareness, changed);
      void publishBytes(ABLY_MSG_AWARENESS, update);
    };

    const onMessage = (msg: Ably.Message) => {
      const data = msg.data as { from?: string; payload?: string } | undefined;
      if (!data?.payload || data.from === peerId) return;
      const bytes = decodeBase64(data.payload);
      if (msg.name === ABLY_MSG_UPDATE || msg.name === ABLY_MSG_SYNC) {
        Y.applyUpdate(ydoc, bytes, ABLY_REMOTE_ORIGIN);
        return;
      }
      if (msg.name === ABLY_MSG_AWARENESS) {
        awarenessProtocol.applyAwarenessUpdate(webrtc.awareness, bytes, ABLY_REMOTE_ORIGIN);
      }
    };

    channel.subscribe(ABLY_MSG_UPDATE, onMessage);
    channel.subscribe(ABLY_MSG_SYNC, onMessage);
    channel.subscribe(ABLY_MSG_AWARENESS, onMessage);

    ydoc.on("update", onDocUpdate);
    webrtc.awareness.on("update", onAwarenessUpdate);

    // Give late joiners a fresh state without waiting for next local edit.
    void publishBytes(ABLY_MSG_SYNC, Y.encodeStateAsUpdate(ydoc));

    stopAbly = () => {
      ydoc.off("update", onDocUpdate);
      webrtc.awareness.off("update", onAwarenessUpdate);
      channel.unsubscribe(ABLY_MSG_UPDATE, onMessage);
      channel.unsubscribe(ABLY_MSG_SYNC, onMessage);
      channel.unsubscribe(ABLY_MSG_AWARENESS, onMessage);
      void channel.detach();
      void ably.close();
    };
  }

  const destroy = () => {
    stopAbly?.();
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
