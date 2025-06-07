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

  let gazeDirection = '';

  if (results.multiFaceLandmarks.length > 0) {
    const landmarks = results.multiFaceLandmarks[0];

    // --- Left Eye ---
    const leftEyeLeft = landmarks[33];
    const leftEyeRight = landmarks[133];
    const leftIris = landmarks[468];

    const leftEyeWidth = leftEyeRight.x - leftEyeLeft.x;
    const leftIrisOffset = (leftIris.x - leftEyeLeft.x) / leftEyeWidth;

    // --- Right Eye ---
    const rightEyeLeft = landmarks[362];
    const rightEyeRight = landmarks[263];
    const rightIris = landmarks[473];

    const rightEyeWidth = rightEyeRight.x - rightEyeLeft.x;
    const rightIrisOffset = (rightIris.x - rightEyeLeft.x) / rightEyeWidth;

    // Average both eyes
    const avgIrisOffset = (leftIrisOffset + rightIrisOffset) / 2;

    // --- Determine direction ---
    if (avgIrisOffset < 0.35) gazeDirection = 'Looking Left';
    else if (avgIrisOffset > 0.65) gazeDirection = 'Looking Right';
    else gazeDirection = 'Looking Center';

    // Draw key points
    [33, 133, 362, 263, 468, 473].forEach(i => {
      const x = landmarks[i].x * canvasElement.width;
      const y = landmarks[i].y * canvasElement.height;
      canvasCtx.beginPath();
      canvasCtx.arc(x, y, 4, 0, 2 * Math.PI);
      canvasCtx.fillStyle = 'cyan';
      canvasCtx.fill();
    });

    // Draw gaze direction text
    canvasCtx.font = '24px Arial';
    canvasCtx.fillStyle = 'lime';
    canvasCtx.fillText(gazeDirection, 20, 30);
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
