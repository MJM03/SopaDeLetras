import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';

const $ = (s) => document.querySelector(s);
const ui = {
  canvas: $('#gameCanvas'), start: $('#startScreen'), pause: $('#pauseScreen'), win: $('#winScreen'), settings: $('#settingsScreen'), loading: $('#loading'),
  words: $('#wordList'), timer: $('#timer'), score: $('#score'), streak: $('#streak'), coins: $('#coinsValue'), stars: $('#starsValue'), progress: $('#progressBar'), progressText: $('#progressText'),
  levelTitle: $('#levelTitle'), levelSubtitle: $('#levelSubtitle'), levelBadge: $('#levelBadge'), worldName: $('#worldName'), hintCount: $('#hintCount'), toast: $('#toast'), combo: $('#combo')
};

const LEVELS = [
  {world:'NEXO NEÓN',title:'Primer contacto',size:8,words:['NUBE','LUZ','RAYO','LUNA','NOVA','ASTRO'],theme:0},
  {world:'NEXO NEÓN',title:'Circuito oculto',size:8,words:['PIXEL','ROBOT','DATOS','CHIP','CLAVE','RED'],theme:0},
  {world:'JARDÍN ORBITAL',title:'Vida estelar',size:9,words:['FLORA','HOJA','RAIZ','BROTE','SEMILLA','VERDE'],theme:1},
  {world:'JARDÍN ORBITAL',title:'Ecos del bosque',size:9,words:['CEDRO','PINO','HONGO','MUSGO','RAMA','BOSQUE'],theme:1},
  {world:'ABISMO AZUL',title:'Bajo la marea',size:10,words:['CORAL','DELFIN','PERLA','OCEANO','TIBURON','MAREA'],theme:2},
  {world:'ABISMO AZUL',title:'Ciudad sumergida',size:10,words:['TRITON','ANCLA','TESORO','BARCO','ARENA','ISLA'],theme:2},
  {world:'TEMPLO SOLAR',title:'Símbolos antiguos',size:10,words:['TEMPLO','FARAON','ORO','DUNA','ESFINGE','NILO'],theme:3},
  {world:'TEMPLO SOLAR',title:'La cámara secreta',size:11,words:['PIRAMIDE','JEROGLIFO','MOMIA','SARCOFAGO','REINA','SOL'],theme:3},
  {world:'VACÍO CÓSMICO',title:'Constelación',size:11,words:['GALAXIA','COMETA','PLANETA','ORBITA','COSMOS','METEORO'],theme:4},
  {world:'VACÍO CÓSMICO',title:'Horizonte final',size:12,words:['UNIVERSO','GRAVEDAD','NEBULOSA','ESTRELLA','SATELITE','ECLIPSE'],theme:4},
  {world:'CÓDIGO MAESTRO',title:'Mente digital',size:12,words:['ALGORITMO','SISTEMA','CODIGO','MATRIZ','VECTOR','MEMORIA'],theme:0},
  {world:'CÓDIGO MAESTRO',title:'Núcleo supremo',size:13,words:['INTELIGENCIA','PROGRAMA','SERVIDOR','INTERFAZ','DIGITAL','FUTURO'],theme:0}
];
const THEMES = [
  {bg:0x07101f,fog:0x07101f,base:0x13284c,accent:0x2ee7ff,accent2:0x8e62ff},
  {bg:0x061a16,fog:0x061a16,base:0x143e33,accent:0x5dffb0,accent2:0x8e62ff},
  {bg:0x041725,fog:0x041725,base:0x0e3653,accent:0x41c8ff,accent2:0x4e73ff},
  {bg:0x1b1005,fog:0x1b1005,base:0x4e3111,accent:0xffc45d,accent2:0xff6d4d},
  {bg:0x070712,fog:0x070712,base:0x21183d,accent:0xbf68ff,accent2:0x45d7ff}
];

let renderer, scene, camera, boardGroup, raycaster, pointer, clock, particles;
let state = loadState();
let grid=[], placements=[], cellMeshes=[], selected=[], found=new Set(), startCell=null, selecting=false, paused=true, elapsed=0, score=0, streak=0, hints=3, currentLevel=state.level||0;
let targetRotation = 0, cameraTween = 0;
const audio = new (window.AudioContext || window.webkitAudioContext)();

function loadState(){try{return JSON.parse(localStorage.getItem('wq3d-state'))||{coins:120,stars:0,level:0,completed:{},sound:true,vibration:true,quality:'high'}}catch{return {coins:120,stars:0,level:0,completed:{},sound:true,vibration:true,quality:'high'}}}
function saveState(){localStorage.setItem('wq3d-state',JSON.stringify(state))}
function normalize(w){return w.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()}
function fmt(t){const m=Math.floor(t/60).toString().padStart(2,'0'),s=Math.floor(t%60).toString().padStart(2,'0');return `${m}:${s}`}
function beep(freq=600,dur=.08,type='sine',vol=.05){if(!state.sound)return; if(audio.state==='suspended')audio.resume(); const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(vol,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+dur);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+dur)}
function toast(msg){ui.toast.textContent=msg;ui.toast.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>ui.toast.classList.remove('show'),1500)}

function init3D(){
  renderer=new THREE.WebGLRenderer({canvas:ui.canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,state.quality==='high'?2:1.25));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=state.quality!=='low';renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene=new THREE.Scene();scene.background=new THREE.Color(0x07101f);scene.fog=new THREE.FogExp2(0x07101f,.024);
  camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,100);camera.position.set(0,11,14);camera.lookAt(0,0,0);
  const hemi=new THREE.HemisphereLight(0xaadfff,0x07101f,2.1);scene.add(hemi);
  const key=new THREE.DirectionalLight(0xffffff,3.2);key.position.set(4,10,6);key.castShadow=true;key.shadow.mapSize.set(1024,1024);scene.add(key);
  const rim=new THREE.PointLight(0x2ee7ff,18,24);rim.position.set(-7,5,-5);scene.add(rim);
  const rim2=new THREE.PointLight(0x8e62ff,15,22);rim2.position.set(7,2,5);scene.add(rim2);
  boardGroup=new THREE.Group();scene.add(boardGroup);
  createEnvironment();raycaster=new THREE.Raycaster();pointer=new THREE.Vector2();clock=new THREE.Clock();
  addEventListener('resize',onResize);bindPointer();animate();
  setTimeout(()=>ui.loading.classList.add('hide'),800);
}

function createEnvironment(){
  const plane=new THREE.Mesh(new THREE.CircleGeometry(18,64),new THREE.MeshStandardMaterial({color:0x09152b,roughness:.86,metalness:.15}));plane.rotation.x=-Math.PI/2;plane.position.y=-1.05;plane.receiveShadow=true;scene.add(plane);
  const ringMat=new THREE.MeshBasicMaterial({color:0x2ee7ff,transparent:true,opacity:.12});
  for(let i=0;i<4;i++){const ring=new THREE.Mesh(new THREE.RingGeometry(5+i*2.4,5.03+i*2.4,96),ringMat);ring.rotation.x=-Math.PI/2;ring.position.y=-1+i*.01;scene.add(ring)}
  const count=state.quality==='low'?350:900;const geo=new THREE.BufferGeometry();const arr=new Float32Array(count*3);for(let i=0;i<count;i++){arr[i*3]=(Math.random()-.5)*42;arr[i*3+1]=Math.random()*18-2;arr[i*3+2]=(Math.random()-.5)*42}geo.setAttribute('position',new THREE.BufferAttribute(arr,3));particles=new THREE.Points(geo,new THREE.PointsMaterial({color:0x7ddfff,size:.045,transparent:true,opacity:.65}));scene.add(particles)
}

