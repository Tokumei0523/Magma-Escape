// --- 音量管理用の変数 (保存データがあれば読み込み、なければ0.5) ---
let bgmVolume = localStorage.getItem("bgmVolume") !== null ? Math.min(1.0, parseFloat(localStorage.getItem("bgmVolume"))) : 0.5;
let seVolume = localStorage.getItem("seVolume") !== null ? Math.min(1.0, parseFloat(localStorage.getItem("seVolume"))) : 0.5;

// スライダーの初期位置を保存された値に合わせる（DOM取得の後に実行）
window.addEventListener("DOMContentLoaded", () => {
    const bgmS = document.getElementById("bgmSlider");
    const seS = document.getElementById("seSlider");

    if (bgmS) bgmS.value = bgmVolume;
    if (seS) seS.value = seVolume;
    document.getElementById("bgmSlider").value = bgmVolume;
    document.getElementById("seSlider").value = seVolume;
    // 初期音量を適用
    updateBgmVolume(bgmVolume);
    updateSeVolume(seVolume);
});

//コンテキストメニューの禁止
window.addEventListener("contextmenu", (e) => {
    e.preventDefault();
}, false);


// タッチスクロール防止はCSSの touch-action で処理
// JavaScriptのpreventDefault()は使用しない（Chromiumで遅延が生じるため）




const sounds = {
    bgm: new Audio("sounds/bgm.mp3"),
    lavaLoop: new Audio("sounds/lava_loop.mp3"), // 迫ってくる音
    start: new Audio("sounds/start.wav"),
    stomp: new Audio("sounds/stomp.wav"),
    dash: new Audio("sounds/dash.wav"),
    click: new Audio("sounds/click.wav"),
    jump: new Audio("sounds/jump.wav"),
    coin: new Audio("sounds/coin.wav"),
    rare_coin: new Audio("sounds/rCoin.wav"),
    spring: new Audio("sounds/spring.wav"),
    death: new Audio("sounds/death.wav"), // ゲームオーバー用
    vent: new Audio("sounds/vent.wav")

};

sounds.lavaLoop.loop = true;
sounds.vent.loop = true;
sounds.bgm.loop = true;


// 音量を調整
for (let key in sounds) {
    sounds[key].volume = seVolume;
}

sounds.bgm.volume = seVolume * 0.05
sounds.click.volume = Math.min(1.0, seVolume * 2);


const settingsModal = document.getElementById("settingsModal");
const howToModal = document.getElementById("howToModal");

const openSettingsBtn = document.getElementById("openSettings");
const closeSettingsBtn = document.getElementById("closeSettings");

const openHowToBtn = document.getElementById("openHowTo");
const closeHowToBtn = document.getElementById("closeHowTo");

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const distEl = document.getElementById("dist");
const dashBar = document.getElementById("dashBar");
const msgEl = document.getElementById("msg");
const resetBtn = document.getElementById("resetBtn");

// タイトル画面用
const titleScreen = document.getElementById("titleScreen");
const startBtn = document.getElementById("startBtn");
const gameUI = document.getElementById("gameUI");

let score = 0;
let distance = 0;
// --- 自己ベストの読み込み (保存されていなければ0) ---
let highScore = localStorage.getItem("highScore") !== null ? parseInt(localStorage.getItem("highScore")) : 0;
let gameActive = true;
let gameStarted = false; // 追加：ゲームが開始されたか
let frameCount = 0;
let combo = 0;
let forceHighJump = false; // 次の足場を高くするためのフラグ

let lavaY = 750;
let baseLavaSpeed = 1.4;
const lavaAccel = 0.0001;

const startX = 100;
const gravity = 0.55;
const friction = 0.88;
const airAccel = 0.85;

let player = {
    x: startX, y: 300, width: 35, height: 35,
    speed: 7, velX: 0, velY: 0,
    jumpCount: 0, maxJumps: 2,
    canDash: true, isDashing: false, facing: "right",
    flashFrame: 0,
    onGround: false
};

let cameraX = player.x - 450;
let cameraY = player.y - 250;
const scrollSpeed = 0.1;

let platforms = [{ x: 0, y: 400, width: 800, height: 60, isMovingX: false, isMovingY: false }];
let hazards = []; let enemies = []; let coins = []; let springs = []; let particles = []; let popups = [];
let vents = [];
let fireballs = [];
let nextSpawnX = 800; let lastY = 400;

let mountains = [];
const mountainCount = 10;
const mountainResetWidth = 400;
for (let i = 0; i < mountainCount; i++) {
    mountains.push({ x: i * mountainResetWidth, y: 150 + Math.random() * 80, width: 300 + Math.random() * 200, height: 200 + Math.random() * 100, speedFactor: 0.15 });
}

let keys = {};

// --- モバイル検出 ---
const isMobile = () => window.innerWidth <= 1024 || window.innerHeight <= 600;

// --- 画面方向と サイズ調整 ---
function updateCanvasSize() {
    const container = document.getElementById("game-container");
    const canvas = document.getElementById("gameCanvas");

    if (isMobile()) {
        // モバイルモード（横向きのみ）
        let screenWidth = window.innerWidth;
        let screenHeight = window.innerHeight;

        // スマートフォンのアドレスバー・検索バーを考慮
        // visualViewport を使用可能な場合はそちらを優先
        if (window.visualViewport) {
            screenWidth = window.visualViewport.width;
            screenHeight = window.visualViewport.height;
        }

        const aspect = 1200 / 600; // 元のアスペクト比

        let newWidth, newHeight;
        if (screenWidth / screenHeight > aspect) {
            // 高さに合わせる
            newHeight = screenHeight;
            newWidth = newHeight * aspect;
        } else {
            // 幅に合わせる
            newWidth = screenWidth;
            newHeight = newWidth / aspect;
        }

        container.style.width = newWidth + "px";
        container.style.height = newHeight + "px";

        // canvas内部サイズは固定（1200x600）
        canvas.width = 1200;
        canvas.height = 600;

        // タッチコントロール表示（横向きの場合のみ）
        const isLandscape = screenWidth > screenHeight;
        if (isLandscape) {
            showTouchControls();
        } else {
            hideTouchControls();
        }
    } else {
        // デスクトップモード
        container.style.width = "1200px";
        container.style.height = "600px";
        canvas.width = 1200;
        canvas.height = 600;
        hideTouchControls();
    }
}

