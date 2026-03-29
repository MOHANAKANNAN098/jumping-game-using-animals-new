const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W, H, gameStarted = false, gameOver = false;
let score = 0, coins = 0, soundEnabled = true;
let playerType = 'monkey', currentLane = 1, targetLane = 1;
let scrollSpeed = 8, bgOffset = 0, groundOffset = 0;
let obstacles = [], coinItems = [], audioCtx;
let animFrame = 0;
let clouds = [];
let particles = [];

const LANES = [0.25, 0.5, 0.75];
const PLAYER_Y = 0.7;
const GROUND_Y = 0.85;

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  initClouds();
}

// Initialize clouds
function initClouds() {
  clouds = [];
  for (let i = 0; i < 8; i++) {
    clouds.push({
      x: Math.random() * W,
      y: Math.random() * H * 0.4,
      speed: 0.2 + Math.random() * 0.3,
      size: 30 + Math.random() * 20
    });
  }
}

// Parallax background with gradient sky
function drawBackground() {
  // Enhanced gradient sky
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, '#00d4ff');
  gradient.addColorStop(0.5, '#66e0ff');
  gradient.addColorStop(1, '#0099ff');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
  
  // Animated clouds
  clouds.forEach(cloud => {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y, cloud.size, 0, Math.PI * 2);
    ctx.arc(cloud.x + cloud.size * 0.8, cloud.y, cloud.size * 1.2, 0, Math.PI * 2);
    ctx.arc(cloud.x + cloud.size * 1.6, cloud.y, cloud.size, 0, Math.PI * 2);
    ctx.fill();
    
    cloud.x += cloud.speed;
    if (cloud.x > W + cloud.size * 2) cloud.x = -cloud.size * 2;
  });
  
  // Trees (medium parallax)
  ctx.fillStyle = '#2d5016';
  for (let i = 0; i < 8; i++) {
    const x = ((bgOffset * 0.5 + i * 200) % (W + 100)) - 50;
    const y = H * 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 20, y + 60);
    ctx.lineTo(x + 20, y + 60);
    ctx.fill();
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(x - 5, y + 60, 10, 40);
    ctx.fillStyle = '#2d5016';
  }
}

// Ground with perspective lines and motion blur
function drawGround() {
  const groundY = H * GROUND_Y;
  
  // Ground fill with gradient
  const groundGrad = ctx.createLinearGradient(0, groundY, 0, H);
  groundGrad.addColorStop(0, '#555');
  groundGrad.addColorStop(1, '#333');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, groundY, W, H - groundY);
  
  // Motion blur effect
  ctx.globalAlpha = 0.3;
  for (let blur = 0; blur < 3; blur++) {
    ctx.strokeStyle = '#fff';
    
    for (let i = 0; i < 10; i++) {
      const progress = (groundOffset + i * 100 + blur * 10) % 500 / 500;
      const y = groundY + progress * (H - groundY);
      const scale = 0.3 + progress * 0.7;
      const lineWidth = W * 0.6 * scale;
      const x = W / 2;
      
      ctx.lineWidth = 3 * scale;
      
      // Left lane line
      ctx.beginPath();
      ctx.moveTo(x - lineWidth * 0.33, y);
      ctx.lineTo(x - lineWidth * 0.33, y + 20 * scale);
      ctx.stroke();
      
      // Right lane line
      ctx.beginPath();
      ctx.moveTo(x + lineWidth * 0.33, y);
      ctx.lineTo(x + lineWidth * 0.33, y + 20 * scale);
      ctx.stroke();
    }
  }
  
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
}