function clearBoard(){while(boardGroup.children.length){const o=boardGroup.children.pop();o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose()}cellMeshes=[]}
function generate(level){
  const size=level.size, alphabet='ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';grid=Array.from({length:size},()=>Array(size).fill(''));placements=[];
  const dirs=[[0,1],[1,0],[1,1],[1,-1],[0,-1],[-1,0],[-1,-1],[-1,1]];
  for(const raw of level.words){const word=normalize(raw);let placed=false;for(let attempt=0;attempt<500&&!placed;attempt++){const [dr,dc]=dirs[Math.floor(Math.random()*dirs.length)],r=Math.floor(Math.random()*size),c=Math.floor(Math.random()*size);const er=r+dr*(word.length-1),ec=c+dc*(word.length-1);if(er<0||er>=size||ec<0||ec>=size)continue;let ok=true;for(let i=0;i<word.length;i++){const ch=grid[r+dr*i][c+dc*i];if(ch&&ch!==word[i]){ok=false;break}}if(!ok)continue;const cells=[];for(let i=0;i<word.length;i++){grid[r+dr*i][c+dc*i]=word[i];cells.push({r:r+dr*i,c:c+dc*i})}placements.push({word,raw,cells});placed=true}}
  }
  for(let r=0;r<size;r++)for(let c=0;c<size;c++)if(!grid[r][c])grid[r][c]=alphabet[Math.floor(Math.random()*alphabet.length)];
}

function makeTextTexture(letter,accent){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,256,256);ctx.fillStyle='#f5f9ff';ctx.font='900 118px Inter,Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor=`#${accent.toString(16).padStart(6,'0')}`;ctx.shadowBlur=20;ctx.fillText(letter,128,136);const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}
function buildBoard(){
  clearBoard();const level=LEVELS[currentLevel],theme=THEMES[level.theme];scene.background.set(theme.bg);scene.fog.color.set(theme.fog);generate(level);
  const size=level.size, gap=size>=12?.79:size>=10?.88:1, total=(size-1)*gap;
  const baseGeo=new THREE.BoxGeometry(total+1.25,.6,total+1.25);const baseMat=new THREE.MeshStandardMaterial({color:theme.base,metalness:.55,roughness:.38});const base=new THREE.Mesh(baseGeo,baseMat);base.position.y=-.58;base.castShadow=base.receiveShadow=true;boardGroup.add(base);
  const edge=new THREE.LineSegments(new THREE.EdgesGeometry(baseGeo),new THREE.LineBasicMaterial({color:theme.accent,transparent:true,opacity:.32}));edge.position.copy(base.position);boardGroup.add(edge);
  const cubeGeo=new THREE.BoxGeometry(.72,.72,.72,2,2,2);
  for(let r=0;r<size;r++)for(let c=0;c<size;c++){
    const mat=new THREE.MeshPhysicalMaterial({color:0x172742,metalness:.45,roughness:.28,clearcoat:.75,clearcoatRoughness:.2,emissive:0x07101f,emissiveIntensity:.25});
    const cube=new THREE.Mesh(cubeGeo,mat);cube.position.set(c*gap-total/2,0,r*gap-total/2);cube.castShadow=cube.receiveShadow=true;cube.userData={r,c,baseY:0,state:'idle'};boardGroup.add(cube);
    const face=new THREE.Mesh(new THREE.PlaneGeometry(.54,.54),new THREE.MeshBasicMaterial({map:makeTextTexture(grid[r][c],theme.accent),transparent:true,depthWrite:false}));face.rotation.x=-Math.PI/2;face.position.set(cube.position.x,.366,cube.position.z);face.userData={r,c,label:true};boardGroup.add(face);cube.userData.face=face;cellMeshes.push(cube)
  }
  boardGroup.rotation.y=0;fitCamera(size);renderWords();updateHud();
}
function fitCamera(size){const mobile=innerWidth<850;const dist=(mobile?size*1.05:size*.82)+8;camera.position.set(0,mobile?11:10,dist);camera.lookAt(0,0,0);cameraTween=1}
function renderWords(){ui.words.innerHTML='';for(const p of placements){const div=document.createElement('div');div.className='word-item';div.dataset.word=p.word;div.innerHTML=`<span>${p.raw}</span><i>✓</i>`;ui.words.appendChild(div)}}
function updateHud(){const level=LEVELS[currentLevel];ui.levelTitle.textContent=`Nivel ${currentLevel+1}`;ui.levelSubtitle.textContent=level.title;ui.levelBadge.textContent=currentLevel+1;ui.worldName.textContent=`MUNDO ${level.theme+1} · ${level.world}`;ui.coins.textContent=state.coins;ui.stars.textContent=state.stars;ui.score.textContent=score;ui.streak.textContent=streak;ui.hintCount.textContent=hints;ui.progressText.textContent=`${found.size} / ${placements.length}`;ui.progress.style.width=`${found.size/placements.length*100}%`;ui.timer.textContent=fmt(elapsed)}