// --- タッチコントロール表示・非表示 ---
function showTouchControls() {
    const touchControls = document.getElementById("touchControls");
    if (touchControls) {
        touchControls.classList.add("active");
    }
}

function hideTouchControls() {
    const touchControls = document.getElementById("touchControls");
    if (touchControls) {
        touchControls.classList.remove("active");
    }
}

// --- 画面向きチェック（横向きのみ対応） ---
function checkOrientation() {
    const warning = document.getElementById("orientationWarning");
    if (!isMobile()) return;

    // 横向き（幅 > 高さ）チェック
    const isLandscape = window.innerWidth > window.innerHeight;
    if (!isLandscape) {
        // 縦向きの場合は警告表示
        warning.style.display = "flex";
        gameActive = false; // ゲーム停止
    } else {
        warning.style.display = "none";
        // 必要に応じてゲーム再開
    }
}

// 初期化時とリサイズ時に呼ぶ
window.addEventListener("load", () => {
    updateCanvasSize();
    checkOrientation();
});

window.addEventListener("resize", () => {
    updateCanvasSize();
    checkOrientation();
});

window.addEventListener("orientationchange", () => {
    setTimeout(() => {
        updateCanvasSize();
        checkOrientation();
    }, 100);
});


// --- 音量更新のロジック ---
function updateBgmVolume(vol) {
    bgmVolume = vol;
    sounds.bgm.volume = vol * 0.1;
    localStorage.setItem("bgmVolume", vol); // 保存！
}

function updateSeVolume(vol) {
    seVolume = vol;
    for (let key in sounds) {
        if (key !== "bgm") {
            sounds[key].volume = vol;

        }
    }
    localStorage.setItem("seVolume", vol); // 保存！
}

// --- スライダーのイベント ---
bgmSlider.addEventListener("input", (e) => {
    updateBgmVolume(parseFloat(e.target.value));
});

seSlider.addEventListener("input", (e) => {
    updateSeVolume(parseFloat(e.target.value));
    sounds.click.currentTime = 0;
    sounds.click.play();
});

// --- モーダル開閉のイベント ---
openSettingsBtn.addEventListener("click", () => {
    settingsModal.style.display = "flex";
    sounds.click.play();
});
closeSettingsBtn.addEventListener("click", () => {
    settingsModal.style.display = "none";
    sounds.click.play();
});

openHowToBtn.addEventListener("click", () => {
    howToModal.style.display = "flex";
    sounds.click.play();
});
closeHowToBtn.addEventListener("click", () => {
    howToModal.style.display = "none";
    sounds.click.play();
});

// --- モバイルタッチボタンのイベント処理 ---
const touchBtns = {
    left: document.getElementById("leftBtn"),
    right: document.getElementById("rightBtn"),
    jump: document.getElementById("jumpBtn"),
    dash: document.getElementById("dashBtn")
};

// ジャンプボタン
if (touchBtns.jump) {
    const jumpAction = () => {
        if (!gameStarted && gameActive === false) {
            startGame();
            return;
        }
        if (!gameActive) return;

        // ジャンプ処理
        if (player.onGround || player.jumpCount < player.maxJumps) {
            sounds.jump.currentTime = 0;
            sounds.jump.play();
            player.velY = -12.5;
            player.jumpCount++;
            if (player.jumpCount === 2) {
                for (let i = 0; i < 15; i++) {
                    particles.push({
                        x: player.x + player.width / 2,
                        y: player.y + player.height,
                        vx: (Math.random() - 0.5) * 12,
                        vy: Math.random() * 3,
                        life: 1.0,
                        color: "rgba(255, 255, 255, 0.8)",
                        size: Math.random() * 8 + 2,
                        isWind: true
                    });
                }
            }
        }
    };

    touchBtns.jump.addEventListener("pointerdown", jumpAction);
}

// ダッシュボタン
if (touchBtns.dash) {
    const dashAction = () => {
        if (!gameActive) return;

        // ダッシュ処理
        if (player.canDash) {
            sounds.dash.currentTime = 0;
            sounds.dash.play();
            player.isDashing = true;
            player.canDash = false;
            player.velX = (player.facing === "right" ? 1 : -1) * 22;
            player.velY = -1.5;

            for (let i = 0; i < 20; i++) {
                particles.push({
                    x: player.x + player.width / 2,
                    y: player.y + player.height / 2,
                    vx: (player.facing === "right" ? -1 : 1) * (Math.random() * 12 + 4),
                    vy: (Math.random() - 0.5) * 10,
                    life: 1.0,
                    color: "#00ffcc",
                    size: Math.random() * 6 + 2,
                    isWind: false
                });
            }

            dashBar.style.transition = "none";
            dashBar.style.width = "0%";
            dashBar.style.background = "#ff3e3e";

            // ダッシュの持続時間を制限（150ms後にfalseに）
            setTimeout(() => { player.isDashing = false; }, 150);
            setTimeout(() => {
                dashBar.style.transition = "width 0.8s linear";
                dashBar.style.width = "100%";
            }, 10);
            // ダッシュのクールタイムをリセット（800ms後にcanDashをtrueに）
            setTimeout(() => {
                player.canDash = true;
                if (gameActive) {
                    dashBar.style.background = "#00ffcc";
                    dashBar.style.boxShadow = "0 0 10px #00ffcc";
                }
            }, 800);
        }
    };

    touchBtns.dash.addEventListener("pointerdown", dashAction);
    touchBtns.dash.addEventListener("pointerup", () => {});
}

// 移動ボタン（キーボードと同じ方式）
if (touchBtns.left) {
    touchBtns.left.addEventListener("pointerdown", () => { keys["ArrowLeft"] = true; keys["A"] = true; });
    touchBtns.left.addEventListener("pointerup", () => { keys["ArrowLeft"] = false; keys["A"] = false; });
}

if (touchBtns.right) {
    touchBtns.right.addEventListener("pointerdown", () => { keys["ArrowRight"] = true; keys["D"] = true; });
    touchBtns.right.addEventListener("pointerup", () => { keys["ArrowRight"] = false; keys["D"] = false; });
}

