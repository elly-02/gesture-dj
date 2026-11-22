import './style.css';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { isOpenPalm, createHoldDetector } from './gestures';
import { TonePlayer } from './audio';

const video = document.querySelector<HTMLVideoElement>('#cam')!;
const canvas = document.querySelector<HTMLCanvasElement>('#overlay')!;
const stage = document.querySelector<HTMLDivElement>('.stage')!;
const ctx = canvas.getContext('2d')!;
const draw = new DrawingUtils(ctx);
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const startBtn = document.querySelector<HTMLButtonElement>('#start')!;

const base = import.meta.env.BASE_URL;
const player = new TonePlayer();
const palmHold = createHoldDetector();

let landmarker: HandLandmarker;
let lastVideoTime = -1;
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
  const isTouchDevice = matchMedia('(pointer: coarse)').matches;
  return !isTouchDevice;
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

async function setup() {
  startBtn.disabled = true;
  status.textContent = 'Loading model…';
  await player.init();

  const vision = await FilesetResolver.forVisionTasks(`${base}mediapipe-wasm`);

  try {
    if (!shouldUseGpu()) throw new Error('Using CPU');
    landmarker = await HandLandmarker.createFromOptions(vision, makeOptions('GPU'));
    delegate = 'GPU';
  } catch {
    landmarker = await HandLandmarker.createFromOptions(vision, makeOptions('CPU'));
    delegate = 'CPU';
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
  });
  video.srcObject = stream;
  await video.play();
  syncSize();

  status.textContent = 'Hold an open palm for half a second to play/pause';
  requestAnimationFrame(loop);
}

function loop() {
  const now = performance.now();

  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    syncSize();

    const result = landmarker.detectForVideo(video, now);
    const hand = result.landmarks[0];

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (hand) {
      draw.drawConnectors(hand, HandLandmarker.HAND_CONNECTIONS, { color: '#5DCAA5', lineWidth: 2 });
      draw.drawLandmarks(hand, { color: '#F0997B', radius: 3 });
    }

    const palm = hand ? isOpenPalm(hand) : false;
    if (palmHold(palm, now)) player.toggle();

    updateFps(now);
    const state = !hand ? 'No hand' : palm ? 'Open palm' : 'Hand';
    status.textContent =
      `${state} · ${player.playing ? 'Playing' : 'Paused'} · ` +
      `${delegate} · ${video.videoWidth}×${video.videoHeight} · ${fps} fps`;
  }

  requestAnimationFrame(loop);
}

startBtn.addEventListener('click', () => {
  setup().catch((err: Error) => {
    status.textContent = `Error: ${err.message}`;
    startBtn.disabled = false;
  });
});