function setPointer(e){const rect=ui.canvas.getBoundingClientRect();pointer.x=((e.clientX-rect.left)/rect.width)*2-1;pointer.y=-((e.clientY-rect.top)/rect.height)*2+1}
function hitCell(e){setPointer(e);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(cellMeshes,false);return hits[0]?.object||null}
function bindPointer(){
  ui.canvas.addEventListener('pointerdown',e=>{if(paused)return;const hit=hitCell(e);if(!hit)return;selecting=true;startCell=hit;ui.canvas.setPointerCapture?.(e.pointerId);updateSelection(hit);beep(320,.035,'sine',.02)});
  ui.canvas.addEventListener('pointermove',e=>{if(!selecting||paused)return;const hit=hitCell(e);if(hit)updateSelection(hit)});
  const end=e=>{if(!selecting)return;selecting=false;validateSelection();startCell=null;selected=[];cellMeshes.forEach(m=>{if(m.userData.state==='preview')setCellState(m,'idle')})};
  ui.canvas.addEventListener('pointerup',end);ui.canvas.addEventListener('pointercancel',end);ui.canvas.addEventListener('pointerleave',e=>{if(e.buttons===0)end(e)});
}
function straightPath(a,b){const dr=b.userData.r-a.userData.r,dc=b.userData.c-a.userData.c;let sr=Math.sign(dr),sc=Math.sign(dc);if(!(dr===0||dc===0||Math.abs(dr)===Math.abs(dc)))return [a];const len=Math.max(Math.abs(dr),Math.abs(dc)),out=[];for(let i=0;i<=len;i++){const r=a.userData.r+sr*i,c=a.userData.c+sc*i;out.push(cellMeshes.find(m=>m.userData.r===r&&m.userData.c===c))}return out.filter(Boolean)}
function updateSelection(hit){cellMeshes.forEach(m=>{if(m.userData.state==='preview')setCellState(m,'idle')});selected=straightPath(startCell,hit);selected.forEach(m=>{if(m.userData.state!=='found')setCellState(m,'preview')})}
function setCellState(mesh,type){mesh.userData.state=type;const face=mesh.userData.face;if(type==='idle'){mesh.material.color.set(0x172742);mesh.material.emissive.set(0x07101f);mesh.material.emissiveIntensity=.25;mesh.userData.targetY=0;mesh.userData.targetScale=1;face.material.opacity=1}else if(type==='preview'){mesh.material.color.set(0x226581);mesh.material.emissive.set(THEMES[LEVELS[currentLevel].theme].accent);mesh.material.emissiveIntensity=.65;mesh.userData.targetY=.22;mesh.userData.targetScale=1.07}else if(type==='found'){mesh.material.color.set(0x1c745e);mesh.material.emissive.set(0x5dffb0);mesh.material.emissiveIntensity=.7;mesh.userData.targetY=.14;mesh.userData.targetScale=1.04}}
function validateSelection(){if(selected.length<2)return;const word=selected.map(m=>grid[m.userData.r][m.userData.c]).join('');const rev=[...word].reverse().join('');const match=placements.find(p=>!found.has(p.word)&&(p.word===word||p.word===rev));if(match){found.add(match.word);const item=ui.words.querySelector(`[data-word="${match.word}"]`);item?.classList.add('found');selected.forEach(m=>setCellState(m,'found'));streak++;const gain=match.word.length*100+streak*25;score+=gain;state.coins+=5;state.coins=Math.floor(state.coins);beep(650,.09,'triangle',.055);setTimeout(()=>beep(880,.12,'sine',.045),70);if(state.vibration&&navigator.vibrate)navigator.vibrate([30,25,45]);showCombo(streak);burst(selected[Math.floor(selected.length/2)].position);updateHud();saveState();if(found.size===placements.length)setTimeout(winLevel,900)}else{streak=0;beep(150,.12,'sawtooth',.025);selected.forEach(m=>{if(m.userData.state!=='found')setCellState(m,'idle')});toast('Esa combinación no está en la lista');updateHud()}}
function showCombo(n){ui.combo.textContent=n>=4?`RACHA x${n}`:n===3?'¡INCREÍBLE!':n===2?'¡GENIAL!':'¡ENCONTRADA!';ui.combo.classList.remove('pop');void ui.combo.offsetWidth;ui.combo.classList.add('pop')}
function burst(pos){const count=state.quality==='low'?18:42,geo=new THREE.BufferGeometry(),arr=new Float32Array(count*3),vel=[];for(let i=0;i<count;i++){arr[i*3]=pos.x;arr[i*3+1]=.5;arr[i*3+2]=pos.z;vel.push(new THREE.Vector3((Math.random()-.5)*.16,Math.random()*.18+.05,(Math.random()-.5)*.16))}geo.setAttribute('position',new THREE.BufferAttribute(arr,3));const pts=new THREE.Points(geo,new THREE.PointsMaterial({color:0x5dffb0,size:.1,transparent:true,opacity:1}));boardGroup.add(pts);let life=0;const tick=()=>{life+=.035;const a=geo.attributes.position.array;for(let i=0;i<count;i++){a[i*3]+=vel[i].x;a[i*3+1]+=vel[i].y;a[i*3+2]+=vel[i].z;vel[i].y-=.008}geo.attributes.position.needsUpdate=true;pts.material.opacity=1-life;if(life<1)requestAnimationFrame(tick);else{boardGroup.remove(pts);geo.dispose();pts.material.dispose()}};tick()}

