
"use strict";

const WORLDS = [
  {id:"tech",name:"Tecnología",icon:"⚡",desc:"Circuitos, códigos y máquinas.",accent:"#38e8ff",accent2:"#7d6cff",bg:"linear-gradient(135deg,#06253b,#16205a)",glow:"#31eaff",
   words:["PIXEL","ROBOT","DATOS","CHIP","CLAVE","RED","CODIGO","NUBE","SENSOR","CABLE","WIFI","LASER","DRON","APP","WEB","RAM","CPU","BYTE","MOUSE","TECLADO","PANTALLA","ANDROID","SISTEMA","DIGITAL"]},
  {id:"art",name:"Arte",icon:"🎨",desc:"Colores, técnicas y creatividad.",accent:"#ff6eb4",accent2:"#ffb44c",bg:"linear-gradient(135deg,#401235,#5f2d15)",glow:"#ff5aa9",
   words:["ARTE","COLOR","LIENZO","PINCEL","MUSEO","FORMA","OLEO","TRAZO","DIBUJO","ESCULTURA","MURAL","TINTA","PALETA","RETRATO","GALERIA","ACUARELA","SOMBRA","TEXTURA","MARCO","CREAR","FIGURA","TONO","ESTILO","OBRA"]},
  {id:"nature",name:"Naturaleza",icon:"🌿",desc:"Bosques, animales y vida.",accent:"#59f3a6",accent2:"#3cc7d9",bg:"linear-gradient(135deg,#0b392f,#123e55)",glow:"#4ee3a1",
   words:["BOSQUE","ARBOL","HOJA","RIO","FLOR","TIERRA","FAUNA","SELVA","LAGO","MONTE","NUBE","LLUVIA","VIENTO","SEMILLA","RAIZ","PLANTA","OCEANO","CORAL","ANIMAL","PAISAJE","VALLE","ROCA","SOL","LUNA"]},
  {id:"space",name:"Espacio",icon:"🚀",desc:"Planetas, estrellas y galaxias.",accent:"#b18cff",accent2:"#43d9ff",bg:"linear-gradient(135deg,#160c40,#092e52)",glow:"#986cff",
   words:["MARTE","LUNA","SOL","ORBITA","COMETA","COSMOS","NAVE","ASTRO","GALAXIA","NEBULOSA","PLANETA","METEORO","SATELITE","UNIVERSO","ESTRELLA","VENUS","TIERRA","JUPITER","COHETE","GRAVEDAD","ESPACIO","ALIEN","ECLIPSE","TELESCOPIO"]},
  {id:"history",name:"Historia",icon:"🏛️",desc:"Civilizaciones y grandes épocas.",accent:"#ffca62",accent2:"#e7844c",bg:"linear-gradient(135deg,#4a2b11,#5a1d17)",glow:"#ffbd55",
   words:["REY","REINA","IMPERIO","TEMPLO","ROMA","INCA","MAYA","EGIPTO","BATALLA","CORONA","PALACIO","CASTILLO","HISTORIA","SIGLO","MAPA","PUEBLO","CULTURA","ANTIGUO","GUERRA","PAZ","HEROE","LEYENDA","DINASTIA","REINO"]},
  {id:"music",name:"Música",icon:"🎵",desc:"Ritmos, instrumentos y sonidos.",accent:"#ff75d8",accent2:"#755cff",bg:"linear-gradient(135deg,#351042,#27184e)",glow:"#ef62d4",
   words:["NOTA","RITMO","PIANO","GUITARRA","VOZ","CANTO","BATERIA","MELODIA","SONIDO","ACORDE","MUSICA","FLAUTA","VIOLIN","BAJO","CORO","DISCO","BANDA","TEMPO","LETRA","ARTISTA","CONCIERTO","TAMBOR","ARPA","SAXO"]},
  {id:"sports",name:"Deportes",icon:"🏆",desc:"Competencia, equipo y victoria.",accent:"#60e9ff",accent2:"#5eff89",bg:"linear-gradient(135deg,#07364b,#124225)",glow:"#55f0a0",
   words:["GOL","PELOTA","EQUIPO","CANCHA","TENIS","FUTBOL","PUNTO","META","COPA","ATLETA","SALTO","CARRERA","ARCO","JUEGO","BALON","RED","BOXEO","NADAR","CICLISMO","MARCA","MEDALLA","TORNEO","RIVAL","CAMPEON"]},
  {id:"food",name:"Sabores",icon:"🍲",desc:"Cocina, ingredientes y recetas.",accent:"#ff9b55",accent2:"#ffe064",bg:"linear-gradient(135deg,#4c1c12,#58410c)",glow:"#ff9f4a",
   words:["PAN","ARROZ","QUESO","SOPA","SAL","AZUCAR","FRUTA","PASTA","CARNE","POLLO","CEBOLLA","TOMATE","PAPA","CAFE","COCINA","RECETA","HORNO","SABOR","POSTRE","LIMON","CACAO","MIEL","PLATO","COMIDA"]}
];

