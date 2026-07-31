let handPose;
let video;
let hands = [];

// const width = screen.availWidth / 1.5;
// const height = screen.availHeight / 1.5;

const width = screen.availWidth;
const height = screen.availHeight;

const confidenceDis = document.querySelector(".confidence");
const handedDis = document.querySelector(".handed");
const pointerTipDis = document.querySelector(".pointerTip");
const thumnTipDis = document.querySelector(".thumnTip");
const functionDis = document.querySelector(".function");

const options = {
  maxHands: 2,
  flipped: true,
  runtime: "tfjs",
  modelType: "full",
  detectorModelUrl: undefined,
  landmarkModelUrl: undefined,
};

function preload() {
  // Load the handPose model
  handPose = ml5.handPose(options);
}

function setup() {
  console.clear();
  createCanvas(width, height);
  // Position the canvas in the center of the screen
  let canvas = createCanvas(width, height);
  // canvas.position((windowWidth - width) / 2, (windowHeight - height) / 2);

  canvas.position(windowWidth - width, windowHeight - height);

  // Create the webcam video and hide it
  video = createCapture(VIDEO);
  video.size(width, height);

  video.hide();

  // start detecting hands from the webcam video
  handPose.detectStart(video, gotHands);
  connections = handPose.getConnections();
}

function draw() {
  // Draw the webcam video
  //image(video, 0, 0, width, height);
  clear(); // Clear the canvas for each frame

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

function gotHands(results, error) {
  // need to know how to get each output check dc
  if (error) {
    console.error(error);
    return;
  }

  hands = results;

  if (hands.length === 0) {
    // console.log("No hands detected");
    functionDis.textContent = "No hands detected";
    return;
  } else {
    out = hands[0].confidence * 100;
    out = out.toFixed(2);
    // console.log("Confidence: " + out + "%");

    confidenceDis.textContent = "Confidence: " + out + "%";

    let indexFingerTip = hands[0].keypoints.find(
      (point) => point.name === "index_finger_tip"
    );
    let thumbTip = hands[0].keypoints.find(
      (point) => point.name === "thumb_tip"
    );

    handedDis.textContent = "Handedness: " + hands[0].handedness; // HANDEDNESS

    if (indexFingerTip && thumbTip) {
      // let out1 = indexFingerTip.x.toFixed(2);
      let out2 = indexFingerTip.y.toFixed(2);
      // let out3 = thumbTip.x.toFixed(2);
      let out4 = thumbTip.y.toFixed(2);

      // console.log(`Index Finger Tip - X: ${out1}, Y: ${out2}`);
      // console.log(`Thumb Tip - X: ${out3}, Y: ${out4}`);

      // console.log(`Index Finger Tip - Y: ${out2}`);
      // console.log(`Thumb Tip - Y: ${out4}`);

      thumnTipDis.textContent = `Thumb Tip - Y: ${out4}`;
      pointerTipDis.textContent = `Index Finger Tip - Y: ${out2}`;

      if (Math.abs(out4 - out2) < 25 && out > 98) {
        // console.log("Together");
        functionDis.textContent = "Function: Together";
      } else if (Math.abs(out4 - out2) > 25 && out > 98) {
        // console.log("Apart");
        functionDis.textContent = "Function: Apart";
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
