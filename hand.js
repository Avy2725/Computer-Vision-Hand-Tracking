let handPose;
let video;
let hands = [];
let connections = [];
let gestureSocket = null;
let camVisible = true;

// const width = screen.availWidth / 1.5;
// const height = screen.availHeight / 1.5;

const width = screen.availWidth;
const height = screen.availHeight;

const confidenceDis = document.querySelector('.confidence');
const handedDis = document.querySelector('.handed');
const pointerTipDis = document.querySelector('.pointerTip');
const thumbTipDis = document.querySelector('.thumbTip');
const functionDis = document.querySelector('.function');
const streamDis = document.querySelector('.stream');
const camToggleBtn = document.querySelector('.cam-toggle');

const options = {
  maxHands: 2,
  flipped: true,
  runtime: 'tfjs',
  modelType: 'full',
  detectorModelUrl: undefined,
  landmarkModelUrl: undefined,
};

function preload() {
  // Load the handPose model
  handPose = ml5.handPose(options);
}

function setup() {
  console.clear();
  let canvas = createCanvas(width, height);
  canvas.position(windowWidth - width, windowHeight - height);
  canvas.style('position', 'fixed');
  canvas.style('top', '0');
  canvas.style('left', '0');
  canvas.style('z-index', '0');
  canvas.style('pointer-events', 'none');

  // Create the webcam video and hide it
  video = createCapture(VIDEO);
  video.size(width, height);

  video.hide();

  // start detecting hands from the webcam video
  handPose.detectStart(video, gotHands);
  connections = handPose.getConnections();

  const socketUrl = new URLSearchParams(window.location.search).get('ws');
  if (socketUrl) {
    try {
      gestureSocket = new WebSocket(socketUrl);
      gestureSocket.addEventListener('open', () => {
        if (streamDis) {
          streamDis.textContent = 'Stream: connected';
        }
      });
      gestureSocket.addEventListener('close', () => {
        if (streamDis) {
          streamDis.textContent = 'Stream: disconnected';
        }
      });
      gestureSocket.addEventListener('error', () => {
        if (streamDis) {
          streamDis.textContent = 'Stream: error';
        }
      });
    } catch (error) {
      console.warn('WebSocket setup failed:', error);
    }
  } else if (streamDis) {
    streamDis.textContent = 'Stream: disabled';
  }

  if (camToggleBtn) {
    camToggleBtn.addEventListener('click', toggleCameraPreview);
    camToggleBtn.textContent = 'Cam: On';
  }
}

function draw() {
  // Draw the webcam video
  clear(); // Clear the canvas for each frame

  if (camVisible) {
    image(video, 0, 0, width, height);
  } else {
    background(5, 7, 13);
  }

  // Draw all the tracked hand points
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];
    for (let j = 0; j < hand.keypoints.length; j++) {
      let keypoint = hand.keypoints[j];
      fill(0, 255, 0);
      noStroke();
      //circle(keypoint.x, keypoint.y, 10); //when flipped:false;
      circle(width - keypoint.x, keypoint.y, 10); // flipped x coordinate
    }
  }

  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];
    for (let j = 0; j < connections.length; j++) {
      let pointAIndex = connections[j][0];
      let pointBIndex = connections[j][1];
      let pointA = hand.keypoints[pointAIndex];
      let pointB = hand.keypoints[pointBIndex];
      stroke(255, 0, 0);
      strokeWeight(2);
      line(width - pointA.x, pointA.y, width - pointB.x, pointB.y);
      //line(pointA.x, pointA.y, pointB.x, pointB.y); //ORIGINAl
    }
  }
}

function toggleCameraPreview() {
  camVisible = !camVisible;

  if (camToggleBtn) {
    camToggleBtn.textContent = camVisible ? 'Cam: On' : 'Cam: Off';
  }
}

