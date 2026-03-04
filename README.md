# nextjs-coedit

Collaborative editor frontend built with Next.js App Router, CodeMirror 6, and Yjs.

## Setup

1. Copy `.env.example` to `.env`.
2. Install dependencies:
   - `pnpm install`
3. Start dev server:
   - `pnpm dev`
4. Open `http://localhost:3000`.

## Environment Variables

- `API_URL`
  - Server-side proxy target used by `app/api/[...path]/route.ts`.
  - Example: `http://localhost:8000/api`
- `NEXT_PUBLIC_APP_URL`
  - Public app base URL used for sharing links.
- `NEXT_PUBLIC_YJS_SIGNALING`
  - Comma-separated signaling URLs for `y-webrtc`.
  - Must be `ws://` or `wss://`.
  - Example: `ws://localhost:4444,wss://signal.example.com`
- `NEXT_PUBLIC_ABLY_API_KEY`
  - Optional Ably key for realtime fallback transport.

## Realtime Transport Behavior

The editor always creates a single shared `Y.Doc` per document tab.

Transport path:

1. Try WebRTC (`y-webrtc`) first.
2. If no peer is connected after 8 seconds, enable Ably fallback (if key is set).
3. If signaling appears failed (reconnect failures and no connected signaling socket), enable Ably fallback.
4. If WebRTC later gets peers while Ably is active, both can run together against the same `Y.Doc`.

Console diagnostics:

- Active transport mode log: `webrtc` / `ably` / `both`
- Validation warnings for invalid or missing `NEXT_PUBLIC_YJS_SIGNALING`
- Warning when using public signaling hosts like `signaling.yjs.dev`

## Running a Local `y-webrtc-signaling` Server

Install:

```bash
npm install -g y-webrtc
```

Run (CLI flag):

```bash
y-webrtc-signaling --port 4444
```

Run (PowerShell env var):

```powershell
$env:PORT=4444; y-webrtc-signaling
```

Then set:

```env
NEXT_PUBLIC_YJS_SIGNALING=ws://localhost:4444
```

Use `wss://` in production when your app is served over HTTPS.

## CORS / Origin Notes for Signaling

Traditional HTTP CORS is not a complete protection model for WebSocket signaling.

- WebSocket handshake behavior differs from normal fetch/XHR CORS preflight.
- `Origin` checks can help, but are not sufficient as sole access control.
- For stronger protection, use one or more:
  - reverse proxy origin allowlist
  - auth/token gate
  - private network/firewall controls

## Signaling Connectivity Test Script

Run:

```bash
node test-signaling.js <wss-or-ws-url>
```

If URL is omitted, script reads first URL from `NEXT_PUBLIC_YJS_SIGNALING` in `.env`.

It checks:

- WebSocket connection established time
- Room publish acknowledgement in `__connectivity_test__`
- Peer presence (or timeout cleanly)
- Clean disconnect

Exit code:

- `0` success
- `1` failure

## Admin Console Routes

- Login: `/admin/login`
- Console: `/admin`
- Documents list: `/admin/docs`
- Document history detail: `/admin/docs/{docId}`

Admin-only features:

- Active session list
- Signaling URL table (create/update/activate/delete)
- Signaling tests from backend (Python) and frontend (browser JS)
- Snapshot history charts and historical snapshot content preview
- Document soft/hard delete and restore

Editing docs remains public; admin auth is only for admin routes.

## Snapshot and Timeline UX

- Frontend autosaves every 30 seconds using `PUT /api/docs/{docId}/snapshot`.
- Backend snapshot dedupe: skip insert when last two snapshot hashes are both equal to current hash.
- Editor page shows a compact non-sticky local edit timeline panel (recent edits only).

## Deprecated SSE Signaling Path

SSE signaling endpoints still exist on backend for reference but are deprecated and not the active collaboration transport.
