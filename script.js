let mainVolume = 0.5;

const sounds = {
    bgm: new Audio("sounds/bgm.mp3"),
    lavaLoop: new Audio("sounds/lava_loop.mp3"), // 迫ってくる音
    start: new Audio("sounds/start.wav"),
    stomp: new Audio("sounds/stomp.wav"),
    dash: new Audio("sounds/dash.wav"),
    click: new Audio("sounds/click.wav"),
    jump: new Audio("sounds/jump.wav"),
    coin: new Audio("sounds/coin.wav"),
    spring: new Audio("sounds/spring.wav"),
    death: new Audio("sounds/death.wav"), // ゲームオーバー用
    vent: new Audio("sounds/vent.wav")

};

sounds.lavaLoop.loop = true;
sounds.vent.loop = true;
sounds.bgm.loop = true;


// 音量を調整
for (let key in sounds) {
    sounds[key].volume = mainVolume;
}

sounds.bgm.volume = mainVolume * 0.05

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
let gameActive = true;
let gameStarted = false; // 追加：ゲームが開始されたか
let frameCount = 0;
let combo = 0;
let forceHighJump = false; // 次の足場を高くするためのフラグ

let lavaY = 750;
let baseLavaSpeed = 0.8;
const lavaAccel = 0.00012;

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

function resetGame() { location.reload(); }
resetBtn.addEventListener("click", resetGame);

// ゲーム開始関数
function startGame() {
    if (gameStarted) return;
    gameStarted = true;
    sounds.bgm.play();
    titleScreen.style.display = "none";
    gameUI.style.display = "block";
    update(); // ここでループを開始
}

startBtn.addEventListener("click", startGame);

