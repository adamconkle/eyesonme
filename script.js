const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('overlay');
const canvasCtx = canvasElement.getContext('2d');

// Setup FaceMesh
const faceMesh = new FaceMesh({
  locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});
faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

// Handle FaceMesh results
faceMesh.onResults(results => {
  canvasCtx.save();

  // Mirror canvas to match mirrored video
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.scale(-1, 1);
  canvasCtx.translate(-canvasElement.width, 0);

  let gazeX = '', gazeY = '';

  if (results.multiFaceLandmarks.length > 0) {
    const landmarks = results.multiFaceLandmarks[0];

    // Left Eye
    const leftIris = landmarks[468];
    const leftEyeLeft = landmarks[33];
    const leftEyeRight = landmarks[133];
    const leftEyeTop = landmarks[159];
    const leftEyeBottom = landmarks[145];

    const leftWidth = leftEyeRight.x - leftEyeLeft.x;
    const leftHeight = leftEyeBottom.y - leftEyeTop.y;
    const leftXRatio = (leftIris.x - leftEyeLeft.x) / leftWidth;
    const leftYRatio = (leftIris.y - leftEyeTop.y) / leftHeight;

    // Right Eye
    const rightIris = landmarks[473];
    const rightEyeLeft = landmarks[362];
    const rightEyeRight = landmarks[263];
    const rightEyeTop = landmarks[386];
    const rightEyeBottom = landmarks[374];

    const rightWidth = rightEyeRight.x - rightEyeLeft.x;
    const rightHeight = rightEyeBottom.y - rightEyeTop.y;
    const rightXRatio = (rightIris.x - rightEyeLeft.x) / rightWidth;
    const rightYRatio = (rightIris.y - rightEyeTop.y) / rightHeight;

    const avgX = (leftXRatio + rightXRatio) / 2;
    const avgY = (leftYRatio + rightYRatio) / 2;

    // Gaze direction logic
    if (avgX < 0.35) gazeX = 'Left';
    else if (avgX > 0.65) gazeX = 'Right';
    else gazeX = 'Center';

    if (avgY < 0.35) gazeY = 'Up';
    else if (avgY > 0.65) gazeY = 'Down';
    else gazeY = 'Center';

    // Draw eye/iris landmarks
    [33, 133, 362, 263, 468, 473, 159, 145, 386, 374].forEach(i => {
      const x = landmarks[i].x * canvasElement.width;
      const y = landmarks[i].y * canvasElement.height;
      canvasCtx.beginPath();
      canvasCtx.arc(x, y, 4, 0, 2 * Math.PI);
      canvasCtx.fillStyle = 'cyan';
      canvasCtx.fill();
    });

    canvasCtx.restore(); // Unflip for drawing text

    // Draw normal (non-mirrored) text
    canvasCtx.font = '24px Arial';
    canvasCtx.fillStyle = 'lime';
    canvasCtx.fillText(`Gaze: ${gazeX} / ${gazeY}`, 20, 30);
  } else {
    canvasCtx.restore();
  }
});

// Start webcam
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await faceMesh.send({ image: videoElement });
  },
  width: 640,
  height: 480
});
camera.start();

// Sync canvas to video size
videoElement.addEventListener('loadeddata', () => {
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;
});
