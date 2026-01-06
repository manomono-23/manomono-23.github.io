let waveGlitches = [];
let isTerminalMode = false;

function setup() {
    let canvas = createCanvas(windowWidth, windowHeight);
    canvas.parent('p5-canvas-container');

    // アナログ波形グリッチを初期化
    for (let i = 0; i < 8; i++) {
        waveGlitches.push(new WaveGlitch());
    }
}

function draw() {
    clear();

    // ランダムにグリッチを発生させる（ジャ！っと瞬時に）
    if (random(1) < 0.03) {
        let wg = random(waveGlitches);
        wg.trigger();
    }

    for (let wg of waveGlitches) {
        wg.update();
        wg.display();
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}

// ターミナルモードの切り替え（外部から呼び出し可能）
function setTerminalMode(mode) {
    isTerminalMode = mode;
}

// アナログ波形グリッチクラス
class WaveGlitch {
    constructor() {
        this.active = false;
        this.y = 0;
        this.amplitude = 0;
        this.frequency = 0;
        this.life = 0;
        this.maxLife = 0;
        this.wavePoints = [];
        this.horizontalOffset = 0;
    }

    trigger() {
        this.active = true;
        this.y = random(height);
        this.amplitude = random(5, 30); // 波の振幅
        this.frequency = random(0.01, 0.05); // 波の周波数
        this.life = random(5, 15); // 短い寿命で瞬時に消える
        this.maxLife = this.life;
        this.horizontalOffset = random(-30, 30);

        // 波形のポイントを生成
        this.wavePoints = [];
        for (let x = 0; x < width + 50; x += 3) {
            this.wavePoints.push({
                x: x,
                noiseOffset: random(1000)
            });
        }
    }

    update() {
        if (this.active) {
            this.life--;
            if (this.life <= 0) {
                this.active = false;
            }
        }
    }

    display() {
        if (this.active) {
            push();

            // フェードアウト効果
            let fadeAlpha = map(this.life, 0, this.maxLife, 0, 1);

            // 色の設定
            let baseColor;
            if (isTerminalMode) {
                baseColor = color(0, 255, 65); // 緑
            } else {
                baseColor = color(0, 0, 0); // 黒
            }

            // 複数の波形を重ねて描画（アナログ感を出す）
            for (let layer = 0; layer < 3; layer++) {
                noFill();

                let alpha = fadeAlpha * (100 - layer * 20);
                baseColor.setAlpha(alpha);
                stroke(baseColor);
                strokeWeight(random(1, 3));

                beginShape();
                for (let point of this.wavePoints) {
                    let x = point.x + this.horizontalOffset;
                    let noiseVal = noise(point.noiseOffset + frameCount * 0.1);
                    let y = this.y + sin(point.x * this.frequency + layer) * this.amplitude * noiseVal;

                    // ランダムなジッター追加
                    y += random(-2, 2);

                    vertex(x, y);
                }
                endShape();

                // 横線のグリッチも追加
                if (random(1) < 0.3) {
                    baseColor.setAlpha(alpha * 0.5);
                    stroke(baseColor);
                    strokeWeight(random(0.5, 2));
                    let lineY = this.y + random(-this.amplitude, this.amplitude);
                    line(0, lineY, width, lineY);
                }
            }

            // 時々、矩形のノイズブロックを追加
            if (random(1) < 0.2) {
                baseColor.setAlpha(fadeAlpha * 80);
                fill(baseColor);
                noStroke();
                let blockX = random(width);
                let blockW = random(20, 100);
                let blockH = random(2, 8);
                rect(blockX, this.y + random(-this.amplitude, this.amplitude), blockW, blockH);
            }

            pop();
        }
    }
}