function resetGame() {
    // ゲーム状態のリセット
    score = 0;
    distance = 0;
    gameActive = true;
    frameCount = 0;
    combo = 0;
    forceHighJump = false;

    lavaY = 750;
    baseLavaSpeed = 1.4;

    player = {
        x: startX, y: 300, width: 35, height: 35,
        speed: 7, velX: 0, velY: 0,
        jumpCount: 0, maxJumps: 2,
        canDash: true, isDashing: false, facing: "right",
        flashFrame: 0,
        onGround: false
    };

    cameraX = player.x - 450;
    cameraY = player.y - 250;

    platforms = [{ x: 0, y: 400, width: 800, height: 60, isMovingX: false, isMovingY: false }];
    hazards = []; enemies = []; coins = []; springs = []; particles = []; popups = [];
    vents = [];
    fireballs = [];
    nextSpawnX = 800; lastY = 400;
    keys = {};

    // UIのリセット
    msgEl.style.display = "none";
    scoreEl.innerText = 0;
    distEl.innerText = 0;
    dashBar.style.transition = "none";
    dashBar.style.width = "100%";
    dashBar.style.background = "#00ffcc";
    dashBar.style.boxShadow = "0 0 10px #00ffcc";

    // サウンドのリセット
    sounds.bgm.currentTime = 0;
    sounds.bgm.play();
    sounds.lavaLoop.currentTime = 0;
}

function goToTitle() {
    // ゲームを停止してタイトルに戻る
    gameActive = false;
    gameStarted = false;

    // サウンド停止
    sounds.bgm.pause();
    sounds.bgm.currentTime = 0;
    sounds.lavaLoop.pause();
    sounds.lavaLoop.currentTime = 0;
    sounds.vent.pause();
    sounds.vent.currentTime = 0;

    // UIの切り替え
    msgEl.style.display = "none";
    gameUI.style.display = "none";
    titleScreen.style.display = "flex";
}

resetBtn.addEventListener("click", resetGame);

// ゲーム開始関数
function startGame() {
    if (gameStarted) return;
    gameStarted = true;

    // タイトルから（再）スタート時に状態をリセット
    score = 0;
    distance = 0;
    gameActive = true;
    frameCount = 0;
    combo = 0;
    forceHighJump = false;
    lavaY = 750;
    baseLavaSpeed = 1.4;
    player = {
        x: startX, y: 300, width: 35, height: 35,
        speed: 7, velX: 0, velY: 0,
        jumpCount: 0, maxJumps: 2,
        canDash: true, isDashing: false, facing: "right",
        flashFrame: 0,
        onGround: false
    };
    cameraX = player.x - 450;
    cameraY = player.y - 250;
    platforms = [{ x: 0, y: 400, width: 800, height: 60, isMovingX: false, isMovingY: false }];
    hazards = []; enemies = []; coins = []; springs = []; particles = []; popups = [];
    vents = []; fireballs = [];
    nextSpawnX = 800; lastY = 400;
    keys = {};
    scoreEl.innerText = 0;
    distEl.innerText = 0;
    dashBar.style.transition = "none";
    dashBar.style.width = "100%";
    dashBar.style.background = "#00ffcc";
    dashBar.style.boxShadow = "0 0 10px #00ffcc";

    sounds.bgm.play();
    sounds.start.play();
    titleScreen.style.display = "none";
    gameUI.style.display = "block";
    update(); // ここでループを開始
}

startBtn.addEventListener("click", startGame);

window.addEventListener("keydown", (e) => {
    if (e.code === "Escape") {
        if (gameStarted) { goToTitle(); return; }
    }
    if (e.code === "KeyR") {
        if (gameStarted) { resetGame(); return; } // ゲーム中のみリスタート
        return;
    }
    if (!gameStarted && e.code === "Space") { startGame(); return; } // タイトルでスペース押しでも開始
    if (!gameActive) return;

    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        if (player.onGround || player.jumpCount < player.maxJumps) {
            sounds.jump.currentTime = 0;
            sounds.jump.play();
            player.velY = -12.5;
            player.jumpCount++;
            if (player.jumpCount === 2) {
                for (let i = 0; i < 15; i++) particles.push({ x: player.x + player.width / 2, y: player.y + player.height, vx: (Math.random() - 0.5) * 12, vy: Math.random() * 3, life: 1.0, color: "rgba(255, 255, 255, 0.8)", size: Math.random() * 8 + 2, isWind: true });
            }
        }
    }
    if ((e.code === "ShiftLeft") && player.canDash) {
        sounds.dash.currentTime = 0;
        sounds.dash.play();
        player.canDash = false;
        player.isDashing = true;
        player.velY = -1.5;
        player.velX = player.facing === "right" ? 22 : -22;

        for (let i = 0; i < 20; i++) {
            particles.push({
                x: player.x + player.width / 2,
                y: player.y + player.height / 2,
                vx: (player.facing === "right" ? -1 : 1) * (Math.random() * 12 + 4),
                vy: (Math.random() - 0.5) * 10,
                life: 1.0,
                color: "#00ffcc",
                size: Math.random() * 6 + 2,
                isWind: false
            });
        }

        dashBar.style.transition = "none";
        dashBar.style.width = "0%";
        dashBar.style.background = "#ff3e3e";

        setTimeout(() => { player.isDashing = false; }, 150);
        setTimeout(() => {
            dashBar.style.transition = "width 0.8s linear";
            dashBar.style.width = "100%";
        }, 10);
        setTimeout(() => {
            player.canDash = true;
            if (gameActive) {
                dashBar.style.background = "#00ffcc";
                dashBar.style.boxShadow = "0 0 10px #00ffcc";
            }
        }, 800);
    }
    keys[e.code] = true;
});

window.addEventListener("keyup", (e) => { keys[e.code] = false; });

function drawRoundRect(x, y, w, h, r, fill = true, stroke = false) {
    if (w < 2 * r) r = w / 2; if (h < 2 * r) r = h / 2;
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    if (fill) ctx.fill(); if (stroke) ctx.stroke();
}

function addPopup(x, y, text, color = "#fff", size = 24) { popups.push({ x: x, y: y, text: text, color: color, life: 1.0, size: size }); }
function createParticles(x, y, color, count, speedRange) { for (let i = 0; i < count; i++) particles.push({ x: x, y: y, vx: (Math.random() - 0.5) * speedRange, vy: (Math.random() - 0.5) * speedRange, life: 1.0, color: color, size: Math.random() * 5 + 1 }); }

