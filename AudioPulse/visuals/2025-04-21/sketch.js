/**
 * ミニマル・オーディオビジュアライザー (2025-04-21)
 * シンプルな白黒デザインで音の可視化を行う
 */

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
let particleCount = 150;     // パーティクルの数
let energySmoothing = 0.2;   // エネルギー値のスムージング係数

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
    particles.push({
      x: random(width),
      y: random(height),
      size: random(1, 5),
      speedX: random(-0.5, 0.5),
      speedY: random(-0.5, 0.5),
      life: random(100, 200)
    });
  }
  
  // マウスクリックでオーディオを開始
  document.addEventListener('click', initAudioOnUserGesture);
  document.addEventListener('touchstart', initAudioOnUserGesture);
  
  // テキスト設定
  textSize(24);
  textAlign(CENTER, CENTER);
  
  // リサイズイベントの初期処理
  windowResized();
  
  // 描画の背景を黒に設定
  background(0);
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
  background(0, 30);
  
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
    
    // 1. 中央の波形ディスク
    drawCentralWaveform(volume, spectralCentroid);
    
    // 2. 周波数スペクトラム
    drawFrequencySpectrum(frequencyData, volume);
    
    // 3. エネルギー波形
    drawEnergyFlow(bassEnergy, midEnergy, trebleEnergy);
    
    // 4. パーティクルシステム
    updateParticles(volume, bassTransient, midTransient, trebleTransient);
    drawParticles();
    
    // 5. 幾何学アクセント
    drawGeometricAccents(kickEnergy, midEnergy, hihatEnergy, spectralCentroid);
    
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

// 中央の波形ディスク
function drawCentralWaveform(volume, spectralCentroid) {
  push();
  translate(width/2, height/2);
  
  // 音量に基づいてディスクサイズを設定
  const baseSize = min(width, height) * 0.3;
  const diskSize = baseSize * (0.8 + volume * 0.5);
  
  // スペクトル重心に基づいて複雑さを調整
  const complexity = map(spectralCentroid, 0, 1, 3, 16);
  const points = floor(complexity) * 4;
  
  // ディスクの外周を描画
  noFill();
  stroke(255, 180);
  strokeWeight(1);
  
  // 音量に応じた点線パターン
  const dashLength = map(volume, 0, 1, 5, 15);
  const gapLength = map(volume, 0, 1, 15, 5);
  drawingContext.setLineDash([dashLength, gapLength]);
  ellipse(0, 0, diskSize, diskSize);
  drawingContext.setLineDash([]);
  
  // 波形を描画
  strokeWeight(2);
  stroke(255);
  
  beginShape();
  for (let i = 0; i < points; i++) {
    const angle = map(i, 0, points, 0, TWO_PI);
    
    // 最新の波形データを使用
    const waveIndex = i % waveHistory[waveHistory.length-1].length;
    const sample = waveHistory[waveHistory.length-1][waveIndex];
    
    // 波形を円形に変換
    const radius = diskSize/2 * (1 + sample * 0.5);
    const x = cos(angle) * radius;
    const y = sin(angle) * radius;
    
    vertex(x, y);
    
    // 波形の頂点に小さな円を追加
    if (i % 4 === 0) {
      noStroke();
      fill(255, 150);
      ellipse(x, y, 4, 4);
      stroke(255);
      noFill();
    }
  }
  endShape(CLOSE);
  
  // 中心の小さなディスク
  fill(0);
  stroke(255);
  strokeWeight(1);
  ellipse(0, 0, diskSize * 0.1, diskSize * 0.1);
  
  // 音量レベルの表示
  noStroke();
  fill(255, 100);
  const innerDiskSize = diskSize * 0.1 * volume;
  ellipse(0, 0, innerDiskSize, innerDiskSize);
  
  pop();
}