// Draw realistic running animal with smooth lane transition
function drawPlayer() {
  const targetX = W * LANES[targetLane];
  const currentX = W * LANES[currentLane];
  const x = currentX;
  const y = H * PLAYER_Y;
  const size = 80;
  const legCycle = Math.sin(animFrame * 0.3) * 15;
  
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.4, size * 0.4, size * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Lane switch motion blur
  if (Math.abs(targetLane - currentLane) > 0.1) {
    ctx.globalAlpha = 0.3;
    ctx.save();
    ctx.translate(x + (targetX - currentX) * 0.5, y);
    drawAnimalBody();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  
  ctx.save();
  ctx.translate(x, y);
  drawAnimalBody();
  ctx.restore();
}

function drawAnimalBody() {
  const legCycle = Math.sin(animFrame * 0.3) * 15;
  
  if (playerType === 'monkey') {
    // Body
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(-15, -30, 30, 40);
    
    // Head
    ctx.beginPath();
    ctx.arc(0, -45, 20, 0, Math.PI * 2);
    ctx.fill();
    
    // Face
    ctx.fillStyle = '#D2B48C';
    ctx.beginPath();
    ctx.arc(0, -42, 12, 0, Math.PI * 2);
    ctx.fill();
    
    // Eyes
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-6, -45, 3, 0, Math.PI * 2);
    ctx.arc(6, -45, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Arms (running motion)
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-15, -20);
    ctx.lineTo(-25, -5 + legCycle);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(15, -20);
    ctx.lineTo(25, -5 - legCycle);
    ctx.stroke();
    
    // Legs (running motion)
    ctx.beginPath();
    ctx.moveTo(-10, 10);
    ctx.lineTo(-15, 30 - legCycle);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10, 10);
    ctx.lineTo(15, 30 + legCycle);
    ctx.stroke();
    
    // Tail
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.quadraticCurveTo(20, -10, 25, -20);
    ctx.lineWidth = 5;
    ctx.stroke();
    
  } else if (playerType === 'elephant') {
    // Body
    ctx.fillStyle = '#808080';
    ctx.fillRect(-25, -25, 50, 45);
    
    // Head
    ctx.beginPath();
    ctx.arc(0, -35, 25, 0, Math.PI * 2);
    ctx.fill();
    
    // Trunk
    ctx.strokeStyle = '#808080';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -25);
    ctx.quadraticCurveTo(-10, 0, -5, 20);
    ctx.stroke();
    
    // Eyes
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-10, -38, 4, 0, Math.PI * 2);
    ctx.arc(10, -38, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Ears
    ctx.fillStyle = '#696969';
    ctx.beginPath();
    ctx.ellipse(-20, -35, 15, 20, -0.3, 0, Math.PI * 2);
    ctx.ellipse(20, -35, 15, 20, 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // Legs (running motion)
    ctx.strokeStyle = '#808080';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(-15, 20);
    ctx.lineTo(-15, 35 - legCycle);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(15, 20);
    ctx.lineTo(15, 35 + legCycle);
    ctx.stroke();
    
  } else if (playerType === 'tiger') {
    // Body
    ctx.fillStyle = '#FF8C00';
    ctx.fillRect(-20, -20, 40, 35);
    
    // Stripes
    ctx.fillStyle = '#000';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(-18, -15 + i * 10, 36, 3);
    }
    
    // Head
    ctx.fillStyle = '#FF8C00';
    ctx.beginPath();
    ctx.arc(0, -35, 18, 0, Math.PI * 2);
    ctx.fill();
    
    // Face stripes
    ctx.fillStyle = '#000';
    ctx.fillRect(-12, -38, 3, 8);
    ctx.fillRect(9, -38, 3, 8);
    
    // Eyes
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(-7, -37, 5, 0, Math.PI * 2);
    ctx.arc(7, -37, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-7, -37, 2, 0, Math.PI * 2);
    ctx.arc(7, -37, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Ears
    ctx.fillStyle = '#FF8C00';
    ctx.beginPath();
    ctx.moveTo(-15, -45);
    ctx.lineTo(-10, -50);
    ctx.lineTo(-5, -45);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(15, -45);
    ctx.lineTo(10, -50);
    ctx.lineTo(5, -45);
    ctx.fill();
    
    // Legs (running motion)
    ctx.strokeStyle = '#FF8C00';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-12, 15);
    ctx.lineTo(-15, 35 - legCycle);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(12, 15);
    ctx.lineTo(15, 35 + legCycle);
    ctx.stroke();
    
    // Tail
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.quadraticCurveTo(35, -15, 30, -25);
    ctx.lineWidth = 6;
    ctx.stroke();
    
  } else if (playerType === 'eagle') {
    // Body
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.ellipse(0, -20, 15, 25, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Head
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(0, -40, 15, 0, Math.PI * 2);
    ctx.fill();
    
    // Beak
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.moveTo(0, -35);
    ctx.lineTo(12, -32);
    ctx.lineTo(0, -30);
    ctx.fill();
    
    // Eyes
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-5, -42, 3, 0, Math.PI * 2);
    ctx.arc(5, -42, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Wings (flapping motion)
    const wingFlap = Math.sin(animFrame * 0.4) * 20;
    ctx.fillStyle = '#654321';
    ctx.beginPath();
    ctx.moveTo(-15, -15);
    ctx.lineTo(-40, -10 + wingFlap);
    ctx.lineTo(-35, 5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(15, -15);
    ctx.lineTo(40, -10 + wingFlap);
    ctx.lineTo(35, 5);
    ctx.fill();
    
    // Tail feathers
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.lineTo(-8, 20);
    ctx.lineTo(0, 18);
    ctx.lineTo(8, 20);
    ctx.fill();
    
    // Legs
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-5, 5);
    ctx.lineTo(-5, 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(5, 5);
    ctx.lineTo(5, 20);
    ctx.stroke();
  }
}

// Create coin particle effect
function createCoinParticles(x, y) {
  for (let i = 0; i < 10; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8 - 2,
      life: 30,
      color: ['#ffd700', '#ffed4e', '#ff8c00'][Math.floor(Math.random() * 3)]
    });
  }
}