function spawnChunk() {
    let gap = 100 + Math.random() * 150;
    let randMove = Math.random();
    let isMovingX = randMove < 0.12;
    let isMovingY = randMove >= 0.12 && randMove < 0.24;

    // 左右移動床はgapを広めに取って隣の床に潜り込まないようにする
    if (isMovingX) gap = 300 + Math.random() * 150;

    let width = (isMovingX || isMovingY) ? (100 + Math.random() * 20) : (200 + Math.random() * 250);

    let rise;
    if (forceHighJump) {
        // バネ・気流の後は確定で高い位置（300〜400px上）に配置
        rise = 200 + Math.random() * 100;
        forceHighJump = false; // フラグをリセット
    } else {
        // 通常時の高さ決定（以前のロジック）
        let randRise = Math.random();
        if (randRise < 0.7) rise = 80 + Math.random() * 70;
        else rise = Math.random() * 80;
    }

    let y = lastY - rise;

    if (isMovingY) {
        y -= 100;
        forceHighJump = true;
    }

    // 左右移動床の可動範囲：gap の半分を超えないよう制限
    const movingYRange = 30 + Math.random() * 20;
    const movingXRange = isMovingX ? Math.min(100 + Math.random() * 60, (gap - width) * 0.45) : 150 + Math.random() * 100;

    const spawnOffsetX = isMovingX ? -100 : 0;

    let newPlatform = {
        x: nextSpawnX + gap + spawnOffsetX,
        y: y,
        width: width,
        height: 30,
        isMovingX: isMovingX,
        isMovingY: isMovingY,
        velX: isMovingX ? (Math.random() < 0.5 ? 2.5 : -2.5) : 0,
        velY: isMovingY ? (Math.random() < 0.5 ? 3 : -3) : 0,
        startX: nextSpawnX + gap + spawnOffsetX,
        startY: y,
        range: movingXRange
    };

    platforms.push(newPlatform);


    if (!isMovingX && !isMovingY) {
        let rand = Math.random();

        // 座標の定義を整理
        const centerSideX = newPlatform.x + (width / 2) - 25; // 真ん中（トゲ用）
        const rightSideX = newPlatform.x + width - 45;      // 右端（バネ・気流用）
        const enemyX = newPlatform.x + 20;                   // 左寄りの敵配置用

        if (rand < 0.2) {
            // ★トゲ（ハザード）は「真ん中」に配置
            hazards.push({ x: centerSideX, y: y - 10, width: 50, height: 10 });
        } else if (rand < 0.4) {
            // 敵（パトロール）は左から中央にかけて動くように調整
            enemies.push({ x: enemyX, y: y - 30, width: 30, height: 30, type: "patrol", speed: 2, minX: newPlatform.x, maxX: newPlatform.x + width - 30 });
        } else if (rand < 0.55) {
            // ドローン敵
            enemies.push({ x: centerSideX, startY: y - 100, y: y - 100, width: 30, height: 30, type: "drone", offset: Math.random() * Math.PI * 2 });
        } else if (rand < 0.7) {
            // ★バネは「右側」に配置
            springs.push({ x: rightSideX, y: y - 25, width: 40, height: 25 });
            forceHighJump = true;
        } else if (rand < 0.9) {
            // ★上昇気流（ベント）も「右側」に配置
            vents.push({ x: rightSideX - 10, y: y - 200, width: 60, height: 200 });
            forceHighJump = true;
        }
    }

    if (Math.random() < 0.5) {
        let isRare = Math.random() < 0.2;
        coins.push({ x: newPlatform.x + width / 2 - 12, y: y - (isRare ? 120 : 120), collected: false, isRare: isRare, angle: Math.random() * Math.PI * 2 });
    }
    nextSpawnX += gap + width; lastY = y;
}

function gameOver() {
    if (!gameActive) return;
    gameActive = false;
    sounds.bgm.pause();
    sounds.bgm.currentTime = 0; // 次回リスタート時に最初から流れるようにする
    sounds.death.currentTime = 0;
    sounds.death.play();
    createParticles(player.x + 17, player.y + 17, "#ff1744", 40, 15);

    const finalTotalScore = score + (distance * 10);
    document.getElementById("finalScore").innerText = finalTotalScore;

    // --- 自己ベストの更新判定 ---
    if (finalTotalScore > highScore) {
        highScore = finalTotalScore;
        localStorage.setItem("highScore", highScore); // ブラウザに保存
        addPopup(player.x, player.y - 50, "NEW RECORD!", "#ffeb3b", 40); // 画面に通知
    }

    document.getElementById("highScoreEl").innerText = highScore;

    const statusText = document.querySelector("#msg h1");
    statusText.innerText = "GAME OVER!";
    statusText.style.color = "#ff1744";
    msgEl.style.display = "block";
    dashBar.style.background = "#555";
}

function isCollide(a, b) { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }

// フレームレート制御用変数
let lastFrameTime = 0;
const FRAME_TIME = 1000 / 60; // 60FPS固定

