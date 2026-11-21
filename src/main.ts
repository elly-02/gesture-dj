import './style.css';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { isOpenPalm, createHoldDetector } from './gestures';
import { TonePlayer } from './audio';

const video = document.querySelector<HTMLVideoElement>('#cam')!;
const canvas = document.querySelector<HTMLCanvasElement>('#overlay')!;
const ctx = canvas.getContext('2d')!;
const draw = new DrawingUtils(ctx);
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const startBtn = document.querySelector<HTMLButtonElement>('#start')!;

const base = import.meta.env.BASE_URL;
const player = new TonePlayer();
const palmHold = createHoldDetector();
let landmarker: HandLandmarker;
let lastVideoTime = -1;

async function setup() {
  startBtn.disabled = true;
  status.textContent = 'Loading model…';
  await player.init();

  const vision = await FilesetResolver.forVisionTasks(`${base}mediapipe-wasm`);
  landmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: `${base}models/hand_landmarker.task`, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numHands: 1,
  });

  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
  video.srcObject = stream;
  await video.play();
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  status.textContent = 'Hold an open palm for half a second to play/pause';
  requestAnimationFrame(loop);
}

function loop() {
  const now = performance.now();
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const result = landmarker.detectForVideo(video, now);
    const hand = result.landmarks[0];

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (hand) {
      draw.drawConnectors(hand, HandLandmarker.HAND_CONNECTIONS, { color: '#5DCAA5', lineWidth: 2 });
      draw.drawLandmarks(hand, { color: '#F0997B', radius: 3 });
    }

    const palm = hand ? isOpenPalm(hand) : false;
    if (palmHold(palm, now)) player.toggle();

    status.textContent = !hand
      ? 'No hand detected'
      : `${palm ? 'Open palm' : 'Hand detected'} · ${player.playing ? 'Playing' : 'Paused'}`;
  }
  requestAnimationFrame(loop);
}

startBtn.addEventListener('click', () => {
  setup().catch((err: Error) => {
    status.textContent = `Error: ${err.message}`;
    startBtn.disabled = false;
  });
});