function hint(){if(paused||hints<=0||found.size===placements.length)return;const p=placements.find(x=>!found.has(x.word));if(!p)return;hints--;const cell=cellMeshes.find(m=>m.userData.r===p.cells[0].r&&m.userData.c===p.cells[0].c);const old=cell.userData.state;setCellState(cell,'preview');setTimeout(()=>setCellState(cell,old==='found'?'found':'idle'),1600);state.coins=Math.max(0,state.coins-10);toast(`La palabra ${p.raw} empieza aquí`);beep(520,.1);updateHud();saveState()}
function winLevel(){paused=true;const timeTarget=50+currentLevel*12;const earnedStars=elapsed<=timeTarget?3:elapsed<=timeTarget*1.6?2:1;const reward=20+earnedStars*10;state.coins+=reward;state.stars+=earnedStars;state.completed[currentLevel]={stars:Math.max(earnedStars,state.completed[currentLevel]?.stars||0),score,time:elapsed};state.level=Math.min(currentLevel+1,LEVELS.length-1);saveState();$('#winStars').textContent='★ '.repeat(earnedStars)+'☆ '.repeat(3-earnedStars);$('#finalScore').textContent=score;$('#finalTime').textContent=fmt(elapsed);$('#finalCoins').textContent=`+${reward}`;$('#winTitle').textContent=earnedStars===3?'¡Dominio absoluto!':earnedStars===2?'¡Excelente expedición!':'¡Misión completada!';$('#winSummary').textContent=`Encontraste ${placements.length} palabras en ${fmt(elapsed)}.`;ui.win.classList.add('visible');beep(523,.15,'triangle',.06);setTimeout(()=>beep(659,.15,'triangle',.06),150);setTimeout(()=>beep(784,.25,'triangle',.06),300)}
function startLevel(index=currentLevel){currentLevel=Math.max(0,Math.min(index,LEVELS.length-1));found.clear();selected=[];score=0;streak=0;hints=3;elapsed=0;paused=false;buildBoard();ui.start.classList.remove('visible');ui.pause.classList.remove('visible');ui.win.classList.remove('visible');toast(`Nivel ${currentLevel+1}: ${LEVELS[currentLevel].title}`)}
function pauseGame(){if(paused)return;paused=true;ui.pause.classList.add('visible')}
function resume(){paused=false;ui.pause.classList.remove('visible');clock.getDelta()}

