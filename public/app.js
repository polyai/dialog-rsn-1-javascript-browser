const replies = new Map();
// The guide connects to wss://your-app.example.com/realtime-relay. Here the relay is
// whatever server served this page, so derive the URL from the page's own origin.
const proto = location.protocol === "https:" ? "wss:" : "ws:";
const ws = new WebSocket(`${proto}//${location.host}/realtime-relay`);

ws.addEventListener("open", () => {
  ws.send(JSON.stringify({
    type: "session.update",
    session: {
      instructions: "You are a helpful, concise assistant.",
      output_modalities: ["text"],
      audio: { input: { format: { type: "audio/pcm" } } },
      poly_input_rate: 48000,
    },
  }));
});

ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === "response.output_text.delta") {
    const current = replies.get(msg.item_id) ?? "";
    replies.set(msg.item_id, current + msg.delta);
    document.getElementById("reply").textContent = replies.get(msg.item_id);
  }
});

document.getElementById("start").addEventListener("click", async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioContext = new AudioContext();
  await audioContext.audioWorklet.addModule("pcm-worklet.js");

  const source = audioContext.createMediaStreamSource(stream);
  const worklet = new AudioWorkletNode(audioContext, "pcm-worklet");

  worklet.port.onmessage = (e) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    const bytes = new Uint8Array(e.data);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: btoa(binary) }));
  };

  source.connect(worklet);
});
