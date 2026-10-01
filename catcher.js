const CONFIG = {
  startingLives: 3,
  gracePeriod: 3.0,
  baseCatcherRadius: 34,
  catchRadiusBonus: 18,
  comboStep: 5,
  maxComboMultiplier: 5,
  scorePerLevel: 150,
  baseBallSpeed: 140,
  speedIncreasePerSec: 2.2,
  speedIncreasePerLevel: 25,
  baseSpawnInterval: 1.3,
  minSpawnInterval: 0.35,
  spawnIntervalDecayPerLevel: 0.11,
  ballRadiusMin: 18,
  ballRadiusMax: 34,
  ballRadiusShrinkPerLevel: 1.5,
  ballRadiusMinFloor: 14,
  goldenChance: 0.12,
  redChance: 0.14,
  powerupChance: 0.08,
  goldenPoints: 25,
  normalPoints: 10,
  slowmoDuration: 5.0,
  slowmoFactor: 0.45,
  handSmoothing: 0.35,
};

const PALM_NAMES = [
  "wrist",
  "index_finger_mcp",
  "middle_finger_mcp",
  "ring_finger_mcp",
  "pinky_mcp",
];
const PALM_INDICES = [0, 5, 9, 13, 17];

const BALL_COLORS = [
  [255, 90, 90],
  [90, 200, 255],
  [120, 255, 120],
  [255, 190, 80],
  [220, 120, 255],
  [255, 230, 90],
];

const TYPE = {
  NORMAL: "normal",
  GOLDEN: "golden",
  RED: "red",
  POWERUP_SLOW: "powerup_slow",
  POWERUP_SHIELD: "powerup_shield",
};

const TYPE_COLORS = {
  [TYPE.GOLDEN]: [255, 200, 0],
  [TYPE.RED]: [255, 60, 60],
  [TYPE.POWERUP_SLOW]: [0, 230, 230],
  [TYPE.POWERUP_SHIELD]: [60, 220, 120],
};

const TYPE_SYMBOLS = {
  [TYPE.GOLDEN]: "$",
  [TYPE.RED]: "!",
  [TYPE.POWERUP_SLOW]: "S",
  [TYPE.POWERUP_SHIELD]: "+",
};

const STATUS = {
  START: "start",
  PLAYING: "playing",
  PAUSED: "paused",
  GAME_OVER: "game_over",
};

let handPose;
let video;
let hands = [];
let lastMillis = 0;
let scaleFactor = 1;
let fatalError = "";
let audioCtx = null;
let smoothedPoints = {};

const game = {
  status: STATUS.START,
  score: 0,
  lives: CONFIG.startingLives,
  level: 1,
  combo: 0,
  comboMultiplier: 1,
  balls: [],
  elapsedTime: 0,
  timeSinceSpawn: 0,
  shieldCharges: 0,
  slowmoTimer: 0,
  twoHandMode: false,
};