function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);if(!paused){elapsed+=dt;ui.timer.textContent=fmt(elapsed)}particles.rotation.y+=dt*.015;boardGroup.rotation.y+=(targetRotation-boardGroup.rotation.y)*.08;cellMeshes.forEach((m,i)=>{const ty=m.userData.targetY??0,ts=m.userData.targetScale??1;m.position.y+=(ty-m.position.y)*.14;m.scale.lerp(new THREE.Vector3(ts,ts,ts),.14);m.userData.face.position.y=m.position.y+.366;m.rotation.y=Math.sin(performance.now()*.001+i)*.004});renderer.render(scene,camera)}
function onResize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();fitCamera(LEVELS[currentLevel].size)}

$('#playBtn').addEventListener('click',()=>startLevel(state.level||0));$('#pauseBtn').addEventListener('click',pauseGame);$('#resumeBtn').addEventListener('click',resume);$('#restartBtn').addEventListener('click',()=>startLevel(currentLevel));$('#replayBtn').addEventListener('click',()=>startLevel(currentLevel));$('#nextBtn').addEventListener('click',()=>startLevel((currentLevel+1)%LEVELS.length));$('#hintBtn').addEventListener('click',hint);$('#rotateLeftBtn').addEventListener('click',()=>targetRotation-=Math.PI/8);$('#rotateRightBtn').addEventListener('click',()=>targetRotation+=Math.PI/8);$('#centerBtn').addEventListener('click',()=>targetRotation=0);$('#homeBtn').addEventListener('click',()=>{paused=true;ui.start.classList.add('visible')});$('#settingsBtn').addEventListener('click',()=>{paused=true;ui.settings.classList.add('visible')});$('#closeSettingsBtn').addEventListener('click',()=>{ui.settings.classList.remove('visible');if(!ui.start.classList.contains('visible')&&!ui.win.classList.contains('visible'))paused=false});
$('#soundToggle').checked=state.sound;$('#vibrationToggle').checked=state.vibration;$('#qualitySelect').value=state.quality;$('#soundToggle').addEventListener('change',e=>{state.sound=e.target.checked;saveState()});$('#vibrationToggle').addEventListener('change',e=>{state.vibration=e.target.checked;saveState()});$('#qualitySelect').addEventListener('change',e=>{state.quality=e.target.value;saveState();toast('La calidad se aplicará al recargar')});$('#resetProgressBtn').addEventListener('click',()=>{if(confirm('¿Restablecer todo el progreso?')){localStorage.removeItem('wq3d-state');location.reload()}});

document.addEventListener('visibilitychange',()=>{if(document.hidden&&!paused)pauseGame()});
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
init3D();buildBoard();updateHud();
