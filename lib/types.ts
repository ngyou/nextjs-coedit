import type * as Y from "yjs";
import type { WebrtcProvider } from "y-webrtc";
import type { IndexeddbPersistence } from "y-indexeddb";
import type { Awareness } from "y-protocols/awareness.js";

export type SaveStatus = "saved" | "saving" | "unsaved";

export type DocumentMeta = {
  id: string;
  has_password: boolean;
  char_count: number;
  created_at: string;
  updated_at: string;
};

export type SnapshotHistoryItem = {
  id: number;
  char_count: number;
  created_at: string;
};

export type CollabRuntime = {
  ydoc: Y.Doc;
  ytext: Y.Text;
  webrtc: WebrtcProvider;
  indexeddb: IndexeddbPersistence;
  awareness: Awareness;
  peerId: string;
  getTransportMode: () => "webrtc" | "ably" | "both";
  destroy: () => void;
};

export type PresenceUser = {
  clientId: number;
  name: string;
};