// 周波数スペクトラム
function drawFrequencySpectrum(frequencyData, volume) {
  push();
  const maxBars = 180; // 表示するバーの数を制限
  const barWidth = TWO_PI / maxBars;
  const radiusBase = min(width, height) * 0.4;
  const barMaxHeight = min(width, height) * 0.15;
  
  translate(width/2, height/2);
  noFill();
  
  // 周波数の帯域ごとに色を変える
  const bassEnd = floor(maxBars * 0.2);
  const midEnd = floor(maxBars * 0.6);
  
  for (let i = 0; i < maxBars; i++) {
    // 対数スケールでインデックスを計算（低周波数により詳細を与える）
    const freqIndex = floor(pow(i / maxBars, 2) * min(frequencyData.length - 1, 1024));
    const value = frequencyData[freqIndex];
    
    // 音量でバーの高さを調整
    const barHeight = value * barMaxHeight * (0.5 + volume * 0.8);
    
    // 角度を計算
    const angle = i * barWidth;
    
    // バーの内側と外側の座標を計算
    const x1 = cos(angle) * radiusBase;
    const y1 = sin(angle) * radiusBase;
    const x2 = cos(angle) * (radiusBase + barHeight);
    const y2 = sin(angle) * (radiusBase + barHeight);
    
    // バーの透明度を値に基づいて設定
    const alpha = map(value, 0, 1, 30, 200);
    
    // バーを描画
    stroke(255, alpha);
    strokeWeight(1.5);
    line(x1, y1, x2, y2);
    
    // 高いエネルギーの周波数には小さな円を追加
    if (value > 0.7) {
      noStroke();
      fill(255, alpha);
      ellipse(x2, y2, 3, 3);
    }
  }
  
  pop();
}

// エネルギー波形
function drawEnergyFlow(bassEnergy, midEnergy, trebleEnergy) {
  push();
  const flowHeight = height * 0.7;
  const flowY = height * 0.85;
  const segmentWidth = width / (historySize - 1);
  
  translate(0, flowY);
  
  // 低音、中音、高音のエネルギーの波を描画
  noFill();
  
  // 低音エネルギー
  stroke(255, 150);
  strokeWeight(2);
  beginShape();
  for (let i = 0; i < energyHistory.bass.length; i++) {
    const x = i * segmentWidth;
    const y = -energyHistory.bass[i] * flowHeight * 0.8;
    vertex(x, y);
  }
  endShape();
  
  // 中音エネルギー
  stroke(255, 100);
  strokeWeight(1.5);
  beginShape();
  for (let i = 0; i < energyHistory.mid.length; i++) {
    const x = i * segmentWidth;
    const y = -energyHistory.mid[i] * flowHeight * 0.6;
    vertex(x, y);
  }
  endShape();
  
  // 高音エネルギー
  stroke(255, 70);
  strokeWeight(1);
  beginShape();
  for (let i = 0; i < energyHistory.treble.length; i++) {
    const x = i * segmentWidth;
    const y = -energyHistory.treble[i] * flowHeight * 0.4;
    vertex(x, y);
  }
  endShape();
  
  pop();
}

