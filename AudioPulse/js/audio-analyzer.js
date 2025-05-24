/**
 * AudioAnalyzer - 音楽ビジュアライザー用の音声解析ユーティリティ
 * Web Audio APIとp5.jsを使用して音声データを分析・変換します
 */
class AudioAnalyzer {
  constructor(audioElement, fftSize = 2048, smoothingTimeConstant = 0.5) {
    this.audioElement = audioElement;
    this.fftSize = fftSize;
    this.smoothingTimeConstant = smoothingTimeConstant;
    
    this.audioContext = null;
    this.analyzer = null;
    this.source = null;
    this.isInitialized = false;
    
    // FFT解析結果を格納する配列
    this.frequencyData = null;
    this.timeData = null;
    
    // 前回のフレームデータを保存（トランジェント検出用）
    this.prevFrequencyData = null;
    this.prevTimeData = null;
    
    // ドラムの周波数帯域を細分化
    this.bands = {
      // 通常の帯域分割
      bass: { min: 20, max: 250 },
      mid: { min: 250, max: 2000 },
      treble: { min: 2000, max: 20000 },
      
      // ドラム特化の帯域
      kickDrum: { min: 20, max: 120 },      // バスドラム
      snareDrumBody: { min: 200, max: 650 }, // スネアドラムのボディ部分
      snareDrumAttack: { min: 800, max: 1200 }, // スネアドラムのアタック部分
      hihat: { min: 7000, max: 12000 }       // ハイハット
    };
    
    // 各帯域のエネルギーしきい値
    this.thresholds = {
      volume: 0.5,
      bass: 0.5,            // 低音域活性化閾値
      mid: 0.4,             // 中音域活性化閾値
      treble: 0.2,          // 高音域活性化閾値
      
      // ドラム検出用のしきい値
      kickAttack: 0.15,     // バスドラムのアタック検出
      snareAttack: 0.25,    // スネアのアタック検出
      hihatAttack: 0.10,    // ハイハットのアタック検出
    };
    
    // 履歴バッファ（平均値計算、パターン認識用）
    this.historySize = 10;
    this.energyHistory = {
      kickDrum: new Array(this.historySize).fill(0),
      snareDrumBody: new Array(this.historySize).fill(0),
      snareDrumAttack: new Array(this.historySize).fill(0),
      hihat: new Array(this.historySize).fill(0)
    };
    
    // ドラム検出状態
    this.drumDetection = {
      kick: false,
      snare: false,
      hihat: false,
      lastKickTime: 0,
      lastSnareTime: 0,
      lastHihatTime: 0,
      minTimeBetweenBeats: 100 // ミリ秒
    };
  }
  
