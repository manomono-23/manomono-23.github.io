// グローバル変数
let audioElement;
let audioAnalyzer;
let isAudioInitialized = false;
let canvasWidth, canvasHeight;
let scaleFactor = 1.0; // 描画スケール調整用

// 視覚効果用の変数
let particles = [];          // パーティクルシステム用配列
let waveHistory = [];        // 波形履歴
let energyHistory = {        // エネルギー履歴
  bass: [],
  mid: [], 
  treble: []
};

// 設定
let historySize = 60;        // 履歴の長さ
let particleCount = 200;     // パーティクルの数
let energySmoothing = 0.2;   // エネルギー値のスムージング係数

// 星空効果用の変数
let stars = [];
let starCount = 100;

// p5.jsセットアップ関数
function setup() {
  // キャンバスサイズの設定
  canvasWidth = 1200;
  canvasHeight = 1900;
  
  // キャンバス作成先を指定（HTMLの#canvas-containerに）
  const canvas = createCanvas(canvasWidth, canvasHeight);
  canvas.parent('canvas-container');
  
  // オーディオ要素の設定
  audioElement = document.getElementById('music');
  
  // AudioAnalyzerの初期化 (FFTサイズ=2048, スムージング=0.7)
  audioAnalyzer = new AudioAnalyzer(audioElement, 2048, 0.7);
  
  // 履歴配列の初期化
  for (let i = 0; i < historySize; i++) {
    waveHistory.push([]);
    
    for (const band in energyHistory) {
      if (!energyHistory[band]) energyHistory[band] = [];
      energyHistory[band].push(0);
    }
  }
  
  // パーティクルの初期化
  for (let i = 0; i < particleCount; i++) {
    particles.push(createParticle());
  }
  
  // 星空の初期化
  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: random(width),
      y: random(height),
      size: random(0.5, 2),
      brightness: random(100, 255)
    });
  }
  
  // マウスクリックでオーディオを開始
  document.addEventListener('click', initAudioOnUserGesture);
  document.addEventListener('touchstart', initAudioOnUserGesture);
  
  // テキスト設定
  textFont('Georgia');
  textSize(24);
  textAlign(CENTER, CENTER);
  
  // リサイズイベントの初期処理
  windowResized();
  
  // 描画の背景を黒に設定
  background(0);
}

// パーティクルを生成する関数
function createParticle(specific = false) {
  if (specific) {
    // 特定位置（中央付近）から生成する場合
    return {
      x: width/2 + random(-width/8, width/8),
      y: height/2 + random(-height/8, height/8),
      size: random(1, 4),
      alpha: random(100, 200),
      speedX: random(-1, 1),
      speedY: random(-1, 1),
      life: random(100, 200),
      maxLife: random(100, 200)
    };
  } else {
    // ランダムに生成する場合
    return {
      x: random(width),
      y: random(height),
      size: random(1, 3),
      alpha: random(50, 150),
      speedX: random(-0.3, 0.3),
      speedY: random(-0.3, 0.3),
      life: random(100, 200),
      maxLife: random(100, 200)
    };
  }
}

// ユーザージェスチャーでオーディオを初期化
function initAudioOnUserGesture() {
  if (!isAudioInitialized) {
    audioAnalyzer.init();
    isAudioInitialized = true;
    audioElement.play();
    
    // イベントリスナーを削除
    document.removeEventListener('click', initAudioOnUserGesture);
    document.removeEventListener('touchstart', initAudioOnUserGesture);
  }
}

