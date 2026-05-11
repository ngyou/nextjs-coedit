#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");
const WebSocket = require("ws");

const ROOM = "__connectivity_test__";
const ACK_TIMEOUT_MS = 8_000;
const PEER_TIMEOUT_MS = 5_000;
const CLOSE_TIMEOUT_MS = 3_000;

function loadEnvFromDotenv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value.replace(/^["']|["']$/g, "");
    }
  }
}

function getSignalingUrl() {
  const cli = process.argv[2]?.trim();
  if (cli) return cli;
  loadEnvFromDotenv();
  const fromEnv = process.env.NEXT_PUBLIC_YJS_SIGNALING?.split(",").map((x) => x.trim()).filter(Boolean)[0];
  return fromEnv || "";
}

function validateWsUrl(url) {
  if (!url) {
    throw new Error("Missing signaling URL. Pass <wss-url> or set NEXT_PUBLIC_YJS_SIGNALING in .env");
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (parsed.protocol !== "wss:" && parsed.protocol !== "ws:") {
    throw new Error(`URL must start with ws:// or wss://, got: ${parsed.protocol}`);
  }
}

async function run() {
  const url = getSignalingUrl();
  validateWsUrl(url);

  const startedAt = Date.now();
  const marker = `connectivity-${Math.random().toString(36).slice(2)}`;
  const ws = new WebSocket(url);

  let connectedAt = 0;
  let ackedJoin = false;
  let peerPresent = false;
  let peerTimedOut = false;
  let closeResolved = false;
  let ackTimer = null;
  let peerTimer = null;

  const cleanupTimers = () => {
    if (ackTimer) clearTimeout(ackTimer);
    if (peerTimer) clearTimeout(peerTimer);
    ackTimer = null;
    peerTimer = null;
  };

  const waitForClose = () =>
    new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!closeResolved) reject(new Error("Timeout waiting for clean websocket close"));
      }, CLOSE_TIMEOUT_MS);
      ws.once("close", () => {
        closeResolved = true;
        clearTimeout(timeout);
        resolve();
      });
      ws.once("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
      ws.close();
    });

  await new Promise((resolve, reject) => {
    ws.once("open", () => {
      connectedAt = Date.now();
      ws.send(JSON.stringify({ type: "subscribe", topics: [ROOM] }));
      ws.send(JSON.stringify({ type: "publish", topic: ROOM, data: marker }));

      ackTimer = setTimeout(() => {
        reject(new Error("Signaling server did not acknowledge room join within timeout"));
      }, ACK_TIMEOUT_MS);
    });

    ws.once("error", (err) => {
      reject(err);
    });

    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (!ackedJoin && msg.type === "publish" && msg.topic === ROOM && msg.data === marker) {
        ackedJoin = true;
        if (ackTimer) clearTimeout(ackTimer);

        const clients = typeof msg.clients === "number" ? msg.clients : 0;
        if (clients > 1) {
          peerPresent = true;
          resolve();
          return;
        }

        peerTimer = setTimeout(() => {
          peerTimedOut = true;
          resolve();
        }, PEER_TIMEOUT_MS);
        return;
      }

      if (ackedJoin && msg.type === "publish" && msg.topic === ROOM && typeof msg.clients === "number" && msg.clients > 1) {
        peerPresent = true;
        if (peerTimer) clearTimeout(peerTimer);
        resolve();
      }
    });
  });

  cleanupTimers();
  await waitForClose();

  const connectMs = connectedAt - startedAt;
  console.log(`OK: WebSocket connection established (${connectMs}ms)`);
  console.log("OK: Signaling server acknowledged room join");
  if (peerPresent) {
    console.log("OK: Another peer is present in the room");
  } else if (peerTimedOut) {
    console.log("OK: No peer detected (timed out cleanly)");
  } else {
    console.log("OK: No peer detected");
  }
  console.log("OK: Clean disconnect");
}

run()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((err) => {
    console.error(`FAIL: Signaling test failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });
