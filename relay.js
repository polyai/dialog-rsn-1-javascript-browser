/**
 * The relay from the guide's "Connecting from the browser" section.
 *
 * The browser's native WebSocket cannot set headers, and Dialog-RSN-1 only accepts
 * X-API-KEY, so a page can never authenticate directly. This process serves the
 * static page and terminates a same-origin WebSocket, holding the real key and
 * piping frames both ways.
 *
 *   Browser  ->  ws://localhost:8787/realtime-relay      (no key, same-origin)
 *   Relay    ->  wss://api.us.poly.ai/v1/realtime        (holds the real key)
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { WebSocketServer, WebSocket } from "ws";

const PORT = process.env.PORT || 8787;
const UPSTREAM = process.env.DIALOGUE_URL || "wss://api.us.poly.ai/v1/realtime";
const API_KEY = process.env.DIALOGUE_API_KEY;

if (!API_KEY) {
  console.error("DIALOGUE_API_KEY is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const PUBLIC = new URL("./public/", import.meta.url).pathname;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
  const file = join(PUBLIC, path === "/" ? "index.html" : path);
  if (!file.startsWith(PUBLIC)) {           // no escaping the public dir
    res.writeHead(403).end("forbidden");
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});

const wss = new WebSocketServer({ server, path: "/realtime-relay" });

wss.on("connection", (client) => {
  console.log("[relay] browser connected, opening upstream");
  const upstream = new WebSocket(UPSTREAM, {
    headers: {
      "X-API-KEY": API_KEY,
      // The API answers 403 Forbidden to a handshake that carries no User-Agent,
      // and node's `ws` sends none by default. Python's `websockets` sets one
      // already, which is why the same key works there and 403s here.
      "User-Agent": "dialog-rsn-1-relay/1.0",
    },
  });

  // Frames the page sends before the upstream socket is open would otherwise be
  // dropped: the page sends session.update immediately on its own "open" event.
  const backlog = [];
  const toUpstream = (data) =>
    upstream.readyState === WebSocket.OPEN ? upstream.send(data) : backlog.push(data);

  upstream.on("open", () => {
    console.log("[relay] upstream open");
    for (const data of backlog.splice(0)) upstream.send(data);
  });
  upstream.on("message", (data) => {
    if (client.readyState === WebSocket.OPEN) client.send(data.toString());
  });
  upstream.on("close", (code, reason) => {
    console.log(`[relay] upstream closed ${code} ${reason}`);
    client.close();
  });
  upstream.on("error", (err) => {
    console.error("[relay] upstream error:", err.message);
    client.close();
  });

  client.on("message", (data) => toUpstream(data.toString()));
  client.on("close", () => {
    console.log("[relay] browser disconnected");
    upstream.close();
  });
  client.on("error", () => upstream.close());
});

server.listen(PORT, () => {
  console.log(`[relay] http://localhost:${PORT}  ->  ${UPSTREAM}`);
});