  /**
   * オーディオ解析の初期化
   * ユーザージェスチャー後に呼び出す必要があります
   */
  init() {
    if (this.isInitialized) return;
    
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyzer = this.audioContext.createAnalyser();
      this.source = this.audioContext.createMediaElementSource(this.audioElement);
      
      // FFTサイズとスムージングの設定
      this.analyzer.fftSize = this.fftSize;
      this.analyzer.smoothingTimeConstant = this.smoothingTimeConstant;

      // デシベル範囲の設定（低いノイズも捉えるために広げる）
      this.analyzer.minDecibels = -90;
      this.analyzer.maxDecibels = -10;
      
      // 接続: オーディオソース → アナライザー → スピーカー出力
      this.source.connect(this.analyzer);
      this.analyzer.connect(this.audioContext.destination);
      
      // データ配列の初期化
      this.frequencyData = new Uint8Array(this.analyzer.frequencyBinCount);
      this.timeData = new Uint8Array(this.analyzer.frequencyBinCount);
      this.prevFrequencyData = new Uint8Array(this.analyzer.frequencyBinCount);
      this.prevTimeData = new Uint8Array(this.analyzer.frequencyBinCount);
      
      this.isInitialized = true;
      console.log('AudioAnalyzer initialized with FFT size:', this.fftSize);
    } catch (error) {
      console.error('AudioAnalyzer initialization failed:', error);
    }
  }
  
  /**
   * 解析データの更新（毎フレーム呼び出し）
   */
  update() {
    if (!this.isInitialized) return;
    
    // 前回のデータを保存
    this.prevFrequencyData.set(this.frequencyData);
    this.prevTimeData.set(this.timeData);
    
    // 新しいデータを取得
    this.analyzer.getByteFrequencyData(this.frequencyData);
    this.analyzer.getByteTimeDomainData(this.timeData);
    
    // 履歴バッファを更新
    this._updateEnergyHistory();
    
    // ドラム検出の更新
    this._updateDrumDetection();
  }
  
  /**
   * エネルギー履歴を更新
   * @private
   */
  _updateEnergyHistory() {
    // 各ドラム要素のエネルギーを計算して履歴に追加
    for (const band in this.energyHistory) {
      // 古いデータをシフト
      this.energyHistory[band].shift();
      // 新しいデータを追加
      this.energyHistory[band].push(this.getEnergy(band));
    }
  }
  
  /**
   * ドラム検出の状態を更新
   * @private
   */
  _updateDrumDetection() {
    const now = Date.now();
    
    // バスドラム検出
    if (this.isKickDrum() && now - this.drumDetection.lastKickTime > this.drumDetection.minTimeBetweenBeats) {
      this.drumDetection.kick = true;
      this.drumDetection.lastKickTime = now;
    } else {
      this.drumDetection.kick = false;
    }
    
    // スネア検出
    if (this.isSnareDrum() && now - this.drumDetection.lastSnareTime > this.drumDetection.minTimeBetweenBeats) {
      this.drumDetection.snare = true;
      this.drumDetection.lastSnareTime = now;
    } else {
      this.drumDetection.snare = false;
    }
    
    // ハイハット検出
    if (this.isHihat() && now - this.drumDetection.lastHihatTime > this.drumDetection.minTimeBetweenBeats) {
      this.drumDetection.hihat = true;
      this.drumDetection.lastHihatTime = now;
    } else {
      this.drumDetection.hihat = false;
    }
  }
  
  /**
   * 全体の音量レベルを取得 (0.0～1.0)
   */
  getVolume() {
    if (!this.isInitialized) return 0;
    
    let sum = 0;
    // RMSの計算（より正確な音量測定）
    for (let i = 0; i < this.timeData.length; i++) {
      const amplitude = (this.timeData[i] / 128.0) - 1.0; // -1.0 to 1.0
      sum += amplitude * amplitude;
    }
    
    return Math.sqrt(sum / this.timeData.length);
  }
  
  /**
   * 特定の周波数帯域のエネルギーレベルを取得 (0.0～1.0)
   * @param {string} band - バンド名（bands内の任意のキー）
   */
  getEnergy(band) {
    if (!this.isInitialized) return 0;
    if (!this.bands[band]) return 0;
    
    const { min, max } = this.bands[band];
    let sum = 0;
    let count = 0;
    
    // 周波数ビンのインデックスに変換
    const nyquist = this.audioContext.sampleRate / 2;
    const minIndex = Math.floor(this.frequencyData.length * min / nyquist);
    const maxIndex = Math.floor(this.frequencyData.length * max / nyquist);
    
    for (let i = minIndex; i <= maxIndex; i++) {
      sum += this.frequencyData[i];
      count++;
    }
    
    return count > 0 ? sum / (count * 255) : 0;
  }

  /**
   * 特定の周波数帯域のトランジェント（急激な変化）を検出
   * @param {string} band - バンド名（bands内の任意のキー）
   * @returns {number} トランジェント強度 (0.0～1.0)
   */
  getTransient(band) {
    if (!this.isInitialized) return 0;
    if (!this.bands[band]) return 0;
    
    const { min, max } = this.bands[band];
    let currentEnergy = 0;
    let previousEnergy = 0;
    let count = 0;
    
    // 周波数ビンのインデックスに変換
    const nyquist = this.audioContext.sampleRate / 2;
    const minIndex = Math.floor(this.frequencyData.length * min / nyquist);
    const maxIndex = Math.floor(this.frequencyData.length * max / nyquist);
    
    for (let i = minIndex; i <= maxIndex; i++) {
      currentEnergy += this.frequencyData[i];
      previousEnergy += this.prevFrequencyData[i];
      count++;
    }
    
    if (count === 0) return 0;
    
    // 正規化されたエネルギー値を計算
    currentEnergy = currentEnergy / (count * 255);
    previousEnergy = previousEnergy / (count * 255);
    
    // エネルギーの増加量を計算（トランジェント強度）
    return Math.max(0, currentEnergy - previousEnergy);
  }
  
  /**
   * 波形の零交差率を計算（ハイハット検出に有用）
   * @returns {number} 零交差率 (0.0～1.0)
   */
  getZeroCrossingRate() {
    if (!this.isInitialized) return 0;
    
    let crossings = 0;
    const middle = 128;
    
    // 隣接サンプル間の符号変化を検出
    for (let i = 1; i < this.timeData.length; i++) {
      if ((this.timeData[i-1] > middle && this.timeData[i] <= middle) ||
          (this.timeData[i-1] <= middle && this.timeData[i] > middle)) {
        crossings++;
      }
    }
    
    // 零交差率を正規化
    return crossings / (this.timeData.length - 1);
  }
  
  /**
   * スペクトル重心を計算（音色の明るさの指標）
   * @returns {number} 正規化されたスペクトル重心 (0.0～1.0)
   */
  getSpectralCentroid() {
    if (!this.isInitialized) return 0;
    
    let sumAmplitude = 0;
    let sumWeightedAmplitude = 0;
    
    for (let i = 0; i < this.frequencyData.length; i++) {
      const amplitude = this.frequencyData[i];
      sumAmplitude += amplitude;
      sumWeightedAmplitude += amplitude * i;
    }
    
    if (sumAmplitude === 0) return 0;
    
    // 正規化されたスペクトル重心
    return sumWeightedAmplitude / sumAmplitude / this.frequencyData.length;
  }
  
  /**
   * 特定の周波数インデックスの値を取得 (0～255)
   * @param {number} index - 周波数インデックス
   */
  getFrequencyValue(index) {
    if (!this.isInitialized || index >= this.frequencyData.length) return 0;
    return this.frequencyData[index];
  }
  
  /**
   * 正規化された周波数データ配列を取得 (0.0～1.0)
   */
  getNormalizedFrequencyData() {
    if (!this.isInitialized) return [];
    
    const normalized = [];
    for (let i = 0; i < this.frequencyData.length; i++) {
      normalized.push(this.frequencyData[i] / 255);
    }
    return normalized;
  }
  
  /**
   * 特定の周波数帯域の平均エネルギーを履歴から計算
   * @param {string} band - バンド名
   * @returns {number} 平均エネルギー (0.0～1.0)
   */
  getAverageEnergy(band) {
    if (!this.energyHistory[band]) return 0;
    
    const sum = this.energyHistory[band].reduce((a, b) => a + b, 0);
    return sum / this.energyHistory[band].length;
  }
  
  /**
   * バスドラム検出（周波数特性とトランジェントを組み合わせた高精度検出）
   * @returns {boolean} バスドラムが検出されたか
   */
  isKickDrum() {
    if (!this.isInitialized) return false;
    
    // バスドラムの特徴量の取得
    const kickEnergy = this.getEnergy('kickDrum');
    const kickTransient = this.getTransient('kickDrum');
    const avgKickEnergy = this.getAverageEnergy('kickDrum');
    
    // バスドラムのパターン検出
    // 1. 40-120Hz帯域のエネルギーが高い
    // 2. その帯域でトランジェント（急激な音量上昇）が検出された
    // 3. 全体の音量も十分ある
    const volumeCondition = this.getVolume() > this.thresholds.volume * 0.7;
    const energyCondition = kickEnergy > avgKickEnergy * 1.5 && kickEnergy > this.thresholds.bass * 0.8;
    const transientCondition = kickTransient > this.thresholds.kickAttack;
    
    // 低音域と中低音域のエネルギー比（バスドラムは低音が支配的）
    const lowToMidRatio = this.getEnergy('kickDrum') / (this.getEnergy('mid') + 0.01);
    const spectralCondition = lowToMidRatio > 0.5;
    
    return volumeCondition && energyCondition && transientCondition && spectralCondition;
  }
  
  /**
   * スネアドラム検出（ボディとアタック部分の両方を考慮）
   * @returns {boolean} スネアドラムが検出されたか
   */
  isSnareDrum() {
    if (!this.isInitialized) return false;
    
    // スネアの特徴量の取得
    const snareBodyEnergy = this.getEnergy('snareDrumBody');
    const snareAttackEnergy = this.getEnergy('snareDrumAttack');
    const snareBodyTransient = this.getTransient('snareDrumBody');
    const snareAttackTransient = this.getTransient('snareDrumAttack');
    
    // スネアのパターン検出
    // 1. 180-250Hz（ボディ）と800-1200Hz（アタック）の両方でエネルギーが検出される
    // 2. 両方の帯域でトランジェントが検出される
    // 3. 全体の音量が十分ある
    const volumeCondition = this.getVolume() > this.thresholds.volume * 0.6;
    
    const bodyCondition = snareBodyEnergy > this.thresholds.mid * 0.7 && 
                          snareBodyTransient > this.thresholds.snareAttack * 0.5;
                          
    const attackCondition = snareAttackEnergy > this.thresholds.mid * 0.6 && 
                            snareAttackTransient > this.thresholds.snareAttack * 0.7;
    
    // スネアはボディとアタックの両方の特性を持つ
    return volumeCondition && bodyCondition && attackCondition;
  }
  
  /**
   * ハイハット検出（高周波数帯域と零交差率を利用）
   * @returns {boolean} ハイハットが検出されたか
   */
  isHihat() {
    if (!this.isInitialized) return false;
    
    // ハイハットの特徴量の取得
    const hihatEnergy = this.getEnergy('hihat');
    const hihatTransient = this.getTransient('hihat');
    const zeroCrossingRate = this.getZeroCrossingRate();
    const spectralCentroid = this.getSpectralCentroid();
    
    // ハイハットのパターン検出
    // 1. 高周波数帯域(7kHz-12kHz)でエネルギーが検出される
    // 2. 零交差率が高い（ホワイトノイズ的な特性）
    // 3. スペクトル重心が高い周波数にある（明るい音色）
    // 4. トランジェントが検出される
    
    const energyCondition = hihatEnergy > this.thresholds.treble * 0.5;
    const transientCondition = hihatTransient > this.thresholds.hihatAttack;
    const zeroCrossingCondition = zeroCrossingRate > 0.3; // 高い零交差率
    const spectralCondition = spectralCentroid > 0.6; // 高いスペクトル重心
    
    return energyCondition && transientCondition && zeroCrossingCondition && spectralCondition;
  }
  
  /**
   * 低音域のビート検出（改良版）
   * @param {number} threshold - 検出閾値、指定しない場合はデフォルト値を使用
   */
  isBass(threshold = null) {
    if (!this.isInitialized) return false;
    
    // バスドラム検出を利用
    return this.drumDetection.kick;
  }
  
  /**
   * 中音域のビート検出（改良版）
   * @param {number} threshold - 検出閾値、指定しない場合はデフォルト値を使用
   */
  isMid(threshold = null) {
    if (!this.isInitialized) return false;
    
    // スネアドラム検出を利用
    return this.drumDetection.snare;
  }
  
  /**
   * 高音域のビート検出（改良版）
   * @param {number} threshold - 検出閾値、指定しない場合はデフォルト値を使用
   */
  isTreble(threshold = null) {
    if (!this.isInitialized) return false;
    
    // ハイハット検出を利用
    return this.drumDetection.hihat;
  }
  
  /**
   * 特定の周波数帯域のエネルギーがしきい値を超えているかを判定
   * @param {string} band - 'bass', 'mid', 'treble'のいずれか
   * @param {number} threshold - 判定閾値 (0.0～1.0)、指定しない場合はコンストラクタで設定した値を使用
   */
  isEnergyAboveThreshold(band, threshold = null) {
    if (!this.isInitialized || !this.bands[band]) return false;
    
    // 引数がない場合はインスタンス変数のしきい値を使用
    const actualThreshold = threshold !== null ? threshold : this.thresholds[band];
    
    const energy = this.getEnergy(band);
    return energy > actualThreshold;
  }
  
  /**
   * 低音域が活性化しているか
   * @param {number} threshold - 判定閾値 (0.0～1.0)、指定しない場合はコンストラクタで設定した値を使用
   */
  isBassActive(threshold = null) {
    return this.isEnergyAboveThreshold('bass', threshold);
  }
  
  /**
   * 中音域が活性化しているか
   * @param {number} threshold - 判定閾値 (0.0～1.0)、指定しない場合はコンストラクタで設定した値を使用
   */
  isMidActive(threshold = null) {
    return this.isEnergyAboveThreshold('mid', threshold);
  }
  
  /**
   * 高音域が活性化しているか
   * @param {number} threshold - 判定閾値 (0.0～1.0)、指定しない場合はコンストラクタで設定した値を使用
   */
  isTrebleActive(threshold = null) {
    return this.isEnergyAboveThreshold('treble', threshold);
  }
  
  /**
   * FFTサイズを変更する
   * @param {number} fftSize - 新しいFFTサイズ (2の累乗)
   */
  setFFTSize(fftSize) {
    if (!this.isInitialized) return;
    
    this.fftSize = fftSize;
    this.analyzer.fftSize = fftSize;
    this.frequencyData = new Uint8Array(this.analyzer.frequencyBinCount);
    this.timeData = new Uint8Array(this.analyzer.frequencyBinCount);
    this.prevFrequencyData = new Uint8Array(this.analyzer.frequencyBinCount);
    this.prevTimeData = new Uint8Array(this.analyzer.frequencyBinCount);
  }
  
  /**
   * スムージング係数を設定する
   * @param {number} value - スムージング係数 (0.0～1.0)
   */
  setSmoothingTimeConstant(value) {
    if (!this.isInitialized) return;
    this.smoothingTimeConstant = Math.max(0, Math.min(1, value));
    this.analyzer.smoothingTimeConstant = this.smoothingTimeConstant;
  }
  
  /**
   * 周波数帯域の範囲をカスタマイズする
   * @param {string} band - bands内の任意のキー
   * @param {number} min - 最小周波数 (Hz)
   * @param {number} max - 最大周波数 (Hz)
   */
  setBandRange(band, min, max) {
    if (this.bands[band]) {
      this.bands[band].min = min;
      this.bands[band].max = max;
    }
  }
  
  /**
   * エネルギー検出のしきい値を設定する
   * @param {string} type - thresholds内の任意のキー
   * @param {number} value - しきい値 (0.0～1.0)
   */
  setThreshold(type, value) {
    if (this.thresholds.hasOwnProperty(type)) {
      this.thresholds[type] = Math.max(0, Math.min(1, value));
    }
  }
  
  /**
   * 全てのエネルギー検出のしきい値を一度に設定する
   * @param {Object} thresholds - 各しきい値を含むオブジェクト
   */
  setAllThresholds(thresholds) {
    for (const type in thresholds) {
      if (this.thresholds.hasOwnProperty(type)) {
        this.thresholds[type] = Math.max(0, Math.min(1, thresholds[type]));
      }
    }
  }
  
  /**
   * ドラム検出間の最小間隔を設定（連続検出防止）
   * @param {number} milliseconds - ミリ秒
   */
  setMinTimeBetweenBeats(milliseconds) {
    this.drumDetection.minTimeBetweenBeats = Math.max(50, milliseconds);
  }
  
  /**
   * 現在のしきい値設定を取得する
   * @return {Object} 現在のしきい値設定
   */
  getThresholds() {
    return {...this.thresholds};
  }
  
  /**
   * 現在の周波数帯域設定を取得する
   * @return {Object} 現在の周波数帯域設定
   */
  getBands() {
    return {...this.bands};
  }
  
  /**
   * 現在の検出状態を取得する
   * @return {Object} 現在のドラム検出状態
   */
  getDrumDetectionState() {
    return {...this.drumDetection};
  }
}

// グローバル変数として公開
window.AudioAnalyzer = AudioAnalyzer;