// p5.js描画関数（毎フレーム実行）
function draw() {
  // 背景をほんの少し透明にして残像効果を作る
  background(0, 20);
  
  // 星空を描画
  drawStars();
  
  if (isAudioInitialized) {
    // オーディオ解析データの更新
    audioAnalyzer.update();
    
    // 各種データを取得
    const volume = audioAnalyzer.getVolume();
    const bassEnergy = audioAnalyzer.getEnergy('bass');
    const midEnergy = audioAnalyzer.getEnergy('mid');
    const trebleEnergy = audioAnalyzer.getEnergy('treble');
    const kickEnergy = audioAnalyzer.getEnergy('kickDrum');
    const hihatEnergy = audioAnalyzer.getEnergy('hihat');
    const spectralCentroid = audioAnalyzer.getSpectralCentroid();
    const frequencyData = audioAnalyzer.getNormalizedFrequencyData();
    
    // トランジェント値を取得
    const bassTransient = audioAnalyzer.getTransient('bass');
    const midTransient = audioAnalyzer.getTransient('mid');
    const trebleTransient = audioAnalyzer.getTransient('treble');
    
    // 履歴データを更新
    updateHistory(volume, bassEnergy, midEnergy, trebleEnergy);
    
    // 2. 動的な波形グリッド
    drawWaveformGrid(frequencyData, volume);
    
    // 3. 音楽エネルギーフローライン
    drawEnergyFlowLines(bassEnergy, midEnergy, trebleEnergy);
    
    // 4. 神秘的な光柱
    drawLightPillars(kickEnergy, spectralCentroid);
    
    // 5. 共鳴する波紋
    drawResonantRipples(volume, bassTransient);
    
    // 6. 神秘的なパーティクルシステム
    updateMysticParticles(volume, bassTransient, midTransient, trebleTransient);
    drawParticles();
    
  } else {
    // オーディオが初期化されていない場合の表示
    push();
    fill(255);
    textAlign(CENTER, CENTER);
    
    // 解像度に左右されない絶対サイズで描画
    const fontSize = 24 / scaleFactor;
    textSize(fontSize);
    
    // 半透明の背景ボックス
    noStroke();
    fill(0, 0, 0, 150);
    rectMode(CENTER);
    
    const message = 'タップして音楽を再生';
    const messageWidth = textWidth(message);
    
    rect(width/2, height/2, messageWidth + 40, fontSize * 1.5, 10);
    
    // テキストを前面に描画
    fill(255);
    text(message, width/2, height/2);
    pop();
  }
}

// 星空を描画
function drawStars() {
  for (let i = 0; i < stars.length; i++) {
    const star = stars[i];
    
    // 音楽が再生中なら星を明滅させる
    if (isAudioInitialized && !audioElement.paused) {
      star.brightness = star.brightness + random(-10, 10);
      star.brightness = constrain(star.brightness, 80, 255);
    }
    
    // 星を描画
    noStroke();
    fill(255, star.brightness);
    ellipse(star.x, star.y, star.size, star.size);
  }
}

// 履歴データの更新
function updateHistory(volume, bassEnergy, midEnergy, trebleEnergy) {
  // 波形サンプルを取得
  const wavePoints = [];
  for (let i = 0; i < 32; i++) {
    const index = floor(map(i, 0, 32, 0, audioAnalyzer.timeData.length));
    const sample = audioAnalyzer.timeData[index] / 128.0 - 1.0; // -1.0～1.0に正規化
    wavePoints.push(sample);
  }
  
  // 履歴を更新
  waveHistory.push(wavePoints);
  if (waveHistory.length > historySize) {
    waveHistory.shift();
  }
  
  // エネルギー履歴を更新
  energyHistory.bass.push(bassEnergy);
  energyHistory.mid.push(midEnergy);
  energyHistory.treble.push(trebleEnergy);
  
  if (energyHistory.bass.length > historySize) energyHistory.bass.shift();
  if (energyHistory.mid.length > historySize) energyHistory.mid.shift();
  if (energyHistory.treble.length > historySize) energyHistory.treble.shift();
}

