(() => {
  // Canvas setup
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let W = window.innerWidth, H = window.innerHeight;
  canvas.width = W; canvas.height = H;

  // UI refs
  const menu = document.getElementById('menu');
  const startBtn = document.getElementById('startBtn');
  const overlay = document.getElementById('overlay');
  const finalScore = document.getElementById('finalScore');
  const restartBtn = document.getElementById('restartBtn');
  const scoreValue = document.getElementById('scoreValue');
  const hiValue = document.getElementById('hiValue');
  const debugInfo = document.getElementById('debugInfo');
  // name inputs - prefill from localStorage if available
  const nameInput1 = document.getElementById('name1');
  const nameInput2 = document.getElementById('name2');
  try{ nameInput1.value = localStorage.getItem('me_name1') || '' }catch(e){}
  try{ nameInput2.value = localStorage.getItem('me_name2') || '' }catch(e){}

  // Game state
  let mode = 'run';
  let running = false;
  let last = 0;
  let speed = 300; // px/sec base
  let spawnInterval = 1500;
  let spawnTimer = 0;
  let gravity = 1600;
  let score = 0, hi = 0;
  let scoreAccumulator = 0;
  let passedBonus = 5;
  let showDebug = false;

  // animals map -> emoji and sizes
  const animalEmojis = {
    elephant: '🐘', monkey: '🐒', dragon: '🐉', butterfly: '🦋', snake: '🐍', eagle: '🦅', dog: '🐶', tiger: '🐯'
  };

  // read saved hi
  try{ hi = parseInt(localStorage.getItem('me_hi')||'0')||0 }catch(e){hi=0}
  hiValue.textContent = 'Hi: '+hi;

  // audio: only for clicks, jump, and game over
  let audioCtx = null;
  function ensureAudio(){ if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)(); if(audioCtx.state==='suspended') audioCtx.resume().catch(()=>{}); }

  function playBeep(freq, type='sine', dur=0.08, vol=0.06){ try{ ensureAudio(); const o=audioCtx.createOscillator(); const g=audioCtx.createGain(); o.type=type; o.frequency.value=freq; g.gain.value=vol; o.connect(g); g.connect(audioCtx.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime+dur); o.stop(audioCtx.currentTime+dur+0.02); }catch(e){} }

  function playClick(){ playBeep(900,'square',0.06,0.05) }
  function playJump(){ playBeep(520,'sine',0.18,0.08) }
  function playGameOver(){ playBeep(120,'sawtooth',0.7,0.12) }

  // delegated click sound for UI elements (buttons, labels, radio/checkbox, mode buttons)
  document.addEventListener('click', (e)=>{
    const el = e.target;
    if(!el) return;
    if(el.closest && (el.closest('button') || el.classList && el.classList.contains('modeBtn') || el.tagName === 'LABEL' || (el.tagName === 'INPUT' && (el.type==='radio' || el.type==='checkbox')))){
      playClick();
    }
  });

  // menu mode buttons
  document.querySelectorAll('.modeBtn').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('.modeBtn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); mode = b.dataset.mode;
    document.body.className = 'mode-'+mode;
  }));

  // change body mode initial
  document.body.className = 'mode-'+mode;

  // helpers to get selected animals and names
  function getSelected(name){ const el=document.querySelector(`input[name="${name}"]:checked`); return el?el.value:null }

  // player & chaser
  let player, chaser;
  function resetEntities(a1,a2,n1,n2){
    // player is the pursued one (Animal2), chaser is Animal1 and should start behind the player
    // place both animals on the left side so both are visible
    const leftMargin = 24;
    const playerX = Math.round(Math.max(leftMargin + 80, Math.min(W * 0.22, 260)));
    player = {x:playerX,y:H-140,w:64,h:64,vx:0,vy:0,emoji:animalEmojis[a1]||'?',name:n1||'Player',onGround:false} ;
    // chaser starts slightly to the left of player but still visible
    const initialGap = Math.round(Math.min(220, W * 0.18));
    const chaserX = Math.max(leftMargin, player.x - initialGap);
    chaser = {x:chaserX,y:H-140,w:64,h:64,vx:0,vy:0,emoji:animalEmojis[a2]||'?',name:n2||'Chaser'};
    if(mode==='fly'){ player.y = H*0.45; chaser.y = H*0.45 }
    if(mode==='swim'){ player.y = H*0.6; chaser.y = H*0.6 }
  }

  // obstacles
  let obstacles = [];
  function spawnObstacle(){
    const h = 30 + Math.random()*80;
    let y = H - 90 - h; // ground
    if(mode==='fly') y = 80 + Math.random()*(H*0.5);
    if(mode==='swim') y = H*0.65 + Math.random()*60;
    obstacles.push({x:W+80,y:y,w:40+Math.random()*60,h:h,passed:false});
  }

  // collisions
  function rectsOverlap(a,b){ return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y }

  // input
  let canJump = true;
  let moveLeft = false, moveRight = false;
  const moveSpeed = 400; // px/s horizontal movement
  
  window.addEventListener('keydown', e=>{
    if(e.code==='Space' || e.code==='ArrowUp'){ e.preventDefault(); tryJump() }
    if(e.code==='ArrowLeft'){ e.preventDefault(); moveLeft = true }
    if(e.code==='ArrowRight'){ e.preventDefault(); moveRight = true }
    if(e.key.toLowerCase()==='d'){ showDebug = !showDebug; debugInfo.classList.toggle('hidden', !showDebug) }
  });
  
  window.addEventListener('keyup', e=>{
    if(e.code==='ArrowLeft'){ moveLeft = false }
    if(e.code==='ArrowRight'){ moveRight = false }
  });
  
  // Touch/Mobile controls: tap left side to move left, tap right side to move right
  let touchMoveLeft = false, touchMoveRight = false;
  document.addEventListener('touchstart', e=>{
    const touch = e.touches[0];
    if(touch.clientX < W * 0.33){ touchMoveLeft = true; e.preventDefault() }
    else if(touch.clientX > W * 0.67){ touchMoveRight = true; e.preventDefault() }
    else { tryJump(); e.preventDefault() }
  });
  
  document.addEventListener('touchend', ()=>{ touchMoveLeft = false; touchMoveRight = false });
  
  canvas.addEventListener('pointerdown', (e)=>{
    if(e.isPrimary){ 
      if(e.clientX < W * 0.33){ moveLeft = true }
      else if(e.clientX > W * 0.67){ moveRight = true }
      else { tryJump() }
    }
  });
  
  canvas.addEventListener('pointerup', (e)=>{ if(e.isPrimary){ moveLeft = false; moveRight = false } });

  function tryJump(){ if(!running) return; if(!canJump) return; // single jump
    if(mode==='fly'){
      player.vy = -480; canJump=false; playJump();
    } else if(mode==='run' || mode==='swim'){
      if(player.onGround || mode==='swim'){
        player.vy = (mode==='swim')? -380 : -680; player.onGround=false; canJump=false; playJump();
      }
    }
  }

  // Start game
  startBtn.addEventListener('click', ()=>{
    const a1 = getSelected('animal1'); const a2 = getSelected('animal2');
    const n1 = document.getElementById('name1').value || 'Player';
    const n2 = document.getElementById('name2').value || 'Chaser';
    if(!a1 || !a2){ alert('Please select both animals.'); return }
    if(a1===a2){ alert('Choose two different animals.'); return }
    // persist names so user doesn't need to re-enter next time
    try{ localStorage.setItem('me_name1', n1); localStorage.setItem('me_name2', n2) }catch(e){}
    // set mode vars
    if(mode==='fly'){ gravity = 800 } else if(mode==='swim'){ gravity = 900 } else { gravity = 1600 }
    spawnInterval = 1500; speed = 300; obstacles = []; spawnTimer=0; score=0; scoreAccumulator=0; passedBonus=5; last=performance.now();
    // Note: Animal1 is chaser, Animal2 is player — swap when creating entities
    resetEntities(a2,a1,n2,n1);
    running = true; menu.classList.add('hidden'); overlay.classList.add('hidden');
    requestAnimationFrame(loop);
  });

  restartBtn.addEventListener('click', ()=>{ overlay.classList.add('hidden'); menu.classList.remove('hidden'); running=false });
  // ensure credits become visible again when restarting
  restartBtn.addEventListener('click', ()=>{ showCredits(); });

  // resize
  window.addEventListener('resize', ()=>{ W = window.innerWidth; H = window.innerHeight; canvas.width=W; canvas.height=H });

  // main loop
  let speedIncreaseTimer = 0;
  function loop(ts){
    if(!running) return; const dt = Math.min(40, ts - last)/1000; last = ts;
    // update difficulty
    speedIncreaseTimer += dt;
    if(speedIncreaseTimer >= 15){ speedIncreaseTimer = 0; speed *= 1.15; spawnInterval = Math.max(550, spawnInterval * 0.9) }

    // spawn
    spawnTimer += dt*1000;
    if(spawnTimer > spawnInterval){ spawnTimer = 0; spawnObstacle() }

    // update obstacles
    for(let i=obstacles.length-1;i>=0;i--){ const ob = obstacles[i]; ob.x -= speed*dt; if(ob.x + ob.w < -50) obstacles.splice(i,1); }

    // horizontal movement (left/right)
    const anyMoveLeft = moveLeft || touchMoveLeft;
    const anyMoveRight = moveRight || touchMoveRight;
    if(anyMoveLeft && !anyMoveRight){ player.x -= moveSpeed*dt }
    else if(anyMoveRight && !anyMoveLeft){ player.x += moveSpeed*dt }
    // boundary checking
    const minX = 24;
    const maxX = W - player.w - 24;
    player.x = Math.max(minX, Math.min(maxX, player.x));

    // physics
    player.vy += gravity*dt; player.y += player.vy*dt; if(mode==='fly'){ /* softer */ }
    if(mode!=='fly'){
      const groundY = H-80-player.h; if(player.y > groundY){ player.y = groundY; player.vy = 0; player.onGround = true; canJump=true }
    } else {
      // for fly, allow returning slowly
      const cap = 20; if(player.y < 40) player.y = 40;
      if(player.y + player.h > H-40){ player.y = H-40-player.h; player.vy = 0; canJump=true }
    }

    // chaser follows but keeps a follow gap (maintains distance)
    const followGap = Math.round(Math.min(180, W * 0.14));
    const targetX = player.x - followGap;
    chaser.x += ((targetX - chaser.x) * 2.2) * dt; // smoothing (slightly slower to preserve gap)
    // chaser vertical follow
    chaser.y += ((player.y - chaser.y) * 2) * dt;

    // scoring
    scoreAccumulator += dt; if(scoreAccumulator >= 1){ score += Math.floor(scoreAccumulator); scoreAccumulator = scoreAccumulator%1; scoreValue.textContent = score }

    // passing obstacles bonus
    obstacles.forEach(ob=>{ if(!ob.passed && ob.x + ob.w < player.x){ ob.passed = true; score += passedBonus } });

    // check collisions
    for(const ob of obstacles){ if(rectsOverlap(player, ob)){ // collision -> game over
        running = false; showGameOver(); playGameOver(); break }
    }

    // render
    render();
    if(running) requestAnimationFrame(loop);
  }

  function showGameOver(){ finalScore.textContent = 'Score: '+score; overlay.classList.remove('hidden'); // update hi
    // save to historical scores list (no names)
    try{
      const raw = localStorage.getItem('me_scores');
      const arr = raw ? JSON.parse(raw) : [];
      arr.push(Number(score) || 0);
      localStorage.setItem('me_scores', JSON.stringify(arr));
    }catch(e){}
    if(score > hi){ hi = score; try{ localStorage.setItem('me_hi', hi) }catch(e){} }
    hiValue.textContent='Hi: '+hi
    hideCredits();
  }

  // Leaderboard display (scores only, ranked)
  const scorebarEl = document.getElementById('scorebar');
  const leaderboardOverlay = document.getElementById('leaderboardOverlay');
  const scoresListEl = document.getElementById('scoresList');
  const topScoreEl = document.getElementById('topScore');
  const leastScoreEl = document.getElementById('leastScore');
  const closeLeaderboard = document.getElementById('closeLeaderboard');
  const creditsEl = document.getElementById('credits');

  function loadScoresArray(){ try{ const raw = localStorage.getItem('me_scores'); return raw ? JSON.parse(raw) : [] }catch(e){ return [] } }

  function showLeaderboard(){
    const arr = loadScoresArray();
    if(arr.length===0){ topScoreEl.textContent='0'; leastScoreEl.textContent='0'; scoresListEl.innerHTML='<li>No scores yet</li>'; }
    else{
      // sort descending for ranking; also compute least
      const sortedDesc = arr.slice().sort((a,b)=>b-a);
      const sortedAsc = arr.slice().sort((a,b)=>a-b);
      topScoreEl.textContent = String(sortedDesc[0]||0);
      leastScoreEl.textContent = String(sortedAsc[0]||0);
      // render ranked list (all scores)
      scoresListEl.innerHTML = '';
      for(let i=0;i<sortedDesc.length; i++){
        const s = sortedDesc[i]; const li = document.createElement('li'); li.textContent = `#${i+1} — ${s}`; scoresListEl.appendChild(li);
      }
    }
    leaderboardOverlay.classList.remove('hidden');
  }

  scorebarEl && scorebarEl.addEventListener('click', ()=>{ showLeaderboard(); });
  closeLeaderboard && closeLeaderboard.addEventListener('click', ()=>{ leaderboardOverlay.classList.add('hidden'); });

  // Hide the credits label when showing game over to avoid overlap artifacts
  function hideCredits(){ if(creditsEl) creditsEl.style.visibility = 'hidden'; }
  function showCredits(){ if(creditsEl) creditsEl.style.visibility = 'visible'; }

  function render(){
    // backgrounds by mode
    ctx.clearRect(0,0,W,H);
    if(mode==='run') renderRun(); else if(mode==='fly') renderFly(); else renderSwim();

    // obstacles
    ctx.fillStyle = '#7b3e00';
    obstacles.forEach(ob=>{
      ctx.fillStyle = (mode==='swim')? '#385b7a':'#7b3e00';
      ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
    });

    // chaser
    drawEntity(chaser, '#c0392b');
    // player
    drawEntity(player, '#2ecc71');

    // debug
    if(showDebug){ debugInfo.classList.remove('hidden'); debugInfo.textContent = `Entities: ${obstacles.length} | Speed: ${Math.round(speed)} | Spawn: ${Math.round(spawnInterval)}ms`;
      // collision boxes
      ctx.strokeStyle='magenta'; ctx.lineWidth=2; ctx.strokeRect(player.x, player.y, player.w, player.h); ctx.strokeStyle='cyan'; ctx.strokeRect(chaser.x, chaser.y, chaser.w, chaser.h);
      // obstacles
      ctx.strokeStyle='yellow'; obstacles.forEach(ob=>ctx.strokeRect(ob.x, ob.y, ob.w, ob.h));
      // distance meter
      ctx.beginPath(); ctx.moveTo(player.x+player.w/2, player.y+player.h/2); ctx.lineTo(chaser.x+chaser.w/2, chaser.y+chaser.h/2); ctx.strokeStyle='white'; ctx.stroke();
      ctx.fillStyle='white'; ctx.fillText('Dist: '+Math.round(Math.hypot(player.x-chaser.x, player.y-chaser.y)), chaser.x+20, chaser.y-10);
    } else { debugInfo.classList.add('hidden') }
  }

  function drawEntity(e, color){ ctx.save(); ctx.fillStyle = color; // draw circle with emoji
    const cx = e.x + e.w/2, cy = e.y + e.h/2; ctx.beginPath(); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.ellipse(cx, cy+18, e.w*0.6, 12, 0, 0, Math.PI*2); ctx.fill();
    ctx.font = Math.round(e.h*0.9)+'px serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle = '#000'; ctx.fillText(e.emoji, cx, cy-2);
    // name
    ctx.font = '14px sans-serif'; ctx.fillStyle='white'; ctx.fillText(e.name, e.x + e.w/2, e.y + e.h + 14);
    ctx.restore(); }

  // theme renders
  function renderRun(){ // ground and trees
    // sky
    ctx.fillStyle = '#87ceeb'; ctx.fillRect(0,0,W,H);
    // ground
    ctx.fillStyle = '#6b8e23'; ctx.fillRect(0,H-90,W,90);
    // simple trees
    for(let i=0;i<8;i++){ const tx = (i*400 + (performance.now()*0.02 % 400)) % (W+200) -200; ctx.fillStyle='#2e8b57'; ctx.fillRect(tx, H-220, 20, 120); ctx.beginPath(); ctx.fillStyle='#1b5e20'; ctx.arc(tx+10, H-230, 40, 0, Math.PI*2); ctx.fill(); }
  }

  function renderFly(){ ctx.fillStyle='#87cfff'; ctx.fillRect(0,0,W,H); // clouds
    ctx.fillStyle='rgba(255,255,255,0.9)'; for(let i=0;i<10;i++){ const cx = (i*350 + (performance.now()*0.03 % 350)) % (W+200) -200; const cy = 60 + (i%3)*40; ctx.beginPath(); ctx.ellipse(cx, cy, 50,30,0,0,Math.PI*2); ctx.fill(); }
  }

  function renderSwim(){ ctx.fillStyle='#1b3b57'; ctx.fillRect(0,0,W,H); // bubbles
    for(let i=0;i<30;i++){ const bx = (i*200 + (performance.now()*0.05 % 200)) % (W+200) -200; const by = (i*30) % H; ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.arc(bx, by, 6, 0, Math.PI*2); ctx.fill(); }
    // seabed
    ctx.fillStyle='#2d5a3b'; ctx.fillRect(0,H-90,W,90);
  }

  // small initial animation to show canvas is alive
  (function idle() { ctx.clearRect(0,0,W,H); ctx.fillStyle='#111'; ctx.font='24px sans-serif'; ctx.textAlign='center'; ctx.fillText('Open menu and press START GAME', W/2, H/2); requestAnimationFrame(idle); })();

})();
/* Monkey Escape - script.js
   Vanilla JS, Canvas API infinite runner
   - Uses requestAnimationFrame with delta time
   - Organized functions: initGame, updateGame, drawGame, spawnObstacle, resetGame
   - High score in localStorage, debug toggle, sound toggle
*/
(function(){
  'use strict';

  /* ---------------------- Constants ---------------------- */
  const CONST = {
    GRAVITY: 2200, // px/s^2
    JUMP_VELOCITY: -780, // px/s
    FLOOR_HEIGHT_RATIO: 0.2, // part of canvas height
    MONKEY_X: 150, // fixed screen x for monkey
    BASE_SCROLL_SPEED: 420, // px/s - ground and obstacles
    SPEED_INCREASE_INTERVAL: 15, // seconds
    SPEED_INCREASE_AMOUNT: 60, // px/s every interval
    OBSTACLE_BASE_INTERVAL: 1.6, // seconds
    OBSTACLE_MIN_INTERVAL: 0.6, // seconds
    OBSTACLE_FREQ_DECREASE: 0.05, // decrease seconds per interval
    ELEPHANT_START_DISTANCE: 700, // px behind monkey
    ELEPHANT_BASE_SPEED: 80, // px/s closing speed
    SLOW_HIT_DURATION: 0.9 // seconds the monkey is slowed after hitting hazard
  };

  /* ---------------------- DOM ---------------------- */
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const startScreen = document.getElementById('startScreen');
  const startBtn = document.getElementById('startBtn');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const restartBtn = document.getElementById('restartBtn');
  const scoreEl = document.getElementById('score');
  const highScoreEl = document.getElementById('highScore');
  const finalScoreEl = document.getElementById('finalScore');
  const finalTimeEl = document.getElementById('finalTime');
  const finalHighEl = document.getElementById('finalHigh');
  const soundToggle = document.getElementById('soundToggle');
  const debugToggle = document.getElementById('debugToggle');
  const jumpBtn = document.getElementById('jumpBtn');

  /* ---------------------- Game State ---------------------- */
  let game = null; // will be initialized in initGame()

  /* ---------------------- Audio (Web Audio API) ---------------------- */
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audio = {
    ctx: null,
    enabled: true,
    init(){ if(!AudioCtx) return; this.ctx = new AudioCtx(); },
    jump(){ if(!this.enabled || !this.ctx) return; const o=this.ctx.createOscillator(); const g=this.ctx.createGain(); o.type='sine'; o.frequency.value=520; g.gain.value=0.08; o.connect(g); g.connect(this.ctx.destination); o.start(); o.stop(this.ctx.currentTime+0.08); },
    over(){ if(!this.enabled || !this.ctx) return; const o=this.ctx.createOscillator(); const g=this.ctx.createGain(); o.type='sawtooth'; o.frequency.value=120; g.gain.value=0.12; o.connect(g); g.connect(this.ctx.destination); o.start(); o.stop(this.ctx.currentTime+0.5); },
    ambientOsc:null,
    ambientStart(){ if(!this.enabled || !this.ctx) return; if(this.ambientOsc) return; const o=this.ctx.createOscillator(); const g=this.ctx.createGain(); o.type='triangle'; o.frequency.value=120; g.gain.value=0.006; o.connect(g); g.connect(this.ctx.destination); o.start(); this.ambientOsc={o,g}; },
    ambientStop(){ if(!this.ambientOsc) return; this.ambientOsc.o.stop(); this.ambientOsc=null; }
  };

  /* ---------------------- Utilities ---------------------- */
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

  /* ---------------------- Game Objects ---------------------- */
  function createMonkey(yFloor){
    return {
      x: CONST.MONKEY_X,
      y: yFloor - 90,
      w: 64,
      h: 64,
      vy: 0,
      onGround: true,
      isJumping:false,
      speedMultiplier:1,
      slowTimer:0
    };
  }

  function createElephant(monkeyX){
    return {
      w: 110,
      h: 70,
      x: monkeyX - CONST.ELEPHANT_START_DISTANCE,
      y: 0, // will set later relative to floor
      pace: CONST.ELEPHANT_BASE_SPEED
    };
  }

  function spawnObstacle(floorY, canvasW){
    // choose obstacle type depending on mode
    let type;
    if(game && game.mode === 'FLY'){
      type = 'cloud';
    } else if(game && game.mode === 'SWIM'){
      type = Math.random()<0.5 ? 'rock' : 'seaweed';
    } else {
      type = Math.random()<0.5 ? 'rock' : 'log';
    }
    const h = (type==='rock') ? 32 + Math.random()*18 : (type==='log'? 36 + Math.random()*30 : (type==='cloud'? 30 + Math.random()*20 : 44 + Math.random()*30));
    const w = (type==='rock') ? 40 + Math.random()*20 : (type==='log'? 70 + Math.random()*20 : (type==='cloud'? 60 + Math.random()*40 : 40 + Math.random()*10));
    const y = (type==='cloud') ? (floorY - 200 + Math.random()*120) : (type==='seaweed' ? (floorY - h + 10) : floorY - h);
    return { type, x: canvasW + 40, y, w, h, counted:false };
  }

  /* ---------------------- Bubbles (for SWIM mode) ---------------------- */
  function spawnBubble(){
    if(!game) return; const x = Math.random() * game.canvasW; const y = game.canvasH * 0.85 + Math.random()*30; return {x,y,r:4+Math.random()*8,v:20+Math.random()*40};
  }

  /* ---------------------- Core Lifecycle Functions ---------------------- */
  const ANIMALS = [
    {id:'Elephant', emoji:'🐘'},
    {id:'Monkey', emoji:'🐒'},
    {id:'Dragon', emoji:'🐉'},
    {id:'Butterfly', emoji:'🦋'},
    {id:'Snake', emoji:'🐍'},
    {id:'Eagle', emoji:'🦅'},
    {id:'Dog', emoji:'🐶'},
    {id:'Tiger', emoji:'🐯'}
  ];

  function initGame(){
    audio.init();
    game = {
      running:false,
      lastTime:0,
      accumScoreTime:0,
      score:0,
      bonus:0,
      highScore: +localStorage.getItem('monkeyEscapeHighScore')||0,
      canvasW:0, canvasH:0,
      floorY:0,
      scrollSpeed: CONST.BASE_SCROLL_SPEED,
      obstacleTimer: 0,
      obstacleInterval: CONST.OBSTACLE_BASE_INTERVAL,
      obstacles:[],
      monkey:null,
      elephant:null,
      elephantDistance: CONST.ELEPHANT_START_DISTANCE,
      elapsed:0,
      speedIncreaseTimer:0,
      debug:false,
      sounded:false,
      paused:false
    };

    resizeCanvas();
    game.monkey = createMonkey(game.floorY);
    game.elephant = createElephant(game.monkey.x);
    game.elephant.y = game.floorY - game.elephant.h + 6;
    updateHUD();
    bindEvents();
    showStart();
    renderAllScores();
    requestAnimationFrame(loop);
  }

  function resetGame(){
    game.score = 0; game.bonus = 0; game.accumScoreTime=0; game.elapsed=0; game.obstacles=[];
    game.scrollSpeed = CONST.BASE_SCROLL_SPEED; game.obstacleInterval = CONST.OBSTACLE_BASE_INTERVAL; game.speedIncreaseTimer=0;
    game.elephantDistance = CONST.ELEPHANT_START_DISTANCE;
    game.monkey = createMonkey(game.floorY);
    game.elephant = createElephant(game.monkey.x);
    game.elephant.y = game.floorY - game.elephant.h + 6;
    updateHUD();
  }

  /* ---------------------- Update + Draw Loop ---------------------- */
  function loop(timestamp){
    if(!game.lastTime) game.lastTime = timestamp;
    const dt = Math.min(0.06, (timestamp - game.lastTime)/1000); // seconds, clamp for safety
    game.lastTime = timestamp;

    if(game.running && !game.paused){
      updateGame(dt);
    }
    drawGame();
    requestAnimationFrame(loop);
  }

  function updateGame(dt){
    game.elapsed += dt;
    // Difficulty scaling every SPEED_INCREASE_INTERVAL
    game.speedIncreaseTimer += dt;
    if(game.speedIncreaseTimer >= CONST.SPEED_INCREASE_INTERVAL){
      game.speedIncreaseTimer = 0;
      game.scrollSpeed += CONST.SPEED_INCREASE_AMOUNT;
      game.obstacleInterval = Math.max(CONST.OBSTACLE_MIN_INTERVAL, game.obstacleInterval - CONST.OBSTACLE_FREQ_DECREASE);
    }

    // Monkey physics
    const m = game.monkey;
    if(m.slowTimer>0){ m.slowTimer -= dt; m.speedMultiplier = 0.6; } else { m.speedMultiplier = 1; }
    // adjust gravity per mode
    let localGravity = CONST.GRAVITY;
    if(game.mode === 'FLY') localGravity *= 0.35;
    if(game.mode === 'SWIM') localGravity *= 0.6;
    m.vy += localGravity * dt;
    m.y += m.vy * dt;
    if(m.y + m.h >= game.floorY){ m.y = game.floorY - m.h; m.vy = 0; m.onGround=true; m.isJumping=false; }

    // Obstacles movement and spawn
    game.obstacleTimer += dt;
    if(game.obstacleTimer >= game.obstacleInterval){
      game.obstacleTimer = 0;
      game.obstacles.push(spawnObstacle(game.floorY, game.canvasW));
    }
    // bubbles spawn in swim mode
    if(game.mode === 'SWIM'){
      if(!game.bubbles) game.bubbles = [];
      if(Math.random() < 0.14) game.bubbles.push(spawnBubble());
      for(let i=game.bubbles.length-1;i>=0;i--){
        const b = game.bubbles[i]; b.y -= b.v * dt; b.x += Math.sin((game.elapsed+i)*2) * 6 * dt;
        if(b.y < -20) game.bubbles.splice(i,1);
      }
    }
    for(let i=game.obstacles.length-1;i>=0;i--){
      const ob = game.obstacles[i];
      ob.x -= game.scrollSpeed * m.speedMultiplier * dt;
      // award bonus when passed
      if(!ob.counted && ob.x + ob.w < m.x){ ob.counted = true; game.bonus += 1; game.score += 5; }
      // remove offscreen
      if(ob.x + ob.w < -50) game.obstacles.splice(i,1);
      // collision detection
      if(checkCollision(m, ob)){
        // immediate caught per rules
        triggerGameOver();
      }
    }

    // Elephant logic
    // Elephant x is behind monkey by elephantDistance (we move it closer slowly)
    const desiredX = m.x - game.elephantDistance;
    // Elephant moves towards desiredX; if monkey slows, elephantDistance reduces faster
    const distanceDelta = (m.slowTimer>0) ? 140 * dt : 40 * dt;
    game.elephantDistance = Math.max(0, game.elephantDistance - distanceDelta);
    // move elephant x smoothly
    const ele = game.elephant;
    ele.x += ((desiredX - ele.x) * clamp(6*dt, 0, 1));

    // If elephant reaches monkey -> caught
    if(ele.x + ele.w >= m.x + 12){ triggerGameOver(); }

    // Score accumulation by time
    game.accumScoreTime += dt;
    if(game.accumScoreTime >= 1){ game.accumScoreTime -= 1; game.score += 1; }

    updateHUD();
  }

  function drawGame(){
    const w = game.canvasW, h = game.canvasH;
    ctx.clearRect(0,0,w,h);

    // Background parallax: two layers of trees moving slower than ground
    drawParallax(ctx, w, h, game.elapsed, game.scrollSpeed);

    // Ground
    const floorY = game.floorY;
    ctx.fillStyle = '#8d6e4a';
    ctx.fillRect(0, floorY, w, h-floorY);
    // ground stripe for texture
    ctx.fillStyle = '#7b5a34';
    for(let x= - (Math.floor(game.elapsed*game.scrollSpeed)%80); x<w; x+=80){
      ctx.fillRect(x, floorY+6, 40, 10);
    }

    // Draw obstacles
    for(const ob of game.obstacles){
      if(ob.type === 'cloud'){
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.beginPath(); ctx.ellipse(ob.x+ob.w*0.3, ob.y+ob.h*0.5, ob.w*0.4, ob.h*0.5,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(ob.x+ob.w*0.7, ob.y+ob.h*0.5, ob.w*0.35, ob.h*0.45,0,0,Math.PI*2); ctx.fill();
      } else if(ob.type === 'seaweed'){
        ctx.fillStyle = '#2e8b57'; for(let s=0;s<3;s++){ ctx.beginPath(); ctx.moveTo(ob.x + s*12, ob.y+ob.h); ctx.quadraticCurveTo(ob.x + s*12 - 6, ob.y + ob.h/2, ob.x + s*12 + 6, ob.y); ctx.lineTo(ob.x + s*12 + 8, ob.y); ctx.quadraticCurveTo(ob.x + s*12 - 2, ob.y + ob.h/2, ob.x + s*12, ob.y+ob.h); ctx.fill(); }
      } else {
        ctx.fillStyle = (ob.type==='rock') ? '#6b6b6b' : '#8b5a2b';
        roundRect(ctx, ob.x, ob.y, ob.w, ob.h, 6, true, false);
      }
      if(game.debug){ ctx.strokeStyle='red'; ctx.strokeRect(ob.x, ob.y, ob.w, ob.h); }
    }

    // Draw bubbles for SWIM mode
    if(game.mode === 'SWIM' && game.bubbles){
      for(const b of game.bubbles){ ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill(); ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.fillRect(b.x-1,b.y- b.r -4,2,8); }
    }

    // Draw players based on selection and mode
    const m = game.monkey;
    drawPlayer(game.playerA || {type:'Monkey'}, m.x, m.y, m.w, m.h, game.mode);
    const ele = game.elephant;
    drawPlayer(game.playerB || {type:'Elephant'}, ele.x, ele.y, ele.w, ele.h, game.mode);

    // Draw HUD inside canvas for nice mobile fallback
    // Draw HUD inside canvas for nice mobile fallback
    ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(8,8,160,36);
    ctx.fillStyle='white'; ctx.font='14px sans-serif'; ctx.textAlign='left'; ctx.fillText('SCORE: '+game.score, 12, 30);
    ctx.textAlign='right'; ctx.fillText('HIGH: '+game.highScore, 150, 30);

    // Debug meters
    if(game.debug){
      ctx.fillStyle='rgba(255,255,255,0.2)'; ctx.fillRect(10,50,200,44);
      ctx.fillStyle='black'; ctx.fillText('EleDist: '+Math.round(game.elephantDistance), 14, 76);
      // draw distance meter
      ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(12,90, Math.max(2, Math.min(180, game.elephantDistance*0.2)), 8);
      ctx.strokeStyle='red'; ctx.strokeRect(game.monkey.x, game.monkey.y, game.monkey.w, game.monkey.h);
    }
  }

  function drawPlayer(player, x, y, w, h, mode){
    // draw more original-looking animals using vector shapes
    ctx.save();
    const cx = x + w/2, cy = y + h/2;
    if(player.type === 'Elephant'){
      // Elephant: body, head, ear, trunk, leg
      ctx.fillStyle = '#cfcfcf';
      // body
      ctx.beginPath(); ctx.ellipse(cx - 6, cy+6, w*0.45, h*0.38, 0, 0, Math.PI*2); ctx.fill();
      // head
      ctx.beginPath(); ctx.ellipse(cx + w*0.18, cy - 2, w*0.28, h*0.26, 0, 0, Math.PI*2); ctx.fill();
      // ear
      ctx.beginPath(); ctx.ellipse(cx + w*0.05, cy - 6, w*0.22, h*0.3, -0.6, 0, Math.PI*2); ctx.fillStyle='#d4d4d4'; ctx.fill();
      // trunk
      ctx.fillStyle='#cfcfcf'; ctx.beginPath(); ctx.moveTo(cx + w*0.34, cy - 2); ctx.quadraticCurveTo(cx + w*0.55, cy + 6, cx + w*0.22, cy + 20); ctx.lineTo(cx + w*0.12, cy + 18); ctx.quadraticCurveTo(cx + w*0.4, cy + 10, cx + w*0.34, cy - 2); ctx.fill();
      // eye
      ctx.fillStyle='#2b2b2b'; ctx.beginPath(); ctx.arc(cx + w*0.28, cy - 6, 3, 0, Math.PI*2); ctx.fill();
      // legs
      ctx.fillStyle='#bfbfbf'; ctx.fillRect(cx - w*0.45, cy + h*0.25, w*0.16, h*0.22); ctx.fillRect(cx - w*0.05, cy + h*0.25, w*0.16, h*0.22);
    } else if(player.type === 'Monkey'){
      // Monkey: round head, ears, tail
      ctx.fillStyle = '#d4945a'; ctx.beginPath(); ctx.ellipse(cx, cy, w*0.36, h*0.42, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#f3d3b1'; ctx.beginPath(); ctx.ellipse(cx, cy+6, w*0.22, h*0.2, 0, 0, Math.PI*2); ctx.fill();
      // eyes
      ctx.fillStyle='#2b2b2b'; ctx.beginPath(); ctx.arc(cx-8, cy-4, 3,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(cx+8, cy-4, 3,0,Math.PI*2); ctx.fill();
      // tail
      ctx.strokeStyle='#8b5a2b'; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(cx - w*0.36, cy+6); ctx.quadraticCurveTo(cx - w*0.7, cy-8, cx - w*0.3, cy-28); ctx.stroke();
    } else if(player.type === 'Dragon'){
      // simple dragon silhouette with wings
      ctx.fillStyle = '#7b4b2b'; ctx.beginPath(); ctx.ellipse(cx-6, cy+6, w*0.4, h*0.28, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='#a33'; ctx.beginPath(); ctx.moveTo(cx + w*0.12, cy - h*0.18); ctx.lineTo(cx + w*0.5, cy - h*0.36); ctx.lineTo(cx + w*0.08, cy - h*0.02); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#2b2b2b'; ctx.beginPath(); ctx.arc(cx + w*0.08, cy - 6, 3,0,Math.PI*2); ctx.fill();
    } else if(player.type === 'Butterfly'){
      // wings
      ctx.fillStyle='#ff77cc'; ctx.beginPath(); ctx.ellipse(cx-10, cy, w*0.28, h*0.22, -0.4, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.ellipse(cx+10, cy, w*0.28, h*0.22, 0.4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='#2b2b2b'; ctx.fillRect(cx-2, cy-6, 4, 24);
    } else if(player.type === 'Snake'){
      ctx.strokeStyle='#3b7a57'; ctx.lineWidth=6; ctx.beginPath(); ctx.moveTo(cx - w*0.36, cy+12); ctx.quadraticCurveTo(cx, cy-14, cx + w*0.36, cy+12); ctx.stroke();
    } else if(player.type === 'Eagle'){
      ctx.fillStyle='#f4f0e6'; ctx.beginPath(); ctx.ellipse(cx, cy, w*0.34, h*0.22, 0, 0, Math.PI*2); ctx.fill(); ctx.fillStyle='#d4a017'; ctx.beginPath(); ctx.moveTo(cx+12,cy); ctx.lineTo(cx+28,cy-6); ctx.lineTo(cx+18,cy+4); ctx.fill();
    } else if(player.type === 'Dog'){
      ctx.fillStyle='#d1b39a'; roundRect(ctx, x, y, w, h, 10, true, false); ctx.fillStyle='#3b2b2b'; ctx.beginPath(); ctx.arc(cx+10, cy-6, 4,0,Math.PI*2); ctx.fill();
    } else if(player.type === 'Tiger'){
      ctx.fillStyle='#f4a460'; roundRect(ctx, x, y, w, h, 10, true, false); ctx.fillStyle='#000'; for(let i=-1;i<=1;i++) ctx.fillRect(cx + i*10 - 20, cy-6, 6, 2);
    } else {
      // fallback: emoji
      ctx.fillStyle = 'white'; roundRect(ctx, x, y, w, h, 12, true, false);
      ctx.font = '30px serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(getEmojiForType(player.type), x + w/2, y + h/2 + 2);
    }
    if(game.debug){ ctx.strokeStyle='rgba(255,0,0,0.6)'; ctx.strokeRect(x, y, w, h); }
    ctx.restore();
  }

  function getEmojiForType(type){ const a = getAnimalById(type); return a ? a.emoji : '❓'; }

  /* ---------------------- Helpers for drawing ---------------------- */
  function drawParallax(ctx, w, h, elapsed, scrollSpeed){
    // Draw different backgrounds per mode
    const mode = game.mode || 'RUN';
    if(mode === 'FLY'){
      // Sky gradient and distant clouds
      ctx.fillStyle = 'linear-gradient';
      const g = ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0,'#87CEEB'); g.addColorStop(1,'#cfeefd'); ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
      // moving clouds
      const cloudSpeed = scrollSpeed * 0.15;
      for(let x = -((elapsed*cloudSpeed)%300); x < w+300; x += 220){ drawCloud(ctx, x, h*0.18 + Math.sin((elapsed+x)/40)*8, 80, 36); }
    } else if(mode === 'SWIM'){
      // Underwater gradient
      const g = ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0,'#0ea5c9'); g.addColorStop(1,'#036b7a'); ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
      // sea floor
      ctx.fillStyle = '#274b3f'; ctx.fillRect(0, h*0.78, w, h*0.22);
    } else {
      // RUN mode: forest background
      const g = ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0,'#b4e7bf'); g.addColorStop(1,'#cfead0'); ctx.fillStyle = g; ctx.fillRect(0,0,w,h*0.6);
      // simple repeated tree shapes
      const layer1Speed = scrollSpeed * 0.25;
      const layer2Speed = scrollSpeed * 0.55;
      for(let x = -((elapsed*layer1Speed)%300); x < w + 300; x += 300){ drawTree(ctx, x, h*0.45, 1.0); }
      for(let x = -((elapsed*layer2Speed)%180); x < w + 180; x += 180){ drawTree(ctx, x, h*0.6, 0.7); }
    }
  }

  function drawCloud(ctx, x, y, w, h){
    ctx.save(); ctx.fillStyle='rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.ellipse(x+0.3*w,y, w*0.45, h*0.6,0,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.ellipse(x+0.7*w,y, w*0.35, h*0.55,0,0,Math.PI*2); ctx.fill(); ctx.restore();
  }

  function drawTree(ctx, x, baseY, scale){
    ctx.save(); ctx.translate(x, baseY); ctx.scale(scale, scale);
    ctx.fillStyle = '#2e7d32'; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(24,-60); ctx.lineTo(48,0); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#6d4c41'; ctx.fillRect(20,0,8,20);
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke){
    if(typeof r==='undefined') r=6; ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); if(fill) ctx.fill(); if(stroke) ctx.stroke();
  }

  function checkCollision(a,b){
    return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
  }

  /* ---------------------- Input & UI ---------------------- */
  function getAnimalById(id){ return ANIMALS.find(a=>a.id===id); }

  function setupAnimalSelection(){
    const items = document.querySelectorAll('.animalItem');
    items.forEach(it=>{
      it.addEventListener('click', ()=>{
        it.classList.toggle('selected');
        handleSelectionChange();
      });
    });
  }

  function handleSelectionChange(){
    const selected = Array.from(document.querySelectorAll('.animalItem.selected'));
    // limit to two
    if(selected.length>2) selected[0].classList.remove('selected');
    const newSel = Array.from(document.querySelectorAll('.animalItem.selected'));
    const preview = document.getElementById('startPreview');
    if(preview){ preview.innerHTML = newSel.map(s=>s.textContent).join(' vs '); }
    // update modal preview if open
    const modalPreview = document.getElementById('modalPreview');
    if(modalPreview){ modalPreview.textContent = newSel.map(s=>s.textContent).join(' vs '); }
    // set default names in modal inputs
    if(newSel.length>=1){ const aId = newSel[0].dataset.animal; const na = document.getElementById('nameAInput'); if(na) na.value = aId; }
    if(newSel.length>=2){ const bId = newSel[1].dataset.animal; const nb = document.getElementById('nameBInput'); if(nb) nb.value = bId; }
    // if two selected, open modal automatically
    if(newSel.length===2){ openSelectionModal(); }
  }

  function askModeAndStart(){
    // (deprecated) use modal-driven flow instead
    openSelectionModal();
  }

  /* ---------------------- Modal flow ---------------------- */
  function openSelectionModal(){
    const sel = Array.from(document.querySelectorAll('.animalItem.selected'));
    const modal = document.getElementById('selectionModal');
    const msg = document.getElementById('modalMsg');
    const preview = document.getElementById('modalPreview');
    const na = document.getElementById('nameAInput');
    const nb = document.getElementById('nameBInput');
    if(!modal) return;
    if(sel.length < 2){ msg.textContent = 'Please select two animals from the left panel first.'; preview.textContent=''; na.value=''; nb.value=''; }
    else { msg.textContent = 'Enter names and choose mode.'; preview.textContent = sel.map(s=>s.textContent).join(' vs '); na.value = sel[0].dataset.animal; nb.value = sel[1].dataset.animal; }
    modal.classList.remove('hidden');
  }

  function closeSelectionModal(){ const modal = document.getElementById('selectionModal'); if(modal) modal.classList.add('hidden'); }

  // modal button handlers
  function setupModalHandlers(){
    const modeRun = document.getElementById('modeRun');
    const modeFly = document.getElementById('modeFly');
    const modeSwim = document.getElementById('modeSwim');
    const start = document.getElementById('modalStart');
    const cancel = document.getElementById('modalCancel');
    modeRun && modeRun.addEventListener('click', ()=>{ game._selectedMode='RUN'; modeRun.style.outline='3px solid #3b7a57'; modeFly.style.outline=''; modeSwim.style.outline=''; tryStartFromModal(); });
    modeFly && modeFly.addEventListener('click', ()=>{ game._selectedMode='FLY'; modeFly.style.outline='3px solid #3b7a57'; modeRun.style.outline=''; modeSwim.style.outline=''; tryStartFromModal(); });
    modeSwim && modeSwim.addEventListener('click', ()=>{ game._selectedMode='SWIM'; modeSwim.style.outline='3px solid #3b7a57'; modeRun.style.outline=''; modeFly.style.outline=''; tryStartFromModal(); });
    start && start.addEventListener('click', ()=>{
      const sel = Array.from(document.querySelectorAll('.animalItem.selected'));
      if(sel.length < 2) { alert('Select two animals first.'); return; }
      const na = document.getElementById('nameAInput').value.trim() || sel[0].dataset.animal;
      const nb = document.getElementById('nameBInput').value.trim() || sel[1].dataset.animal;
      game.playerA = { type: sel[0].dataset.animal, name: na };
      game.playerB = { type: sel[1].dataset.animal, name: nb };
      game.mode = game._selectedMode || 'RUN';
      closeSelectionModal(); resetGame(); startGame(true);
    });
    cancel && cancel.addEventListener('click', ()=>{ closeSelectionModal(); });
    // Enter key on inputs starts the game
    const naInput = document.getElementById('nameAInput');
    const nbInput = document.getElementById('nameBInput');
    [naInput, nbInput].forEach(inp=>{ if(!inp) return; inp.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') tryStartFromModal(); }); });
  }

  function tryStartFromModal(){
    const sel = Array.from(document.querySelectorAll('.animalItem.selected'));
    if(sel.length < 2) return; // need two
    const na = document.getElementById('nameAInput').value.trim() || sel[0].dataset.animal;
    const nb = document.getElementById('nameBInput').value.trim() || sel[1].dataset.animal;
    const mode = game._selectedMode || 'RUN';
    // commit and start
    game.playerA = { type: sel[0].dataset.animal, name: na };
    game.playerB = { type: sel[1].dataset.animal, name: nb };
    game.mode = mode;
    closeSelectionModal(); resetGame(); startGame(true);
  }

  function renderAllScores(){
    const el = document.getElementById('allScoresList'); if(!el) return;
    const list = JSON.parse(localStorage.getItem('monkeyEscapeAllScores')||'[]');
    el.innerHTML = list.map(it=> `<div style="padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.04)"><strong>${it.score}</strong> — ${it.players[0]} vs ${it.players[1]} (${it.mode})</div>`).join('') || '<div style="opacity:0.8">No scores yet</div>';
  }

  function bindEvents(){
    window.addEventListener('keydown', e=>{
      if(e.code === 'Space'){ e.preventDefault(); playerJump(); }
      if(e.key === 'd' || e.key === 'D'){ toggleDebug(); }
    });
    window.addEventListener('resize', resizeCanvas);
    startBtn.addEventListener('click', ()=>{
      const sel = Array.from(document.querySelectorAll('.animalItem.selected'));
      if(sel.length >= 2){
        const naEl = document.getElementById('nameAInput');
        const nbEl = document.getElementById('nameBInput');
        const na = naEl && naEl.value.trim() ? naEl.value.trim() : sel[0].dataset.animal;
        const nb = nbEl && nbEl.value.trim() ? nbEl.value.trim() : sel[1].dataset.animal;
        game.playerA = { type: sel[0].dataset.animal, name: na };
        game.playerB = { type: sel[1].dataset.animal, name: nb };
        game.mode = game._selectedMode || 'RUN';
        closeSelectionModal(); resetGame(); startGame(true);
      } else {
        openSelectionModal();
      }
    });
    restartBtn.addEventListener('click', ()=>{ startGame(true); });
    soundToggle.addEventListener('click', ()=>{ audio.enabled = !audio.enabled; updateSoundUI(); if(audio.enabled) audio.ambientStart(); else audio.ambientStop(); });
    debugToggle.addEventListener('click', ()=>{ toggleDebug(); });
    // mobile jump button
    jumpBtn.addEventListener('touchstart', (e)=>{ e.preventDefault(); playerJump(); });
    jumpBtn.addEventListener('mousedown', (e)=>{ e.preventDefault(); playerJump(); });
    // initialize selection UI
    setupAnimalSelection();
    setupModalHandlers();
  }

  function updateHUD(){
    scoreEl.textContent = '' + game.score;
    highScoreEl.textContent = 'High: ' + game.highScore;
  }

  function updateSoundUI(){ soundToggle.textContent = audio.enabled ? '🔊' : '🔇'; }

  function showStart(){ startScreen.classList.remove('hidden'); gameOverScreen.classList.add('hidden'); jumpBtn.classList.toggle('hidden', !isTouchDevice()); }

  function startGame(isRestart=false){
    startScreen.classList.add('hidden'); gameOverScreen.classList.add('hidden');
    if(isRestart) resetGame();
    game.running = true; game.lastTime = 0; game.accumScoreTime = 0; game.elapsed = 0; game.obstacleTimer=0; game.obstacles=[];
    if(audio.enabled) audio.ambientStart();
  }

  function showGameOver(){
    game.running = false;
    if(audio.enabled) audio.ambientStop(); audio.over();
    gameOverScreen.classList.remove('hidden');
    finalScoreEl.textContent = 'Score: ' + game.score;
    finalTimeEl.textContent = 'Survived: ' + Math.floor(game.elapsed) + 's';
    // high score
    if(game.score > game.highScore){ game.highScore = game.score; localStorage.setItem('monkeyEscapeHighScore', String(game.highScore)); }
    finalHighEl.textContent = 'High Score: ' + game.highScore;
    highScoreEl.textContent = 'High: ' + game.highScore;
    jumpBtn.classList.add('hidden');
    // save to all players scores
    try{
      const list = JSON.parse(localStorage.getItem('monkeyEscapeAllScores')||'[]');
      list.unshift({players:[game.playerA?.name||'A', game.playerB?.name||'B'], score:game.score, mode:game.mode||'RUN', time:Math.floor(game.elapsed)});
      localStorage.setItem('monkeyEscapeAllScores', JSON.stringify(list.slice(0,50)));
      renderAllScores();
    }catch(e){ console.warn(e); }
  }

  function triggerGameOver(){ if(game.running){ audio.over(); showGameOver(); } }

  function playerJump(){ if(!game || !game.running) return; const m = game.monkey; if(m.isJumping) return; // single jump only
    m.vy = CONST.JUMP_VELOCITY; m.isJumping=true; m.onGround=false; audio.jump(); }

  function toggleDebug(){ game.debug = !game.debug; debugToggle.style.background = game.debug ? '#ffe4b5' : ''; }

  function isTouchDevice(){ return 'ontouchstart' in window || navigator.maxTouchPoints>0; }

  /* ---------------------- Resizing ---------------------- */
  function resizeCanvas(){
    const rect = canvas.getBoundingClientRect();
    // choose device pixel ratio for crispness
    const dpr = window.devicePixelRatio || 1;
    const parentW = canvas.clientWidth || rect.width || 800;
    const parentH = Math.max(320, window.innerHeight * 0.6);
    canvas.width = Math.floor(parentW * dpr);
    canvas.height = Math.floor(parentH * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    game.canvasW = canvas.width / dpr; game.canvasH = canvas.height / dpr;
    game.floorY = game.canvasH * (1 - CONST.FLOOR_HEIGHT_RATIO);
    // ensure monkey and elephant reposition relative to floor
    if(game && game.monkey){ game.monkey.y = game.floorY - game.monkey.h; game.elephant.y = game.floorY - game.elephant.h + 6; }
  }

  /* ---------------------- Initialization ---------------------- */
  // kick off
  initGame();

  // expose the required function names to satisfy the prompt (kept in closure)
  window.initGame = initGame;
  window.updateGame = updateGame;
  window.drawGame = drawGame;
  window.spawnObstacle = spawnObstacle;
  window.resetGame = resetGame;

})();
