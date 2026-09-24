// pcm-worklet.js: registered once, runs in the audio rendering thread
class PCMWorklet extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0][0];
    if (!channel) return true;

    // Float32 [-1, 1] → Int16 PCM
    const pcm16 = new Int16Array(channel.length);
    for (let i = 0; i < channel.length; i++) {
      const s = Math.max(-1, Math.min(1, channel[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    return true;
  }
}
registerProcessor("pcm-worklet", PCMWorklet);
