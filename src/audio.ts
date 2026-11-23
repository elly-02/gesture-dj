const NOTES = [261.63, 329.63, 392.0, 523.25];

export class TonePlayer {
  private ctx?: AudioContext;
  private gain?: GainNode;
  private osc?: OscillatorNode;
  playing = false;
  volume = 0.7;
  track = 0;

  async init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(this.ctx.destination);
    this.osc = this.ctx.createOscillator();
    this.osc.frequency.value = NOTES[this.track];
    this.osc.connect(this.gain);
    this.osc.start();
  }

  private applyGain() {
    if (!this.ctx || !this.gain) return;
    const target = this.playing ? 0.2 * this.volume : 0;
    this.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
  }

  toggle() {
    this.playing = !this.playing;
    this.applyGain();
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    this.applyGain();
  }

  setVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v));
    this.applyGain();
  }

  step(direction: 1 | -1) {
    if (!this.ctx || !this.osc) return;
    this.track = (this.track + direction + NOTES.length) % NOTES.length;
    this.osc.frequency.setTargetAtTime(NOTES[this.track], this.ctx.currentTime, 0.01);
  }
}