/* app.js - extracted from original index.html and organized */

/* ======================
   PRNG
   ====================== */
function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}
function initSeed(){
  let seed = localStorage.getItem('fg_seed');
  if(!seed){
    seed = Math.floor(Math.random()*1e9).toString();
    localStorage.setItem('fg_seed', seed);
  }
  return Number(seed);
}
let seed = initSeed();
let rand = mulberry32(seed);

/* ======================
   State + Persistence
   ====================== */
const STORAGE_KEY = 'fg_state_v5_multi_fish_mission';
let state = {
  gold: 250,
  rodLevel: 1,
  maxDistance: 0,
  inventory: [],
  equippedEnchant: 'none',
  bestFish: {},
  currentMission: null
};
function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw){
    try{ Object.assign(state, JSON.parse(raw)); } catch(e){}
  }
  if (!state.currentMission) generateNewMission();
  syncUI();
}
function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  syncUI();
}

/* ======================
   Data: fish, enchants
   ====================== */
const FISH_TYPES = [
  {id:'common', name:'Ikan Mas', displayName:'<span style="color:var(--fish-common);">Ikan Mas</span>', base:20, weight:60, difficulty:1},
  {id:'blue', name:'Neon Tetra', displayName:'<span style="color:var(--fish-blue);text-shadow:0 0 3px var(--fish-blue);">Neon Tetra</span>', base:60, weight:25, difficulty:2},
  {id:'rare', name:'Arowana', displayName:'<span style="color:var(--fish-rare);font-weight:600;text-shadow:0 0 5px var(--fish-rare);">Arowana</span>', base:180, weight:8, difficulty:4},
  {id:'legend', name:'Coelacanth', displayName:'<span style="color:var(--fish-legend);font-weight:bold;text-shadow:0 0 7px var(--fish-legend);">Coelacanth</span>', base:500, weight:3, difficulty:7},
  {id:'ancient', name:'Dunkleosteus', displayName:'<span style="color:var(--fish-ancient);text-shadow:0 0 5px #ffffff;">Dunkleosteus</span>', base:300, weight:2, difficulty:5},
  {id:'mythical', name:'Leedsichthys', displayName:'<span style="color:var(--fish-mythical);text-shadow:0 0 6px var(--fish-mythical);">Leedsichthys</span>', base:400, weight:1.5, difficulty:6},
  {id:'cosmic', name:'Megalodon', displayName:'<span style="color:var(--fish-cosmic);text-shadow:0 0 8px #ffffff;">Megalodon</span>', base:600, weight:1, difficulty:8},
  {id:'rainbow', name:'Rainbow Trout', displayName:'<span style="background:var(--fish-rainbow);-webkit-background-clip:text;-webkit-text-fill-color:transparent;text-shadow:0 0 5px #ffffff;">Rainbow Trout</span>', base:800, weight:0.5, difficulty:9},
  {id:'dragon', name:'Sea Dragon', displayName:'<span style="background:var(--fish-dragon);-webkit-background-clip:text;-webkit-text-fill-color:transparent;text-shadow:0 0 5px #FF4500;">Sea Dragon</span>', base:1000, weight:0.3, difficulty:10}
];

const ENCHANT_POOL = [
  {id:'lucky', name:'Lucky', weight: 30},
  {id:'deep', name:'Deep', weight: 25},
  {id:'steady', name:'Steady', weight: 25},
  {id:'golden', name:'Golden', weight: 15},
  {id:'ancient', name:'Ancient', weight: 5}
];

function rollEnchant(){
  const total = ENCHANT_POOL.reduce((s,i)=>s+i.weight,0);
  let r = rand() * total;
  for(const it of ENCHANT_POOL){
    if(r < it.weight) return it;
    r -= it.weight;
  }
  return ENCHANT_POOL[0];
}