// 動的な波形グリッド
function drawWaveformGrid(frequencyData, volume) {
  push();
  
  const gridSize = 20;
  const rows = 15;
  const cols = 30;
  const centerX = width / 2;
  const centerY = height * 0.35;
  const gridStartX = centerX - (cols * gridSize) / 2;
  const gridStartY = centerY - (rows * gridSize) / 2;
  
  // グリッドの透明度を音量で調整
  const gridAlpha = map(volume, 0, 1, 30, 120);
  
  stroke(255, gridAlpha);
  strokeWeight(0.5);
  noFill();
  
  // 水平線
  for (let y = 0; y <= rows; y++) {
    const waveVal = (y % 2 === 0) ? sin(frameCount * 0.03 + y * 0.2) * 10 * volume : 0;
    beginShape();
    for (let x = 0; x <= cols; x++) {
      const freqIndex = floor(map(x, 0, cols, 0, frequencyData.length * 0.5));
      const freqVal = frequencyData[freqIndex] * 20 * volume;
      
      // 波形による変位
      const xPos = gridStartX + x * gridSize;
      const yPos = gridStartY + y * gridSize + waveVal + (y % 4 === 0 ? freqVal : 0);
      
      curveVertex(xPos, yPos);
      
      // グリッド交点に小さなドットを描画
      if (x % 5 === 0 && y % 5 === 0) {
        noStroke();
        fill(255, gridAlpha + 40);
        ellipse(xPos, yPos, 2, 2);
        stroke(255, gridAlpha);
        noFill();
      }
    }
    endShape();
  }
  
  // 垂直線（より少なく、より薄く）
  stroke(255, gridAlpha * 0.7);
  for (let x = 0; x <= cols; x += 2) {
    beginShape();
    for (let y = 0; y <= rows; y++) {
      const freqIndex = floor(map(y, 0, rows, frequencyData.length * 0.5, frequencyData.length * 0.8));
      const freqVal = frequencyData[freqIndex] * 15 * volume;
      
      const xPos = gridStartX + x * gridSize + (x % 5 === 0 ? freqVal : 0);
      const yPos = gridStartY + y * gridSize;
      
      curveVertex(xPos, yPos);
    }
    endShape();
  }
  
  pop();
}

// 音楽エネルギーフローライン
function drawEnergyFlowLines(bassEnergy, midEnergy, trebleEnergy) {
  push();
  
  const centerY = height * 0.6;
  const lineHeight = height * 0.2;
  
  // 中央のラインの描画
  strokeWeight(2);
  stroke(255, 180);
  noFill();
  
  // 1. メインの波形ライン
  beginShape();
  for (let i = 0; i < energyHistory.mid.length; i++) {
    const x = map(i, 0, energyHistory.mid.length - 1, 0, width);
    const y = centerY - energyHistory.mid[i] * lineHeight;
    curveVertex(x, y);
  }
  endShape();
  
  // 2. 低音域ライン（細め、下側）
  strokeWeight(1.5);
  stroke(255, 120);
  beginShape();
  for (let i = 0; i < energyHistory.bass.length; i++) {
    const x = map(i, 0, energyHistory.bass.length - 1, 0, width);
    const y = centerY + 30 + energyHistory.bass[i] * lineHeight * 0.7;
    curveVertex(x, y);
  }
  endShape();
  
  // 3. 高音域ライン（さらに細め、上側）
  strokeWeight(1);
  stroke(255, 80);
  beginShape();
  for (let i = 0; i < energyHistory.treble.length; i++) {
    const x = map(i, 0, energyHistory.treble.length - 1, 0, width);
    const y = centerY - 30 - energyHistory.treble[i] * lineHeight * 0.5;
    curveVertex(x, y);
  }
  endShape();
  
  // ラインを接続する垂直線（ピアノの鍵盤のような効果）
  strokeWeight(0.5);
  stroke(255, 40);
  for (let i = 0; i < energyHistory.mid.length; i += 4) {
    const x = map(i, 0, energyHistory.mid.length - 1, 0, width);
    const topY = centerY - 30 - energyHistory.treble[i] * lineHeight * 0.5;
    const bottomY = centerY + 30 + energyHistory.bass[i] * lineHeight * 0.7;
    line(x, topY, x, bottomY);
  }
  
  pop();
}

