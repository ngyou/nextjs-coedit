# nextjs-coedit

Collaborative editor frontend built with Next.js + Yjs.

## Setup

1. Copy `.env.example` to `.env`.
2. Install dependencies:
   - `pnpm install`
3. Start dev server:
   - `pnpm dev`
4. Open `http://localhost:3000`.

## Environment Variables

- `API_URL`
  - Backend proxy target used by `app/api/[...path]/route.ts`.
  - Example: `http://localhost:8000/api`
- `NEXT_PUBLIC_APP_URL`
  - Public app URL used in share links.
- `NEXT_PUBLIC_YJS_SIGNALING`
  - Comma-separated WebSocket signaling URLs for `y-webrtc`.
  - Example: `wss://signal.example.com`
- `NEXT_PUBLIC_ABLY_API_KEY`
  - Optional Ably key used as realtime relay fallback path.

## Realtime Transport Logic

The editor can use two realtime paths:

1. WebRTC via `y-webrtc` (primary)
2. Ably pub/sub relay (fallback path when key is configured)

### 1) `NEXT_PUBLIC_YJS_SIGNALING` (WebRTC signaling)

- Purpose: peer discovery for WebRTC.
- `y-webrtc` needs a signaling server to exchange SDP/ICE metadata before direct peer connection is possible.
- Signaling server endpoints must be WebSocket URLs (`ws://` or `wss://`).

Why `wss://` in production:

- Browsers enforce secure context rules.
- HTTPS pages commonly block insecure `ws://` mixed content.
- `wss://` is the safe default for deployed environments.

### 2) `NEXT_PUBLIC_ABLY_API_KEY` (Ably relay fallback)

- If set, frontend also connects to Ably channel `coedit:{docId}`.
- It relays:
  - Yjs document updates
  - Yjs full sync snapshot on join
  - Yjs awareness/presence updates
- This provides an alternate realtime path when WebRTC signaling/connectivity is unreliable.

## Backend SSE Role

Backend exposes SSE signaling routes (`/api/signal/...`), but current frontend runtime does not use SSE as an active transport in `createCollabRuntime`.

- Current active frontend paths: WebRTC (`NEXT_PUBLIC_YJS_SIGNALING`) + optional Ably relay (`NEXT_PUBLIC_ABLY_API_KEY`).
- SSE can be integrated later with a custom Yjs transport adapter if needed.

## Practical Configuration

- Local/dev quick start:
  - Set `NEXT_PUBLIC_YJS_SIGNALING` to a working signaling WS endpoint.
  - Optionally set `NEXT_PUBLIC_ABLY_API_KEY` for relay fallback.
- Production:
  - Use `wss://` signaling URLs.
  - Prefer Ably token auth from backend instead of exposing a root API key.
