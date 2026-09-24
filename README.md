# Dialog-RSN-1 voice agent in the browser

The full example from [Build a voice agent for the browser with JavaScript](https://dialog-rsn-1-eap-docs.pages.dev/dialog-rsn-1/guides/javascript-browser/),
plus the relay the guide describes, so you can run it.

The page captures microphone audio, streams it to Dialog-RSN-1 through a same-origin relay, and
renders the reply as it arrives. It uses plain browser APIs, with no framework and no build step.

## Run it

You need Node 18 or later and a Dialog-RSN-1 API key.

```bash
npm install
cp .env.example .env        # add your DIALOGUE_API_KEY
set -a && . ./.env && set +a
npm start                   # http://localhost:8787
```

Open the page, click **Start talking**, and allow the microphone.

## What's in it

| File | What it is |
|---|---|
| `public/index.html` | The guide's page, unchanged |
| `public/app.js` | The guide's script. One change: it connects to the relay on the page's own origin instead of `your-app.example.com` |
| `public/pcm-worklet.js` | The guide's `AudioWorkletProcessor`, unchanged |
| `relay.js` | Serves `public/` and relays `/realtime-relay` to Dialog-RSN-1, adding your key server-side |

## Why a relay

A browser's native `WebSocket` can't set headers, and Dialog-RSN-1 only accepts the key in the
`X-API-KEY` header. Even if it could, a key in page code is readable by anyone who opens dev tools.
The relay holds the key and the browser never sees it:

```text
Browser  ->  ws://localhost:8787/realtime-relay   (no key, same-origin)
Relay    ->  wss://api.us.poly.ai/v1/realtime     (holds the real key)
```

If you write your own relay in Node, set a `User-Agent` on the upstream connection. The API
rejects a handshake without one with a bare 403, and the `ws` package sends none by default.

## Related

- [Dialog-RSN-1 quickstart](https://dialog-rsn-1-eap-docs.pages.dev/dialog-rsn-1/quickstart/)
- [Dialog-RSN-1 reference](https://dialog-rsn-1-eap-docs.pages.dev/dialog-rsn-1/reference/)
- [Python version of this agent](https://github.com/polyai/dialog-rsn-1-python-from-scratch)

## License

Apache 2.0. See [LICENSE](LICENSE).