// 神秘的な光柱
function drawLightPillars(kickEnergy, spectralCentroid) {
  push();
  
  const baseY = height * 0.75;
  const pillarWidth = 1;
  const pillarMaxHeight = height * 0.3;
  const pillarCount = 60;
  const spacing = width / pillarCount;
  
  // 低音のエネルギーに応じた透明度
  const baseAlpha = map(kickEnergy, 0, 1, 30, 200);
  
  for (let i = 0; i < pillarCount; i++) {
    // 光柱の高さをスペクトル重心とインデックスから計算
    const heightFactor = noise(i * 0.3, frameCount * 0.01) * 
                         map(spectralCentroid, 0, 1, 0.4, 1.0);
    const pillarHeight = pillarMaxHeight * heightFactor * 
                         (0.3 + kickEnergy * 0.7);
    
    // 光柱の位置
    const x = spacing * i;
    
    // 光柱のグラデーション
    for (let h = 0; h < pillarHeight; h++) {
      const y = baseY - h;
      const progress = h / pillarHeight;
      const alpha = baseAlpha * (1 - progress);
      
      // 光柱が上に向かうにつれて幅を広げる
      const currentWidth = pillarWidth + progress * 2;
      
      noStroke();
      fill(255, alpha);
      rect(x, y, currentWidth, 1);
    }
    
    // 光柱の底に小さな輝きを追加
    noStroke();
    fill(255, baseAlpha);
    ellipse(x, baseY, pillarWidth * 3, pillarWidth * 2);
  }
  
  pop();
}

// 共鳴する波紋
function drawResonantRipples(volume, bassTransient) {
  push();
  
  const centerX = width * 0.5;
  const centerY = height * 0.75;
  
  // 波紋の数と最大サイズ
  const rippleCount = 5;
  const maxSize = width * 0.8;
  
  noFill();
  
  // 低音のトランジェントがあれば新しい波紋を追加
  if (bassTransient > 0.2) {
    // 波紋効果を強調
    const rippleStrength = map(bassTransient, 0.2, 1, 1, 3);
    for (let i = 0; i < rippleStrength; i++) {
      // 波紋のスケールを拡大
      let scale = map(i, 0, rippleCount - 1, 0.1, 1);
      strokeWeight(1.5);
      stroke(255, 200 * scale);
      
      // 波紋を描画
      ellipse(centerX, centerY, maxSize * scale, maxSize * scale * 0.3);
    }
  }
  
  // 常に表示される波紋
  for (let i = 0; i < rippleCount; i++) {
    // 時間に基づいた波紋の大きさ（パルス感）
    let scale = ((frameCount * 0.01 + i / rippleCount) % 1);
    let alpha = map(scale, 0, 1, 180, 0);
    
    // 音量に基づいた波紋のサイズ調整
    let scaledSize = maxSize * scale * (0.5 + volume * 0.5);
    
    strokeWeight(1 - scale * 0.5);
    stroke(255, alpha);
    
    // 楕円形の波紋（水平方向に広がる）
    ellipse(centerX, centerY, scaledSize, scaledSize * 0.3);
  }
  
  pop();
}

// 神秘的なパーティクルの更新
function updateMysticParticles(volume, bassTransient, midTransient, trebleTransient) {
  // トランジェント検出時に新しいパーティクルを生成
  if (bassTransient > 0.15) {
    // 低音域のトランジェントでは底部から上昇するパーティクル
    for (let i = 0; i < 10; i++) {
      particles.push({
        x: random(width),
        y: height * 0.8 + random(height * 0.2),
        size: random(2, 6),
        alpha: random(150, 200),
        speedX: random(-0.5, 0.5),
        speedY: random(-3, -1) * (0.5 + bassTransient),
        life: random(100, 150),
        maxLife: random(100, 150)
      });
    }
  }
  
  if (midTransient > 0.1) {
    // 中音域のトランジェントでは中央から放射状にパーティクル
    for (let i = 0; i < 5; i++) {
      const angle = random(TWO_PI);
      const speed = random(1, 3) * (0.5 + midTransient);
      particles.push({
        x: width/2 + random(-width/10, width/10),
        y: height * 0.6 + random(-height/10, height/10),
        size: random(1, 4),
        alpha: random(100, 180),
        speedX: cos(angle) * speed,
        speedY: sin(angle) * speed,
        life: random(80, 120),
        maxLife: random(80, 120)
      });
    }
  }
  
  if (trebleTransient > 0.1) {
    // 高音域のトランジェントでは上部から小さなパーティクル
    for (let i = 0; i < 8; i++) {
      particles.push({
        x: random(width),
        y: random(height * 0.4),
        size: random(0.5, 2),
        alpha: random(80, 150),
        speedX: random(-0.5, 0.5),
        speedY: random(0.5, 2) * (0.5 + trebleTransient),
        life: random(60, 100),
        maxLife: random(60, 100)
      });
    }
  }
  
  // 全パーティクルを更新
  for (let i = particles.length - 1; i >= 0; i--) {
    // 位置を更新（音量に応じて速度調整）
    particles[i].x += particles[i].speedX * (0.8 + volume);
    particles[i].y += particles[i].speedY * (0.8 + volume);
    
    // 寿命を減らす
    particles[i].life -= 1;
    
    // 画面外または寿命が尽きたパーティクルを削除
    if (particles[i].life <= 0 ||
        particles[i].x < -50 ||
        particles[i].x > width + 50 ||
        particles[i].y < -50 ||
        particles[i].y > height + 50) {
      particles.splice(i, 1);
    }
  }
  
  // パーティクル数を一定に保つ
  while (particles.length < particleCount) {
    particles.push(createParticle());
  }
}

