const replies = new Map();
const audioContext = new AudioContext(); // suspended until the click below, but sampleRate is known now
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
      poly_input_rate: audioContext.sampleRate,
    },
  }));
});

ws.addEventListener("close", () => {
  // The server closes a connection that sends nothing for 5 minutes, so a page left
  // unclicked goes quiet. Say so rather than leave a button that does nothing.
  document.getElementById("reply").textContent = "Disconnected. Reload the page to start again.";
});

ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === "response.output_text.delta") {
    const current = replies.get(msg.item_id) ?? "";
    replies.set(msg.item_id, current + msg.delta);
    document.getElementById("reply").textContent = replies.get(msg.item_id);
  }
  if (msg.type === "error") {
    console.error(`${msg.error.code}: ${msg.error.message}`);
  }
});

const button = document.getElementById("start");
button.addEventListener("click", async () => {
  button.disabled = true; // a second click would add a second worklet and send every frame twice
  await audioContext.resume(); // first, while the click still counts as a user gesture
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