function computeWeightedList(distance){
  const enchant = state.equippedEnchant || 'none';
  const isFar = distance > 220;
  const isVeryFar = distance > 300;
  return FISH_TYPES.map(ft => {
    let w = ft.weight;
    if(ft.id === 'legend' && enchant !== 'ancient'){
      w = Math.max(0.2, w * 0.12);
    }
    if(ft.id === 'ancient' && enchant === 'ancient'){
      w = w * 2.5;
    }
    if(ft.id === 'rainbow' && isVeryFar){
      w = w * 1.5;
    }
    if(enchant === 'lucky' && (ft.id === 'rare' || ft.id === 'legend' || ft.id === 'mythical')){
      w = w * 2.0;
    }
    if(enchant === 'deep' && isFar && (ft.id === 'blue' || ft.id === 'rare' || ft.id === 'cosmic')){
      w = w * 1.8;
    }
    if(distance > 260) w = w * 1.05;
    return Object.assign({}, ft, {weight: w});
  });
}

function prngChoiceByDistance(list, distance){
  const adjusted = computeWeightedList(distance);
  const total = adjusted.reduce((s,i)=>s+i.weight,0);
  let r = rand() * total;
  for(const it of adjusted){
    if(r < it.weight) return it;
    r -= it.weight;
  }
  return adjusted[0];
}

/* ======================
   Mission Logic
   ====================== */
function generateNewMission() {
  const fish = FISH_TYPES[Math.floor(rand() * FISH_TYPES.length)];
  const required = Math.floor(1 + rand() * 5);
  const reward = Math.floor(fish.base * required * (1 + rand() * 0.5));
  state.currentMission = {
    fishType: fish.id,
    fishName: fish.name,
    required: required,
    count: 0,
    reward: reward
  };
  saveState();
  renderMission();
}
function updateMissionProgress(caughtFishType) {
  if (state.currentMission && state.currentMission.fishType === caughtFishType) {
    state.currentMission.count++;
    if (state.currentMission.count >= state.currentMission.required) {
      state.gold += state.currentMission.reward;
      showToast(`Misi selesai! +${state.currentMission.reward} Gold`);
      generateNewMission();
    } else {
      showToast(`Progres misi: ${state.currentMission.count}/${state.currentMission.required}`);
      renderMission();
    }
    saveState();
  }
}
function renderMission() {
  const missionList = document.getElementById('missionList');
  missionList.innerHTML = '';
  if (state.currentMission) {
    const el = document.createElement('div');
    el.className = 'mission-item';
    const progressPercent = (state.currentMission.count / state.currentMission.required) * 100;
    el.innerHTML = `
      <div><strong>Tangkap ${state.currentMission.required} ${state.currentMission.fishName}</strong></div>
      <div class="small">Hadiah: ${state.currentMission.reward} Gold</div>
      <div class="small">Progres: ${state.currentMission.count}/${state.currentMission.required}</div>
      <div class="mission-progress"><div class="mission-progress-bar" style="width: ${progressPercent}%"></div></div>
    `;
    missionList.appendChild(el);
  } else {
    missionList.innerHTML = '<div class="muted small">Tidak ada misi saat ini.</div>';
  }
}

/* ======================
   UI refs
   ====================== */
const currentEl = document.getElementById('current');
const maxEl = document.getElementById('max');
const goldEl = document.getElementById('gold');
const rodLevelEl = document.getElementById('rodLevel');
const shopGoldEl = document.getElementById('shopGold');
const upgradePriceUI = document.getElementById('upgradePriceUI');
const rodEnchantEl = document.getElementById('rodEnchant');
const bobber = document.getElementById('bobber');
const rod = document.getElementById('rod');
const water = document.getElementById('water');
const castBtn = document.getElementById('castBtn');
const reelBtn = document.getElementById('reelBtn');
const reelTapHint = document.getElementById('reelTapHint');
const pullContainer = document.getElementById('pullContainer');
const pullBar = document.getElementById('pullBar');
const pullTimeEl = document.getElementById('pullTime');
const pullEffectsContainer = document.getElementById('pullEffectsContainer');