function update(currentTime) {
    // フレームレート制御（60FPSに統一）
    if (lastFrameTime === 0) lastFrameTime = currentTime;
    const deltaTime = currentTime - lastFrameTime;
    
    // 遅延の少ない単純なフレーム判定：15ms以上経過なら処理
    if (deltaTime < 15) {
        requestAnimationFrame(update);
        return;
    }
    
    lastFrameTime = currentTime;
    frameCount++;


    if (frameCount % 10 === 0 && gameActive) {
        // プレイヤーとマグマの距離を計算
        let distToLava = lavaY - (player.y + player.height);

        // 距離が 500px 以内なら音を鳴らし、近いほど大きくする
        // 500px以上離れたら音量は 0
        let vol = Math.max(0, 1 - (distToLava / 500));
        sounds.lavaLoop.volume = vol * seVolume * 0.2; // 全体音量50%に合わせるなら * 0.5

        if (sounds.lavaLoop.paused) {
            sounds.lavaLoop.play();
        }
    } else if(!gameActive){
        sounds.lavaLoop.pause(); // ゲームオーバー時は止める
    }

    if (!gameActive) {
        updateParticles(); updatePopups(); draw();
        if (gameStarted) requestAnimationFrame(update); // タイトルに戻った場合はループ停止
        return;
    }
    if (player.flashFrame > 0) player.flashFrame--;

    let wasOnGround = player.onGround;
    player.onGround = false;

    if (frameCount % 180 === 0) {
        fireballs.push({
            x: cameraX + Math.random() * canvas.width,
            y: lavaY,
            width: 25, height: 25,
            velY: -8 - Math.random() * 4,
            active: true
        });
    }

    for (let i = fireballs.length - 1; i >= 0; i--) {
        let f = fireballs[i];
        f.velY += gravity * 0.3;
        f.y += f.velY;
        if (isCollide(player, f)) gameOver();
        if (f.y > lavaY + 150) fireballs.splice(i, 1);
    }

    platforms.forEach(p => {
        if (p.isMovingX) {
            p.x += p.velX;
            if (Math.abs(p.x - p.startX) > p.range)
                p.velX *= -1;
        }
        if (p.isMovingY) {
            p.y += p.velY;
            if (Math.abs(p.y - p.startY) > p.range)
                p.velY *= -1;
        }
    });

    let isInVent = false;
    vents.forEach(v => {
        if (frameCount % 4 === 0) {
            particles.push({ x: v.x + Math.random() * v.width, y: v.y + v.height, vx: (Math.random() - 0.5) * 0.5, vy: -Math.random() * 4 - 2, life: 1.0, color: "rgba(255, 255, 255, 0.4)", size: Math.random() * 4 + 2, isWind: true });
        }
        if (isCollide(player, v)) {
            player.velY -= 1.5; if (player.velY < -10) player.velY = -10;
            if (player.velY > 0) {
                player.jumpCount = 1; // 落下中ならジャンプ回数をリセットして、気流から飛び出せるようにする
            }
            isInVent = true;
        }
    });

    // --- 音の制御 ---
    if (isInVent && gameActive) {
        if (sounds.vent.paused) {
            sounds.vent.play(); // 鳴っていなければ再生
        }
    } else {
        sounds.vent.pause(); // 離れたら一時停止
        sounds.vent.currentTime = 0; // 次回のために再生位置を戻す
    }

    if (!player.isDashing) {
        let accel = player.jumpCount > 0 ? airAccel : 1.0;
        if (keys["ArrowRight"] || keys["d"] || keys["KeyD"]) { player.velX += accel; player.facing = "right"; }
        if (keys["ArrowLeft"] || keys["a"] || keys["KeyA"]) { player.velX -= accel; player.facing = "left"; }
        player.velX *= friction; player.velY += gravity;
    }

    player.x += player.velX;
    platforms.forEach(p => {
        if (isCollide(player, p)) {
            if (player.velX > 0 && player.x < p.x) player.x = p.x - player.width;
            else if (player.velX < 0 && player.x > p.x) player.x = p.x + p.width;
        }
    });

    player.y += player.velY;
    platforms.forEach(p => {
        if (isCollide(player, p)) {
            if (player.velY >= 0 && player.y + player.height < p.y + 25) {
                player.jumpCount = 0; player.y = p.y - player.height; player.velY = 0; player.onGround = true;
                combo = 0; if (p.isMovingX) player.x += p.velX; if (p.isMovingY) player.y += p.velY;
            } else if (player.velY < 0 && player.y > p.y + p.height - 20) {
                player.y = p.y + p.height; player.velY = 0;
            }
        }
    });

    if (wasOnGround && !player.onGround && player.velY > 0 && player.jumpCount === 0) {
        player.jumpCount = 1;
    }

    hazards.forEach(h => { if (isCollide(player, h)) gameOver(); });

    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        if (e.type === "patrol") { e.x += e.speed; if (e.x <= e.minX || e.x >= e.maxX) e.speed *= -1; }
        else { e.y = e.startY + Math.sin(frameCount * 0.05 + e.offset) * 40; }
        if (isCollide(player, e)) {
            if (player.velY > 0 && player.y + player.height < e.y + e.height * 0.6) {
                sounds.stomp.currentTime = 0;
                sounds.stomp.play();
                player.velY = -10; player.jumpCount = 1; player.flashFrame = 8;
                combo++; let comboScore = 200 * combo; score += comboScore;
                addPopup(e.x, e.y, (combo > 1 ? combo + " COMBO! " : "") + "+" + comboScore, `hsl(${(combo * 40) % 360}, 100%, 70%)`, 24 + combo * 4);
                createParticles(e.x + 15, e.y + 15, "#ffeb3b", 15, 8); enemies.splice(i, 1);
            } else if (player.isDashing) {
                sounds.stomp.currentTime = 0;
                sounds.stomp.play();
                combo++;
                let comboScore = 200 * combo;
                score += comboScore;
                addPopup(e.x, e.y, (combo > 1 ? combo + " COMBO! " : "") + "+" + comboScore, `hsl(${(combo * 40) % 360}, 100%, 70%)`, 24 + combo * 4);
                createParticles(e.x + 15, e.y + 15, "#ffeb3b", 15, 8);
                enemies.splice(i, 1);
            } else if (!player.isDashing) {
                gameOver();
            }
        }
    }

    springs.forEach(s => {
        if (isCollide(player, s)) {
            sounds.spring.currentTime = 0;
            sounds.spring.play();
            player.velY = -18; player.jumpCount = 1; player.flashFrame = 8; createParticles(s.x + 20, s.y, "#00ffcc", 10, 4);
        }
    });
    coins.forEach(c => {
        if (!c.collected) {
            c.angle += 0.08; if (isCollide(player, { x: c.x, y: c.y, width: 25, height: 25 })) {
                c.collected = true; let pts = c.isRare ? 1000 : 100;
                score += pts;
                if (c.isRare) {
                    sounds.rare_coin.currentTime = 0;
                    sounds.rare_coin.play();
                } else {
                    sounds.coin.currentTime = 0;
                    sounds.coin.play();
                }
                addPopup(c.x, c.y, "+" + pts, c.isRare ? "#00ffff" : "#ffd700");
                createParticles(c.x + 12, c.y + 12, c.isRare ? "#00ffff" : "#FFD700", 12, 4);
            }
        }
    });

    if (frameCount % 8 === 0) particles.push({ x: cameraX + Math.random() * canvas.width, y: cameraY + canvas.height, vx: (Math.random() - 0.5) * 1, vy: -Math.random() * 2 - 1, life: 1.0, color: "#ff5722", size: Math.random() * 6 + 2, isHeat: true });
    updateParticles(); updatePopups();
    let currentHeight = Math.floor((300 - player.y) / 20);
    distance = Math.max(distance, currentHeight);
    scoreEl.innerText = score; distEl.innerText = distance;
    cameraX += (player.x - 450 - cameraX) * scrollSpeed; cameraY += (player.y - 250 - cameraY) * scrollSpeed;
    if (player.x + 1200 > nextSpawnX) spawnChunk();

    lavaY -= (lavaY - (player.y + player.height) < 200) ? baseLavaSpeed * 0.4 : (lavaY - (player.y + player.height) > 600 ? baseLavaSpeed * 12 : baseLavaSpeed);
    baseLavaSpeed += lavaAccel; if (player.y + player.height > lavaY) gameOver();
    draw(); requestAnimationFrame(update);
}