function preload() {
  handPose = ml5.handPose({
    maxHands: 2,
    flipped: true,
    runtime: "tfjs",
    modelType: "full",
  });
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  scaleFactor = Math.min(width / 960, height / 720);
  lastMillis = millis();

  video = createCapture(VIDEO, () => {
    video.size(width, height);
  });
  video.size(width, height);
  video.hide();

  try {
    handPose.detectStart(video, gotHands);
  } catch (err) {
    fatalError = "Failed to start hand tracking: " + err.message;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  scaleFactor = Math.min(width / 960, height / 720);
  if (video) {
    video.size(width, height);
  }
}

function gotHands(results, error) {
  if (error) {
    console.error(error);
    return;
  }
  hands = results || [];
}

function draw() {
  let dt = (millis() - lastMillis) / 1000;
  lastMillis = millis();
  dt = Math.min(dt, 0.05);

  if (fatalError) {
    background(5, 7, 13);
    drawFatalError(fatalError);
    return;
  }

  if (video && video.loadedmetadata) {
    image(video, 0, 0, width, height);
  } else {
    background(5, 7, 13);
  }

  const catchers = computeCatcherPoints();

  if (game.status === STATUS.PLAYING) {
    updateGame(dt, catchers);
  }

  for (const ball of game.balls) {
    drawBall(ball);
  }
  for (const catcher of catchers) {
    drawCatcher(catcher.x, catcher.y, catcher.radius);
  }

  if (!catchers.length && game.status === STATUS.PLAYING) {
    drawShadowText(
      "No hand detected — show your hand to the camera",
      width / 2,
      height - 28,
      16,
      [255, 60, 60],
      true,
    );
  }

  if (game.status === STATUS.START) {
    drawStartScreen();
  } else if (game.status === STATUS.PAUSED) {
    drawHud();
    drawPauseScreen();
  } else if (game.status === STATUS.GAME_OVER) {
    drawHud();
    drawGameOverScreen();
  } else {
    drawHud();
  }
}

function keyPressed() {
  if (key === "q" || key === "Q" || keyCode === ESCAPE) {
    return;
  }
  ensureAudio();
  if (key === " " && game.status === STATUS.START) {
    startGame();
  } else if (key === "p" || key === "P") {
    togglePause();
  } else if (
    (key === "r" || key === "R") &&
    (game.status === STATUS.PAUSED || game.status === STATUS.GAME_OVER)
  ) {
    resetGame(true);
  } else if (key === "h" || key === "H") {
    game.twoHandMode = !game.twoHandMode;
  }
}

function mousePressed() {
  ensureAudio();
  if (game.status === STATUS.START) {
    startGame();
  } else if (game.status === STATUS.GAME_OVER) {
    resetGame(true);
  } else if (game.status === STATUS.PAUSED) {
    togglePause();
  }
}

function resetGame(keepTwoHand) {
  const twoHandMode = keepTwoHand ? game.twoHandMode : false;
  game.status = STATUS.START;
  game.score = 0;
  game.lives = CONFIG.startingLives;
  game.level = 1;
  game.combo = 0;
  game.comboMultiplier = 1;
  game.balls = [];
  game.elapsedTime = 0;
  game.timeSinceSpawn = 0;
  game.shieldCharges = 0;
  game.slowmoTimer = 0;
  game.twoHandMode = twoHandMode;
}

function startGame() {
  resetGame(true);
  game.status = STATUS.PLAYING;
}

function togglePause() {
  if (game.status === STATUS.PLAYING) {
    game.status = STATUS.PAUSED;
  } else if (game.status === STATUS.PAUSED) {
    game.status = STATUS.PLAYING;
  }
}

function inGracePeriod() {
  return game.elapsedTime < CONFIG.gracePeriod;
}

function speedMultiplier() {
  const timeBonus =
    game.elapsedTime * (CONFIG.speedIncreasePerSec / CONFIG.baseBallSpeed);
  const levelBonus =
    (game.level - 1) * (CONFIG.speedIncreasePerLevel / CONFIG.baseBallSpeed);
  let mult = 1.0 + timeBonus + levelBonus;
  if (game.slowmoTimer > 0) {
    mult *= CONFIG.slowmoFactor;
  }
  return mult;
}

function spawnInterval() {
  const interval =
    CONFIG.baseSpawnInterval -
    (game.level - 1) * CONFIG.spawnIntervalDecayPerLevel;
  return Math.max(CONFIG.minSpawnInterval, interval);
}

function updateGame(dt, catchers) {
  game.elapsedTime += dt;
  if (game.slowmoTimer > 0) {
    game.slowmoTimer = Math.max(0, game.slowmoTimer - dt);
  }

  if (!inGracePeriod()) {
    game.timeSinceSpawn += dt;
    if (game.timeSinceSpawn >= spawnInterval()) {
      game.timeSinceSpawn = 0;
      spawnBall();
      if (game.level >= 4 && Math.random() < 0.35) {
        spawnBall();
      }
    }
  }

  const speedMult = speedMultiplier();
  const surviving = [];
  for (const ball of game.balls) {
    ball.y += ball.speed * speedMult * dt * scaleFactor;
    ball.pulse += dt * 4;
    if (checkCatch(ball, catchers)) {
      continue;
    }
    if (ball.y - ball.radius > height) {
      handleMiss(ball);
      continue;
    }
    surviving.push(ball);
  }
  game.balls = surviving;

  if (game.score >= game.level * CONFIG.scorePerLevel) {
    game.level += 1;
    playChime([523, 659, 784, 1047], 0.09);
  }

  if (game.lives <= 0) {
    game.lives = 0;
    game.status = STATUS.GAME_OVER;
    playTone(140, 0.6, "square", 0.2);
  }
}

function spawnBall() {
  const shrink = Math.min(
    CONFIG.ballRadiusMax - CONFIG.ballRadiusMinFloor,
    (game.level - 1) * CONFIG.ballRadiusShrinkPerLevel,
  );
  const maxR = Math.max(CONFIG.ballRadiusMin, CONFIG.ballRadiusMax - shrink);
  const radius =
    (CONFIG.ballRadiusMin +
      Math.random() * (maxR - CONFIG.ballRadiusMin)) *
    scaleFactor;
  const x = radius + Math.random() * Math.max(1, width - 2 * radius);
  const speed = CONFIG.baseBallSpeed * (0.85 + Math.random() * 0.35);

  const roll = Math.random();
  const redCut = CONFIG.redChance;
  const goldCut = redCut + CONFIG.goldenChance;
  const powerCut = goldCut + CONFIG.powerupChance;

  let type = TYPE.NORMAL;
  if (roll < redCut) {
    type = TYPE.RED;
  } else if (roll < goldCut) {
    type = TYPE.GOLDEN;
  } else if (roll < powerCut) {
    type = Math.random() < 0.5 ? TYPE.POWERUP_SLOW : TYPE.POWERUP_SHIELD;
  }

  game.balls.push({
    x,
    y: -radius,
    radius,
    speed,
    type,
    color: TYPE_COLORS[type] || BALL_COLORS[Math.floor(Math.random() * BALL_COLORS.length)],
    pulse: Math.random() * Math.PI * 2,
  });
}

function checkCatch(ball, catchers) {
  for (const catcher of catchers) {
    const dx = ball.x - catcher.x;
    const dy = ball.y - catcher.y;
    const limit = ball.radius + catcher.radius;
    if (dx * dx + dy * dy <= limit * limit) {
      handleCatch(ball);
      return true;
    }
  }
  return false;
}

function handleCatch(ball) {
  if (ball.type === TYPE.RED) {
    game.lives -= 1;
    game.combo = 0;
    game.comboMultiplier = 1;
    playTone(160, 0.25, "square", 0.2);
    return;
  }

  let points = CONFIG.normalPoints;
  if (ball.type === TYPE.GOLDEN) {
    points = CONFIG.goldenPoints;
    playChime([880, 1174, 1568], 0.09);
  } else if (ball.type === TYPE.POWERUP_SLOW) {
    game.slowmoTimer = CONFIG.slowmoDuration;
    playChime([660, 990], 0.12);
  } else if (ball.type === TYPE.POWERUP_SHIELD) {
    game.shieldCharges += 1;
    playChime([660, 990], 0.12);
  } else {
    playTone(880, 0.12, "sine", 0.15);
  }

  game.combo += 1;
  game.comboMultiplier = Math.min(
    CONFIG.maxComboMultiplier,
    1 + Math.floor(game.combo / CONFIG.comboStep),
  );
  game.score += points * game.comboMultiplier;
}

function handleMiss(ball) {
  if (ball.type === TYPE.RED) {
    return;
  }
  if (ball.type === TYPE.POWERUP_SLOW || ball.type === TYPE.POWERUP_SHIELD) {
    return;
  }
  game.combo = 0;
  game.comboMultiplier = 1;
  if (game.shieldCharges > 0) {
    game.shieldCharges -= 1;
  } else {
    game.lives -= 1;
  }
  playTone(220, 0.2, "square", 0.15);
}

function palmPoint(hand) {
  const pts = [];
  for (const name of PALM_NAMES) {
    const found = hand.keypoints.find((point) => point.name === name);
    if (found) {
      pts.push(found);
    }
  }
  if (!pts.length && hand.keypoints) {
    for (const index of PALM_INDICES) {
      if (hand.keypoints[index]) {
        pts.push(hand.keypoints[index]);
      }
    }
  }
  if (!pts.length) {
    return null;
  }
  const x = pts.reduce((sum, point) => sum + point.x, 0) / pts.length;
  const y = pts.reduce((sum, point) => sum + point.y, 0) / pts.length;
  return { x: width - x, y };
}

function smoothPoint(slot, x, y) {
  const prev = smoothedPoints[slot];
  if (!prev) {
    smoothedPoints[slot] = { x, y };
    return { x, y };
  }
  const alpha = CONFIG.handSmoothing;
  const sx = prev.x + (x - prev.x) * alpha;
  const sy = prev.y + (y - prev.y) * alpha;
  smoothedPoints[slot] = { x: sx, y: sy };
  return smoothedPoints[slot];
}

function computeCatcherPoints() {
  const selected = game.twoHandMode ? hands.slice(0, 2) : hands.slice(0, 1);
  const points = [];
  selected.forEach((hand, index) => {
    const palm = palmPoint(hand);
    if (!palm) {
      return;
    }
    const smoothed = smoothPoint(index, palm.x, palm.y);
    points.push({
      x: smoothed.x,
      y: smoothed.y,
      radius: (CONFIG.baseCatcherRadius + CONFIG.catchRadiusBonus) * scaleFactor,
    });
  });
  Object.keys(smoothedPoints).forEach((slot) => {
    if (Number(slot) >= points.length) {
      delete smoothedPoints[slot];
    }
  });
  return points;
}

function drawBall(ball) {
  if (ball.type !== TYPE.NORMAL) {
    const glow = 4 + 2 * Math.sin(ball.pulse);
    noFill();
    stroke(ball.color[0], ball.color[1], ball.color[2]);
    strokeWeight(3);
    circle(ball.x, ball.y, (ball.radius + glow) * 2);
  }
  fill(ball.color[0], ball.color[1], ball.color[2]);
  stroke(255);
  strokeWeight(2);
  circle(ball.x, ball.y, ball.radius * 2);
  const symbol = TYPE_SYMBOLS[ball.type];
  if (symbol) {
    noStroke();
    fill(0);
    textAlign(CENTER, CENTER);
    textSize(Math.max(12, ball.radius * 0.9));
    textStyle(BOLD);
    text(symbol, ball.x, ball.y);
  }
}

function drawCatcher(x, y, radius) {
  noFill();
  stroke(0, 230, 230);
  strokeWeight(3);
  circle(x, y, radius * 2);
  fill(255);
  noStroke();
  circle(x, y, 8);
}

function dimOverlay(alpha) {
  noStroke();
  fill(0, 0, 0, alpha);
  rect(0, 0, width, height);
}

function drawShadowText(label, x, y, size, color, centered) {
  textSize(size);
  textStyle(BOLD);
  textAlign(centered ? CENTER : LEFT, centered ? CENTER : TOP);
  fill(0);
  text(label, x + 2, y + 2);
  fill(color[0], color[1], color[2]);
  text(label, x, y);
}

function drawHud() {
  drawShadowText(`Score: ${game.score}`, 16, 12, 26, [255, 255, 255], false);
  drawShadowText("Lives:", 16, 44, 26, [255, 255, 255], false);
  for (let i = 0; i < Math.max(game.lives, 0); i += 1) {
    fill(255, 60, 60);
    noStroke();
    circle(108 + i * 24, 58, 18);
  }
  drawShadowText(`Level: ${game.level}`, 16, 76, 26, [0, 230, 230], false);
  drawShadowText(
    `Ball Speed: ${speedMultiplier().toFixed(2)}x`,
    16,
    110,
    18,
    [255, 140, 40],
    false,
  );

  let nextY = 134;
  if (game.comboMultiplier > 1) {
    drawShadowText(`Combo x${game.comboMultiplier}!`, 16, nextY, 18, [255, 215, 0], false);
    nextY += 24;
  }
  if (game.shieldCharges > 0) {
    drawShadowText(`Shield x${game.shieldCharges}`, 16, nextY, 18, [60, 220, 120], false);
    nextY += 24;
  }
  if (game.slowmoTimer > 0) {
    drawShadowText(
      `Slow-Mo ${game.slowmoTimer.toFixed(1)}s`,
      16,
      nextY,
      18,
      [0, 230, 230],
      false,
    );
  }

  if (game.twoHandMode) {
    textSize(18);
    textStyle(BOLD);
    const label = "Two-Hand Mode";
    const labelWidth = textWidth(label);
    drawShadowText(label, width - 16 - labelWidth, 12, 18, [190, 90, 255], false);
  }

  if (inGracePeriod() && game.status === STATUS.PLAYING) {
    const remaining = CONFIG.gracePeriod - game.elapsedTime;
    drawShadowText(
      `Get Ready: ${remaining.toFixed(1)}`,
      width / 2,
      50,
      40,
      [255, 255, 255],
      true,
    );
  }
}

function drawStartScreen() {
  dimOverlay(150);
  drawShadowText("Hand Catcher", width / 2, height / 2 - 110, 64, [255, 215, 0], true);
  drawShadowText(
    "Move your hand under the falling balls to catch them",
    width / 2,
    height / 2 - 40,
    26,
    [255, 255, 255],
    true,
  );
  drawShadowText(
    "Avoid red balls   |   Grab gold for bonus points",
    width / 2,
    height / 2 - 5,
    26,
    [255, 255, 255],
    true,
  );
  drawShadowText("Press SPACE or click to Start", width / 2, height / 2 + 60, 40, [60, 220, 120], true);
  drawShadowText(
    "H: toggle two-hand mode   P: pause   Allow camera access to play",
    width / 2,
    height / 2 + 105,
    18,
    [255, 255, 255],
    true,
  );
}

function drawPauseScreen() {
  dimOverlay(170);
  drawShadowText("Paused", width / 2, height / 2 - 40, 64, [255, 255, 255], true);
  drawShadowText(
    "P or click: resume   R: restart",
    width / 2,
    height / 2 + 30,
    26,
    [255, 255, 255],
    true,
  );
}

function drawGameOverScreen() {
  dimOverlay(190);
  drawShadowText("Game Over", width / 2, height / 2 - 95, 64, [255, 60, 60], true);
  drawShadowText(`Final Score: ${game.score}`, width / 2, height / 2 - 25, 40, [255, 255, 255], true);
  drawShadowText(`Level Reached: ${game.level}`, width / 2, height / 2 + 20, 26, [0, 230, 230], true);
  drawShadowText("Press R or click to Restart", width / 2, height / 2 + 80, 40, [60, 220, 120], true);
}

function drawFatalError(message) {
  drawShadowText("Hand Catcher could not start:", width / 2, height / 2 - 40, 26, [255, 60, 60], true);
  drawShadowText(message, width / 2, height / 2 + 10, 18, [255, 255, 255], true);
}

function ensureAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      audioCtx = new Ctx();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function playTone(freq, duration, type, volume) {
  if (!audioCtx) {
    return;
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type || "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume || 0.15, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playChime(freqs, stepDuration) {
  freqs.forEach((freq, index) => {
    setTimeout(() => playTone(freq, stepDuration + 0.04, "sine", 0.12), index * stepDuration * 1000);
  });
}