// Draw particles
function drawParticles() {
  particles.forEach((p, idx) => {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life / 30;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
    
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.3;
    p.life--;
    
    if (p.life <= 0) particles.splice(idx, 1);
  });
  ctx.globalAlpha = 1;
}

// Spawn obstacle
function spawnObstacle() {
  const lane = Math.floor(Math.random() * 3);
  obstacles.push({
    lane,
    progress: 0,
    type: Math.random() > 0.5 ? 'box' : 'cone'
  });
}

// Spawn coin
function spawnCoin() {
  const lane = Math.floor(Math.random() * 3);
  coinItems.push({
    lane,
    progress: 0,
    collected: false
  });
}

// Draw obstacles with perspective
function drawObstacles() {
  obstacles.forEach(obs => {
    const scale = 0.3 + obs.progress * 0.7;
    const y = H * GROUND_Y + obs.progress * (H * PLAYER_Y - H * GROUND_Y);
    const x = W * LANES[obs.lane];
    const size = 50 * scale;
    
    if (obs.type === 'box') {
      ctx.fillStyle = '#ff6b35';
      ctx.fillRect(x - size / 2, y - size, size, size);
      ctx.strokeStyle = '#cc4422';
      ctx.lineWidth = 3;
      ctx.strokeRect(x - size / 2, y - size, size, size);
    } else {
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(x, y - size * 1.5);
      ctx.lineTo(x - size / 2, y);
      ctx.lineTo(x + size / 2, y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#cc9900';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  });
}

// Draw coins with animation
function drawCoins() {
  const time = Date.now() / 200;
  
  coinItems.forEach(coin => {
    if (coin.collected) return;
    
    const scale = 0.3 + coin.progress * 0.7;
    const y = H * GROUND_Y + coin.progress * (H * PLAYER_Y - H * GROUND_Y) - 30 * scale;
    const x = W * LANES[coin.lane];
    const size = 30 * scale;
    
    // Coin animation
    const rotation = Math.sin(time) * 0.3;
    
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(Math.cos(rotation), 1);
    
    // Coin
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#ff8c00';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Dollar sign
    ctx.fillStyle = '#ff8c00';
    ctx.font = `bold ${size * 0.6}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 0);
    
    ctx.restore();
  });
}

// Update game state
function update() {
  if (!gameStarted || gameOver) return;
  
  // Animation frame
  animFrame++;
  
  // Smooth lane transition
  if (currentLane < targetLane) currentLane += 0.15;
  if (currentLane > targetLane) currentLane -= 0.15;
  if (Math.abs(currentLane - targetLane) < 0.1) currentLane = targetLane;
  
  // Update scroll
  bgOffset += scrollSpeed * 0.5;
  groundOffset += scrollSpeed;
  
  // Update score
  score += 1;
  document.getElementById('scoreValue').textContent = Math.floor(score / 10);
  
  // Increase speed over time
  scrollSpeed += 0.002;
  
  // Update obstacles
  obstacles.forEach((obs, idx) => {
    obs.progress += 0.015;
    
    // Check collision
    if (obs.progress >= 0.95 && obs.progress <= 1.05) {
      if (Math.abs(obs.lane - currentLane) < 0.3) {
        endGame();
      }
    }
    
    // Remove if passed
    if (obs.progress > 1.1) {
      obstacles.splice(idx, 1);
    }
  });
  
  // Update coins
  coinItems.forEach((coin, idx) => {
    coin.progress += 0.015;
    
    // Check collection
    if (!coin.collected && coin.progress >= 0.95 && coin.progress <= 1.05) {
      if (Math.abs(coin.lane - currentLane) < 0.3) {
        coin.collected = true;
        coins++;
        document.getElementById('coinsValue').textContent = coins;
        const x = W * LANES[coin.lane];
        const y = H * PLAYER_Y;
        createCoinParticles(x, y);
        playSound('coin');
      }
    }
    
    // Remove if passed
    if (coin.progress > 1.1) {
      coinItems.splice(idx, 1);
    }
  });
  
  // Spawn new obstacles and coins
  if (Math.random() < 0.02) spawnObstacle();
  if (Math.random() < 0.03) spawnCoin();
}

// Render loop
function render() {
  drawBackground();
  drawGround();
  drawObstacles();
  drawCoins();
  drawParticles();
  drawPlayer();
}

function gameLoop() {
  update();
  render();
  requestAnimationFrame(gameLoop);
}

// Start game
function startGame() {
  playerType = document.querySelector('input[name="animal"]:checked').value;
  gameStarted = true;
  gameOver = false;
  score = 0;
  coins = 0;
  scrollSpeed = 8;
  currentLane = 1;
  targetLane = 1;
  animFrame = 0;
  obstacles = [];
  coinItems = [];
  particles = [];
  initClouds();
  
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('scoreValue').textContent = '0';
  document.getElementById('coinsValue').textContent = '0';
  
  if (!audioCtx) initAudio();
}

// End game
function endGame() {
  gameOver = true;
  gameStarted = false;
  document.getElementById('finalScore').textContent = `Score: ${Math.floor(score / 10)}`;
  document.getElementById('finalCoins').textContent = `Coins: ${coins}`;
  document.getElementById('overlay').classList.remove('hidden');
  playSound('gameover');
}

// Restart game
function restartGame() {
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('menu').classList.remove('hidden');
}

// Audio
function initAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playSound(type) {
  if (!soundEnabled || !audioCtx) return;
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  if (type === 'coin') {
    osc.frequency.value = 800;
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  } else if (type === 'gameover') {
    osc.frequency.value = 200;
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
  }
}

// Event listeners
window.addEventListener('resize', resize);

document.addEventListener('keydown', (e) => {
  if (!gameStarted || gameOver) return;
  
  if (e.key === 'ArrowLeft' && targetLane > 0) {
    targetLane--;
  } else if (e.key === 'ArrowRight' && targetLane < 2) {
    targetLane++;
  }
});

// Touch controls for mobile
let touchStartX = 0;
canvas.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
});

canvas.addEventListener('touchend', (e) => {
  if (!gameStarted || gameOver) return;
  
  const touchEndX = e.changedTouches[0].clientX;
  const diff = touchEndX - touchStartX;
  
  if (diff > 50 && targetLane < 2) {
    targetLane++;
  } else if (diff < -50 && targetLane > 0) {
    targetLane--;
  }
});

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', restartGame);

document.getElementById('soundToggle').addEventListener('click', (e) => {
  soundEnabled = !soundEnabled;
  e.target.textContent = soundEnabled ? '🔊' : '🔇';
});

// Initialize
resize();
gameLoop();
