import './style.css';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import {
  isOpenPalm,
  createHoldDetector,
  createSwipeDetector,
  createVolumeSlider,
  smoothStep,
  type Zone,
} from './gestures';
import { TonePlayer } from './audio';

const video = document.querySelector<HTMLVideoElement>('#cam')!;
const canvas = document.querySelector<HTMLCanvasElement>('#overlay')!;
const stage = document.querySelector<HTMLDivElement>('.stage')!;
const sliderEl = document.querySelector<HTMLDivElement>('#slider')!;
const knobEl = document.querySelector<HTMLDivElement>('#knob')!;
const ctx = canvas.getContext('2d')!;
const draw = new DrawingUtils(ctx);
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const startBtn = document.querySelector<HTMLButtonElement>('#start')!;
const stopBtn = document.querySelector<HTMLButtonElement>('#stop')!;

const base = import.meta.env.BASE_URL;
const player = new TonePlayer();
const palmHold = createHoldDetector();
const detectSwipe = createSwipeDetector();

// Must match .slider in style.css: left 82% + width 15%, top 15% + height 70%
const VOLUME_ZONE: Zone = { xMin: 0.82, xMax: 0.97, yMin: 0.15, yMax: 0.85 };
const updateSlider = createVolumeSlider(VOLUME_ZONE);
const PALM_BLOCK_AFTER_SWIPE_MS = 800;
const HINT = 'Palm = play/pause · Swipe = change track · Hold fingertip on the slider = volume';

let landmarker: HandLandmarker | null = null;
let stream: MediaStream | null = null;
let rafId = 0;
let lastVideoTime = -1;
let lastSwipeAt = -Infinity;
let lastGesture = '—';
let delegate: 'GPU' | 'CPU' = 'CPU';
let frames = 0;
let fps = 0;
let fpsStart = performance.now();

function makeOptions(mode: 'GPU' | 'CPU') {
  return {
    baseOptions: { modelAssetPath: `${base}models/hand_landmarker.task`, delegate: mode },
    runningMode: 'VIDEO' as const,
    numHands: 1,
    minHandDetectionConfidence: 0.4,
    minHandPresenceConfidence: 0.4,
  };
}

function shouldUseGpu(): boolean {
  const params = new URLSearchParams(location.search);
  if (params.has('gpu')) return true;
  if (params.has('cpu')) return false;
  return !matchMedia('(pointer: coarse)').matches;
}

function syncSize() {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    stage.style.aspectRatio = `${w} / ${h}`;
  }
}

function updateFps(now: number) {
  frames++;
  if (now - fpsStart >= 1000) {
    fps = frames;
    frames = 0;
    fpsStart = now;
  }
}

function renderSlider(state: string) {
  sliderEl.className = `slider ${state}`;
  knobEl.style.top = `${(1 - player.volume) * 100}%`;
}

async function loadModel() {
  if (landmarker) return;
  const vision = await FilesetResolver.forVisionTasks(`${base}mediapipe-wasm`);
  try {
    if (!shouldUseGpu()) throw new Error('Using CPU');
    landmarker = await HandLandmarker.createFromOptions(vision, makeOptions('GPU'));
    delegate = 'GPU';
  } catch {
    landmarker = await HandLandmarker.createFromOptions(vision, makeOptions('CPU'));
    delegate = 'CPU';
  }
}

async function startCamera() {
  startBtn.disabled = true;
  status.textContent = 'Loading…';

  await player.init();
  await loadModel();

  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
  });
  video.srcObject = stream;
  await video.play();

  lastVideoTime = -1;
  syncSize();
  renderSlider('idle');
  stopBtn.disabled = false;
  status.textContent = HINT;
  rafId = requestAnimationFrame(loop);
}

function stopCamera() {
  cancelAnimationFrame(rafId);
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  video.srcObject = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const now = performance.now();
  updateSlider(null, now);
  detectSwipe(null, now);
  palmHold(false, now);
  renderSlider('idle');
  player.pause();

  stopBtn.disabled = true;
  startBtn.disabled = false;
  status.textContent = 'Camera off. Click start to turn it back on.';
}

function loop() {
  if (!stream || !landmarker) return;
  const now = performance.now();

  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    syncSize();

    const result = landmarker.detectForVideo(video, now);
    const hand = result.landmarks[0] ?? null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (hand) {
      draw.drawConnectors(hand, HandLandmarker.HAND_CONNECTIONS, { color: '#5DCAA5', lineWidth: 2 });
      draw.drawLandmarks(hand, { color: '#F0997B', radius: 3 });
    }

    const slider = updateSlider(hand ? hand[8] : null, now);
    if (slider.volume !== null) {
      player.setVolume(smoothStep(player.volume, slider.volume, 0.5));
      lastGesture = 'Volume';
    }
    renderSlider(slider.state);
    const sliderBusy = slider.state !== 'idle';

    const swipe = detectSwipe(hand && !sliderBusy ? hand[0].x : null, now);
    if (swipe) {
      player.step(swipe === 'right' ? 1 : -1);
      lastSwipeAt = now;
      lastGesture = `Swipe ${swipe}`;
    }

    const palmAllowed = !sliderBusy && now - lastSwipeAt > PALM_BLOCK_AFTER_SWIPE_MS;
    const palm = hand && palmAllowed ? isOpenPalm(hand) : false;
    if (palmHold(palm, now)) {
      player.toggle();
      lastGesture = 'Palm';
    }

    updateFps(now);
    status.textContent =
      `${hand ? lastGesture : 'No hand'} · ${player.playing ? 'Playing' : 'Paused'} · ` +
      `Track ${player.track + 1} · Vol ${Math.round(player.volume * 100)}% · ${delegate} · ${fps} fps`;
  }

  rafId = requestAnimationFrame(loop);
}

startBtn.addEventListener('click', () => {
  startCamera().catch((err: Error) => {
    status.textContent = `Error: ${err.message}`;
    stopBtn.disabled = true;
    startBtn.disabled = false;
  });
});

stopBtn.addEventListener('click', stopCamera);