// DEPRECATED: This SSE signaling relay is no longer the active path.
// Retained for reference. Will be removed in a future cleanup.

export type SignalMessage = Record<string, unknown>;

type OnMessage = (msg: SignalMessage) => void;

export class SSESignalingProvider {
  private readonly docId: string;
  private readonly peerId: string;
  private eventSource?: EventSource;
  private readonly listeners = new Set<OnMessage>();

  constructor(docId: string, peerId: string) {
    this.docId = docId;
    this.peerId = peerId;
  }

  connect() {
    if (this.eventSource) return;
    console.warn("[DEPRECATED] SSE signaling endpoint in use. Prefer WebRTC signaling or Ably fallback.");
    this.eventSource = new EventSource(
      `/api/signal/${encodeURIComponent(this.docId)}/listen?peer_id=${encodeURIComponent(this.peerId)}`,
    );
    this.eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as SignalMessage;
        for (const listener of this.listeners) listener(payload);
      } catch {
        return;
      }
    };
  }

  disconnect() {
    this.eventSource?.close();
    this.eventSource = undefined;
    this.listeners.clear();
  }

  async send(message: SignalMessage) {
    console.warn("[DEPRECATED] SSE signaling endpoint in use. Prefer WebRTC signaling or Ably fallback.");
    await fetch(`/api/signal/${encodeURIComponent(this.docId)}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
      cache: "no-store",
    });
  }

  onMessage(cb: OnMessage): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
}
