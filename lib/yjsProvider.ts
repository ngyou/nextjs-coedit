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
const FALLBACK_TIMEOUT_MS = 8_000;
const SIGNALING_DIAG_INTERVAL_MS = 1_000;
const PUBLIC_SIGNALING_HOSTS = new Set(["signaling.yjs.dev", "y-webrtc-eu.fly.dev"]);

type TransportMode = "webrtc" | "ably" | "both";

function parseSignalingServers(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    console.warn(
      "[collab] NEXT_PUBLIC_YJS_SIGNALING is empty. WebRTC peer discovery may fail unless peers are in the same browser context.",
    );
    return [];
  }

  const urls = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const valid: string[] = [];
  for (const value of urls) {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
        console.warn(`[collab] Ignoring invalid signaling URL (must be ws:// or wss://): ${value}`);
        continue;
      }
      if (PUBLIC_SIGNALING_HOSTS.has(parsed.hostname)) {
        console.warn(
          `[collab] Using public signaling host (${parsed.hostname}). Prefer your own signaling service for production.`,
        );
      }
      valid.push(parsed.toString());
    } catch {
      console.warn(`[collab] Ignoring malformed signaling URL: ${value}`);
    }
  }

  if (!valid.length) {
    console.warn("[collab] No valid signaling URLs remain after validation.");
  }
  return valid;
}

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

  const signalingServers = parseSignalingServers(process.env.NEXT_PUBLIC_YJS_SIGNALING);

  const webrtc = new WebrtcProvider(docId, ydoc, {
    signaling: signalingServers,
    maxConns: 30,
  });

  webrtc.awareness.setLocalStateField("user", { name, peerId });

  const ablyKey = process.env.NEXT_PUBLIC_ABLY_API_KEY?.trim();
  let hasWebrtcPeers = false;
  let ablyActive = false;
  let lastTransportMode: TransportMode | null = null;
  let stopAbly: (() => void) | null = null;

  const logTransportMode = () => {
    let mode: TransportMode;
    if (hasWebrtcPeers && ablyActive) {
      mode = "both";
    } else if (ablyActive) {
      mode = "ably";
    } else {
      mode = "webrtc";
    }
    if (mode !== lastTransportMode) {
      lastTransportMode = mode;
      console.info(`[collab] transport active: ${mode}`);
    }
  };

  const activateAbly = (reason: string) => {
    if (!ablyKey || ablyActive) return;
    ablyActive = true;
    console.warn(`[collab] activating Ably fallback: ${reason}`);

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
    logTransportMode();

    stopAbly = () => {
      ydoc.off("update", onDocUpdate);
      webrtc.awareness.off("update", onAwarenessUpdate);
      channel.unsubscribe(ABLY_MSG_UPDATE, onMessage);
      channel.unsubscribe(ABLY_MSG_SYNC, onMessage);
      channel.unsubscribe(ABLY_MSG_AWARENESS, onMessage);
      void channel.detach();
      void ably.close();
      ablyActive = false;
      logTransportMode();
    };
  };

  const onPeers = (event: { webrtcPeers: string[]; bcPeers: string[] }) => {
    hasWebrtcPeers = event.webrtcPeers.length > 0 || event.bcPeers.length > 0;
    logTransportMode();
  };

  webrtc.on("peers", onPeers);
  logTransportMode();

  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let signalingDiagTimer: ReturnType<typeof setInterval> | null = null;

  if (ablyKey) {
    fallbackTimer = setTimeout(() => {
      if (!hasWebrtcPeers) {
        activateAbly("no peers connected within 8s");
      }
    }, FALLBACK_TIMEOUT_MS);

    signalingDiagTimer = setInterval(() => {
      if (hasWebrtcPeers || ablyActive || !signalingServers.length) return;
      const conns = (webrtc as unknown as { signalingConns?: Array<{ connected?: boolean; connecting?: boolean; unsuccessfulReconnects?: number }> }).signalingConns ?? [];
      if (!conns.length) return;
      const anyConnected = conns.some((conn) => Boolean(conn.connected));
      const anyConnecting = conns.some((conn) => Boolean(conn.connecting));
      const anyFailed = conns.some((conn) => (conn.unsuccessfulReconnects ?? 0) > 0);
      if (!anyConnected && !anyConnecting && anyFailed) {
        activateAbly("WebRTC signaling connection failed");
      }
    }, SIGNALING_DIAG_INTERVAL_MS);
  } else {
    console.warn("[collab] NEXT_PUBLIC_ABLY_API_KEY is not set. Ably fallback is disabled.");
  }

  const destroy = () => {
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    if (signalingDiagTimer) {
      clearInterval(signalingDiagTimer);
      signalingDiagTimer = null;
    }
    webrtc.off("peers", onPeers);
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
    getTransportMode: () => lastTransportMode ?? "webrtc",
    destroy,
  };
}