const shopBtn = document.getElementById('shopBtn');
const invBtn = document.getElementById('invBtn');
const museumBtn = document.getElementById('museumBtn');
const missionBtn = document.getElementById('missionBtn');
const settingsBtn = document.getElementById('settingsBtn');
const shopPanel = document.getElementById('shopPanel');
const invPanel = document.getElementById('invPanel');
const museumPanel = document.getElementById('museumPanel');
const missionPanel = document.getElementById('missionPanel');
const settingsPanel = document.getElementById('settingsPanel');
const invList = document.getElementById('invList');
const museumList = document.getElementById('museumList');
const buyUpgradeBtn = document.getElementById('buyUpgradeBtn');
const buyCoinBtn = document.getElementById('buyCoinBtn');
const sellAllBtn = document.getElementById('sellAllBtn');
const closeInvBtn = document.getElementById('closeInvBtn');
const resetBtn = document.getElementById('resetBtn');
const buyGachaBtn = document.getElementById('buyGachaBtn');

const toastEl = document.getElementById('toast');

/* ======================
   UI Sync / Init
   ====================== */
function upgradePrice(){ return 100 + (state.rodLevel - 1) * 120; }

function renderInventory(){
  invList.innerHTML = '';
  if(state.inventory.length === 0){
    invList.innerHTML = '<div class="muted small">Belum ada ikan di inventory.</div>';
    return;
  }
  for(const it of state.inventory.slice().reverse()){
    const el = document.createElement('div');
    el.className = 'inv-item';
    el.innerHTML = `<div><strong>${it.displayName || it.name}</strong><div class="small">Value: ${it.value} Gold</div></div>
                    <div><button class="btn sellBtn" data-id="${it.id}" style="background:#198754">Jual</button></div>`;
    invList.appendChild(el);
  }
  Array.from(document.getElementsByClassName('sellBtn')).forEach(b=>{
    b.onclick = ()=> sellOne(b.dataset.id);
  });
}

function renderMuseum(){
  museumList.innerHTML = '';
  if(Object.keys(state.bestFish).length === 0){
    museumList.innerHTML = '<div class="muted small">Belum ada ikan terbaik. Tangkap lebih banyak!</div>';
    return;
  }
  for(const type in state.bestFish){
    const fish = state.bestFish[type];
    const el = document.createElement('div');
    el.className = 'museum-item';
    const imgMap = getImgMap();
    const imgSrc = imgMap[type] || imgMap.common;
    el.innerHTML = `
      <img class="museum-img" src="${imgSrc}" alt="${fish.name}" style="border: 2px solid var(--fish-${type}); box-shadow: 0 0 6px var(--fish-${type});">
      <div>
        <strong>${fish.displayName || fish.name}</strong>
        <div class="small">Value Tertinggi: ${fish.value} Gold</div>
      </div>`;
    museumList.appendChild(el);
  }
}

function updateRodAura(){
  let aura = 'none';
  if(state.rodLevel >= 10) aura = 'legendary';
  else if(state.rodLevel >= 5) aura = 'mystic';
  else if(state.rodLevel >= 2) aura = 'fiery';
  rod.dataset.aura = aura;
}

function syncUI(){
  currentEl.textContent = (0).toFixed(1);
  maxEl.textContent = state.maxDistance.toFixed(1);
  goldEl.textContent = state.gold;
  rodLevelEl.textContent = state.rodLevel;
  shopGoldEl.textContent = state.gold;
  upgradePriceUI.textContent = upgradePrice();
  rodEnchantEl.textContent = state.equippedEnchant === 'none' ? 'None' : state.equippedEnchant.charAt(0).toUpperCase() + state.equippedEnchant.slice(1);

  bobber.dataset.enchant = state.equippedEnchant || 'none';
  updateRodAura();

  renderInventory();
  renderMuseum();
  renderMission();
}
loadState();

/* ======================
   Flow variables
   ====================== */
let flowState = 'idle';
let biteTimer = null;
let pullState = null;
let particleInterval = null;
let isHoldingPull = false;
let pullLoopHandle = null;
let castTime = 0; 

/* ======================
   Casting & bite schedule
   ====================== */
