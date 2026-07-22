'use strict';

const SAVE_KEY = 'wordquest_v1_save';
const SETTINGS_KEY = 'wordquest_v1_settings';
const alphabet = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
const categories = [
  { name:'Animales', words:['TIGRE','PANDA','ZORRO','KOALA','CABALLO','DELFIN','AGUILA','CONEJO','LEOPARDO','BALLENA'] },
  { name:'Espacio', words:['LUNA','MARTE','COMETA','ORBITA','GALAXIA','PLANETA','ESTRELLA','SATURNO','NEBULOSA','ASTRO'] },
  { name:'Tecnología', words:['CODIGO','DATOS','ROBOT','NUBE','PIXEL','TECLADO','SOFTWARE','INTERNET','SERVIDOR','PANTALLA'] },
  { name:'Naturaleza', words:['BOSQUE','RIO','MONTAÑA','FLOR','NUBE','OCEANO','SELVA','VIENTO','TIERRA','LAGUNA'] },
  { name:'Inventarios', words:['STOCK','CODIGO','ALMACEN','CONTEO','PRODUCTO','LOTE','RUBRO','ESCANER','CAJA','VALIDAR'] },
  { name:'Viajes', words:['AVION','HOTEL','PLAYA','MAPA','RUTA','MALETA','DESTINO','PASAPORTE','TREN','PUERTO'] }
];

const state = {
  save: loadSave(), settings: loadSettings(), currentLevel: 1, board: [], placed: [], words: [], found: new Set(),
  selection: [], dragging: false, score: 0, seconds: 120, timer: null, paused: false, daily: false
};

const el = id => document.getElementById(id);
const screens = [...document.querySelectorAll('.screen')];

function defaultSave(){ return { unlocked:1, stars:{}, coins:120, wins:0, totalWords:0, streak:0, bestTime:null, lastDaily:null }; }
function loadSave(){ try{return {...defaultSave(),...JSON.parse(localStorage.getItem(SAVE_KEY)||'{}')}}catch{return defaultSave()} }
function loadSettings(){ try{return {sound:true,vibration:true,contrast:false,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}}catch{return {sound:true,vibration:true,contrast:false}} }
function persist(){ localStorage.setItem(SAVE_KEY,JSON.stringify(state.save)); updateTopUI(); }
function persistSettings(){ localStorage.setItem(SETTINGS_KEY,JSON.stringify(state.settings)); document.body.classList.toggle('high-contrast',state.settings.contrast); }

function showScreen(id){ screens.forEach(s=>s.classList.toggle('active',s.id===id)); el('backBtn').classList.toggle('hidden',id==='homeScreen'); if(id!=='gameScreen') stopTimer(); window.scrollTo({top:0,behavior:'smooth'}); }
function updateTopUI(){
  el('coinsLabel').textContent=state.save.coins; el('streakHome').textContent=state.save.streak; el('starsHome').textContent=Object.values(state.save.stars).reduce((a,b)=>a+b,0); el('winsHome').textContent=state.save.wins;
}
function toast(msg){ const t=el('toast'); t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800); }
function vibrate(pattern=20){ if(state.settings.vibration && navigator.vibrate) navigator.vibrate(pattern); }
function beep(freq=440,duration=.08){
  if(!state.settings.sound) return;
  try{ const C=window.AudioContext||window.webkitAudioContext; const c=new C();const o=c.createOscillator();const g=c.createGain();o.frequency.value=freq;o.type='sine';g.gain.setValueAtTime(.05,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+duration);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+duration); }catch{}
}

function renderMap(){
  const map=el('levelMap'); map.innerHTML='';
  for(let i=1;i<=12;i++){
    const b=document.createElement('button'); b.className='level-node'; b.type='button'; b.innerHTML=`<span>${i}</span><small class="mini-stars">${'★'.repeat(state.save.stars[i]||0)}${'☆'.repeat(3-(state.save.stars[i]||0))}</small>`;
    if(i<state.save.unlocked)b.classList.add('completed'); else if(i===state.save.unlocked)b.classList.add('current'); else b.classList.add('locked');
    b.disabled=i>state.save.unlocked; b.addEventListener('click',()=>startLevel(i,false)); map.appendChild(b);
  }
  const done=Math.min(state.save.unlocked-1,12); el('worldProgress').textContent=`${done}/12`; el('worldProgressBar').style.width=`${done/12*100}%`;
}