function updateParticles() { for (let i = particles.length - 1; i >= 0; i--) { let p = particles[i]; p.x += p.vx; p.y += p.vy; p.life -= (p.isWind ? 0.03 : p.isHeat ? 0.01 : 0.025); if (p.life <= 0) particles.splice(i, 1); } }
function updatePopups() { for (let i = popups.length - 1; i >= 0; i--) { popups[i].y -= 1.5; popups[i].life -= 0.02; if (popups[i].life <= 0) popups.splice(i, 1); } }

// ドット風描画ヘルパー：8x8グリッドに沿って矩形を描く
function pixelRect(x, y, w, h, color) {
    const S = 4; // ドットサイズ
    ctx.fillStyle = color;
    const px = Math.floor(x / S) * S;
    const py = Math.floor(y / S) * S;
    const pw = Math.ceil(w / S) * S;
    const ph = Math.ceil(h / S) * S;
    ctx.fillRect(px, py, pw, ph);
}

// ドット風ピクセルフォント（ポップアップ用）
function pixelText(text, x, y, color, size) {
    ctx.fillStyle = color;
    ctx.font = `bold ${size}px "Courier New", monospace`;
    ctx.fillText(text, x, y);
}

function draw() {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- 背景：ドット山シルエット ---
    ctx.globalAlpha = 0.55;
    mountains.forEach(m => {
        let mX = m.x - (cameraX * m.speedFactor);
        const loopW = mountainCount * mountainResetWidth;
        if (mX < -500) m.x += loopW;
        const S = 8;
        const steps = Math.ceil(m.width / S);
        ctx.fillStyle = "#1a0a05";
        for (let i = 0; i < steps; i++) {
            // 三角形をブロック状にステップ近似
            const t = i / steps;
            const peakT = 0.5;
            const normT = Math.abs(t - peakT) / peakT;
            const colH = Math.floor((m.height * (1 - normT * normT)) / S) * S;
            ctx.fillRect(Math.floor((mX + i * S) / S) * S, Math.floor(m.y / S) * S, S, colH);
        }
    });
    ctx.globalAlpha = 1.0;

    // --- 背景オーバーレイ ---
    ctx.fillStyle = "rgba(255, 60, 0, 0.10)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-Math.floor(cameraX), -Math.floor(cameraY));

    // --- ベント（上昇気流）---
    vents.forEach(v => {
        const S = 4;
        // ベント本体（ダーク）
        ctx.fillStyle = "#221100";
        ctx.fillRect(Math.floor(v.x / S) * S, Math.floor((v.y + v.height - 10) / S) * S, Math.ceil(v.width / S) * S, S * 3);
        // ベント口（オレンジ）
        ctx.fillStyle = "#ff5722";
        ctx.fillRect(Math.floor((v.x + 5) / S) * S, Math.floor((v.y + v.height - 15) / S) * S, Math.ceil((v.width - 10) / S) * S, S);
    });

    // --- 足場（ドット風ブロック）---
    platforms.forEach(p => {
        const S = 4;
        const px = Math.floor(p.x / S) * S;
        const py = Math.floor(p.y / S) * S;
        const pw = Math.ceil(p.width / S) * S;
        const ph = Math.ceil(p.height / S) * S;

        // --- 動く床の可動範囲を表示 ---
        if (p.isMovingX) {
            const railY = py + ph / 2;
            const rangeLeft = Math.floor((p.startX - p.range) / S) * S;
            const rangeRight = Math.floor((p.startX + p.range + pw) / S) * S;
            const rangeW = rangeRight - rangeLeft;

            // レール本体（半透明ライン）
            ctx.globalAlpha = 0.22;
            ctx.fillStyle = "#ff5722";
            ctx.fillRect(rangeLeft, railY - S, rangeW, S * 2);

            // ドット点線（レール上）
            ctx.fillStyle = "#ffaa44";
            for (let dx = rangeLeft + S * 4; dx < rangeRight - S * 4; dx += S * 6) {
                ctx.fillRect(dx, railY - S / 2, S * 3, S);
            }
            ctx.globalAlpha = 1.0;
        }

        if (p.isMovingY) {
            const railX = px + pw / 2;
            const rangeTop = Math.floor((p.startY - p.range) / S) * S;
            const rangeBottom = Math.floor((p.startY + p.range + ph) / S) * S;
            const rangeH = rangeBottom - rangeTop;

            // レール本体（半透明ライン）
            ctx.globalAlpha = 0.22;
            ctx.fillStyle = "#ff9800";
            ctx.fillRect(railX - S, rangeTop, S * 2, rangeH);

            // ドット点線（レール上）
            ctx.fillStyle = "#ffdd88";
            for (let dy = rangeTop + S * 4; dy < rangeBottom - S * 4; dy += S * 6) {
                ctx.fillRect(railX - S / 2, dy, S, S * 3);
            }
            ctx.globalAlpha = 1.0;
        }

        if (p.isMovingX || p.isMovingY) {
            ctx.fillStyle = p.isMovingY ? "#ff9800" : "#ff5722";
            ctx.fillRect(px, py, pw, ph);
            // ハイライト上辺
            ctx.fillStyle = "#ffcc80";
            ctx.fillRect(px, py, pw, S);
            // ドット模様（クリッピングして溢れ防止）
            ctx.fillStyle = "rgba(255,255,255,0.25)";
            const dotCount = Math.floor((pw - S * 4) / (S * 8));
            for (let i = 0; i < dotCount; i++) {
                const dotX = px + S * 2 + i * S * 8;
                if (dotX + S * 2 <= px + pw) {
                    ctx.fillRect(dotX, py + S * 2, S * 2, S * 2);
                }
            }
            // 枠線（ドット）
            ctx.fillStyle = "#ff9800";
            ctx.fillRect(px, py, pw, S);
            ctx.fillRect(px, py + ph - S, pw, S);
            ctx.fillRect(px, py, S, ph);
            ctx.fillRect(px + pw - S, py, S, ph);
            // 下辺オレンジライン
            ctx.fillStyle = "#ffcc00";
            ctx.fillRect(px, py + ph, pw, S);
        } else {
            // 通常足場：石ブロック風
            ctx.fillStyle = "#3d2a2a";
            ctx.fillRect(px, py, pw, ph);
            // 上面ハイライト
            ctx.fillStyle = "#5a3d3d";
            ctx.fillRect(px, py, pw, S);
            // ブロック目地
            ctx.fillStyle = "#2a1a1a";
            const blockW = S * 8;
            for (let bx = px; bx < px + pw; bx += blockW) {
                ctx.fillRect(bx, py, S, ph);
            }
            for (let by = py; by < py + ph; by += S * 4) {
                ctx.fillRect(px, by, pw, S);
            }
            // ドット飾り
            ctx.fillStyle = "#4a3535";
            for (let i = 0; i < (pw - S * 4) / (S * 8); i++) {
                ctx.fillRect(px + S * 4 + i * S * 8, py + S * 2, S * 2, S * 2);
            }
            // 枠
            ctx.fillStyle = "#ff8c00";
            ctx.fillRect(px, py, pw, S);
            ctx.fillRect(px, py, S, ph);
            ctx.fillRect(px + pw - S, py, S, ph);
            // 下辺オレンジライン
            ctx.fillStyle = "#ff8c00";
            ctx.fillRect(px, py + ph, pw, S);
        }
    });

    // --- ファイアボール（ドット風）---
    fireballs.forEach(f => {
        const S = 4;
        const cx = Math.floor((f.x + 12) / S) * S;
        const cy = Math.floor((f.y + 12) / S) * S;
        // 外炎
        ctx.fillStyle = "#ff5722";
        ctx.fillRect(cx - S * 3, cy - S * 3, S * 6, S * 6);
        // 中炎
        ctx.fillStyle = "#ffeb3b";
        ctx.fillRect(cx - S * 2, cy - S * 2, S * 4, S * 4);
        // 芯
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(cx - S, cy - S, S * 2, S * 2);
        if (frameCount % 3 === 0) particles.push({ x: f.x + 12, y: f.y + 12, vx: (Math.random() - 0.5) * 1.5, vy: 1, life: 0.6, color: "#ff9100", size: 6 });
    });

    // --- ハザード（トゲ：ドット風ピクセル三角）---
    hazards.forEach(h => {
        const S = 4;
        const spikeCount = Math.floor(h.width / (S * 3));
        for (let i = 0; i < spikeCount; i++) {
            const sx = h.x + i * S * 3;
            // ピクセル三角（ステップ状）
            for (let row = 0; row < 3; row++) {
                const rowW = (3 - row) * S;
                const rowX = sx + (i % 2 === 0 ? row : 0) * S / 2;
                ctx.fillStyle = row === 0 ? "#b71c1c" : row === 1 ? "#e53935" : "#ff5252";
                ctx.fillRect(Math.floor(sx / S) * S + row * S, h.y + (2 - row) * S, S * (3 - row * 0.5 | 0), S);
            }
            // 先端光
            ctx.fillStyle = "#ffcdd2";
            ctx.fillRect(Math.floor(sx / S) * S + S * 2, h.y, S, S);
        }
    });

    // --- 敵（ドット風スプライト）---
    enemies.forEach(e => {
        const S = 4;
        const ex = Math.floor(e.x / S) * S;
        const ey = Math.floor(e.y / S) * S;
        if (e.type === "patrol") {
            // ボディ
            ctx.fillStyle = "#7b1fa2";
            ctx.fillRect(ex, ey + S, S * 7, S * 5);
            // 頭
            ctx.fillStyle = "#9c27b0";
            ctx.fillRect(ex + S, ey, S * 5, S * 3);
            // 目
            ctx.fillStyle = "#ffeb3b";
            const eyeOffX = e.speed > 0 ? S * 4 : S;
            ctx.fillRect(ex + eyeOffX, ey + S, S * 2, S * 2);
            // 足
            ctx.fillStyle = "#6a1b9a";
            ctx.fillRect(ex + S, ey + S * 6, S * 2, S);
            ctx.fillRect(ex + S * 4, ey + S * 6, S * 2, S);
        } else {
            // ドローン：点滅するドット円形
            const pulse = Math.floor(Math.sin(frameCount * 0.1) * 2);
            ctx.fillStyle = "#c62828";
            ctx.fillRect(ex + S, ey, S * 5, S * 7);
            ctx.fillRect(ex, ey + S, S * 7, S * 5);
            ctx.fillStyle = "#ff5252";
            ctx.fillRect(ex + S * 2, ey + S, S * 3, S * 5);
            ctx.fillRect(ex + S, ey + S * 2, S * 5, S * 3);
            // 目（中央）
            ctx.fillStyle = "#ffcdd2";
            ctx.fillRect(ex + S * 3, ey + S * 3, S, S);
            // 外リング（ドット）
            ctx.fillStyle = "rgba(255,82,82,0.5)";
            ctx.fillRect(ex - S + pulse, ey + S * 3, S * 2, S);
            ctx.fillRect(ex + S * 6 - pulse, ey + S * 3, S * 2, S);
            ctx.fillRect(ex + S * 3, ey - S + pulse, S, S * 2);
            ctx.fillRect(ex + S * 3, ey + S * 6 - pulse, S, S * 2);
        }
    });

    // --- バネ（ドット風）---
    springs.forEach(s => {
        const S = 4;
        const sx = Math.floor(s.x / S) * S;
        const sy = Math.floor(s.y / S) * S;
        // ベース
        ctx.fillStyle = "#555";
        ctx.fillRect(sx, sy + s.height - S * 2, Math.ceil(s.width / S) * S, S * 2);
        // コイル（交互パターン）
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = i % 2 === 0 ? "#cccccc" : "#888888";
            const offset = i % 2 === 0 ? 0 : S;
            ctx.fillRect(sx + offset, sy + i * S * 2, Math.ceil(s.width / S) * S - offset, S);
        }
        // 先端
        ctx.fillStyle = "#00e5cc";
        ctx.fillRect(sx + S, sy, Math.ceil(s.width / S) * S - S * 2, S * 2);
    });

    // --- コイン（ドット風：特大・カクカク回転版）---
    coins.forEach(c => {
        if (!c.collected) {
            const S = 4; // ドットサイズ
            const cx = Math.floor(c.x / S) * S;
            const cy = Math.floor(c.y / S) * S;

            // 回転を4段階（0.25, 0.5, 0.75, 1.0）に制限してパタパタさせる
            const flicker = Math.ceil(Math.abs(Math.cos(c.angle)) * 4) / 4;

            // 通常コイン (6x6) - 前回のレア相当の大きさ
            const normalPattern = [
                [0, 0, 1, 1, 0, 0],
                [0, 1, 1, 1, 1, 0],
                [1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 2, 2],
                [0, 1, 1, 2, 2, 0],
                [0, 0, 2, 2, 0, 0]
            ];

            // レアコイン (10x10) - 圧倒的な存在感
            const rarePattern = [
                [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
                [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
                [0, 1, 1, 1, 3, 3, 1, 1, 1, 0],
                [1, 1, 1, 3, 3, 3, 3, 1, 1, 1],
                [1, 1, 1, 3, 3, 3, 3, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 2, 2],
                [1, 1, 1, 1, 1, 1, 1, 2, 2, 2],
                [0, 1, 1, 1, 1, 1, 2, 2, 2, 0],
                [0, 0, 1, 1, 1, 2, 2, 2, 0, 0],
                [0, 0, 0, 2, 2, 2, 2, 0, 0, 0]
            ];

            const pattern = c.isRare ? rarePattern : normalPattern;
            const pSize = pattern.length;

            ctx.save();
            // 中心座標を計算（ドット単位）
            const centerX = cx + Math.floor((pSize * S) / 2);
            const centerY = cy + Math.floor((pSize * S) / 2);

            ctx.translate(centerX, centerY);
            ctx.scale(flicker, 1);
            ctx.translate(-Math.floor((pSize * S) / 2), -Math.floor((pSize * S) / 2));

            for (let row = 0; row < pSize; row++) {
                for (let col = 0; col < pSize; col++) {
                    const type = pattern[row][col];
                    if (type === 0) continue;

                    if (type === 1) ctx.fillStyle = "#FFD700"; // 金
                    if (type === 2) ctx.fillStyle = "#FFA000"; // 影
                    if (type === 3) ctx.fillStyle = "#FFFF88"; // 光

                    ctx.fillRect(col * S, row * S, S, S);
                }
            }
            ctx.restore();
        }
    });

    // --- パーティクル（ドット風：丸→四角）---
    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        const S = 4;
        const ps = Math.max(S, Math.ceil(p.size / S) * S);
        ctx.fillRect(Math.floor(p.x / S) * S, Math.floor(p.y / S) * S, ps, ps);
    });

    ctx.globalAlpha = 1.0;

    // --- ポップアップテキスト（ドットフォント風）---
    popups.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.font = `bold ${p.size}px "DotGothic16", monospace`;
        ctx.fillText(p.text, p.x, p.y);
    });
    ctx.globalAlpha = 1.0;

    // --- プレイヤー（ドット風スプライト）---
    {
        const S = 4;
        const px = Math.floor(player.x / S) * S;
        const py = Math.floor(player.y / S) * S;
        const isFlash = player.flashFrame > 0 || player.isDashing;
        // ボディ
        ctx.fillStyle = isFlash ? "#00e5ff" : "#FF5722";
        ctx.fillRect(px + S, py + S * 2, S * 6, S * 5);
        // 頭
        ctx.fillStyle = isFlash ? "#00e5ff" : "#FF7043";
        ctx.fillRect(px + S, py, S * 6, S * 3);
        // 目
        ctx.fillStyle = isFlash ? "#ffffff" : "white";
        const eyeOffX = player.facing === "right" ? S * 4 : S;
        ctx.fillRect(px + eyeOffX, py + S, S * 2, S * 2);
        // 瞳
        ctx.fillStyle = isFlash ? "#ff0" : "#222";
        ctx.fillRect(px + eyeOffX + (player.facing === "right" ? S : 0), py + S, S, S);
        // 足
        ctx.fillStyle = isFlash ? "#00b0ff" : "#BF360C";
        ctx.fillRect(px + S, py + S * 7, S * 2, S * 2);
        ctx.fillRect(px + S * 5, py + S * 7, S * 2, S * 2);
        // ダッシュエフェクト
        if (player.isDashing) {
            ctx.fillStyle = "rgba(0,229,204,0.5)";
            const trailDir = player.facing === "right" ? -1 : 1;
            ctx.fillRect(px + trailDir * S * 4, py + S * 2, S * 4, S * 4);
        }
    }

    // --- 溶岩（ドット風・波なし）---
    {
        const S = 4;
        const lavaTop = Math.floor(lavaY / S) * S;
        // 溶岩本体（フラットに）
        ctx.fillStyle = "rgba(255, 61, 0, 0.88)";
        ctx.fillRect(Math.floor(cameraX / S) * S, lavaTop, canvas.width + S, 2500);
        // 表面ハイライト（明るい行）
        ctx.fillStyle = "rgba(255,160,0,0.6)";
        ctx.fillRect(Math.floor(cameraX / S) * S, lavaTop, canvas.width + S, S * 2);
        // ドット泡
        for (let i = 0; i < 8; i++) {
            const bx = Math.floor((cameraX + (i * 90 + (frameCount * 1.5) % 80)) / S) * S;
            const by = lavaTop + S * 4 + (i % 3) * S * 2;
            ctx.fillStyle = "#ffcc00";
            ctx.fillRect(bx, by, S * 2, S * 2);
        }
    }

    ctx.restore();
}

// 初期化：背景だけ描画しておく
// ダッシュバーをドット風スタイルに初期化
(function initDashBarStyle() {
    const dotPattern = "repeating-linear-gradient(90deg, transparent 0px, transparent 6px, rgba(0,0,0,0.35) 6px, rgba(0,0,0,0.35) 8px)";
    const origTransition = dashBar.style.transition;

    // dashBarの色変更をすべてdotパターン付きに上書きするMutationObserver
    const observer = new MutationObserver(() => {
        if (!dashBar.style.backgroundImage || !dashBar.style.backgroundImage.includes("repeating-linear-gradient")) {
            dashBar.style.backgroundImage = dotPattern;
        }
    });
    observer.observe(dashBar, { attributes: true, attributeFilter: ["style"] });

    dashBar.style.backgroundImage = dotPattern;
})();
draw();
