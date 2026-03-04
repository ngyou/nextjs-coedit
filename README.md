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

## Run Your Own `y-webrtc-signaling`

Install signaling server CLI:

```bash
npm install -g y-webrtc
```

Start a local signaling service on port `4444`:

```bash
y-webrtc-signaling --port 4444
```

PowerShell example:

```powershell
$env:PORT=4444; y-webrtc-signaling
```

Set frontend env:

```env
NEXT_PUBLIC_YJS_SIGNALING=ws://localhost:4444
```

Use `wss://` in production (for HTTPS sites and browser mixed-content rules).

## Can I Add CORS Checks To `y-webrtc-signaling`?

Short answer: not as traditional HTTP CORS.

- WebSocket handshakes are not protected by browser CORS preflight like `fetch/XHR`.
- Browser clients still send an `Origin` header, but this is only one signal and is not a full auth mechanism.
- Default `y-webrtc-signaling` CLI does not provide strong built-in origin/auth policy controls.

Recommended controls:

- Put signaling behind a reverse proxy (Nginx/Caddy/Traefik) and explicitly allow trusted `Origin` values.
- Add authentication (token/API key) at proxy or a custom signaling server wrapper.
- Restrict network access (firewall/private network/VPN) when possible.

Conclusion: you can add origin filtering, but do not rely on CORS/origin checks alone to prevent abuse.

## Signaling Connectivity Test

Run a standalone signaling check:

```bash
node test-signaling.js <wss-url>
```

If `<wss-url>` is omitted, the script uses the first URL from `NEXT_PUBLIC_YJS_SIGNALING` in `.env`.

It reports:

- WebSocket connection time
- Room join acknowledgement for `__connectivity_test__`
- Whether another peer is present (or timeout cleanly)
- Clean disconnect

Exit codes:

- `0`: success
- `1`: failure

## Admin Console

- Login page: `/admin/login`
- Console page: `/admin`
- Documents page: `/admin/docs`
- Document history page: `/admin/docs/{docId}`
- Uses backend `/api/admin/*` endpoints through the existing proxy route.
- Admin auth is required only for admin pages. Document creation/editing remains public.
- Signaling section supports:
  - persistent URL table (store/activate/deactivate/delete y-webrtc signaling URLs)
  - backend test (Python service-side connectivity)
  - frontend test (browser JavaScript connectivity)
- Document history section supports:
  - searchable/paged snapshot table
  - decoded historical snapshot content preview
  - snapshot trend charts for char count and payload size

## Snapshot History Charts

- Document page autosaves every 30 seconds to backend snapshots.
- Backend deduplicates snapshot inserts when the last 2 snapshots are the same payload hash.
- Document page shows a compact frontend local edit timeline panel for the current browser session.