castBtn.addEventListener('click', ()=> {
  if(flowState !== 'idle') return;
  flowState = 'throwing';
  showToast('Kail dilempar');
  const distance = (Math.floor(rand() * (320 + state.rodLevel * 40)) + 40).toFixed(1);
  currentEl.textContent = distance;
  if(Number(distance) > state.maxDistance){ state.maxDistance = Number(distance); saveState(); }

  bobber.style.transition = 'none';
  bobber.querySelector('.bobber-core').style.transform = 'scale(1.06)';

  setTimeout(()=>{
    bobber.style.transition = 'bottom 240ms ease-out, transform 200ms';
    bobber.style.bottom = '78%';
    bobber.querySelector('.bobber-core').style.transform = '';
    bobber.querySelector('.bobber-core').style.animation = `bob ${1.8 + Math.random()*0.8}s ease-in-out infinite`;
    bobber.style.animation = `sway ${(2 + Math.random()*1.5).toFixed(2)}s ease-in-out infinite`;
    spawnRipple();
    flowState = 'floating';
    castTime = Date.now(); 
    reelBtn.style.display = 'inline-block';
    reelTapHint.style.display = 'none';
    schedulePossibleBite(Number(distance));
  }, 900);
});

function schedulePossibleBite(distance){
  if(biteTimer) { clearTimeout(biteTimer); biteTimer = null; }
  const baseDelay = 900 + Math.floor(rand()*4000);
  const enchant = state.equippedEnchant || 'none';
  let biteChance = 0.18 + state.rodLevel * 0.08 + rand()*0.18;
  if(enchant === 'lucky') biteChance += 0.06;
  if(enchant === 'deep' && distance > 220) biteChance += 0.05;
  biteChance = Math.min(0.92, biteChance);
  biteTimer = setTimeout(()=>{
    biteTimer = null;
    if(flowState !== 'floating') return;
    if(rand() < biteChance){
      const chosen = prngChoiceByDistance(distance);
      startPullMiniGame(chosen, distance);
    } else {
      if(rand() < 0.35) schedulePossibleBite(distance);
      else showToast('Tidak ada yang menggigit, tetap di air');
    }
  }, baseDelay);
}

/* ======================
   Pull mini-game + loop
   ====================== */
function spawnPullParticle(fishType) {
  if (!pullEffectsContainer) return;
  const p = document.createElement('div');
  p.className = 'pull-particle ' + (fishType || 'common');

  const endX = (rand() * 160 - 80) + 'px';
  const animDuration = (0.8 + rand() * 0.6).toFixed(2);

  p.style.setProperty('--end-x', endX);
  p.style.animationDuration = animDuration + 's';

  pullEffectsContainer.appendChild(p);

  setTimeout(() => p.remove(), parseFloat(animDuration) * 1000);
}

function startPullMiniGame(fish, distance){
    flowState = 'pulling';

    if (particleInterval) clearInterval(particleInterval);
    particleInterval = setInterval(() => {
        if (flowState === 'pulling') spawnPullParticle(fish.id);
    }, 150);

    const difficulty = fish.difficulty || 1;
    const enchant = state.equippedEnchant || 'none';

    const trackHeight = 250;
    const playerBarHeight = 60;
    const fishHeight = 30;

    let playerBarSize = playerBarHeight;
    if (enchant === 'steady') {
        playerBarSize = playerBarHeight * 1.35;
    }

    pullState = {
        fish,
        timeLeft: Math.max(4.0, 7.0 - difficulty * 0.35 + rand() * 1.4),
        catchProgress: 25,
        catchRate: 15 + (state.rodLevel * 1.5),
        decayRate: 10 + difficulty * 1.5,
        playerY: 0,
        playerVel: 0,
        playerBoost: 0.8 + (state.rodLevel * 0.05),
        gravity: 1.1,
        fishY: trackHeight / 2,
        fishTargetY: trackHeight / 2,
        fishSpeed: 0.5 + difficulty * 0.2,
        fishTimer: 0,
        trackHeight: trackHeight,
        playerBarHeight: playerBarSize,
        fishHeight: fishHeight
    };

    if (enchant === 'steady') {
        pullState.gravity *= 0.8;
        pullState.playerBoost *= 1.1;
    }

    document.getElementById('sdvContainer').style.display = 'flex';
    document.getElementById('sdvPlayerBar').style.height = playerBarSize + 'px';
    
    // Update hint text
    reelTapHint.textContent = "Tahan & Lepas!";
    reelTapHint.style.display = 'block';

    pullContainer.style.display = 'block';
    pullBar.style.width = pullState.catchProgress + '%';
    pullTimeEl.textContent = pullState.timeLeft.toFixed(1) + 's';

    showToast('Ikan menggigit! Tahan & Lepas untuk menyeimbangkan!');

    pullLoopStart();
}