function gotHands(results, error) {
  // need to know how to get each output check dc
  if (error) {
    console.error(error);
    return;
  }

  hands = results;

  if (hands.length === 0) {
    // console.log("No hands detected");
    functionDis.textContent = 'No hands detected';
    if (gestureSocket && gestureSocket.readyState === WebSocket.OPEN) {
      gestureSocket.send(JSON.stringify({ type: 'hands', hands: [] }));
    }
    return;
  } else {
    let out = hands[0].confidence * 100;
    out = out.toFixed(2);
    // console.log("Confidence: " + out + "%");

    confidenceDis.textContent = 'Confidence: ' + out + '%';

    let indexFingerTip = hands[0].keypoints.find(
      (point) => point.name === 'index_finger_tip',
    );
    let thumbTip = hands[0].keypoints.find(
      (point) => point.name === 'thumb_tip',
    );

    handedDis.textContent = 'Handedness: ' + hands[0].handedness; // HANDEDNESS

    if (indexFingerTip && thumbTip) {
      let indexTipX = indexFingerTip.x.toFixed(2);
      let indexTipY = indexFingerTip.y.toFixed(2);
      let thumbTipX = thumbTip.x.toFixed(2);
      let thumbTipY = thumbTip.y.toFixed(2);

      thumbTipDis.textContent = `Thumb Tip - X: ${thumbTipX}, Y: ${thumbTipY}`;
      pointerTipDis.textContent = `Index Tip - X: ${indexTipX}, Y: ${indexTipY}`;

      const dx = thumbTip.x - indexFingerTip.x;
      const dy = thumbTip.y - indexFingerTip.y;
      const pinchDistance = Math.hypot(dx, dy);

      let gesture = 'Unclassified';
      if (pinchDistance < 28 && out > 98) {
        gesture = 'Pinch';
      } else if (pinchDistance >= 28 && pinchDistance < 70 && out > 98) {
        gesture = 'Near';
      } else if (pinchDistance >= 70 && out > 98) {
        gesture = 'Apart';
      }

      functionDis.textContent = `Gesture: ${gesture}`;

      if (gestureSocket && gestureSocket.readyState === WebSocket.OPEN) {
        gestureSocket.send(
          JSON.stringify({
            type: 'hand-data',
            confidence: Number(out),
            handedness: hands[0].handedness,
            gesture,
            keypoints: hands[0].keypoints.map((point) => ({
              name: point.name,
              x: Number(point.x.toFixed(2)),
              y: Number(point.y.toFixed(2)),
            })),
          }),
        );
      }
    } else {
      // console.log("Index Finger Tip or Thumb Tip not detected");
    }
  }
}

// setInterval(() => {
//   if (hands.length === 0) {
//     console.log("No hands detected");
//     return;
//   } else {
//     out = hands[0].confidence * 100;
//     out = out.toFixed(2);
//     console.log("Confidence: " + out + "%");

//     confidenceDis.textContent = "Confidence: " + out + "%";

//     let indexFingerTip = hands[0].keypoints.find(
//       (point) => point.name === "index_finger_tip"
//     );
//     let thumbTip = hands[0].keypoints.find(
//       (point) => point.name === "thumb_tip"
//     );

//     handedDis.textContent = "Handedness: " + hands[0].handedness; // HANDEDNESS

//     if (indexFingerTip && thumbTip) {
//       let out1 = indexFingerTip.x.toFixed(2);
//       // let out2 = indexFingerTip.y;
//       let out3 = thumbTip.x.toFixed(2);
//       // let out4 = thumbTip.y;

//       // console.log(`Index Finger Tip - X: ${out1}, Y: ${out2}`);
//       // console.log(`Thumb Tip - X: ${out3}, Y: ${out4}`);

//       // console.log(`Index Finger Tip - Y: ${out2}`);
//       // console.log(`Thumb Tip - Y: ${out4}`);

//       thumnTipDis.textContent = `Thumb Tip - X: ${out3}`;
//       pointerTipDis.textContent = `Index Finger Tip - X: ${out1}`;

//       if (Math.abs(out2 - out4) < 20) {
//         console.log("Together");
//       } else if (Math.abs(out2 - out4) > 20) {
//         console.log("Apart");
//       }
//     } else {
//       console.log("Index Finger Tip or Thumb Tip not detected");
//     }
//   }
// }, 500);

// setInterval(extractConfidence, 1000);