const LEVELS_PER_WORLD=12;
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const state=JSON.parse(localStorage.getItem("wq-worlds-save")||'{"coins":120,"stars":0,"words":0,"unlockedWorld":0,"progress":{},"sound":true,"unlockAll":false}');
if(typeof state.unlockAll!=="boolean")state.unlockAll=false;
let currentWorld=0,currentLevel=0,grid=[],placed=[],found=new Set(),selecting=false,startCell=null,currentPath=[],timerId=null,elapsed=0,score=0,hints=3,paused=false,currentSize=8;
let audioCtx=null;

function save(){localStorage.setItem("wq-worlds-save",JSON.stringify(state));updateTop()}
function updateTop(){
  $("#coinsTop").textContent=state.coins||0;$("#starsTotal").textContent=state.stars||0;$("#wordsTotal").textContent=state.words||0;
  $("#playerLevel").textContent=Math.max(1,Math.floor((state.stars||0)/8)+1)
}
function showScreen(id){
  $$(".screen").forEach(s=>s.classList.remove("active"));$("#"+id).classList.add("active");
  window.scrollTo({top:0,behavior:"smooth"});
}
function worldProgress(i){
  const p=state.progress[WORLDS[i].id]||{}; return Object.values(p).filter(v=>v&&v.stars).length
}
function unlockedLevel(i){
  if(state.unlockAll)return LEVELS_PER_WORLD-1;const p=state.progress[WORLDS[i].id]||{};let n=0;while(p[n]&&p[n].stars)n++;return Math.min(n,LEVELS_PER_WORLD-1)
}
function renderWorldCards(target,preview=false){
  const host=$(target);host.innerHTML="";
  WORLDS.forEach((w,i)=>{
    if(preview&&i>3)return;
    const complete=worldProgress(i),locked=!state.unlockAll&&i>state.unlockedWorld;
    const card=document.createElement("button");card.className="world-card"+(locked?" locked":"");
    card.style.setProperty("--world-bg",w.bg);card.style.setProperty("--world-glow",w.glow);
    card.innerHTML=`<span class="world-icon">${w.icon}</span>${locked?'<span class="lock">🔒</span>':''}
      <div class="world-card-content"><span class="eyebrow">MUNDO ${i+1}</span><h3>${w.name}</h3><p>${w.desc}</p>
      <div class="mini-progress"><i style="width:${complete/LEVELS_PER_WORLD*100}%"></i></div></div>`;
    card.addEventListener("click",()=>{if(locked){toast("Completa más niveles para desbloquearlo");return}openWorld(i)});
    host.appendChild(card)
  });
  $("#worldProgress").textContent=`${Math.min(state.unlockedWorld+1,WORLDS.length)} / ${WORLDS.length}`
}
function openWorld(i){
  currentWorld=i;const w=WORLDS[i];applyTheme(w);
  $("#worldNumber").textContent=`MUNDO ${i+1}`;$("#worldTitle").textContent=w.name;$("#worldDescription").textContent=w.desc;
  renderLevels();showScreen("levelsScreen");startBannerAnimation(w);let stamp=$("#worldBanner .theme-stamp");if(!stamp){stamp=document.createElement("span");stamp.className="theme-stamp";$("#worldBanner").appendChild(stamp)}stamp.textContent=w.icon
}
function renderLevels(){
  const w=WORLDS[currentWorld],p=state.progress[w.id]||{},unlock=unlockedLevel(currentWorld);
  $("#worldStars").textContent=`${Object.values(p).reduce((a,v)=>a+(v.stars||0),0)} estrellas`;
  $("#worldCompleted").textContent=`${worldProgress(currentWorld)}/${LEVELS_PER_WORLD} niveles`;
  const host=$("#levelGrid");host.innerHTML="";
  for(let i=0;i<LEVELS_PER_WORLD;i++){
    const done=p[i],locked=i>unlock;
    const b=document.createElement("button");b.className="level-card"+(locked?" locked":i===unlock?" current":"");
    b.innerHTML=`<b>${locked?"🔒":i+1}</b><small>${done?"★".repeat(done.stars)+"☆".repeat(3-done.stars):"☆☆☆"}</small>`;
    b.addEventListener("click",()=>{if(!locked)startLevel(i)});
    host.appendChild(b)
  }
}
function applyTheme(w){
  document.documentElement.style.setProperty("--accent",w.accent);document.documentElement.style.setProperty("--accent2",w.accent2);document.body.dataset.world=w.id;document.querySelector("meta[name=theme-color]")?.setAttribute("content",w.bg.match(/#[0-9a-f]{6}/i)?.[0]||"#06111e")
}
function startLevel(level){
  currentLevel=level;const w=WORLDS[currentWorld];applyTheme(w);
  currentSize=level<3?8:level<6?9:level<9?10:11;
  const count=level<3?5:level<7?6:level<10?7:8;
  hints=3;elapsed=0;score=0;found.clear();paused=false;
  $("#gameWorld").textContent=`${w.icon} ${w.name.toUpperCase()}`;$("#gameLevel").textContent=`Nivel ${level+1}`;
  $("#difficultyLabel").textContent=level<3?"Fácil":level<7?"Medio":level<10?"Difícil":"Experto";
  $("#hintsCount").textContent=hints;$("#score").textContent=0;$("#timer").textContent="00:00";
  const pool=[...w.words].sort(()=>Math.random()-.5);const words=pool.filter(x=>x.length<=currentSize).slice(0,count);
  generatePuzzle(words,currentSize);renderBoard();renderWordList(words);updateProgress();
  showScreen("gameScreen");startThemeAnimation(w);startTimer();flipBoard();
}
function normalize(s){return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase()}
function generatePuzzle(words,size){
  grid=Array.from({length:size},()=>Array(size).fill(""));placed=[];
  const dirs=[[0,1],[1,0],[1,1],[-1,1],[0,-1],[-1,0],[1,-1],[-1,-1]];
  for(const raw of words){
    const word=normalize(raw);let ok=false;
    for(let t=0;t<300&&!ok;t++){
      const [dr,dc]=dirs[Math.floor(Math.random()*dirs.length)],r=Math.floor(Math.random()*size),c=Math.floor(Math.random()*size);
      const er=r+dr*(word.length-1),ec=c+dc*(word.length-1);
      if(er<0||er>=size||ec<0||ec>=size)continue;
      let valid=true;for(let k=0;k<word.length;k++){const v=grid[r+dr*k][c+dc*k];if(v&&v!==word[k]){valid=false;break}}
      if(!valid)continue;
      const cells=[];for(let k=0;k<word.length;k++){grid[r+dr*k][c+dc*k]=word[k];cells.push([r+dr*k,c+dc*k])}
      placed.push({word:raw,norm:word,cells});ok=true
    }
  }
  const letters="ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";
  grid=grid.map(row=>row.map(v=>v||letters[Math.floor(Math.random()*letters.length)]))
}
function renderBoard(){
  const b=$("#board");b.innerHTML="";b.style.gridTemplateColumns=`repeat(${currentSize},1fr)`;
  grid.forEach((row,r)=>row.forEach((letter,c)=>{
    const d=document.createElement("div");d.className="letter";d.textContent=letter;d.dataset.r=r;d.dataset.c=c;
    d.addEventListener("pointerdown",onPointerDown);b.appendChild(d)
  }))
}
function renderWordList(words){
  const host=$("#wordList");host.innerHTML="";words.forEach(w=>{const d=document.createElement("div");d.className="word-chip";d.dataset.word=normalize(w);d.textContent=w;host.appendChild(d)})
}
function onPointerDown(e){
  if(paused)return;e.preventDefault();selecting=true;startCell=[+e.currentTarget.dataset.r,+e.currentTarget.dataset.c];currentPath=[];
  e.currentTarget.setPointerCapture?.(e.pointerId);updateSelection(e.clientX,e.clientY)
}
function onPointerMove(e){if(selecting&&!paused){e.preventDefault();updateSelection(e.clientX,e.clientY)}}
function onPointerUp(){if(!selecting)return;selecting=false;checkSelection()}
function updateSelection(x,y){
  const el=document.elementFromPoint(x,y)?.closest(".letter");if(!el)return;
  const end=[+el.dataset.r,+el.dataset.c],dr=end[0]-startCell[0],dc=end[1]-startCell[1];
  const len=Math.max(Math.abs(dr),Math.abs(dc));let sr=0,sc=0;
  if(dr===0){sc=Math.sign(dc)}else if(dc===0){sr=Math.sign(dr)}else if(Math.abs(dr)===Math.abs(dc)){sr=Math.sign(dr);sc=Math.sign(dc)}else return;
  currentPath=[];for(let k=0;k<=len;k++)currentPath.push([startCell[0]+sr*k,startCell[1]+sc*k]);
  $$(".letter.selecting").forEach(n=>n.classList.remove("selecting"));
  currentPath.forEach(([r,c])=>cell(r,c)?.classList.add("selecting"))
}
function checkSelection(){
  const text=currentPath.map(([r,c])=>grid[r][c]).join("");const rev=[...text].reverse().join("");
  const match=placed.find(p=>!found.has(p.norm)&&(p.norm===text||p.norm===rev));
  $$(".letter.selecting").forEach(n=>n.classList.remove("selecting"));
  if(match){
    found.add(match.norm);match.cells.forEach(([r,c])=>cell(r,c)?.classList.add("found"));
    const chip=$(`.word-chip[data-word="${match.norm}"]`);chip?.classList.add("done");
    score+=100+Math.max(0,60-elapsed)*2;state.words=(state.words||0)+1;$("#score").textContent=score;playTone(720,.1);vibrate(35);toast(`¡${match.word}! +100`);
    updateProgress();if(found.size===placed.length)setTimeout(completeLevel,650)
  }else if(currentPath.length>1){playTone(180,.08)}
  currentPath=[]
}
function cell(r,c){return $(`.letter[data-r="${r}"][data-c="${c}"]`)}
function updateProgress(){
  $("#foundCount").textContent=`${found.size} / ${placed.length} palabras`;$("#progressFill").style.width=`${placed.length?found.size/placed.length*100:0}%`
}
function startTimer(){clearInterval(timerId);timerId=setInterval(()=>{if(!paused){elapsed++;$("#timer").textContent=formatTime(elapsed)}},1000)}
function formatTime(s){return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`}
function togglePause(force){
  paused=typeof force==="boolean"?force:!paused;$("#pauseShield").classList.toggle("active",paused);$("#board").classList.toggle("paused",paused);$("#pauseBtn span").textContent=paused?"▶":"Ⅱ";if(paused)vibrate(20)
}
function flipBoard(){const b=$("#board");b.classList.add("flipping");setTimeout(()=>b.classList.remove("flipping"),650)}
function useHint(){
  if(paused||hints<=0)return;const p=placed.find(x=>!found.has(x.norm));if(!p)return;hints--;$("#hintsCount").textContent=hints;
  const [r,c]=p.cells[0];cell(r,c)?.classList.add("hint");setTimeout(()=>cell(r,c)?.classList.remove("hint"),2500);state.coins=Math.max(0,(state.coins||0)-5);save()
}
function completeLevel(){
  clearInterval(timerId);flipBoard();const stars=elapsed<=50?3:elapsed<=95?2:1,coins=stars*18+currentLevel*2;
  const w=WORLDS[currentWorld],p=state.progress[w.id]||(state.progress[w.id]={}),old=p[currentLevel]?.stars||0;
  p[currentLevel]={stars:Math.max(old,stars),best:Math.min(p[currentLevel]?.best??9999,elapsed),score:Math.max(p[currentLevel]?.score||0,score)};
  state.stars=(state.stars||0)+Math.max(0,stars-old);state.coins=(state.coins||0)+coins;
  if(currentLevel===LEVELS_PER_WORLD-1&&currentWorld===state.unlockedWorld&&state.unlockedWorld<WORLDS.length-1)state.unlockedWorld++;
  save();$("#rewardStars").textContent="★".repeat(stars)+"☆".repeat(3-stars);$("#rewardTime").textContent=formatTime(elapsed);$("#rewardScore").textContent=score;$("#rewardCoins").textContent=`+${coins} ✦`;$("#rewardModal").classList.add("active");confetti()
}
function nextLevel(){
  $("#rewardModal").classList.remove("active");if(currentLevel<LEVELS_PER_WORLD-1)startLevel(currentLevel+1);else{openWorld(currentWorld);showScreen("levelsScreen")}
}
function playTone(freq,dur){
  if(!state.sound)return;try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=freq;o.type="sine";g.gain.setValueAtTime(.04,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+dur);o.connect(g).connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+dur)}catch{}
}
function vibrate(ms){navigator.vibrate?.(ms)}
function toast(t){const el=$("#toast");el.textContent=t;el.classList.add("show");clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove("show"),1800)}
function confetti(){
  for(let i=0;i<24;i++){const s=document.createElement("i");s.style.cssText=`position:fixed;z-index:110;left:${Math.random()*100}%;top:-20px;width:8px;height:14px;background:hsl(${Math.random()*360} 90% 65%);transform:rotate(${Math.random()*180}deg);border-radius:3px;pointer-events:none;transition:transform 1.6s linear,top 1.6s ease-in`;document.body.appendChild(s);requestAnimationFrame(()=>{s.style.top="110%";s.style.transform+=` translateX(${(Math.random()-.5)*180}px) rotate(540deg)`});setTimeout(()=>s.remove(),1800)}
}
function startThemeAnimation(w){
  const canvas=$("#themeCanvas"),ctx=canvas.getContext("2d");let raf;
  function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio,1.5);canvas.width=r.width*d;canvas.height=r.height*d;ctx.setTransform(d,0,0,d,0,0)}
  resize();let t=0;
  function draw(){t+=.016;const W=canvas.clientWidth,H=canvas.clientHeight;ctx.clearRect(0,0,W,H);
    const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,w.bg.match(/#[0-9a-f]{6}/ig)?.[0]||"#081b2d");g.addColorStop(1,w.bg.match(/#[0-9a-f]{6}/ig)?.[1]||"#102a45");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    if(w.id==="tech"){ctx.lineWidth=1;for(let y=30;y<H;y+=45){ctx.strokeStyle=`rgba(56,232,255,${.08+.07*Math.sin(t*2+y)})`;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}for(let x=20;x<W;x+=55){ctx.fillStyle=`rgba(56,232,255,${.15+.2*Math.max(0,Math.sin(t*2+x))})`;ctx.fillRect(x,(x*1.7+t*25)%H,4,4)}}
    else if(w.id==="art"){for(let i=0;i<18;i++){ctx.fillStyle=`hsla(${(i*39+t*15)%360},80%,60%,.08)`;ctx.beginPath();ctx.arc((i*83)%W,(i*57+Math.sin(t+i)*30)%H,25+(i%4)*10,0,Math.PI*2);ctx.fill()}}
    else if(w.id==="nature"){for(let i=0;i<28;i++){ctx.fillStyle="rgba(89,243,166,.12)";ctx.beginPath();ctx.ellipse((i*71+t*14)%W,(i*91)%H,4,10,Math.sin(i+t),0,Math.PI*2);ctx.fill()}}
    else if(w.id==="space"){for(let i=0;i<70;i++){ctx.fillStyle=`rgba(255,255,255,${.25+.4*Math.abs(Math.sin(t+i))})`;ctx.fillRect((i*47)%W,(i*83)%H,1.5,1.5)}}
    else if(w.id==="history"){for(let x=0;x<W;x+=42){ctx.strokeStyle="rgba(255,202,98,.08)";ctx.strokeRect(x,(x*.6)%H,26,26)}}
    else if(w.id==="music"){for(let i=0;i<12;i++){const h=25+Math.abs(Math.sin(t*3+i))*90;ctx.fillStyle="rgba(255,117,216,.12)";ctx.fillRect(i*W/12,H-h,W/18,h)}}
    else if(w.id==="sports"){for(let i=0;i<5;i++){ctx.strokeStyle="rgba(96,233,255,.1)";ctx.beginPath();ctx.arc(W/2,H/2,40+i*45+Math.sin(t)*5,0,Math.PI*2);ctx.stroke()}}
    else {for(let i=0;i<14;i++){ctx.fillStyle=`rgba(255,180,76,${.06+.05*Math.sin(t+i)})`;ctx.beginPath();ctx.arc((i*97)%W,(i*61)%H,18+i%3*10,0,Math.PI*2);ctx.fill()}}
    raf=requestAnimationFrame(draw)
  }cancelAnimationFrame(window._themeRaf);draw();window._themeRaf=raf
}
function startBannerAnimation(w){
  const c=$("#bannerCanvas"),ctx=c.getContext("2d");const r=c.getBoundingClientRect(),d=Math.min(devicePixelRatio,1.5);c.width=r.width*d;c.height=r.height*d;ctx.setTransform(d,0,0,d,0,0);
  let t=0;function draw(){t+=.012;const W=c.clientWidth,H=c.clientHeight;const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,w.bg.match(/#[0-9a-f]{6}/ig)?.[0]||"#132");g.addColorStop(1,w.bg.match(/#[0-9a-f]{6}/ig)?.[1]||"#235");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.globalAlpha=.14;ctx.font="120px sans-serif";for(let i=0;i<5;i++)ctx.fillText(w.icon,(i*180+t*40)% (W+140)-100,80+(i%2)*120);ctx.globalAlpha=1;window._bannerRaf=requestAnimationFrame(draw)}cancelAnimationFrame(window._bannerRaf);draw()
}
function ambient(){
  const c=$("#ambient"),ctx=c.getContext("2d");function resize(){c.width=innerWidth*Math.min(devicePixelRatio,1.3);c.height=innerHeight*Math.min(devicePixelRatio,1.3);ctx.setTransform(Math.min(devicePixelRatio,1.3),0,0,Math.min(devicePixelRatio,1.3),0,0)}resize();addEventListener("resize",resize);let t=0;
  function draw(){t+=.005;ctx.clearRect(0,0,innerWidth,innerHeight);for(let i=0;i<18;i++){ctx.fillStyle=`rgba(67,231,255,${.025+.02*Math.sin(t+i)})`;ctx.beginPath();ctx.arc((i*137)%innerWidth,(i*211+t*8000)%innerHeight,2+i%4,0,Math.PI*2);ctx.fill()}requestAnimationFrame(draw)}draw()
}

$("#playBtn").onclick=()=>{renderWorldCards("#worldGrid");showScreen("worldsScreen")};
$("#homeBtn").onclick=()=>showScreen("homeScreen");$("#backWorlds").onclick=()=>{renderWorldCards("#worldGrid");showScreen("worldsScreen")};
$("#levelsBtn").onclick=()=>{clearInterval(timerId);openWorld(currentWorld)};$("#pauseBtn").onclick=()=>togglePause();$("#resumeBtn").onclick=()=>togglePause(false);
$("#hintBtn").onclick=useHint;$("#shuffleBtn").onclick=()=>{if(confirm("¿Reiniciar este nivel?"))startLevel(currentLevel)};
$("#soundBtn").onclick=()=>{state.sound=!state.sound;save();toast(state.sound?"Sonido activado":"Sonido desactivado")};
$("#nextLevelBtn").onclick=nextLevel;$("#modalLevelsBtn").onclick=()=>{$("#rewardModal").classList.remove("active");openWorld(currentWorld)};
addEventListener("pointermove",onPointerMove,{passive:false});addEventListener("pointerup",onPointerUp);addEventListener("pointercancel",onPointerUp);
document.addEventListener("visibilitychange",()=>{if(document.hidden&&$("#gameScreen").classList.contains("active"))togglePause(true)});
function syncSettings(){
  $("#unlockAllToggle").checked=!!state.unlockAll;$("#soundToggle").checked=!!state.sound;
}
function refreshMaps(){renderWorldCards("#worldGrid");renderWorldCards("#worldPreview",true);if($("#levelsScreen").classList.contains("active"))renderLevels()}
function setUnlockAll(value){state.unlockAll=!!value;save();syncSettings();refreshMaps();toast(value?"Todos los mundos y niveles desbloqueados":"Progresión normal restaurada")}
$("#settingsBtn").onclick=()=>{syncSettings();$("#settingsModal").classList.add("active")};
$("#closeSettings").onclick=()=>$("#settingsModal").classList.remove("active");
$("#settingsModal").addEventListener("click",e=>{if(e.target.id==="settingsModal")e.currentTarget.classList.remove("active")});
$("#unlockAllToggle").onchange=e=>setUnlockAll(e.target.checked);
$("#soundToggle").onchange=e=>{state.sound=e.target.checked;save();toast(state.sound?"Sonido activado":"Sonido desactivado")};
$("#unlockAllBtn").onclick=()=>setUnlockAll(true);
$("#lockAllBtn").onclick=()=>setUnlockAll(false);
if("serviceWorker" in navigator)addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
updateTop();renderWorldCards("#worldPreview",true);ambient();