function levelConfig(level){
  const size=level<=3?8:level<=7?10:12; const count=level<=3?5:level<=7?7:9; const time=level<=3?150:level<=7?180:210;
  return {size,count,time,reverse:level>=4,diagonal:level>=3,category:categories[(level-1)%categories.length]};
}
function normalizeWord(w){return w.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()}
function sample(arr,n){return [...arr].sort(()=>Math.random()-.5).slice(0,n)}

function generateBoard(config){
  const size=config.size; const grid=Array.from({length:size},()=>Array(size).fill(''));
  const dirs=[[0,1],[1,0]]; if(config.diagonal)dirs.push([1,1],[1,-1]); if(config.reverse)dirs.push([0,-1],[-1,0],[-1,-1],[-1,1]);
  const chosen=sample(config.category.words.map(normalizeWord).filter(w=>w.length<=size),config.count);
  const placed=[];
  chosen.forEach(word=>{
    let success=false;
    for(let attempt=0;attempt<250&&!success;attempt++){
      const [dr,dc]=dirs[Math.floor(Math.random()*dirs.length)];
      const r=Math.floor(Math.random()*size),c=Math.floor(Math.random()*size); const er=r+dr*(word.length-1),ec=c+dc*(word.length-1);
      if(er<0||er>=size||ec<0||ec>=size)continue;
      let ok=true; const cells=[];
      for(let i=0;i<word.length;i++){const rr=r+dr*i,cc=c+dc*i; if(grid[rr][cc]&&grid[rr][cc]!==word[i]){ok=false;break} cells.push([rr,cc]);}
      if(ok){cells.forEach(([rr,cc],i)=>grid[rr][cc]=word[i]);placed.push({word,cells});success=true;}
    }
  });
  for(let r=0;r<size;r++)for(let c=0;c<size;c++)if(!grid[r][c])grid[r][c]=alphabet[Math.floor(Math.random()*alphabet.length)];
  return {grid,placed,words:placed.map(p=>p.word)};
}

