const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('overlay');
const canvasCtx = canvasElement.getContext('2d');

// Calibration state
let calibrationMode = true;
let calibrationStep = 0;
let upperSamples = [], centerYSamples = [], lowerSamples = [];
let leftSamples = [], centerXSamples = [], rightSamples = [];

let upperY = 0.42, lowerY = 0.58;
let leftX = 0.35, rightX = 0.65;

const recentX = [], recentY = [];
const SMOOTHING_FRAMES = 5;
const Y_GAIN = 1.8;
const X_GAIN = 1.0;

let previousY = null;
let velocityY = 0;

// UI
const startBtn = document.getElementById('start-calibration');
const instruction = document.getElementById('instruction');

// FaceMesh setup
const faceMesh = new FaceMesh({
  locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});
faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

// Main tracking
faceMesh.onResults(results => {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results.multiFaceLandmarks.length > 0) {
    const landmarks = results.multiFaceLandmarks[0];

    const leftIris = landmarks[468], rightIris = landmarks[473];
    const leftCorner = landmarks[33], rightCorner = landmarks[263];
    const leftTop = landmarks[159], leftBottom = landmarks[145];
    const rightTop = landmarks[386], rightBottom = landmarks[374];

    const irisX = (leftIris.x + rightIris.x) / 2;
    const irisY_L = (leftIris.y - leftTop.y) / (leftBottom.y - leftTop.y);
    const irisY_R = (rightIris.y - rightTop.y) / (rightBottom.y - rightTop.y);
    const rawX = (irisX - leftCorner.x) / (rightCorner.x - leftCorner.x);
    const rawY = (irisY_L + irisY_R) / 2;

    recentX.push(rawX);
    recentY.push(rawY);
    if (recentX.length > SMOOTHING_FRAMES) recentX.shift();
    if (recentY.length > SMOOTHING_FRAMES) recentY.shift();
    const avgX = recentX.reduce((a, b) => a + b, 0) / recentX.length;
    const avgY = recentY.reduce((a, b) => a + b, 0) / recentY.length;

    if (previousY !== null) velocityY = avgY - previousY;
    previousY = avgY;

    if (calibrationMode) {
      if (calibrationStep === 1) upperSamples.push(avgY);
      if (calibrationStep === 2) centerYSamples.push(avgY);
      if (calibrationStep === 3) lowerSamples.push(avgY);
      if (calibrationStep === 4) leftSamples.push(avgX);
      if (calibrationStep === 5) centerXSamples.push(avgX);
      if (calibrationStep === 6) rightSamples.push(avgX);
    }

    const adjustedY = (avgY - 0.5) * Y_GAIN + 0.5;
    const adjustedX = (avgX - 0.5) * X_GAIN + 0.5;

    let gazeX = "...", gazeY = "...";

    if (!calibrationMode) {
      if (adjustedY < upperY) gazeY = 'Up';
      else if (adjustedY > lowerY) gazeY = 'Down';
      else gazeY = 'Center';

      if (adjustedX < leftX) gazeX = 'Right';
      else if (adjustedX > rightX) gazeX = 'Left';
      else gazeX = 'Center';

      canvasCtx.font = '24px Arial';
      canvasCtx.fillStyle = 'red';
      canvasCtx.fillText(`Gaze: ${gazeX} / ${gazeY}`, 20, 30);

      // Gaze circle
      const circleX = adjustedX * canvasElement.width;
      const circleY = adjustedY * canvasElement.height;
      canvasCtx.beginPath();
      canvasCtx.arc(circleX, circleY, 8, 0, 2 * Math.PI);
      canvasCtx.fillStyle = 'lime';
      canvasCtx.fill();
    }

    // Draw eye landmarks
    [33, 133, 362, 263, 468, 473, 159, 145, 386, 374].forEach(i => {
      const x = landmarks[i].x * canvasElement.width;
      const y = landmarks[i].y * canvasElement.height;
      canvasCtx.beginPath();
      canvasCtx.arc(x, y, 2, 0, 2 * Math.PI);
      canvasCtx.fillStyle = 'cyan';
      canvasCtx.fill();
    });
  }

  canvasCtx.restore();
});

// Camera setup
const camera = new Camera(videoElement, {
  onFrame: async () => await faceMesh.send({ image: videoElement }),
  width: 640,
  height: 480
});
camera.start();

videoElement.addEventListener('loadeddata', () => {
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;
});

// CALIBRATION PROCESS
startBtn.addEventListener('click', async () => {
  calibrationMode = true;
  startBtn.disabled = true;

  instruction.innerText = "Look UP and hold...";
  speak("Look up and hold.");
  calibrationStep = 1; upperSamples = [];
  await delay(4000);

  instruction.innerText = "Look CENTER (vertical) and hold...";
  speak("Look center and hold.");
  calibrationStep = 2; centerYSamples = [];
  await delay(4000);

  instruction.innerText = "Look DOWN and hold...";
  speak("Look down and hold.");
  calibrationStep = 3; lowerSamples = [];
  await delay(4000);

  instruction.innerText = "Look LEFT and hold...";
  speak("Look left and hold.");
  calibrationStep = 4; leftSamples = [];
  await delay(4000);

  instruction.innerText = "Look CENTER (horizontal) and hold...";
  speak("Look center and hold.");
  calibrationStep = 5; centerXSamples = [];
  await delay(4000);

  instruction.innerText = "Look RIGHT and hold...";
  speak("Look right and hold.");
  calibrationStep = 6; rightSamples = [];
  await delay(4000);

  calibrationStep = 0;
  calibrationMode = false;
  instruction.innerText = "Calibration complete!";
  speak("Calibration complete. Ready to track your eyes.");

  // Apply calibrated thresholds
  const upAvg = average(upperSamples);
  const centerYAvg = average(centerYSamples);
  const downAvg = average(lowerSamples);

  const leftAvg = average(leftSamples);
  const centerXAvg = average(centerXSamples);
  const rightAvg = average(rightSamples);

  upperY = (upAvg + centerYAvg) / 2;
  lowerY = (downAvg + centerYAvg) / 2;
  leftX = (leftAvg + centerXAvg) / 2;
  rightX = (rightAvg + centerXAvg) / 2;

  console.log("Vertical:", { upperY, centerYAvg, lowerY });
  console.log("Horizontal:", { leftX, centerXAvg, rightX });
});

// Helpers
function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
function speak(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = .7;
  speechSynthesis.speak(utterance);
}
