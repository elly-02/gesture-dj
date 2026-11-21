export class TonePlayer {
  private ctx?: AudioContext;
  private gain?: GainNode;
  playing = false;

  async init() {
    this.ctx = new AudioContext();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(this.ctx.destination);
    const osc = this.ctx.createOscillator();
    osc.frequency.value = 440;
    osc.connect(this.gain);
    osc.start();
  }

  toggle() {
    if (!this.ctx || !this.gain) return;
    this.playing = !this.playing;
    this.gain.gain.setTargetAtTime(this.playing ? 0.15 : 0, this.ctx.currentTime, 0.02);
  }
}