let lastTime = 0;
function pullLoopStart() {
  if (pullLoopHandle) cancelAnimationFrame(pullLoopHandle);
  lastTime = performance.now();
  pullLoopHandle = requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
  if (!pullState || flowState !== 'pulling') {
    cancelAnimationFrame(pullLoopHandle);
    return;
  }

  const deltaTime = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  pullState.timeLeft -= deltaTime;

  pullState.fishTimer -= deltaTime * 60;
  if (pullState.fishTimer <= 0) {
    const fishDifficulty = pullState.fish.difficulty || 1;
    pullState.fishTargetY = rand() * (pullState.trackHeight - pullState.fishHeight);
    pullState.fishTimer = 40 + rand() * (120 - fishDifficulty * 8);
    pullState.fishSpeed = 0.5 + fishDifficulty * 0.2 + rand() * (fishDifficulty * 0.1);
  }

  if (pullState.fishY < pullState.fishTargetY) {
    pullState.fishY = Math.min(pullState.fishY + pullState.fishSpeed * deltaTime * 60, pullState.fishTargetY);
  } else {
    pullState.fishY = Math.max(pullState.fishY - pullState.fishSpeed * deltaTime * 60, pullState.fishTargetY);
  }

  if (isHoldingPull) {
    pullState.playerVel += pullState.playerBoost * deltaTime * 60;
  } else {
    pullState.playerVel -= pullState.gravity * deltaTime * 60;
  }

  pullState.playerVel = Math.max(-15, Math.min(15, pullState.playerVel));
  pullState.playerVel *= 0.92;
  pullState.playerY += pullState.playerVel * deltaTime * 60;

  const maxPlayerY = pullState.trackHeight - pullState.playerBarHeight;
  if (pullState.playerY < 0) {
    pullState.playerY = 0;
    pullState.playerVel = 0;
  }
  if (pullState.playerY > maxPlayerY) {
    pullState.playerY = maxPlayerY;
    pullState.playerVel = 0;
  }

  const playerTop = pullState.playerY + pullState.playerBarHeight;
  const fishTop = pullState.fishY + pullState.fishHeight;

  const isOverlapping = (pullState.playerY < fishTop) && (playerTop > pullState.fishY);

  if (isOverlapping) {
    pullState.catchProgress += pullState.catchRate * deltaTime;
    rod.style.transform = `translateX(-50%) rotate(${rand()*2 - 1}deg)`;
  } else {
    pullState.catchProgress -= pullState.decayRate * deltaTime;
    rod.style.transform = 'translateX(-50%)';
  }
  pullState.catchProgress = Math.max(0, Math.min(100, pullState.catchProgress));

  document.getElementById('sdvPlayerBar').style.bottom = pullState.playerY + 'px';
  document.getElementById('sdvFishIcon').style.bottom = pullState.fishY + 'px';
  pullBar.style.width = pullState.catchProgress + '%';
  pullTimeEl.textContent = Math.max(0, pullState.timeLeft).toFixed(1) + 's';

  if (pullState.catchProgress >= 100) {
    endPullMiniGame(true);
  } else if (pullState.timeLeft <= 0 || pullState.catchProgress <= 0) {
    endPullMiniGame(false);
  } else {
    pullLoopHandle = requestAnimationFrame(gameLoop);
  }
}

