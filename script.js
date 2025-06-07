const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('overlay');
const canvasCtx = canvasElement.getContext('2d');

// Setup MediaPipe FaceMesh
const faceMesh = new FaceMesh({
  locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});
faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

faceMesh.onResults(results => {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  let gazeX = '';
  let gazeY = '';

  if (results.multiFaceLandmarks.length > 0) {
    const landmarks = results.multiFaceLandmarks[0];

    // --- Left Eye (horizontal) ---
    const leftEyeLeft = landmarks[33];
    const leftEyeRight = landmarks[133];
    const leftEyeTop = landmarks[159];
    const leftEyeBottom = landmarks[145];
    const leftIris = landmarks[468];

    const leftWidth = leftEyeRight.x - leftEyeLeft.x;
    const leftHeight = leftEyeBottom.y - leftEyeTop.y;
    const leftIrisXOffset = (leftIris.x - leftEyeLeft.x) / leftWidth;
    const leftIrisYOffset = (leftIris.y - leftEyeTop.y) / leftHeight;

    // --- Right Eye (horizontal) ---
    const rightEyeLeft = landmarks[362];
    const rightEyeRight = landmarks[263];
    const rightEyeTop = landmarks[386];
    const rightEyeBottom = landmarks[374];
    const rightIris = landmarks[473];

    const rightWidth = rightEyeRight.x - rightEyeLeft.x;
    const rightHeight = rightEyeBottom.y - rightEyeTop.y;
    const rightIrisXOffset = (rightIris.x - rightEyeLeft.x) / rightWidth;
    const rightIrisYOffset = (rightIris.y - rightEyeTop.y) / rightHeight;

    // --- Averaged iris offsets ---
    const avgX = (leftIrisXOffset + rightIrisXOffset) / 2;
    const avgY = (leftIrisYOffset + rightIrisYOffset) / 2;

    // --- Horizontal direction ---
    if (avgX < 0.35) gazeX = 'Left';
    else if (avgX > 0.65) gazeX = 'Right';
    else gazeX = 'Center';

    // --- Vertical direction ---
    if (avgY < 0.35) gazeY = 'Up';
    else if (avgY > 0.65) gazeY = 'Down';
    else gazeY = 'Center';

    // --- Draw landmark dots ---
    [33, 133, 362, 263, 468, 473, 159, 145, 386, 374].forEach(i => {
      const x = landmarks[i].x * canvasElement.width;
      const y = landmarks[i].y * canvasElement.height;
      canvasCtx.beginPath();
      canvasCtx.arc(x, y, 4, 0, 2 * Math.PI);
      canvasCtx.fillStyle = 'cyan';
      canvasCtx.fill();
    });

    // --- Display text ---
    canvasCtx.font = '24px Arial';
    canvasCtx.fillStyle = 'lime';
    canvasCtx.fillText(`Gaze: ${gazeX} / ${gazeY}`, 20, 30);
  }

  canvasCtx.restore();
});



// Setup webcam stream
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await faceMesh.send({ image: videoElement });
  },
  width: 640,
  height: 480
});
camera.start();

// Resize canvas to match video
videoElement.addEventListener('loadeddata', () => {
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;
});
