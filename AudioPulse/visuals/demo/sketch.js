/**
 * AudioAnalyzer可視化テスト (2025-04-21)
 * AudioAnalyzerクラスの全機能をシンプルに視覚化
 */

// グローバル変数
let audioElement;
let audioAnalyzer;
let isAudioInitialized = false;
let canvasWidth, canvasHeight;
let freqBarWidth;
let scaleFactor = 1.0; // 描画スケール調整用

// 履歴データの保存用
let drumHistorySize = 64;
let kickHistory = [];
let snareHistory = [];
let hihatHistory = [];
let transientHistory = {
  kickDrum: [],
  snareDrumBody: [],
  snareDrumAttack: [],
  hihat: []
};

// p5.jsセットアップ関数
function setup() {
  // キャンバスサイズの設定
  canvasWidth = 1200;
  canvasHeight = 2000; // 少し大きくしてドラム可視化のスペースを確保
  
  // キャンバス作成先を指定（HTMLの#canvas-containerに）
  const canvas = createCanvas(canvasWidth, canvasHeight);
  canvas.parent('canvas-container');
  
  // オーディオ要素の設定
  audioElement = document.getElementById('music');
  
  // AudioAnalyzerの初期化 (FFTサイズ=2048, スムージング=0.5)
  audioAnalyzer = new AudioAnalyzer(audioElement, 2048, 0.5);
  
  // 各しきい値を設定
  audioAnalyzer.setAllThresholds({
    volume: 0.35,    // 全体の音量しきい値
    bass: 0.25,      // 低音域しきい値
    mid: 0.25,       // 中音域しきい値
    treble: 0.1,     // 高音域しきい値
    kickAttack: 0.10, // バスドラムのアタック検出
    snareAttack: 0.15, // スネアのアタック検出
    hihatAttack: 0.03  // ハイハットのアタック検出
  });
  
  // 周波数バーの幅を計算
  freqBarWidth = width / (audioAnalyzer.fftSize / 8);
  
  // 履歴配列の初期化
  for (let i = 0; i < drumHistorySize; i++) {
    kickHistory.push(0);
    snareHistory.push(0);
    hihatHistory.push(0);
    
    for (const band in transientHistory) {
      if (!transientHistory[band]) transientHistory[band] = [];
      transientHistory[band].push(0);
    }
  }
  
  // マウスクリックでオーディオを開始
  document.addEventListener('click', initAudioOnUserGesture);
  document.addEventListener('touchstart', initAudioOnUserGesture);
  
  // テキスト設定
  textSize(18); // フォントサイズを小さく
  textAlign(LEFT, CENTER);
  
  // リサイズイベントの初期処理
  windowResized();
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
  // 背景を黒に設定
  background(0);
  
  if (isAudioInitialized) {
    // オーディオ解析データの更新
    audioAnalyzer.update();
    
    // 各種データを取得
    const volume = audioAnalyzer.getVolume();
    const bassEnergy = audioAnalyzer.getEnergy('bass');
    const midEnergy = audioAnalyzer.getEnergy('mid');
    const trebleEnergy = audioAnalyzer.getEnergy('treble');
    const frequencyData = audioAnalyzer.getNormalizedFrequencyData();
    
    // ドラム要素検出
    const isKick = audioAnalyzer.isKickDrum();
    const isSnare = audioAnalyzer.isSnareDrum();
    const isHihat = audioAnalyzer.isHihat();
    
    // 履歴の更新
    updateDrumHistory(isKick, isSnare, isHihat);
    updateTransientHistory();
    
    // 状態検出結果
    const isBass = audioAnalyzer.isBass();
    const isMid = audioAnalyzer.isMid();
    const isTreble = audioAnalyzer.isTreble();
    const isBassActive = audioAnalyzer.isBassActive();
    const isMidActive = audioAnalyzer.isMidActive();
    const isTrebleActive = audioAnalyzer.isTrebleActive();
    
    // 音響特性値の取得
    const zeroCrossingRate = audioAnalyzer.getZeroCrossingRate();
    const spectralCentroid = audioAnalyzer.getSpectralCentroid();

    // 1. 周波数スペクトラム表示（上部）
    drawFrequencySpectrum(frequencyData);
    
    // 2. 波形表示（中央）
    drawWaveform();
    
    // 3. 音量レベルと帯域エネルギーレベル（左側）
    drawEnergyLevels(volume, bassEnergy, midEnergy, trebleEnergy);
    
    // 4. 状態検出表示（右側）
    drawDetectors(isBass, isMid, isTreble, isBassActive, isMidActive, isTrebleActive);
    
    // 5. ドラム要素検出表示（右側下部）
    drawDrumDetectors(isKick, isSnare, isHihat);
    
    // 6. トランジェント表示（中央下部）
    drawTransients();
    
    // 7. 音響特性表示（左下部）
    drawAcousticProperties(zeroCrossingRate, spectralCentroid);
    
    // 8. ドラム履歴パターン表示（中央下部）
    drawDrumPatternHistory();
    
    // 9. サンプルビジュアライザー（下部）
    drawSampleVisualizer(volume, bassEnergy, midEnergy, trebleEnergy);
  } else {
    // オーディオが初期化されていない場合の表示
    push();
    fill(255);
    textAlign(CENTER, CENTER);
    
    // 解像度に左右されない絶対サイズで描画
    const fontSize = 18 / scaleFactor; // フォントサイズを小さく
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

// ドラム検出履歴の更新
function updateDrumHistory(kick, snare, hihat) {
  kickHistory.push(kick ? 1 : 0);
  snareHistory.push(snare ? 1 : 0);
  hihatHistory.push(hihat ? 1 : 0);
  
  if (kickHistory.length > drumHistorySize) kickHistory.shift();
  if (snareHistory.length > drumHistorySize) snareHistory.shift();
  if (hihatHistory.length > drumHistorySize) hihatHistory.shift();
}

// トランジェント履歴の更新
function updateTransientHistory() {
  // 各ドラム帯域のトランジェント値を取得して履歴に追加
  for (const band in transientHistory) {
    const value = audioAnalyzer.getTransient(band);
    transientHistory[band].push(value);
    
    if (transientHistory[band].length > drumHistorySize) {
      transientHistory[band].shift();
    }
  }
}

// 周波数スペクトラム表示
function drawFrequencySpectrum(frequencyData) {
  push();
  stroke(255);
  fill(255);
  
  const sectionHeight = height * 0.15; // 少し小さく
  const marginTop = 50;
  
  textSize(18 / scaleFactor); // フォントサイズを小さく
  text("周波数スペクトラム", 20, marginTop - 30);
  
  // 表示する周波数バーの数を制限
  const maxBars = min(frequencyData.length, 512); // より多くのバーを表示
  const barWidth = width / maxBars;
  
  noStroke();
  for (let i = 0; i < maxBars; i++) {
    const barHeight = map(frequencyData[i], 0, 1, 0, sectionHeight);
    rect(i * barWidth, marginTop + sectionHeight - barHeight, barWidth - 1, barHeight);
  }
  
  // 周波数帯域の区切り線と新しいドラム帯域の区切り線を表示
  const nyquist = 22050; // 標準的なサンプリングレート(44.1kHz)の半分
  
  // 低/中/高音域の境界を表示
  stroke(255, 0, 0, 100);
  const bassLimit = audioAnalyzer.bands.bass.max;
  const midLimit = audioAnalyzer.bands.mid.max;
  
  const bassX = map(bassLimit, 0, nyquist, 0, width);
  const midX = map(midLimit, 0, nyquist, 0, width);
  
  line(bassX, marginTop, bassX, marginTop + sectionHeight);
  line(midX, marginTop, midX, marginTop + sectionHeight);
  
  // ドラム帯域の境界を表示
  stroke(0, 255, 0, 100);
  const kickMax = audioAnalyzer.bands.kickDrum.max;
  const snareBodyMax = audioAnalyzer.bands.snareDrumBody.max;
  const snareAttackMax = audioAnalyzer.bands.snareDrumAttack.max;
  const hihatMin = audioAnalyzer.bands.hihat.min;
  
  const kickX = map(kickMax, 0, nyquist, 0, width);
  const snareBodyX = map(snareBodyMax, 0, nyquist, 0, width);
  const snareAttackX = map(snareAttackMax, 0, nyquist, 0, width);
  const hihatX = map(hihatMin, 0, nyquist, 0, width);
  
  line(kickX, marginTop, kickX, marginTop + sectionHeight);
  line(snareBodyX, marginTop, snareBodyX, marginTop + sectionHeight);
  line(snareAttackX, marginTop, snareAttackX, marginTop + sectionHeight);
  line(hihatX, marginTop, hihatX, marginTop + sectionHeight);
  
  // 帯域ラベル
  noStroke();
  fill(255);
  textSize(10 / scaleFactor); // フォントサイズを小さく
  text("低音域", bassX / 2, marginTop + sectionHeight + 20);
  text("中音域", bassX + (midX - bassX) / 2, marginTop + sectionHeight + 20);
  text("高音域", midX + (width - midX) / 2, marginTop + sectionHeight + 20);
  
  fill(0, 255, 0);
  textSize(8 / scaleFactor); // フォントサイズを小さく
  text("バスドラム", kickX / 2, marginTop + sectionHeight + 40);
  text("スネア(ボディ)", (kickX + snareBodyX) / 2, marginTop + sectionHeight + 40);
  text("スネア(アタック)", (snareBodyX + snareAttackX) / 2, marginTop + sectionHeight + 40);
  text("ハイハット", (hihatX + width) / 2, marginTop + sectionHeight + 40);
  
  pop();
}

// 波形表示
function drawWaveform() {
  push();
  stroke(255);
  noFill();
  
  const sectionTop = height * 0.25;
  const sectionHeight = height * 0.08;
  
  fill(255);
  noStroke();
  textSize(18 / scaleFactor); // フォントサイズを小さく
  text("波形 (時間ドメイン)", 20, sectionTop - 30);
  
  // 波形描画
  stroke(255);
  beginShape();
  for (let i = 0; i < width; i++) {
    // 時間データの配列から値を取得
    const index = floor(map(i, 0, width, 0, audioAnalyzer.timeData.length));
    const sample = audioAnalyzer.timeData[index] / 128.0 - 1.0; // -1.0～1.0に正規化
    
    // 波形の高さを計算
    const y = map(sample, -1, 1, sectionTop + sectionHeight, sectionTop);
    vertex(i, y);
  }
  endShape();
  
  // ゼロラインを表示
  stroke(255, 50);
  line(0, sectionTop + sectionHeight / 2, width, sectionTop + sectionHeight / 2);
  
  pop();
}

// 音量レベルと帯域エネルギーレベル表示
function drawEnergyLevels(volume, bassEnergy, midEnergy, trebleEnergy) {
  push();
  stroke(255);
  fill(255);
  
  const sectionTop = height * 0.4;
  const sectionHeight = height * 0.2;
  const barWidth = 60;
  const barGap = 20;
  const leftMargin = 100;
  
  textSize(18 / scaleFactor); // フォントサイズを小さく
  text("エネルギーレベル", leftMargin, sectionTop - 30);
  
  // 音量レベル
  noStroke();
  const volumeHeight = volume * sectionHeight;
  rect(leftMargin, sectionTop + sectionHeight - volumeHeight, barWidth, volumeHeight);
  
  textSize(12 / scaleFactor); // フォントサイズを小さく
  text("音量", leftMargin, sectionTop + sectionHeight + 20);
  text(volume.toFixed(2), leftMargin, sectionTop + sectionHeight + 40);
  
  // 低音域エネルギー
  const bassX = leftMargin + barWidth + barGap;
  const bassHeight = bassEnergy * sectionHeight;
  rect(bassX, sectionTop + sectionHeight - bassHeight, barWidth, bassHeight);
  text("低音", bassX, sectionTop + sectionHeight + 20);
  text(bassEnergy.toFixed(2), bassX, sectionTop + sectionHeight + 40);
  
  // 中音域エネルギー
  const midX = bassX + barWidth + barGap;
  const midHeight = midEnergy * sectionHeight;
  rect(midX, sectionTop + sectionHeight - midHeight, barWidth, midHeight);
  text("中音", midX, sectionTop + sectionHeight + 20);
  text(midEnergy.toFixed(2), midX, sectionTop + sectionHeight + 40);
  
  // 高音域エネルギー
  const trebleX = midX + barWidth + barGap;
  const trebleHeight = trebleEnergy * sectionHeight;
  rect(trebleX, sectionTop + sectionHeight - trebleHeight, barWidth, trebleHeight);
  text("高音", trebleX, sectionTop + sectionHeight + 20);
  text(trebleEnergy.toFixed(2), trebleX, sectionTop + sectionHeight + 40);
  
  // ドラム帯域のエネルギーレベル
  textSize(18 / scaleFactor); // フォントサイズを小さく
  text("ドラム帯域エネルギー", leftMargin, sectionTop + sectionHeight + 70);
  
  textSize(12 / scaleFactor); // フォントサイズを小さく
  
  // バスドラムエネルギー
  const kickEnergy = audioAnalyzer.getEnergy('kickDrum');
  const kickHeight = kickEnergy * sectionHeight;
  fill(255, 100, 100);
  rect(leftMargin, sectionTop + sectionHeight * 2 - kickHeight, barWidth, kickHeight);
  fill(255);
  text("バスドラム", leftMargin, sectionTop + sectionHeight * 2 + 20);
  text(kickEnergy.toFixed(2), leftMargin, sectionTop + sectionHeight * 2 + 40);
  
  // スネアボディエネルギー
  const snareBodyEnergy = audioAnalyzer.getEnergy('snareDrumBody');
  const snareBodyHeight = snareBodyEnergy * sectionHeight;
  fill(100, 255, 100);
  rect(bassX, sectionTop + sectionHeight * 2 - snareBodyHeight, barWidth, snareBodyHeight);
  fill(255);
  text("スネア(体)", bassX, sectionTop + sectionHeight * 2 + 20);
  text(snareBodyEnergy.toFixed(2), bassX, sectionTop + sectionHeight * 2 + 40);
  
  // スネアアタックエネルギー
  const snareAttackEnergy = audioAnalyzer.getEnergy('snareDrumAttack');
  const snareAttackHeight = snareAttackEnergy * sectionHeight;
  fill(100, 100, 255);
  rect(midX, sectionTop + sectionHeight * 2 - snareAttackHeight, barWidth, snareAttackHeight);
  fill(255);
  text("スネア(ア)", midX, sectionTop + sectionHeight * 2 + 20);
  text(snareAttackEnergy.toFixed(2), midX, sectionTop + sectionHeight * 2 + 40);
  
  // ハイハットエネルギー
  const hihatEnergy = audioAnalyzer.getEnergy('hihat');
  const hihatHeight = hihatEnergy * sectionHeight;
  fill(255, 255, 100);
  rect(trebleX, sectionTop + sectionHeight * 2 - hihatHeight, barWidth, hihatHeight);
  fill(255);
  text("ハイハット", trebleX, sectionTop + sectionHeight * 2 + 20);
  text(hihatEnergy.toFixed(2), trebleX, sectionTop + sectionHeight * 2 + 40);
  
  pop();
}

// 各種検出器の状態表示
function drawDetectors(isBass, isMid, isTreble, isBassActive, isMidActive, isTrebleActive) {
  push();
  
  const sectionTop = height * 0.4;
  const sectionHeight = height * 0.15;
  const boxSize = 50;            // 検出器ボックスのサイズを小さく
  const boxGap = 40;             // 要素間の間隔を広げる
  const textGap = 30;            // テキストとボックスの間隔
  const rowGap = 60;             // 行間の間隔を広げる
  const rightSide = width - 420; // 少し左へ
  
  // タイトル
  noStroke();
  fill(255);
  textSize(18 / scaleFactor); // フォントサイズを小さく
  text("検出状態", rightSide, sectionTop - 30);
  
  // テキストサイズを小さく
  textSize(12 / scaleFactor); // フォントサイズを小さく
  textAlign(CENTER, TOP);  // テキスト中央揃え
  
  // 低音域ビート
  stroke(255);
  if (isBass) fill(255);
  else noFill();
  rect(rightSide, sectionTop, boxSize, boxSize);
  noStroke();
  fill(255);
  text("低音", rightSide + boxSize/2, sectionTop + boxSize + textGap/2);
  
  // 中音域ビート
  stroke(255);
  if (isMid) fill(255);
  else noFill();
  rect(rightSide + boxSize + boxGap, sectionTop, boxSize, boxSize);
  noStroke();
  fill(255);
  text("中音", rightSide + boxSize + boxGap + boxSize/2, sectionTop + boxSize + textGap/2);
  
  // 高音域ビート
  stroke(255);
  if (isTreble) fill(255);
  else noFill();
  rect(rightSide + (boxSize + boxGap) * 2, sectionTop, boxSize, boxSize);
  noStroke();
  fill(255);
  text("高音", rightSide + (boxSize + boxGap) * 2 + boxSize/2, sectionTop + boxSize + textGap/2);
  
  // 第2行: 帯域活性検出（Y位置を下に移動）
  const secondRowY = sectionTop + boxSize + textGap + rowGap;
  
  // 低音域活性
  stroke(255);
  if (isBassActive) fill(255);
  else noFill();
  rect(rightSide, secondRowY, boxSize, boxSize);
  noStroke();
  fill(255);
  text("低活", rightSide + boxSize/2, secondRowY + boxSize + textGap/2);
  
  // 中音域活性
  stroke(255);
  if (isMidActive) fill(255);
  else noFill();
  rect(rightSide + boxSize + boxGap, secondRowY, boxSize, boxSize);
  noStroke();
  fill(255);
  text("中活", rightSide + boxSize + boxGap + boxSize/2, secondRowY + boxSize + textGap/2);
  
  // 高音域活性
  stroke(255);
  if (isTrebleActive) fill(255);
  else noFill();
  rect(rightSide + (boxSize + boxGap) * 2, secondRowY, boxSize, boxSize);
  noStroke();
  fill(255);
  text("高活", rightSide + (boxSize + boxGap) * 2 + boxSize/2, secondRowY + boxSize + textGap/2);
  
  // しきい値情報（テキスト位置を調整）
  noStroke();
  fill(255);
  textAlign(LEFT, TOP);
  textSize(10 / scaleFactor); // フォントサイズを小さく
  const thresholds = audioAnalyzer.getThresholds();
  
  // しきい値情報を縦に並べて表示
  text(`しきい値:`, rightSide, secondRowY + boxSize + textGap * 2);
  text(`低音=${thresholds.bass.toFixed(2)}`, rightSide, secondRowY + boxSize + textGap * 2 + 60);
  text(`中音=${thresholds.mid.toFixed(2)}`, rightSide, secondRowY + boxSize + textGap * 2 + 90);
  text(`高音=${thresholds.treble.toFixed(2)}`, rightSide, secondRowY + boxSize + textGap * 2 + 120);
  
  // 元のテキスト設定に戻す
  textAlign(LEFT, CENTER);
  textSize(18 / scaleFactor); // フォントサイズを小さく
  
  pop();
}

// ドラム要素検出状態の表示（新機能）
function drawDrumDetectors(isKick, isSnare, isHihat) {
  push();
  
  const sectionTop = height * 0.6;
  const boxSize = 50;
  const boxGap = 40;
  const textGap = 30;
  const rightSide = width - 420;
  
  // タイトル
  noStroke();
  fill(255);
  textSize(18 / scaleFactor); // フォントサイズを小さく
  text("ドラム検出状態", rightSide, sectionTop - 30);
  
  // テキストサイズを小さく
  textSize(12 / scaleFactor); // フォントサイズを小さく
  textAlign(CENTER, TOP);  // テキスト中央揃え
  
  // バスドラム検出
  stroke(255, 100, 100);
  strokeWeight(2);
  if (isKick) fill(255, 100, 100);
  else noFill();
  rect(rightSide, sectionTop, boxSize, boxSize);
  noStroke();
  fill(255, 100, 100);
  text("バスドラム", rightSide + boxSize/2, sectionTop + boxSize + textGap/2);
  
  // スネア検出
  stroke(100, 255, 100);
  strokeWeight(2);
  if (isSnare) fill(100, 255, 100);
  else noFill();
  rect(rightSide + boxSize + boxGap, sectionTop, boxSize, boxSize);
  noStroke();
  fill(100, 255, 100);
  text("スネア", rightSide + boxSize + boxGap + boxSize/2, sectionTop + boxSize + textGap/2);
  
  // ハイハット検出
  stroke(255, 255, 100);
  strokeWeight(2);
  if (isHihat) fill(255, 255, 100);
  else noFill();
  rect(rightSide + (boxSize + boxGap) * 2, sectionTop, boxSize, boxSize);
  noStroke();
  fill(255, 255, 100);
  text("ハイハット", rightSide + (boxSize + boxGap) * 2 + boxSize/2, sectionTop + boxSize + textGap/2);
  
  // ドラム検出設定情報
  noStroke();
  fill(255);
  textAlign(LEFT, TOP);
  textSize(10 / scaleFactor); // フォントサイズを小さく
  const thresholds = audioAnalyzer.getThresholds();
  
  // ドラム関連のしきい値情報
  const infoY = sectionTop + boxSize + textGap * 2;
  text(`ドラム検出しきい値:`, rightSide, infoY);
  text(`バスドラム=${thresholds.kickAttack.toFixed(2)}`, rightSide, infoY + 30);
  text(`スネア=${thresholds.snareAttack.toFixed(2)}`, rightSide, infoY + 60);
  text(`ハイハット=${thresholds.hihatAttack.toFixed(2)}`, rightSide, infoY + 90);
  
  // 元のテキスト設定に戻す
  textAlign(LEFT, CENTER);
  textSize(18 / scaleFactor); // フォントサイズを小さく
  
  pop();
}

// トランジェント表示（新機能）
function drawTransients() {
  push();
  
  const sectionTop = height * 0.75;
  const sectionHeight = height * 0.08;
  const leftMargin = width * 0.1;
  const graphWidth = width * 0.8;
  
  // タイトル
  noStroke();
  fill(255);
  textSize(18 / scaleFactor); // フォントサイズを小さく
  text("トランジェント (音の立ち上がり)", leftMargin, sectionTop - 30);
  
  // 背景とグリッド
  noFill();
  stroke(50);
  rect(leftMargin, sectionTop, graphWidth, sectionHeight);
  
  // グリッド線
  for (let i = 0; i <= 4; i++) {
    const y = sectionTop + (sectionHeight * i / 4);
    line(leftMargin, y, leftMargin + graphWidth, y);
  }
  
  // 各バンドのトランジェント履歴を描画
  const bandColors = {
    kickDrum: [255, 100, 100],
    snareDrumBody: [100, 255, 100],
    snareDrumAttack: [100, 100, 255],
    hihat: [255, 255, 100]
  };
  
  for (const band in transientHistory) {
    const color = bandColors[band];
    stroke(color[0], color[1], color[2]);
    strokeWeight(2);
    noFill();
    
    beginShape();
    for (let i = 0; i < transientHistory[band].length; i++) {
      const x = leftMargin + (i / drumHistorySize) * graphWidth;
      const y = sectionTop + sectionHeight - transientHistory[band][i] * sectionHeight;
      vertex(x, y);
    }
    endShape();
  }
  
  // 凡例
  const legendY = sectionTop + sectionHeight + 20;
  textSize(10 / scaleFactor); // フォントサイズを小さく
  noStroke();
  
  fill(255, 100, 100);
  text("バスドラム", leftMargin, legendY);
  
  fill(100, 255, 100);
  text("スネア(ボディ)", leftMargin + 120, legendY);
  
  fill(100, 100, 255);
  text("スネア(アタック)", leftMargin + 250, legendY);
  
  fill(255, 255, 100);
  text("ハイハット", leftMargin + 400, legendY);
  
  pop();
}

// 音響特性表示（新機能）
function drawAcousticProperties(zeroCrossingRate, spectralCentroid) {
  push();
  
  const sectionTop = height * 0.65;
  const sectionHeight = height * 0.08;
  const barWidth = 60;
  const barGap = 20;
  const leftMargin = 100;
  
  // タイトル
  noStroke();
  fill(255);
  textSize(18 / scaleFactor); // フォントサイズを小さく
  text("音響特性", leftMargin, sectionTop - 30);
  
  // 零交差率
  const zcrHeight = zeroCrossingRate * sectionHeight;
  fill(255, 150, 0);
  rect(leftMargin, sectionTop + sectionHeight - zcrHeight, barWidth, zcrHeight);
  
  // スペクトル重心
  const centroidHeight = spectralCentroid * sectionHeight;
  fill(0, 150, 255);
  rect(leftMargin + barWidth + barGap, sectionTop + sectionHeight - centroidHeight, barWidth, centroidHeight);
  
  // ラベルと値
  fill(255);
  textSize(12 / scaleFactor); // フォントサイズを小さく
  text("零交差率", leftMargin, sectionTop + sectionHeight + 20);
  text(zeroCrossingRate.toFixed(2), leftMargin, sectionTop + sectionHeight + 40);
  
  text("スペクトル重心", leftMargin + barWidth + barGap, sectionTop + sectionHeight + 20);
  text(spectralCentroid.toFixed(2), leftMargin + barWidth + barGap, sectionTop + sectionHeight + 40);
  
  // 説明テキスト
  textSize(10 / scaleFactor); // フォントサイズを小さく
  fill(255, 150, 0);
  text("※ ハイハット検出に使用", leftMargin, sectionTop + sectionHeight + 70);
  
  fill(0, 150, 255);
  text("※ 音色の明るさの指標", leftMargin + barWidth + barGap, sectionTop + sectionHeight + 70);
  
  pop();
}

// ドラムパターン履歴表示（新機能）
function drawDrumPatternHistory() {
  push();
  
  const sectionTop = height * 0.65;
  const sectionHeight = height * 0.08;
  const historyWidth = width * 0.4;
  const rightMargin = width * 0.1;
  const leftPosition = width - rightMargin - historyWidth;
  
  // タイトル
  noStroke();
  fill(255);
  textSize(18 / scaleFactor); // フォントサイズを小さく
  text("ドラムパターン履歴", leftPosition, sectionTop - 30);
  
  // 背景
  noFill();
  stroke(50);
  rect(leftPosition, sectionTop, historyWidth, sectionHeight * 3);
  
  // 各ドラム要素の履歴を表示
  const barHeight = sectionHeight * 0.6;
  const rowHeight = sectionHeight;
  
  // バスドラムの履歴
  noStroke();
  fill(255, 100, 100);
  for (let i = 0; i < kickHistory.length; i++) {
    if (kickHistory[i] > 0) {
      const x = leftPosition + (i / drumHistorySize) * historyWidth;
      const y = sectionTop + rowHeight * 0 + (rowHeight - barHeight) / 2;
      const barWidth = historyWidth / drumHistorySize;
      rect(x, y, barWidth, barHeight);
    }
  }
  
  // スネアの履歴
  fill(100, 255, 100);
  for (let i = 0; i < snareHistory.length; i++) {
    if (snareHistory[i] > 0) {
      const x = leftPosition + (i / drumHistorySize) * historyWidth;
      const y = sectionTop + rowHeight * 1 + (rowHeight - barHeight) / 2;
      const barWidth = historyWidth / drumHistorySize;
      rect(x, y, barWidth, barHeight);
    }
  }
  
  // ハイハットの履歴
  fill(255, 255, 100);
  for (let i = 0; i < hihatHistory.length; i++) {
    if (hihatHistory[i] > 0) {
      const x = leftPosition + (i / drumHistorySize) * historyWidth;
      const y = sectionTop + rowHeight * 2 + (rowHeight - barHeight) / 2;
      const barWidth = historyWidth / drumHistorySize;
      rect(x, y, barWidth, barHeight);
    }
  }
  
  // ラベル
  fill(255);
  textSize(10 / scaleFactor); // フォントサイズを小さく
  text("バスドラム", leftPosition - 90, sectionTop + rowHeight * 0.5);
  text("スネア", leftPosition - 90, sectionTop + rowHeight * 1.5);
  text("ハイハット", leftPosition - 90, sectionTop + rowHeight * 2.5);
  
  pop();
}

// サンプルビジュアライザー
function drawSampleVisualizer(volume, bassEnergy, midEnergy, trebleEnergy) {
  push();
  
  const sectionTop = height * 0.88; // 少し下に移動
  const sectionHeight = height * 0.1;
  
  // タイトル
  noStroke();
  fill(255);
  textSize(18 / scaleFactor); // フォントサイズを小さく
  text("サンプルビジュアライザー", 20, sectionTop - 30);
  
  // 中央線
  stroke(255, 100);
  line(0, sectionTop + sectionHeight / 2, width, sectionTop + sectionHeight / 2);
  
  // ドラム検出を利用したビジュアルエフェクト
  const isKick = audioAnalyzer.isKickDrum();
  const isSnare = audioAnalyzer.isSnareDrum();
  const isHihat = audioAnalyzer.isHihat();
  
  // バスドラム効果：中央から広がる円
  if (isKick) {
    noFill();
    stroke(255, 100, 100, 150);
    strokeWeight(4);
    const kickRadius = 100 + bassEnergy * 200;
    ellipse(width / 2, sectionTop + sectionHeight / 2, kickRadius, kickRadius);
  }
  
  // スネア効果：ランダムな点の群れ
  if (isSnare) {
    fill(100, 255, 100, 150);
    noStroke();
    for (let i = 0; i < 50; i++) {
      const x = random(width);
      const y = random(sectionTop, sectionTop + sectionHeight);
      const size = random(2, 10);
      ellipse(x, y, size, size);
    }
  }
  
  // ハイハット効果：水平線のパターン
  if (isHihat) {
    stroke(255, 255, 100, 150);
    strokeWeight(2);
    for (let i = 0; i < 10; i++) {
      const y = sectionTop + random(sectionHeight);
      line(0, y, width, y);
    }
  }
  
  // 低音の波
  stroke(255);
  noFill();
  beginShape();
  for (let x = 0; x < width; x += 5) {
    const angle = x * 0.01 + frameCount * 0.02;
    const y = sectionTop + sectionHeight / 2 + sin(angle) * (bassEnergy * sectionHeight / 2);
    vertex(x, y);
  }
  endShape();
  
  // 中音の円
  noStroke();
  fill(255, 150);
  const midRadius = midEnergy * 100;
  ellipse(width / 4, sectionTop + sectionHeight / 2, midRadius * 2, midRadius * 2);
  
  // 高音の長方形
  const rectSize = trebleEnergy * 100;
  rect(width * 0.75, sectionTop + sectionHeight / 2 - rectSize / 2, rectSize, rectSize);
  
  // 音量のバーをオーバーレイ表示
  noStroke();
  fill(255, 200);
  const volumeWidth = volume * width;
  rect(0, sectionTop + sectionHeight - 10, volumeWidth, 10);
  
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

// 次の日付へ移動
function navigateToNextDay() {
  const currentDate = new Date('2025-04-21');
  currentDate.setDate(currentDate.getDate() + 1);
  const nextDateStr = currentDate.toISOString().split('T')[0];
  window.location.href = `../${nextDateStr}/index.html`;
}

// 前の日付へ移動
function navigateToPreviousDay() {
  const currentDate = new Date('2025-04-21');
  currentDate.setDate(currentDate.getDate() - 1);
  const prevDateStr = currentDate.toISOString().split('T')[0];
  window.location.href = `../${prevDateStr}/index.html`;
}