function endPullMiniGame(success){
    if (particleInterval) {
        clearInterval(particleInterval);
        particleInterval = null;
    }
    if (pullEffectsContainer) pullEffectsContainer.innerHTML = '';

    if(pullLoopHandle) {
        cancelAnimationFrame(pullLoopHandle);
        pullLoopHandle = null;
    }

    setHold(false);

    pullContainer.style.display = 'none';
    document.getElementById('sdvContainer').style.display = 'none';

    reelTapHint.style.display = 'none';
    const fish = pullState ? pullState.fish : null;
    const enchant = state.equippedEnchant || 'none';

    if (!success && pullState && pullState.catchProgress <= 0) {
        showToast('Ikan lepas karena progress habis!');
    } else if (!success) {
        showToast('Ikan lepas... Waktu habis!');
    } else {
      let allow = true;
      if((fish.id === 'legend' || fish.id === 'ancient' || fish.id === 'cosmic') && enchant !== 'ancient'){
        if(rand() > 0.18) allow = false;
      }

      if(!allow){
        showToast('Ikan langka meloloskan diri. (butuh Ancient Enchant)');
      } else {
        const chosen = fish;

        let value = Math.max(5, Math.floor(chosen.base + chosen.base * (0.25 * state.rodLevel) + rand()* chosen.base));
        if (enchant === 'golden') {
          value = Math.floor(value * 1.5);
        }

        const id = 'f_' + Date.now() + '_' + Math.floor(rand()*1000);
        const item = {id, type: chosen.id, name: chosen.name, displayName: chosen.displayName, value, ts: Date.now()};
        state.inventory.push(item);

        const type = chosen.id;
        if (!state.bestFish[type] || value > state.bestFish[type].value) {
          state.bestFish[type] = {name: chosen.name, displayName: chosen.displayName, value};
          showToast('Rekor baru! ' + chosen.name + ' ditambahkan ke Museum.');
        }

        updateMissionProgress(type);

        saveState();
        showCatchEffect();
        showCaughtImg(chosen.id);
        showToast(`Berhasil! Mendapat ${chosen.name} (Value: ${value} Gold)`);
      }
    }

    pullState = null;
    bobber.style.transition = 'bottom 700ms cubic-bezier(.22,.9,.27,1), transform 700ms';
    bobber.style.bottom = 'calc(120px + 35vh)';
    bobber.style.animation = '';
    bobber.querySelector('.bobber-core').style.animation = '';
    flowState = 'idle';
    reelBtn.style.display = 'none';
}

/* manual reel (Click only) */
reelBtn.addEventListener('click', ()=> {
  // Jika sedang mini-game, click biasa tidak melakukan apa-apa 
  // (mekanisme pointerdown/up yang menangani mini-game)
  if(flowState === 'pulling') {
    return;
  }
  if(flowState !== 'floating') return;
  flowState = 'reeling';
  reelBtn.style.display = 'none';
  spawnRipple();
  bobber.style.transition = 'bottom 700ms cubic-bezier(.22,.9,.27,1), transform 700ms';
  bobber.style.bottom = 'calc(120px + 35vh)';
  bobber.style.animation = '';
  bobber.querySelector('.bobber-core').style.animation = '';
  if(biteTimer){ clearTimeout(biteTimer); biteTimer = null; }
  setTimeout(()=>{
    const timeFloating = (Date.now() - castTime) / 1000;
    if (timeFloating < 2) { // Minimal 2 detik floating untuk chance ikan
      showToast('Terlalu cepat, tidak ada yang terangkat');
    } else {
      const enchant = state.equippedEnchant || 'none';
      let catchChance = 0.12 + state.rodLevel * 0.06 + rand()*0.16;
      if(enchant === 'lucky') catchChance += 0.03;
      catchChance = Math.min(0.6, catchChance * (timeFloating / 5)); 

      if(rand() < catchChance){
        const d = Number(currentEl.textContent) || 0;
        const chosen = prngChoiceByDistance(d);
        if((chosen.id === 'legend' || chosen.id === 'ancient' || chosen.id === 'cosmic') && enchant !== 'ancient' && rand() > 0.18){
          showToast('Ikan langka hampir terangkat tapi lepas. (butuh Ancient Enchant)');
        } else {

          let value = Math.floor(chosen.base + chosen.base * (0.15 * state.rodLevel) + rand()* chosen.base);
          if (enchant === 'golden') {
            value = Math.floor(value * 1.5);
          }

          const id = 'f_' + Date.now() + '_' + Math.floor(rand()*1000);
          const item = {id, type: chosen.id, name: chosen.name, displayName: chosen.displayName, value, ts: Date.now()};
          state.inventory.push(item);

          const type = chosen.id;
          if (!state.bestFish[type] || value > state.bestFish[type].value) {
            state.bestFish[type] = {name: chosen.name, displayName: chosen.displayName, value};
            showToast('Rekor baru! ' + chosen.name + ' ditambahkan ke Museum.');
          }

          updateMissionProgress(type);

          saveState();
          showCatchEffect();
          showCaughtImg(chosen.id);
          showToast(`Kamu menangkap ${chosen.name} (Value: ${value} Gold)`);
        }
      } else {
        showToast('Tidak ada yang terangkat');
      }
    }
    flowState = 'idle';
  }, 800);
});