function startLevel(level,daily=false){
  state.currentLevel=level;state.daily=daily;state.found=new Set();state.selection=[];state.score=0;state.paused=false;
  const config=levelConfig(level);if(daily){config.size=10;config.count=8;config.time=180;config.diagonal=true;config.reverse=true;config.category=categories[new Date().getDate()%categories.length];}
  const generated=generateBoard(config);state.board=generated.grid;state.placed=generated.placed;state.words=generated.words;state.seconds=config.time;
  el('levelLabel').textContent=daily?'D':level;el('categoryLabel').textContent=daily?`Reto diario · ${config.category.name}`:config.category.name;el('difficultyLabel').textContent=`${config.size} × ${config.size} · ${level<4?'Fácil':level<8?'Medio':'Difícil'}`;
  renderBoard();renderWords();updateGameUI();showScreen('gameScreen');startTimer();
}
function renderBoard(){
  const board=el('wordBoard'),size=state.board.length;board.innerHTML='';board.style.gridTemplateColumns=`repeat(${size},1fr)`;
  state.board.forEach((row,r)=>row.forEach((letter,c)=>{const cell=document.createElement('button');cell.type='button';cell.className='letter-cell';cell.textContent=letter;cell.dataset.r=r;cell.dataset.c=c;cell.addEventListener('pointerdown',pointerStart);cell.addEventListener('pointerenter',pointerEnter);cell.addEventListener('pointerup',pointerEnd);board.appendChild(cell);}));
  board.addEventListener('pointerleave',()=>{if(state.dragging)pointerEnd()});
}
function renderWords(){const list=el('wordList');list.innerHTML='';state.words.forEach(w=>{const s=document.createElement('span');s.className='word-chip'+(state.found.has(w)?' found':'');s.textContent=w;s.dataset.word=w;list.appendChild(s)});el('foundCounter').textContent=`${state.found.size}/${state.words.length}`;}
function pointerStart(e){if(state.paused)return;e.preventDefault();state.dragging=true;state.selection=[];clearSelection();addCellToSelection(e.currentTarget);}
function pointerEnter(e){if(!state.dragging||state.paused)return;const target=e.currentTarget;const start=state.selection[0];if(!start)return;const r=+target.dataset.r,c=+target.dataset.c;const dr=r-start.r,dc=c-start.c;const valid=dr===0||dc===0||Math.abs(dr)===Math.abs(dc);if(!valid)return;const len=Math.max(Math.abs(dr),Math.abs(dc));const sr=Math.sign(dr),sc=Math.sign(dc);state.selection=[];clearSelection();for(let i=0;i<=len;i++){const node=document.querySelector(`.letter-cell[data-r="${start.r+sr*i}"][data-c="${start.c+sc*i}"]`);if(node)addCellToSelection(node)}}
function addCellToSelection(node){const r=+node.dataset.r,c=+node.dataset.c;if(state.selection.some(x=>x.r===r&&x.c===c))return;state.selection.push({r,c,node});node.classList.add('selecting')}
function clearSelection(){document.querySelectorAll('.letter-cell.selecting').forEach(n=>n.classList.remove('selecting'))}
function pointerEnd(){if(!state.dragging)return;state.dragging=false;const word=state.selection.map(x=>state.board[x.r][x.c]).join('');const rev=[...word].reverse().join('');const match=state.words.find(w=>(w===word||w===rev)&&!state.found.has(w));if(match){state.found.add(match);state.selection.forEach(x=>x.node.classList.add('found'));state.score+=100+state.seconds;state.save.totalWords++;beep(720,.12);vibrate([20,30,20]);burst();renderWords();updateGameUI();if(state.found.size===state.words.length)setTimeout(completeLevel,500);}else if(word.length>1){beep(180,.08);vibrate(35);}clearSelection();state.selection=[];}
function updateGameUI(){el('scoreLabel').textContent=state.score.toLocaleString();el('timeLabel').textContent=formatTime(state.seconds);el('starsLive').textContent='★'.repeat(currentStars())+'☆'.repeat(3-currentStars());}
function formatTime(s){return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
function currentStars(){const config=levelConfig(state.currentLevel);const ratio=state.seconds/config.time;return ratio>.55?3:ratio>.25?2:1}
function startTimer(){stopTimer();state.timer=setInterval(()=>{if(state.paused)return;state.seconds--;updateGameUI();if(state.seconds<=0){stopTimer();showFailModal()}},1000)}
function stopTimer(){if(state.timer){clearInterval(state.timer);state.timer=null}}
function completeLevel(){
  stopTimer();const stars=currentStars(),reward=25+stars*10;state.save.coins+=reward;state.save.wins++;state.save.streak++;state.save.bestTime=state.save.bestTime===null?state.seconds:Math.max(state.save.bestTime,state.seconds);
  if(!state.daily){state.save.stars[state.currentLevel]=Math.max(state.save.stars[state.currentLevel]||0,stars);state.save.unlocked=Math.max(state.save.unlocked,Math.min(12,state.currentLevel+1));}else{state.save.lastDaily=new Date().toDateString();}
  persist();openResultModal(true,stars,reward);
}
function showFailModal(){state.save.streak=0;persist();openResultModal(false,0,0)}
function openResultModal(win,stars,reward){
  el('modalIcon').textContent=win?'🎉':'⏳';el('modalEyebrow').textContent=win?'NIVEL COMPLETADO':'TIEMPO AGOTADO';el('modalTitle').textContent=win?'¡Excelente!':'Casi lo logras';el('modalText').textContent=win?'Encontraste todas las palabras.':'Reintenta el nivel y mejora tu velocidad.';el('modalStars').textContent=win?'★'.repeat(stars)+'☆'.repeat(3-stars):'☆☆☆';el('modalRewards').innerHTML=win?`<span>+${reward} 🪙</span><span>+${state.score} pts</span>`:'';el('modalPrimary').textContent=win?'Siguiente nivel':'Reintentar';el('modal').classList.remove('hidden');
  el('modalPrimary').onclick=()=>{el('modal').classList.add('hidden');win&&!state.daily&&state.currentLevel<12?startLevel(state.currentLevel+1):startLevel(state.currentLevel,state.daily)};
  el('modalSecondary').onclick=()=>{el('modal').classList.add('hidden');renderMap();showScreen('mapScreen')};
}
function useHint(){
  if(state.save.coins<15)return toast('Necesitas 15 monedas');const target=state.placed.find(p=>!state.found.has(p.word));if(!target)return;state.save.coins-=15;persist();const [r,c]=target.cells[0];const cell=document.querySelector(`.letter-cell[data-r="${r}"][data-c="${c}"]`);cell.animate([{transform:'scale(1)',boxShadow:'0 0 0 rgba(34,211,238,0)'},{transform:'scale(1.25)',boxShadow:'0 0 24px rgba(34,211,238,1)'},{transform:'scale(1)',boxShadow:'0 0 0 rgba(34,211,238,0)'}],{duration:1200,iterations:2});toast(`Empieza con ${target.word[0]}`);beep(560,.1);
}
function burst(){const canvas=el('fxCanvas'),ctx=canvas.getContext('2d'),rect=canvas.getBoundingClientRect();canvas.width=rect.width*devicePixelRatio;canvas.height=rect.height*devicePixelRatio;ctx.scale(devicePixelRatio,devicePixelRatio);const particles=Array.from({length:28},()=>({x:rect.width/2,y:rect.height/2,vx:(Math.random()-.5)*7,vy:(Math.random()-.7)*7,life:1,r:2+Math.random()*3}));let t=0;function frame(){ctx.clearRect(0,0,rect.width,rect.height);particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.12;p.life-=.025;ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=Math.random()>.5?'#22d3ee':'#a78bfa';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill()});ctx.globalAlpha=1;if(t++<44)requestAnimationFrame(frame);else ctx.clearRect(0,0,rect.width,rect.height)}frame()}