// パーティクルの描画
function drawParticles() {
  push();
  blendMode(ADD); // 加算合成で光の効果を強調
  noStroke();
  
  for (let i = 0; i < particles.length; i++) {
    // 寿命に基づいた透明度
    const lifeRatio = particles[i].life / particles[i].maxLife;
    const alpha = particles[i].alpha * lifeRatio;
    
    // グロー効果（大きな半透明の円）
    fill(255, alpha * 0.3);
    ellipse(particles[i].x, particles[i].y, particles[i].size * 3, particles[i].size * 3);
    
    // パーティクル本体
    fill(255, alpha);
    ellipse(particles[i].x, particles[i].y, particles[i].size, particles[i].size);
  }
  
  blendMode(BLEND); // ブレンドモードを元に戻す
  pop();
}

// ウィンドウリサイズ時の処理
function windowResized() {
  // 画面サイズを取得
  const windowW = windowWidth;
  const windowH = windowHeight;
  
  // キャンバスの比率を保つために必要な計算
  const targetRatio = canvasWidth / canvasHeight;
  const windowRatio = windowW / windowH;
  
  // scaleFactor計算（テキストサイズなどの調整用）
  if (windowRatio > targetRatio) {
    // ウィンドウが横長の場合
    scaleFactor = windowH / canvasHeight;
  } else {
    // ウィンドウが縦長の場合
    scaleFactor = windowW / canvasWidth;
  }
  
  // 表示サイズのリサイズ（内部解像度は変えない）
  const canvas = document.querySelector('canvas');
  if (canvas) {
    if (windowRatio > targetRatio) {
      // ウィンドウが横長の場合、高さに合わせる
      const newWidth = windowH * targetRatio;
      canvas.style.width = newWidth + 'px';
      canvas.style.height = windowH + 'px';
    } else {
      // ウィンドウが縦長の場合、幅に合わせる
      const newHeight = windowW / targetRatio;
      canvas.style.width = windowW + 'px';
      canvas.style.height = newHeight + 'px';
    }
  }
}

// 左/中央/右タップを検出するためのハンドラー
function handleTapNavigation(event) {
  const x = event.touches ? event.touches[0].clientX : event.clientX;
  const totalWidth = window.innerWidth;
  const thirdWidth = totalWidth / 3;
  
  if (x < thirdWidth) {
    // 左側1/3タップ → 前のページ
    navigateToPreviousDay();
  } else if (x > thirdWidth * 2) {
    // 右側1/3タップ → 次のページ
    navigateToNextDay();
  } else {
    // 中央1/3タップ → 再生/一時停止
    togglePlayback();
  }
}

// 再生/一時停止の切り替え
function togglePlayback() {
  if (!isAudioInitialized) {
    // 初期化されていなければ初期化して再生
    initAudioOnUserGesture();
  } else {
    // すでに初期化済みなら再生/一時停止を切り替え
    if (audioElement.paused) {
      audioElement.play();
    } else {
      audioElement.pause();
    }
  }
}