/* ======================
   Visual helpers
   ====================== */
function spawnRipple(){
  const r = document.createElement('div');
  r.className = 'ripple';
  const offsetX = (rand()*36 - 18);
  r.style.left = `calc(50% + ${offsetX}px)`;
  water.appendChild(r);
  setTimeout(()=>r.remove(), 1000);
  for(let i=0;i<2;i++){
    setTimeout(()=> {
      const ring = document.createElement('div');
      ring.className = 'ripple-ring';
      const ox = (rand()*40 - 20);
      ring.style.left = `calc(50% + ${ox}px)`;
      water.appendChild(ring);
      setTimeout(()=>ring.remove(), 1000);
    }, i*120);
  }
  for(let i=0;i<5;i++){
    setTimeout(()=> {
      const b = document.createElement('div');
      b.className = 'bubble';
      const bx = (rand()*60 - 30);
      b.style.left = `calc(50% + ${bx}px)`;
      b.style.bottom = `calc(78% + ${rand()*18-9}px)`;
      b.style.animationDuration = (0.9 + rand()*0.9) + 's';
      document.getElementById('game').appendChild(b);
      setTimeout(()=>b.remove(), 1200);
    }, i*80);
  }
}
function showCatchEffect(){
  const el = document.createElement('div');
  el.id = 'catchEffect';
  el.textContent = '🎉 Ikan Tertangkap!';
  document.getElementById('game').appendChild(el);
  setTimeout(()=>el.remove(),1400);
  spawnRipple();
}
function getImgMap(){
  return {
    common: 'img/arapaima.png',
    blue: 'img/blue_catfish.png',
    rare: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Goldfish_cartoon.svg/120px-Goldfish_cartoon.svg.png',
    legend: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Fish_icon.svg/120px-Fish_icon.svg.png',
    ancient: 'https://placehold.co/120x120/png?text=Dunkleosteus',
    mythical: 'https://placehold.co/120x120/png?text=Leedsichthys',
    cosmic: 'https://placehold.co/120x120/png?text=Megalodon',
    rainbow: 'https://placehold.co/120x120/png?text=RainbowTrout',
    dragon: 'https://placehold.co/120x120/png?text=SeaDragon'
  };
}
function showCaughtImg(type){
  const img = document.createElement('img');
  img.id = 'caughtImg';
  const map = getImgMap();
  img.src = map[type] || map.common;
  img.alt = 'Ikan tertangkap';
  img.style.border = `2px solid var(--fish-${type})`;
  img.style.boxShadow = `0 0 10px var(--fish-${type})`;
  document.getElementById('game').appendChild(img);
  setTimeout(()=>img.remove(),1500);
}

/* ======================
   Shop & Inventory logic
   ====================== */
shopBtn.addEventListener('click', ()=> togglePanel('shop'));
invBtn.addEventListener('click', ()=> togglePanel('inv'));
museumBtn.addEventListener('click', ()=> togglePanel('museum'));
missionBtn.addEventListener('click', ()=> togglePanel('mission'));
settingsBtn.addEventListener('click', ()=> togglePanel('settings'));
function togglePanel(name){
  shopPanel.style.display = name==='shop' ? (shopPanel.style.display === 'block' ? 'none' : 'block') : 'none';
  invPanel.style.display = name==='inv' ? (invPanel.style.display === 'block' ? 'none' : 'block') : 'none';
  museumPanel.style.display = name==='museum' ? (museumPanel.style.display === 'block' ? 'none' : 'block') : 'none';
  missionPanel.style.display = name==='mission' ? (missionPanel.style.display === 'block' ? 'none' : 'block') : 'none';
  settingsPanel.style.display = name==='settings' ? (settingsPanel.style.display === 'block' ? 'none' : 'block') : 'none';
}