window.addEventListener("keydown", (e) => {
    if (e.code === "KeyR") {
        resetGame(); // ページをリロードしてすべてをリセットする
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
        y -= 50;
        forceHighJump = true;
    }

    let newPlatform = {
        x: nextSpawnX + gap,
        y: y,
        width: width,
        height: 30,
        isMovingX: isMovingX,
        isMovingY: isMovingY,
        velX: isMovingX ? (Math.random() < 0.5 ? 2.5 : -2.5) : 0,
        velY: isMovingY ? (Math.random() < 0.5 ? 2 : -2) : 0,
        startX: nextSpawnX + gap,
        startY: y,
        range: 150 + Math.random() * 100
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
        coins.push({ x: newPlatform.x + width / 2 - 12, y: y - (isRare ? 120 : 50), collected: false, isRare: isRare, angle: Math.random() * Math.PI * 2 });
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

    const statusText = document.querySelector("#msg h1");
    statusText.innerText = "GAME OVER!";
    statusText.style.color = "#ff1744";
    msgEl.style.display = "block";
    dashBar.style.background = "#555";
}

function isCollide(a, b) { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }

function update() {
    frameCount++;


    if (gameActive) {
        // プレイヤーとマグマの距離を計算
        let distToLava = lavaY - (player.y + player.height);

        // 距離が 500px 以内なら音を鳴らし、近いほど大きくする
        // 500px以上離れたら音量は 0
        let vol = Math.max(0, 1 - (distToLava / 500));
        sounds.lavaLoop.volume = vol * mainVolume * 0.2 ; // 全体音量50%に合わせるなら * 0.5

        if (sounds.lavaLoop.paused) {
            sounds.lavaLoop.play();
        }
    } else {
        sounds.lavaLoop.pause(); // ゲームオーバー時は止める
    }

    if (!gameActive) { updateParticles(); updatePopups(); draw(); requestAnimationFrame(update); return; }
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
        if (p.isMovingX) { p.x += p.velX; if (Math.abs(p.x - p.startX) > p.range) p.velX *= -1; }
        if (p.isMovingY) { p.y += p.velY; if (Math.abs(p.y - p.startY) > p.range) p.velY *= -1; }
    });

    let isInVent = false;
    vents.forEach(v => {
        if (frameCount % 4 === 0) {
            particles.push({ x: v.x + Math.random() * v.width, y: v.y + v.height, vx: (Math.random() - 0.5) * 0.5, vy: -Math.random() * 4 - 2, life: 1.0, color: "rgba(255, 255, 255, 0.4)", size: Math.random() * 4 + 2, isWind: true });
        }
        if (isCollide(player, v)) {
            player.velY -= 1.5; if (player.velY < -10) player.velY = -10;
            if (player.velY > 0) {
                player.jumpCount = 0; // 落下中ならジャンプ回数をリセットして、気流から飛び出せるようにする
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
        if (keys["ArrowRight"] || keys["KeyD"]) { player.velX += accel; player.facing = "right"; }
        if (keys["ArrowLeft"] || keys["KeyA"]) { player.velX -= accel; player.facing = "left"; }
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
                combo++; let comboScore = 500 * combo; score += comboScore;
                addPopup(e.x, e.y, (combo > 1 ? combo + " COMBO! " : "") + "+" + comboScore, `hsl(${(combo * 40) % 360}, 100%, 70%)`, 24 + combo * 4);
                createParticles(e.x + 15, e.y + 15, "#ffeb3b", 15, 8); enemies.splice(i, 1);
            } else if (!player.isDashing) { gameOver(); }
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
                sounds.coin.currentTime = 0;
                sounds.coin.play();
                c.collected = true; let pts = c.isRare ? 1000 : 100; score += pts; addPopup(c.x, c.y, "+" + pts, c.isRare ? "#00ffff" : "#ffd700"); createParticles(c.x + 12, c.y + 12, c.isRare ? "#00ffff" : "#FFD700", 12, 4);
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

    lavaY -= (lavaY - (player.y + player.height) < 180) ? baseLavaSpeed * 0.35 : (lavaY - (player.y + player.height) > 600 ? baseLavaSpeed * 10 : baseLavaSpeed);
    baseLavaSpeed += lavaAccel; if (player.y + player.height > lavaY) gameOver();
    draw(); requestAnimationFrame(update);
}

function updateParticles() { for (let i = particles.length - 1; i >= 0; i--) { let p = particles[i]; p.x += p.vx; p.y += p.vy; p.life -= (p.isWind ? 0.03 : p.isHeat ? 0.01 : 0.025); if (p.life <= 0) particles.splice(i, 1); } }
function updatePopups() { for (let i = popups.length - 1; i >= 0; i--) { popups[i].y -= 1.5; popups[i].life -= 0.02; if (popups[i].life <= 0) popups.splice(i, 1); } }

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#1a0a05";
    mountains.forEach(m => {
        let mX = m.x - (cameraX * m.speedFactor);
        const loopW = mountainCount * mountainResetWidth;
        if (mX < -500) m.x += loopW;
        ctx.beginPath();
        ctx.moveTo(mX, m.y);
        ctx.bezierCurveTo(mX + m.width * 0.2, m.y - m.height * 0.8, mX + m.width * 0.8, m.y - m.height * 0.8, mX + m.width, m.y);
        ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    ctx.fillStyle = "rgba(255, 60, 0, 0.12)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.translate(-Math.floor(cameraX), -Math.floor(cameraY));

    vents.forEach(v => {
        ctx.fillStyle = "#221100"; ctx.fillRect(v.x, v.y + v.height - 10, v.width, 10);
        ctx.fillStyle = "#ff5722"; ctx.fillRect(v.x + 5, v.y + v.height - 15, v.width - 10, 5);
    });

    platforms.forEach(p => {
        const px = Math.floor(p.x); const py = Math.floor(p.y);
        ctx.lineWidth = 2;
        if (p.isMovingX || p.isMovingY) {
            let grad = ctx.createLinearGradient(px, py, px, py + p.height);
            if (p.isMovingY) { grad.addColorStop(0, "#ff9800"); grad.addColorStop(1, "#f44336"); }
            else { grad.addColorStop(0, "#ff5722"); grad.addColorStop(1, "#795548"); }
            ctx.fillStyle = grad;
            ctx.strokeStyle = "#ff9800";
            drawRoundRect(px, py, p.width, p.height, 5, true, true);
        } else {
            ctx.fillStyle = "#3d2a2a";
            ctx.strokeStyle = "#ff8c00";
            drawRoundRect(px, py, p.width, p.height, 5, true, true);
        }

        ctx.fillStyle = (p.isMovingX || p.isMovingY) ? "rgba(255, 255, 255, 0.2)" : "#4a3535";
        for (let i = 0; i < (p.width - 20) / 30; i++) {
            let relX = 15 + i * 30;
            ctx.beginPath();
            ctx.arc(px + relX + Math.sin(i) * 5, py + 15 + Math.cos(i) * 5, 8, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    fireballs.forEach(f => {
        let grad = ctx.createRadialGradient(f.x + 12, f.y + 12, 2, f.x + 12, f.y + 12, 18);
        grad.addColorStop(0, "#fff"); grad.addColorStop(0.3, "#ffeb3b"); grad.addColorStop(1, "#ff5722");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(f.x + 12, f.y + 12, 15, 0, Math.PI * 2); ctx.fill();
        if (frameCount % 3 === 0) particles.push({ x: f.x + 12, y: f.y + 12, vx: (Math.random() - 0.5) * 1.5, vy: 1, life: 0.6, color: "#ff9100", size: 5 });
    });

    hazards.forEach(h => { const spikeCount = h.width / 10; for (let i = 0; i < spikeCount; i++) { let sx = h.x + i * 10, sy = h.y + 10; let grad = ctx.createLinearGradient(sx, sy, sx, sy - 15); grad.addColorStop(0, "#b71c1c"); grad.addColorStop(1, "#ff5252"); ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 5, sy - 15); ctx.lineTo(sx + 10, sy); ctx.fill(); ctx.fillStyle = "#fff"; ctx.fillRect(sx + 4, sy - 15, 2, 2); } });
    enemies.forEach(e => { if (e.type === "patrol") { ctx.fillStyle = "#9c27b0"; drawRoundRect(e.x, e.y, e.width, e.height, 15); ctx.fillStyle = "#ffeb3b"; ctx.beginPath(); let eyeX = e.x + (e.speed > 0 ? 20 : 5); ctx.arc(eyeX, e.y + 10, 4, 0, Math.PI * 2); ctx.fill(); } else { ctx.fillStyle = "#ff5252"; ctx.beginPath(); ctx.arc(e.x + 15, e.y + 15, 10 + Math.sin(frameCount * 0.1) * 3, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "rgba(255, 255, 255, 0.5)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x + 15, e.y + 15, 20, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 15; ctx.shadowColor = "#ff5252"; ctx.beginPath(); ctx.arc(e.x + 15, e.y + 15, 20, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0; } });

    springs.forEach(s => {
        ctx.fillStyle = "#444";
        drawRoundRect(s.x, s.y + s.height - 6, s.width, 6, 3);
        ctx.fillStyle = "#bbb";
        for (let i = 0; i < 5; i++) {
            drawRoundRect(s.x + 4, s.y + (i * 3.5) + 2, s.width - 8, 3, 1.5);
        }
    });

    coins.forEach(c => { if (!c.collected) { let scaleX = Math.cos(c.angle); let coinW = 20 * Math.abs(scaleX); let coinX = c.x + 12 - coinW / 2; ctx.save(); if (c.isRare) { let hue = (Date.now() / 8) % 360; ctx.fillStyle = `hsl(${hue}, 100%, 65%)`; ctx.shadowBlur = 15; ctx.shadowColor = `hsl(${hue}, 100%, 65%)`; } else { ctx.fillStyle = "#FFD700"; } ctx.beginPath(); ctx.ellipse(coinX + coinW / 2, c.y + 12, coinW / 2, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); } });
    particles.forEach(p => { ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2); ctx.fill(); });

    ctx.globalAlpha = 1.0; popups.forEach(p => { ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.font = `bold ${p.size}px Arial`; ctx.fillText(p.text, p.x, p.y); });
    ctx.globalAlpha = 1.0;

    ctx.fillStyle = "#FF5722"; drawRoundRect(player.x, player.y, player.width, player.height, 10);
    ctx.fillStyle = (player.flashFrame > 0) ? "#00ffff" : "white";
    let eyeX = player.facing === "right" ? player.x + 20 : player.x + 5; ctx.beginPath(); ctx.arc(eyeX + 5, player.y + 12, 5, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "rgba(255, 61, 0, 0.85)"; ctx.beginPath(); ctx.moveTo(cameraX, lavaY); for (let x = cameraX; x <= cameraX + canvas.width; x += 40) { let waveY = Math.sin((x + frameCount * 5) * 0.02) * 8; ctx.lineTo(x, lavaY + waveY); } ctx.lineTo(cameraX + canvas.width, 2500); ctx.lineTo(cameraX, 2500); ctx.fill();
    ctx.fillStyle = "#ff9100"; for (let x = cameraX; x <= cameraX + canvas.width; x += 80) { let waveY = Math.sin((x + frameCount * 5) * 0.02) * 8; ctx.fillRect(x, lavaY + waveY - 2, 40, 4); }
    ctx.restore();
}

// 初期化：背景だけ描画しておく
draw();