// パーティクルの更新
function updateParticles(volume, bassTransient, midTransient, trebleTransient) {
  // トランジェント検出時に新しいパーティクルを生成
  const transientThreshold = 0.1;
  
  if (bassTransient > transientThreshold) {
    // 低音域のトランジェントでは大きなパーティクルを下部から生成
    for (let i = 0; i < 5; i++) {
      particles.push({
        x: random(width),
        y: height * 0.8 + random(height * 0.2),
        size: random(4, 8),
        speedX: random(-1, 1),
        speedY: random(-3, -1),
        life: random(100, 150)
      });
    }
  }
  
  if (midTransient > transientThreshold) {
    // 中音域のトランジェントでは中央からパーティクルを生成
    for (let i = 0; i < 3; i++) {
      particles.push({
        x: width/2 + random(-width/4, width/4),
        y: height/2 + random(-height/4, height/4),
        size: random(2, 6),
        speedX: random(-2, 2),
        speedY: random(-2, 2),
        life: random(80, 120)
      });
    }
  }
  
  if (trebleTransient > transientThreshold) {
    // 高音域のトランジェントでは小さなパーティクルを上部から生成
    for (let i = 0; i < 8; i++) {
      particles.push({
        x: random(width),
        y: random(height * 0.3),
        size: random(1, 3),
        speedX: random(-0.5, 0.5),
        speedY: random(0.5, 2),
        life: random(60, 100)
      });
    }
  }
  
  // 全パーティクルを更新
  for (let i = particles.length - 1; i >= 0; i--) {
    // 位置を更新
    particles[i].x += particles[i].speedX * (1 + volume * 2);
    particles[i].y += particles[i].speedY * (1 + volume * 2);
    
    // 寿命を減らす
    particles[i].life -= 1;
    
    // 画面外または寿命が尽きたパーティクルを削除
    if (particles[i].life <= 0 ||
        particles[i].x < 0 ||
        particles[i].x > width ||
        particles[i].y < 0 ||
        particles[i].y > height) {
      particles.splice(i, 1);
    }
  }
  
  // パーティクル数を一定に保つ
  while (particles.length < particleCount) {
    particles.push({
      x: random(width),
      y: random(height),
      size: random(1, 4),
      speedX: random(-0.5, 0.5),
      speedY: random(-0.5, 0.5),
      life: random(50, 150)
    });
  }
}

// パーティクルの描画
function drawParticles() {
  noStroke();
  
  for (let i = 0; i < particles.length; i++) {
    // 寿命に基づいた透明度
    const alpha = map(particles[i].life, 0, 100, 0, 150);
    fill(255, alpha);
    
    // パーティクルを描画
    ellipse(particles[i].x, particles[i].y, particles[i].size, particles[i].size);
  }
}

// 幾何学アクセント
function drawGeometricAccents(kickEnergy, midEnergy, hihatEnergy, spectralCentroid) {
  push();
  translate(width/2, height/2);
  
  // 音楽の特性に基づいて幾何学図形を描画
  const baseSize = min(width, height) * 0.2;
  
  // 三角形 (低音域)
  if (kickEnergy > 0.1) {
    const kickSize = baseSize * kickEnergy * 1.5;
    push();
    rotate(frameCount * 0.001);
    noFill();
    stroke(255, kickEnergy * 200);
    strokeWeight(1);
    
    // 三角形を描画
    beginShape();
    for (let i = 0; i < 3; i++) {
      const angle = i * TWO_PI / 3;
      const x = cos(angle) * kickSize;
      const y = sin(angle) * kickSize;
      vertex(x, y);
    }
    endShape(CLOSE);
    pop();
  }
  
  // 正方形 (中音域)
  if (midEnergy > 0.15) {
    const midSize = baseSize * midEnergy * 1.2;
    push();
    rotate(frameCount * -0.002);
    noFill();
    stroke(255, midEnergy * 150);
    strokeWeight(1);
    
    // 正方形を描画
    rectMode(CENTER);
    rect(0, 0, midSize, midSize);
    pop();
  }
  
  // 円 (高音域)
  if (hihatEnergy > 0.1) {
    const hihatSize = baseSize * hihatEnergy * 0.8;
    push();
    noFill();
    stroke(255, hihatEnergy * 100);
    strokeWeight(1);
    
    // 円を描画
    ellipse(0, 0, hihatSize, hihatSize);
    
    // スペクトル重心に基づいて複雑な円形パターンを追加
    const complexity = floor(map(spectralCentroid, 0, 1, 3, 12));
    for (let j = 0; j < complexity; j++) {
      const ratio = j / complexity;
      const circleSize = hihatSize * (1 - ratio * 0.5);
      ellipse(0, 0, circleSize, circleSize);
    }
    pop();
  }
  
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