buyUpgradeBtn.addEventListener('click', ()=>{
  const price = upgradePrice();
  if(state.gold >= price){
    state.gold -= price;
    state.rodLevel++;
    saveState();
    showToast(`Rod di-upgrade ke level ${state.rodLevel}`);
  } else showToast('Gold tidak cukup');
});

buyGachaBtn.addEventListener('click', ()=>{
  const price = 250;
  if(state.gold >= price){
    state.gold -= price;
    const roll = rollEnchant();
    state.equippedEnchant = roll.id;
    saveState();
    showToast(`Gacha: Dapat ${roll.name} Enchant! Langsung terpasang.`);
  } else {
    showToast('Gold tidak cukup');
  }
});

buyCoinBtn.addEventListener('click', ()=>{
  const price = 10;
  if(state.gold >= price){
    state.gold -= price;
    state.gold += 500;
    saveState();
    showToast('+500 Gold ditambahkan');
  } else {
    showToast('Gold tidak cukup');
  }
});

function sellOne(id){
  const idx = state.inventory.findIndex(x=>x.id===id);
  if(idx===-1) return;
  const item = state.inventory.splice(idx,1)[0];
  state.gold += item.value;
  saveState();
  renderInventory();
  showToast(`Dijual ${item.name} +${item.value} Gold`);
}

sellAllBtn.addEventListener('click', ()=> {
  if(state.inventory.length===0) return showToast('Tidak ada yang dijual');
  let total = 0;
  while(state.inventory.length) total += state.inventory.pop().value;
  state.gold += total;
  saveState();
  renderInventory();
  showToast('Semua ikan terjual: +' + total + ' Gold');
});

closeInvBtn.addEventListener('click', ()=> invPanel.style.display = 'none');

resetBtn.addEventListener('click', ()=> {
  if(confirm('Reset progress?')) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('fg_seed');
    location.reload();
  }
});

/* ======================
   Toast notifications
   ====================== */
let toastTimer = null;
function showToast(text, ms=2200){
  if(toastTimer){ clearTimeout(toastTimer); toastTimer = null; }
  toastEl.textContent = text;
  toastEl.classList.add('show');
  toastTimer = setTimeout(()=>{ toastEl.classList.remove('show'); toastTimer = null; }, ms);
}

/* ======================
   Save helpers + init
   ====================== */
saveState();

setInterval(()=>{ if(flowState==='idle' && rand() < 0.28) spawnRipple(); }, 3200);

/* ======================
   Controls for pull mini-game (mouse/touch/keyboard)
   - hold mouse/touch/space to "pull" (isHoldingPull = true)
   - release to let gravity act
   ====================== */
function setHold(value){ isHoldingPull = !!value; }

document.addEventListener('keydown', (e)=> {
  if(e.code === 'Space') { e.preventDefault(); setHold(true); }
});
document.addEventListener('keyup', (e)=> {
  if(e.code === 'Space') { setHold(false); }
});

// FIX: Menggunakan setPointerCapture untuk menangkap event meski jari keluar tombol
reelBtn.addEventListener('pointerdown', (e)=> {
  if(flowState === 'pulling') {
    e.preventDefault(); // Mencegah event click susulan & scrolling
    reelBtn.setPointerCapture(e.pointerId);
    setHold(true);
  }
});

reelBtn.addEventListener('pointerup', (e)=> {
  if(flowState === 'pulling') {
    e.preventDefault();
    reelBtn.releasePointerCapture(e.pointerId);
    setHold(false);
  }
});

// Menangani kasus jika pointer dibatalkan (misal ada popup sistem)
reelBtn.addEventListener('pointercancel', (e)=> {
  if(flowState === 'pulling') {
    setHold(false);
    try { reelBtn.releasePointerCapture(e.pointerId); } catch(e){}
  }
});

// clicking outside panels closes them
document.addEventListener('click', (e)=>{
  const withinMenu = e.target.closest('#menu') || e.target.closest('.panel') || e.target.closest('.btn');
  if(!withinMenu){
    shopPanel.style.display = 'none';
    invPanel.style.display = 'none';
    museumPanel.style.display = 'none';
    missionPanel.style.display = 'none';
    settingsPanel.style.display = 'none';
  }
});