function renderStats(){
  el('statWins').textContent=state.save.wins;el('statWords').textContent=state.save.totalWords;el('statStars').textContent=Object.values(state.save.stars).reduce((a,b)=>a+b,0);el('statBest').textContent=state.save.bestTime===null?'--':formatTime(state.save.bestTime);
  const data=[['🌱','Primer paso','Completa 1 nivel',state.save.wins>=1],['🔥','En racha','Gana 3 niveles seguidos',state.save.streak>=3],['🔤','Cazapalabras','Encuentra 50 palabras',state.save.totalWords>=50],['👑','Maestro del bosque','Completa 12 niveles',state.save.unlocked>=12]];
  el('achievementList').innerHTML=data.map(a=>`<div class="achievement ${a[3]?'':'locked'}"><span>${a[0]}</span><div><strong>${a[1]}</strong><small>${a[2]}</small></div></div>`).join('');
}
function bind(){
  el('playBtn').addEventListener('click',()=>{renderMap();showScreen('mapScreen')});el('dailyBtn').addEventListener('click',()=>{const today=new Date().toDateString();if(state.save.lastDaily===today)toast('Ya completaste el reto de hoy');else startLevel(1,true)});el('statsBtn').addEventListener('click',()=>{renderStats();showScreen('statsScreen')});el('settingsBtn').addEventListener('click',()=>showScreen('settingsScreen'));el('backBtn').addEventListener('click',()=>showScreen('homeScreen'));
  el('hintBtn').addEventListener('click',useHint);el('shuffleBtn').addEventListener('click',()=>startLevel(state.currentLevel,state.daily));el('pauseBtn').addEventListener('click',()=>{state.paused=!state.paused;el('pauseBtn').querySelector('strong').textContent=state.paused?'Continuar':'Pausa';toast(state.paused?'Juego pausado':'Juego reanudado')});
  el('soundToggle').checked=state.settings.sound;el('vibrationToggle').checked=state.settings.vibration;el('contrastToggle').checked=state.settings.contrast;
  [['soundToggle','sound'],['vibrationToggle','vibration'],['contrastToggle','contrast']].forEach(([id,key])=>el(id).addEventListener('change',e=>{state.settings[key]=e.target.checked;persistSettings()}));
  el('resetProgressBtn').addEventListener('click',()=>{if(confirm('¿Deseas borrar todo el progreso?')){state.save=defaultSave();persist();renderStats();toast('Progreso restablecido')}});
  document.addEventListener('pointerup',pointerEnd);
}
function init(){persistSettings();updateTopUI();bind();if('serviceWorker'in navigator)navigator.serviceWorker.register('service-worker.js').catch(()=>{});}
init();
