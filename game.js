/* MARK ON ME · No libraries, build step, server, or network required.
   EDIT HERE: scene captions, image filenames, and optional music paths. */
const CONFIG = {
  images: { claw:'assets/claw-user.png', title:'assets/title-forest-new.png', forest:'assets/forest-v3.png', empty:'assets/empty-v3.png', desk:'assets/desk-v3.png', car:'assets/car-v3.png', cliff:'assets/cliff-v3.png', wolf:'assets/wolf-v2-sprite.png', ending:'assets/cliff-v3.png', bottle:'assets/bottle-photo.png', bottleLetter:'assets/bottle-letter-photo.png', key:'assets/key-photo.png', paper:'assets/letter-paper-transparent.png', sleeve:'assets/sleeve-v2-sprite.png' },
  // User-provided local songs. Durations are seconds; volume is 0..1.
  audio: {startRatio:.45,startAt:{},volume:.5,fadeIn:3,fadeOut:2,openingSeconds:44,
    tracks:{mark:'assets/audio/mark-on-me.mp3',good:'assets/audio/good-boy.mp3',empty:'assets/audio/empty.mp3',love:'assets/audio/love-jang.mp3',accelerate:'assets/audio/accelerate.mp3',howl:'assets/audio/night-to-howl.mp3'},
    chapterTracks:['good','empty','love','accelerate','howl']
  },
  walkSpeed: .16,
  chapters: [
    {name:'GOOD BOY', bg:'forest', caption:'약속한 곳에는 네가 없었다. 나무에 남은 작은 상처만이 나를 기다렸다.', goal:'나무에 남은 첫 번째 발톱자국을 찾아 다가가세요.', mark:[.865,.48]},
    {name:'EMPTY', bg:'empty', caption:'아무것도 없는 곳에, 네가 남겨둔 빈자리가 있었다.', goal:'공터의 돌에 남은 두 번째 흔적을 찾아보세요.', mark:[.51,.55]},
    {name:'러브장', bg:'desk', caption:'이번에는 내가, 너에게 무언가를 남길 차례였다.', goal:'오래된 책상에 새겨진 세 번째 흔적을 찾으세요.', mark:[.64,.69]},
    {name:'ACCELERATE', bg:'car', caption:'숲은 끝나지 않았지만, 너에게 가는 길은 조금 더 선명해졌다.', goal:'차로 이어지는 네 번째 발톱자국을 따라가세요.', mark:[.43,.74]},
    {name:'NIGHT TO HOWL!', bg:'cliff', caption:'달빛이 닿는 곳. 오래전 우리가 다시 만나기로 했던 곳.', goal:'절벽의 마지막 흔적을 찾아 다가가세요.', mark:[.48,.75]}
  ]
};
const $=id=>document.getElementById(id), canvas=$('world'), ctx=canvas.getContext('2d');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const art={}; let W=0,H=0,dpr=1,clock=0,last=0,frame=0,toastTimer;
const keys=new Set();
const state={mode:'title',chapter:0,stage:'mark',z:0,x:0,lookX:0,lookY:0,mouseX:.5,mouseY:.52,marks:0,bottle:false,letter:'',sealed:false,key:false,paused:false,transition:false,anim:0,hover:false,exitTravel:0,lit:false,prologuePage:-1,selectedSlot:4,acquireAt:-10};
let sceneView=null,driveData=null;
let targetRect=null,previousFocus=null,pickupFlight=null,stepTimer=0;
const sfx=new SoundEffects();
const letterDrawing=new LetterDrawing($('letterDrawing'),()=>{ $('foldLetter').disabled=!$('letter').value.trim()&&!letterDrawing.hasInk; });
const music=new MusicController(CONFIG.audio,msg=>toast(msg),()=>{
  syncSoundButton('audioToggle',!music.muted,'음악',music.needsGesture);
});
Object.entries(CONFIG.images).forEach(([key,src])=>{const im=new Image();im.onload=()=>{art[key]=im;};im.onerror=()=>console.warn('Image unavailable:',src);im.src=src;});
function resize(){W=innerWidth;H=innerHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);}
addEventListener('resize',resize);resize();
function setText(id,text){$(id).textContent=text;}
function show(id,visible=true){$(id).hidden=!visible;}
function say(text){if(state.mode==='explore'||state.mode==='drive')return;setText('narrativeText',text);}
function toast(text){setText('toast',text);show('toast');clearTimeout(toastTimer);toastTimer=setTimeout(()=>show('toast',false),2800);}
function updateHud(){
  const ch=CONFIG.chapters[state.chapter];setText('chapterIndex',`CHAPTER 0${state.chapter+1} · THE ${['FIRST','SECOND','THIRD','FOURTH','LAST'][state.chapter]} MARK`);$('chapterNameArt').src=['assets/title-good-boy.png','assets/title-empty.png','assets/title-love-jang.png','assets/title-accelerate.png','assets/title-night-to-howl.png'][state.chapter];$('chapterNameArt').alt=ch.name;
  $('marks').replaceChildren(...Array.from({length:5},(_,i)=>{const el=document.createElement('i');if(i<state.marks)el.className='found';return el;}));setText('markCount',`${state.marks} / 5`);
  const items=[
    {icon:'claw',name:'늑대의 흔적',owned:state.marks>0,count:state.marks},
    {icon:'bottle',name:state.sealed?'편지를 담은 병':'빈 유리병',owned:state.bottle},
    {icon:'letter',name:'접은 편지',owned:!!(state.letter||state.letterArt)&&!state.sealed},
    {icon:'key',name:'자동차 열쇠',owned:state.key},
    {icon:'bookmark',name:'다시 만나자는 약속',owned:true}
  ];
  $('inventory').replaceChildren(...items.map((item,i)=>{
    const el=document.createElement('div');el.className='hotbar-slot'+(item.owned?' owned':'')+(state.selectedSlot===i?' selected':'');el.setAttribute('aria-label',item.owned?item.name:'빈 아이템 칸');el.title=item.owned?item.name:'';
    const num=document.createElement('small');num.textContent=String(i+1);el.appendChild(num);
    if(item.owned){const icon=document.createElement(item.icon==='bottle'||item.icon==='key'||item.icon==='claw'?'img':'span');if(icon.tagName==='IMG'){icon.src=CONFIG.images[item.icon==='bottle'&&state.sealed?'bottleLetter':item.icon];icon.alt=item.name;}else{icon.className='item-symbol '+item.icon;icon.textContent=item.icon==='claw'?'╱╱╱':item.icon==='letter'?'✉':' ';}el.appendChild(icon);if(item.count){const count=document.createElement('b');count.textContent=item.count;el.appendChild(count);}}
    return el;
  }));

}
function acquire(slot){sfx.play('pickup');pickupFlight={slot,x:targetRect?.x??W*.5,y:targetRect?.y??H*.5,start:clock};state.selectedSlot=slot;state.acquireAt=clock;updateHud();}
function changeScene(index){show('narrative',false);show('storybook',false);$('game').dataset.scene='night';music.setTrack(CONFIG.audio.chapterTracks[index]);state.exitTravel=0;state.foundPrints=[];state.markFocus=0;state.hintTime=0;state.chapter=index;state.mode='chapter';show('chapterCard');setText('cardNumber',`CHAPTER ${String(index+1).padStart(2,'0')}`);$('cardTitleArt').src=['assets/title-good-boy.png','assets/title-empty.png','assets/title-love-jang.png','assets/title-accelerate.png','assets/title-night-to-howl.png'][index];$('cardTitleArt').alt=CONFIG.chapters[index].name;state.stage='mark';state.z=0;state.x=0;state.anim=0;keys.clear();updateHud();setText('objective',CONFIG.chapters[index].goal);say(CONFIG.chapters[index].caption);}
async function fadeTo(fn){if(state.transition)return;state.transition=true;keys.clear();show('interaction',false);$('fade').classList.add('active');await new Promise(r=>setTimeout(r,reduced?160:650));fn();$('fade').classList.remove('active');await new Promise(r=>setTimeout(r,reduced?160:650));state.transition=false;}
function start(){
  if(state.previewLetter){state.previewLetter=false;state.member=null;state.letter='';state.letterArt=null;$('letter').value='';letterDrawing.reset();setText('letterCount','0 / 600');}
  sfx.unlock();music.unlock();music.setPaused(false);music.setDucked(1);music.setTrack('mark');
  fadeTo(()=>{show('title',false);show('ending',false);show('narrative',false);show('storybook');state.mode='prologue';state.anim=0;state.prologuePage=-1;$('game').dataset.scene='book';});
}
function restart(){sfx.stopHowl();music.stop();closeModal('help');closeModal('letterRead');fadeTo(()=>{Object.assign(state,{mode:'title',chapter:0,stage:'mark',z:0,x:0,marks:0,bottle:false,letter:'',member:null,sealed:false,key:false,paused:false,anim:0,selectedSlot:4,acquireAt:-10,lit:false,prologuePage:-1});$('letter').value='';state.letterArt=null;letterDrawing.reset();setText('letterCount','0 / 600');$('foldLetter').disabled=true;['chapterCard','memberPanel','ending','hud','objective','narrative','gameFooter','reticle','interaction'].forEach(id=>show(id,false));show('title');show('storybook',false);$('game').dataset.scene='title';music.stop();$('start').focus();});}
function openModal(id,focusId){sfx.stopHowl();previousFocus=document.activeElement;keys.clear();state.paused=true;show(id);$(focusId)?.focus();if(id==='help')music.setPaused(true);else music.setDucked(.35);}
function closeModal(id){if($(id).hidden)return;show(id,false);state.paused=false;keys.clear();previousFocus?.focus();if(id==='help')music.setPaused(false);else music.setDucked(1);}
function target(){
  const ch=CONFIG.chapters[state.chapter];
  if(state.stage==='mark')return {kind:'mark',pos:footprints()[state.markFocus??0],label:'늑대 발자국 조사하기'};
  const defs={memento:['fur',[.57,.72],'남겨진 털 한 줌 살펴보기'],bottle:['bottle',[.5,.455],'빈 유리병 가져가기'],write:['paper',[.51,.72],'펜을 들고 편지 쓰기'],folded:['folded',[.5,.73],'접은 편지를 병에 넣기'],inserted:['bottleLetter',[.5,.72],'병의 마개 닫기'],sealed:['bottleLetter',[.5,.72],'마음을 담은 병 챙기기'],key:['key',[.47,.72],'차 열쇠 줍기'],};
  const d=defs[state.stage];return d?{kind:d[0],pos:d[1],label:d[2]}:null;
}
function interact(){
  if(state.mode!=='explore'||state.paused||state.transition)return;
  if(!target())return;
  const activeTarget=target();if(!sceneView||Math.hypot(state.mouseX*W-(sceneView.x+activeTarget.pos[0]*sceneView.w),state.mouseY*H-(sceneView.y+activeTarget.pos[1]*sceneView.h))>=flashlightRadius()*.75)return;
  if(state.z<.68){toast('조금 더 가까이 걸어가 보세요. ↑');return;}
  if(state.stage==='mark'){
    const found=state.foundPrints??(state.foundPrints=[]),index=state.markFocus??0;if(found.includes(index))return;found.push(index);sfx.play('pickup');state.hintTime=0;
    if(found.length<3){state.markFocus=[0,1,2].find(i=>!found.includes(i));setText('objective',`늑대 발자국 ${found.length} / 3 · 나머지 발자국을 찾아보세요.  H 힌트`);return;}
    state.marks++;state.anim=0;acquire(0);if(state.marks===5)music.setTrack('mark');
    const stages=['memento','bottle','write','key','cliff'];state.stage=stages[state.chapter];if(state.stage==='cliff')prepareExit('cliff');
    const lines=['껍질 사이에 잿빛 털이 걸려 있었다. 분명, 네가 여기 있었다.','누군가의 말을 기다리듯, 비어 있는 작은 병 하나.','펜과 편지지. 네가 남긴 빈자리를 나의 말로 채우고 싶었다.','마지막 발톱자국 곁에 차 열쇠가 놓여 있었다.','흔적은 여기서 끝났다. 하지만 우리의 약속은, 아직.'];say(lines[state.chapter]);
    setText('objective',['나무 아래에 남겨진 털을 살펴보세요.','돌 위의 빈 병을 가져가세요.','책상의 편지지에 늑대에게 전할 말을 써보세요.','차 앞에 놓인 열쇠를 주우세요.','↑ 키로 조금 더, 달빛이 비치는 절벽으로.'][state.chapter]);return;
  }
  switch(state.stage){
    case 'memento':sfx.play('paper');say('익숙한 온기가 손끝에 남았다. 넌 내가 찾아올 것을 알고 있었구나.');prepareExit();setText('objective','↑ 키로 숲 안쪽을 향해 계속 걸어가세요.');break;
    case 'bottle':state.bottle=true;prepareExit();say('빈 병을 조심히 챙겼다. 언젠가 이 안에 담을 말이 생길 것 같았다.');acquire(1);setText('objective','↑ 키로 병을 챙겨 다음 흔적을 향해 걸어가세요.');break;
    case 'write':openMemberPicker();break;
    case 'folded':if(!state.bottle)return;sfx.play('paper');state.stage='inserted';state.anim=0;say('접은 편지가 병 속으로 미끄러졌다. 이제 더는 비어 있지 않았다.');setText('objective','마개를 닫아 편지를 간직하세요.');break;
    case 'inserted':sfx.play('cork');state.sealed=true;state.stage='sealed';state.anim=0;updateHud();say('흔적을 찾던 내가, 처음으로 너에게 흔적을 남겼다.');acquire(1);setText('objective','다시 숲으로, 다음 흔적을 따라가세요.');break;
    case 'sealed':prepareExit();say('병을 품에 넣었다. 너에게 닿으면, 이 마음을 건넬 거야.');break;
    case 'key':state.key=true;prepareExit('car');acquire(3);say('차가운 열쇠를 쥐었다. 이제 너에게 갈 수 있다.');setText('objective','↑ 키로 자동차에 다가가면 탑승합니다.');break;

  }
}
// Scene exits are reached by walking, never by an interaction button.
function prepareExit(stage='next'){
  state.stage=stage;state.exitTravel=0;show('interaction',false);
  setText('objective',stage==='car'?'↑ 키로 자동차에 다가가세요.':stage==='cliff'?'↑ 키로 달빛 아래까지 걸어가세요.':'↑ 키로 숲길을 계속 걸어가세요.');
}
function crossExit(){
  if(state.stage==='next'){fadeTo(()=>changeScene(state.chapter+1));return;}
  if(state.stage==='car'&&state.key&&state.sealed){fadeTo(()=>{sfx.play('door');driveData=newDrive();state.mode='drive';$('game').dataset.scene='drive';state.anim=0;show('narrative',false);show('interaction',false);show('reticle',false);setText('objective','↑ 길게 눌러 가속 · ↓ 브레이크 · ← → 조향 | 장애물을 피하세요.');say('나무 사이를 가르며, 오래된 약속을 향해 달렸다.');});return;}
  if(state.stage==='cliff'){state.howlPlayed=false;state.mode='reunion';$('game').dataset.scene='reunion';state.anim=0;show('narrative',false);keys.clear();show('interaction',false);show('reticle',false);setText('objective','잠시, 달빛 아래에서 기다려보세요.');say('고요 속에서, 익숙한 발소리가 들려왔다.');}
}
async function foldLetter(){if(state.folding)return;const text=$('letter').value.trim();if((!text&&!letterDrawing.hasInk)||!state.member)return;if($('letter').scrollHeight>$('letter').clientHeight+3){toast('편지지 안에 들어오도록 줄바꿈이나 글 길이를 줄여 주세요.');return;}state.letter=$('letter').value;state.letterArt=letterDrawing.hasInk?letterDrawing.snapshot():null;state.folding=true;try{await animateLetterFold();}finally{state.folding=false;}closeModal('letterPanel');if(state.previewLetter){$('readLetter').onclick();return;}state.stage='folded';state.anim=0;acquire(2);say('전하고 싶었던 말을 천천히 접었다. 가져온 빈 병을 꺼냈다.');setText('objective','접은 편지를 빈 병 안에 넣으세요.');}
function finish(){fadeTo(()=>{state.mode='ending';$('game').dataset.scene='ending';show('ending');['hud','objective','narrative','gameFooter','reticle','interaction'].forEach(id=>show(id,false));$('readLetter').focus();});}
$('title').onclick=()=>{if(state.mode==='title'&&!state.transition)start();};$('start').onclick=e=>{e.stopPropagation();start();};$('interact').onclick=interact;$('foldLetter').onclick=foldLetter;$('closeLetter').onclick=()=>closeModal('letterPanel');
$('letter').addEventListener('input',()=>{setText('letterCount',`${$('letter').value.length} / 600`);$('foldLetter').disabled=!$('letter').value.trim()&&!letterDrawing.hasInk;});
function syncSoundButton(id,enabled,label,needsGesture=false){
  const button=$(id);
  button.setAttribute('aria-pressed',String(enabled));
  button.setAttribute('aria-label',`${label} ${enabled?'켜짐':'꺼짐'}`);
  button.title=needsGesture?`${label} 재생`:`${label} ${enabled?'끄기':'켜기'}`;
}
$('audioToggle').onclick=()=>music.toggle();
$('titleHelp').onclick=e=>{e.stopPropagation();openModal('help','resume');};
$('helpBtn').onclick=()=>openModal('help','resume');$('resume').onclick=()=>closeModal('help');$('restartHelp').onclick=restart;$('replay').onclick=restart;
$('readLetter').onclick=()=>{setText('readTitle',`${state.member||'늑대'}에게,`);setText('savedLetter',state.letter);show('savedLetter',!!state.letter);$('savedDrawing').src=state.letterArt||'';show('savedDrawing',!!state.letterArt);openModal('letterRead','closeRead');};$('closeRead').onclick=()=>closeModal('letterRead');
const movement=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
addEventListener('keydown',e=>{
  if(state.folding){e.preventDefault();return;}
  const modal=['memberPanel','letterPanel','help','letterRead'].find(id=>!$(id).hidden);
  if(e.key==='Escape') {e.preventDefault();if(modal)closeModal(modal);else if(state.mode!=='title'&&state.mode!=='ending'&&!state.transition)openModal('help','resume');return;}
  if(modal){if(e.key==='Tab'){const els=Array.from($(modal).querySelectorAll('button:not(:disabled), textarea, input:not(:disabled)'));const first=els[0],lastEl=els[els.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();lastEl.focus();}else if(!e.shiftKey&&document.activeElement===lastEl){e.preventDefault();first.focus();}}return;}
  const key=e.key.length===1?e.key.toLowerCase():e.key;
  if(state.mode==='prologue'&&(key==='ArrowRight'||key==='ArrowLeft')){e.preventDefault();if(!e.repeat&&!bookTurn)state.anim=clamp((Math.floor(state.anim/11)+(key==='ArrowRight'?1:-1))*11,0,CONFIG.audio.openingSeconds);return;}
  if(movement.includes(key)){e.preventDefault();keys.add(key);}
  if(key==='h'&&!e.repeat&&state.mode==='explore'&&state.stage==='mark'){state.hintTime=6;setText('objective','손전등으로 반짝이는 발자국을 찾아보세요.');}
  if(key==='e'&&!e.repeat){e.preventDefault();interact();}
});
addEventListener('keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));
addEventListener('blur',()=>{keys.clear();if(!state.paused&&state.mode!=='title'&&state.mode!=='ending'&&!state.transition)openModal('help','resume');});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();sfx.stopHowl();sfx.engine(false,0);music.suspend();}else music.resume();});
canvas.addEventListener('pointermove',e=>{state.mouseX=e.clientX/W;state.mouseY=e.clientY/H;state.lookX=(state.mouseX-.5)*.11;state.lookY=(state.mouseY-.5)*.06;});
canvas.addEventListener('pointerdown',e=>{if(state.mode==='title'){start();return;}if(targetRect&&Math.hypot(e.clientX-targetRect.x,e.clientY-targetRect.y)<targetRect.r)interact();});
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function smooth(v){v=clamp(v,0,1);return v*v*(3-2*v);}
function path(points,color,stroke,width=1){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();if(color){ctx.fillStyle=color;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
function background(name,z=state.z){
  const im=art[name];const bob=state.mode==='explore'&&!reduced&&keys.size?Math.sin(clock*10)*4:0;
  const scale=1.025+(z+(state.mode==='explore'?state.exitTravel:0))*.19;let ox=-(state.x*.035+state.lookX)*W;const oy=-state.lookY*H+bob;
  ctx.fillStyle='#17272e';ctx.fillRect(0,0,W,H);
  if(im){const s=Math.max(W/im.width,H/im.height)*scale;const iw=im.width*s,ih=im.height*s;if(W/H<1.1&&state.mode==='explore'){ox+=(.5-(target()?.pos[0]??.5))*iw*.9;}ox=clamp(ox,-(iw-W)/2,(iw-W)/2);const x=(W-iw)/2+ox,y=(H-ih)/2+clamp(oy,-(ih-H)/2,(ih-H)/2);ctx.drawImage(im,x,y,iw,ih);if(name==='title'){ctx.save();ctx.fillStyle='rgba(4,7,15,.18)';ctx.fillRect(0,0,W,H);ctx.restore();}return {x,y,w:iw,h:ih};}
  // Atmospheric fallback only while the local artwork is loading.
  const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#283b43');g.addColorStop(1,'#101d22');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  for(let i=0;i<20;i++){const x=((i*173)%1000)/1000*W;path([[x-10,H],[x-4,0],[x+9,0],[x+32,H]],'#101a21');}return{x:ox,y:oy,w:W,h:H};
}
function claw(x,y,size,bright=1,reveal=1){if(art.claw){ctx.save();ctx.globalAlpha=Math.min(1,bright*.8)*reveal;const h=size*1.15,w=h*art.claw.width/art.claw.height;ctx.drawImage(art.claw,x-w/2,y-h/2,w,h);ctx.restore();return;}ctx.save();ctx.translate(x,y);ctx.rotate(.13);ctx.shadowColor='#eee9d6';ctx.shadowBlur=bright>1?4:0;for(let i=0;i<3;i++){const dx=(i-1)*size*.26;path([[dx+size*.18,-size*.55],[dx+size*.06,-size*.09],[dx-size*.13,size*.52*reveal],[dx-size*.15,size*.23],[dx-size*.015,-size*.20]],`rgba(${state.chapter===0?'221,205,165':'188,176,151'},${Math.min(.95,bright*.64)})`);}ctx.restore();}
function bottle(x,y,s,filled=false){const photo=filled?art.bottleLetter:art.bottle;if(photo){const h=190*s,w=h*photo.width/photo.height;ctx.drawImage(photo,x-w/2,y-h/2,w,h);return;}ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.shadowColor='#d2e2d5';ctx.shadowBlur=13;path([[-9,-30],[-9,-15],[-20,-3],[-21,35],[-15,41],[15,41],[21,35],[20,-3],[9,-15],[9,-30]],'#b9cebc24','#b6c9bd',1.5);ctx.shadowBlur=0;ctx.strokeStyle='#cadbc799';ctx.beginPath();ctx.moveTo(-14,4);ctx.lineTo(-14,30);ctx.stroke();if(filled){ctx.save();ctx.rotate(-.17);ctx.fillStyle='#d7caab';ctx.fillRect(-7,-6,14,34);ctx.strokeStyle='#8d836f';ctx.strokeRect(-7,-6,14,34);ctx.restore();}if(state.sealed){ctx.fillStyle='#9f8b67';ctx.fillRect(-10,-36,20,10);}ctx.restore();}
function drawItem(kind,x,y,size){if(kind==='key'&&art.key){const h=size*1.7,w=h*art.key.width/art.key.height;ctx.drawImage(art.key,x-w/2,y-h/2,w,h);return;}const s=size/55;ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.lineCap='round';
  if(kind==='bottle'||kind==='bottleLetter'){ctx.restore();bottle(x,y,s,kind==='bottleLetter');return;}
  if(kind==='paper'||kind==='folded'){ctx.rotate(-.1);if(art.paper)ctx.drawImage(art.paper,-33,-28,67,54);else path([[-33,-24],[29,-28],[34,22],[-28,26]],'#d1c5aa','#8a8e79');ctx.strokeStyle='#737866';ctx.lineWidth=.8;for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(-20,-10+i*7);ctx.lineTo(17,-12+i*7);ctx.stroke();}if(kind==='folded'){ctx.save();ctx.beginPath();ctx.moveTo(-33,-24);ctx.lineTo(0,6);ctx.lineTo(29,-28);ctx.closePath();ctx.clip();if(art.paper)ctx.drawImage(art.paper,-33,-28,67,54);ctx.restore();path([[-33,-24],[0,6],[29,-28]],null,'#8a7757');ctx.fillStyle='#8d2434';ctx.beginPath();ctx.arc(0,6,6,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#b34d52';ctx.lineWidth=1;ctx.stroke();}else{ctx.rotate(.65);path([[28,-37],[32,-37],[32,20],[30,29],[28,20]],'#bdaf8f');}}
  else if(kind==='key'){ctx.strokeStyle='#c7b990';ctx.lineWidth=4;ctx.beginPath();ctx.arc(-12,-10,10,0,Math.PI*2);ctx.moveTo(-5,-2);ctx.lineTo(20,22);ctx.lineTo(25,17);ctx.moveTo(12,14);ctx.lineTo(18,8);ctx.stroke();}
  else if(kind==='fur'){for(let i=0;i<16;i++)path([[-18+i*2,-5],[-25+i*3,-22-Math.sin(i)*7],[18-i,18]],i%2?'#9ba7a4':'#78898a');}
  else {ctx.strokeStyle='#d4cbb5aa';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,17,0,Math.PI*2);ctx.moveTo(-5,0);ctx.lineTo(6,0);ctx.moveTo(1,-5);ctx.lineTo(6,0);ctx.lineTo(1,5);ctx.stroke();}
  ctx.restore();
}
function particles(){ctx.save();for(let i=0;i<30;i++){const x=((i*137.1+Math.sin(clock*.2+i)*25)%(W+30)),y=((i*73.7-clock*(2+i%3))%H+H)%H;ctx.globalAlpha=.07+(Math.sin(clock+i)+1)*.055;ctx.fillStyle='#dde1c8';ctx.fillRect(x,y,i%3?1:2,1);}ctx.restore();}
function flashlightRadius(){return Math.min(210,Math.min(W,H)*.25)*2;}
function lantern(){
  if(state.mode!=='explore')return;
  const x=state.mouseX*W,y=state.mouseY*H,r=flashlightRadius();
  ctx.save();
  // A bright central beam, broad penumbra and a little ambient spill.
  const g=ctx.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,'rgba(3,6,16,0)');
  g.addColorStop(.35,'rgba(3,6,16,.025)');
  g.addColorStop(.62,'rgba(3,6,16,.16)');
  g.addColorStop(.82,'rgba(3,6,16,.51)');
  g.addColorStop(1,'rgba(3,6,16,.88)');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.globalCompositeOperation='screen';
  const warm=ctx.createRadialGradient(x,y,0,x,y,r);
  warm.addColorStop(0,'rgba(255,244,212,.32)');
  warm.addColorStop(.28,'rgba(255,241,202,.23)');
  warm.addColorStop(.6,'rgba(250,235,197,.12)');
  warm.addColorStop(.85,'rgba(242,226,189,.035)');
  warm.addColorStop(1,'rgba(242,226,189,0)');
  ctx.fillStyle=warm;ctx.fillRect(0,0,W,H);
  ctx.restore();
}

function sleeve(){if(state.mode!=='explore')return;if(art.sleeve){const h=Math.min(H*.37,W*.32),w=h*art.sleeve.width/art.sleeve.height;ctx.drawImage(art.sleeve,W-w+20,H-h+30+(reduced?0:Math.sin(clock*2)*3+(keys.size?Math.sin(clock*10)*9:0)-Math.sin(clamp((clock-state.acquireAt)/.65,0,1)*Math.PI)*55),w,h);return;}const x=W*.89,y=H+10,b=reduced?0:Math.sin(clock*1.5)*3;ctx.save();ctx.translate(x,y+b);path([[-38,30],[-42,-44],[-18,-96],[3,-90],[39,-28],[56,30]],'#752d2e');path([[-18,-96],[-14,-119],[2,-131],[12,-125],[10,-99],[3,-90]],'#b4a28a');path([[-40,-35],[-22,-82],[-13,-77],[-13,0]],'#91352f');ctx.restore();}
function wolf(progress){const im=art.wolf;const size=Math.min(W*.3,H*.47)*(.25+.75*smooth(progress));const x=W*.53+(reduced?0:Math.sin(clock*3)*2),y=H*.79+(reduced?0:Math.sin(clock*4)*2);ctx.save();ctx.globalAlpha=smooth(progress*4);if(im){const h=size;const w=h*im.width/im.height;ctx.drawImage(im,x-w/2,y-h,w,h);}else{path([[x-size*.4,y],[x-size*.36,y-size*.44],[x-size*.22,y-size*.65],[x-size*.26,y-size],[x-size*.09,y-size*.86],[x+size*.05,y-size],[x+size*.13,y-size*.66],[x+size*.26,y-size*.47],[x+size*.29,y],[x+size*.17,y],[x+size*.12,y-size*.31],[x-size*.2,y-size*.28],[x-size*.27,y]],'#182329');}ctx.restore();}
function newDrive(){
  const obstacles=[];for(let row=0;row<14;row++){const free=(row*7+1)%3;for(let lane=0;lane<3;lane++)if(lane!==free&&(row%3===0||lane===(free+1)%3))obstacles.push({z:240+row*160,lane:lane-1,kind:row%2?'rock':'log',hit:false});}
  return {distance:0,speed:0,throttle:0,lateralVelocity:0,steer:0,x:0,hits:0,cooldown:0,obstacles};
}
// Simplified longitudinal force model: metres, seconds, kg; displayed speed is km/h.
// Fixed small substeps keep acceleration consistent across display frame rates.
function advanceCar(d,dt,accelerating,braking,steering){
  let remaining=Math.min(Math.max(dt,0),.1);
  while(remaining>1e-8){const h=Math.min(remaining,1/120);remaining-=h;
    const v=d.speed/3.6;
    d.throttle=(d.throttle||0)+((accelerating&&!braking?1:0)-(d.throttle||0))*(1-Math.exp(-h/(accelerating&&!braking?.8:.16)));
    const traction=accelerating&&!braking?d.throttle*Math.min(4300,65000/Math.max(v,6)):0;
    const resistance=v>0?180+.43*v*v:0;
    const brakeForce=braking?8500:0;
    const engineBrake=!accelerating&&v>0?320:0;
    const nextV=clamp(v+(traction-resistance-brakeForce-engineBrake)/1200*h,0,130/3.6);
    d.speed=nextV*3.6;d.distance+=(v+nextV)*.5*h;
    d.steer=(d.steer||0)+(steering-(d.steer||0))*(1-Math.exp(-h*7));
    const desired=d.steer*Math.min(.9,nextV*.055);
    d.lateralVelocity=(d.lateralVelocity||0)+(desired-(d.lateralVelocity||0))*(1-Math.exp(-h*5));
    d.x+=d.lateralVelocity*h;
    if(Math.abs(d.x)>.9){d.x=clamp(d.x,-.9,.9);d.lateralVelocity=0;}
    d.cooldown=Math.max(0,d.cooldown-h);
  }
}
function drive(dt){
  const d=driveData||(driveData=newDrive()),roadW=Math.min(W*.67,620),left=W/2-roadW/2,carY=H*.78,carW=38,carH=67;
  if(!state.paused&&!state.transition){
    advanceCar(d,dt,keys.has('ArrowUp'),keys.has('ArrowDown'),(keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0));
  }
  ctx.fillStyle='#101e25';ctx.fillRect(0,0,W,H);ctx.fillStyle='#303937';ctx.fillRect(left,0,roadW,H);
  ctx.fillStyle='#60664c';ctx.fillRect(left,0,5,H);ctx.fillRect(left+roadW-5,0,5,H);
  for(let i=0;i<38;i++){const y=((i*83+d.distance*2)%(H+90))-45,x=left+20+((i*127)%Math.max(1,roadW-40));ctx.fillStyle=i%2?'#565b4944':'#111e2644';ctx.fillRect(x,y,5+i%8,3+i%5);}
  for(let i=0;i<16;i++){const y=((i*115+d.distance*2)%(H+160))-80;for(const side of [-1,1]){const x=W/2+side*(roadW/2+45+(i%3)*20);ctx.save();ctx.translate(x,y);ctx.rotate(i*.7);path([[-43,-12],[-29,-39],[1,-47],[30,-31],[43,-2],[28,32],[-4,45],[-38,26]],'#0c1920');path([[-35,-18],[-13,-41],[15,-34],[37,-6],[21,29],[-8,36],[-32,12]],i%2?'#294135':'#233c34');path([[-13,-41],[15,-34],[37,-6],[0,0]],'#355044');path([[0,0],[21,29],[-8,36],[-32,12]],'#1a302e');ctx.restore();}}
  for(const o of d.obstacles){const y=carY-(o.z-d.distance)*2;if(y< -100||y>H+100)continue;const x=W/2+o.lane*roadW*.3;
    ctx.save();ctx.translate(x,y);if(o.kind==='rock'){path([[-30,15],[-22,-22],[10,-29],[32,-5],[22,23]],'#72756b','#323f40',3);path([[-22,-22],[10,-29],[0,8]],'#95927c');}else{ctx.rotate(.18);ctx.fillStyle='#574232';ctx.fillRect(-48,-17,96,34);ctx.strokeStyle='#987550';ctx.lineWidth=3;ctx.strokeRect(-48,-17,96,34);ctx.fillStyle='#8c7151';ctx.fillRect(-42,-12,7,24);}ctx.restore();
    if(!state.paused&&!state.transition&&!o.hit&&d.cooldown<=0&&Math.abs(y-carY)<carH*.5+22&&Math.abs(x-(W/2+d.x*roadW*.45))<carW*.5+(o.kind==='log'?48:30)){
      o.hit=true;d.hits++;d.speed*=.25;d.throttle=0;d.lateralVelocity*=.3;d.cooldown=1.2;sfx.play('door');
    }
  }
  const carX=W/2+d.x*roadW*.45;
  const lights=ctx.createRadialGradient(carX,carY-65,5,carX,carY-65,150);lights.addColorStop(0,'#efdf9a33');lights.addColorStop(1,'#efdf9a00');ctx.fillStyle=lights;ctx.fillRect(left,0,roadW,H);
  ctx.save();ctx.translate(carX,carY);ctx.rotate(reduced?0:(d.steer||0)*Math.min(.16,d.speed/400));
  ctx.fillStyle='#071118';ctx.fillRect(-24,-24,8,19);ctx.fillRect(16,-24,8,19);ctx.fillRect(-24,16,8,19);ctx.fillRect(16,16,8,19);
  path([[-18,-34],[16,-34],[21,-21],[21,29],[14,37],[-15,37],[-21,27],[-21,-20]],d.cooldown>0&&Math.floor(clock*9)%2?'#e6b794':'#8d273c','#351c2b',2);
  path([[-14,-15],[13,-15],[15,-1],[-15,-1]],'#9baca7');ctx.fillStyle='#4d1d32';ctx.fillRect(-14,6,28,17);ctx.fillStyle='#f3dfa0';ctx.fillRect(-15,-33,8,5);ctx.fillRect(8,-33,8,5);ctx.fillStyle='#e7544b';ctx.fillRect(-15,30,7,4);ctx.fillRect(8,30,7,4);ctx.restore();
  ctx.fillStyle='#09121dde';ctx.fillRect(W/2-160,100,320,57);ctx.fillStyle='#d8cbb2';ctx.font='13px Pretendard, sans-serif';ctx.textAlign='center';ctx.fillText(`약속의 장소까지 ${Math.max(0,Math.ceil(2500-d.distance))} m  ·  ${Math.round(d.speed)} km/h`,W/2,123);ctx.fillStyle='#263c40';ctx.fillRect(W/2-140,138,280,4);ctx.fillStyle='#be9b6b';ctx.fillRect(W/2-140,138,280*clamp(d.distance/2500,0,1),4);ctx.textAlign='start';
  if(d.distance>=2500&&!state.transition&&!state.paused)fadeTo(()=>{changeScene(4);show('reticle');});
}

function drawPickup(){
  if(!pickupFlight)return;const p=pickupFlight,t=clamp((clock-p.start)/1.15,0,1);if(t>=1){pickupFlight=null;return;}
  const endX=W*.5+(p.slot-2)*60,endY=H-55,e=smooth(t),x=p.x+(endX-p.x)*e,y=p.y+(endY-p.y)*e-Math.sin(t*Math.PI)*70;
  ctx.save();ctx.translate(x,y);ctx.rotate(reduced?0:Math.sin(t*Math.PI*6)*.13*(1-t));ctx.translate(-x,-y);ctx.globalAlpha=1-t*.25;ctx.shadowColor='#e6c68a';ctx.shadowBlur=15;
  if(p.slot===0)claw(x,y,35*(1-t*.4),1.5);else drawItem(p.slot===1?(state.sealed?'bottleLetter':'bottle'):p.slot===2?'folded':'key',x,y,38*(1-t*.4));ctx.restore();
}

function redHood(x,y,height){
  ctx.save();ctx.translate(x,y);ctx.scale(height/260,height/260);
  path([[-27,-62],[-24,0],[-8,0],[-4,-63]],'#171821');path([[8,-63],[10,0],[24,0],[29,-63]],'#171821');
  path([[0,-180],[-62,-63],[-28,-46],[37,-49],[67,-67],[24,-166]],'#941d32');
  path([[0,-180],[-62,-63],[-17,-58]],'#b62a39');path([[0,-180],[5,-64],[37,-49],[67,-67],[24,-166]],'#751a30');
  path([[4,-258],[-38,-220],[-32,-180],[0,-164],[33,-184],[27,-225]],'#b4263a');path([[4,-258],[4,-177],[33,-184],[27,-225]],'#76172e');
  ctx.restore();
}
const STORY=[
  ['혼자였던 늑대','옛날, 깊은 숲속에 늑대 한 마리가 살고 있었습니다. 사람들은 늑대가 자신들을 해칠 거라 생각했지요. 그래서 늑대는 늘 혼자였습니다.'],
  ['먼저 내민 손','어느 날, 빨간 망토를 입은 소녀가 다가와 먼저 손을 내밀었습니다. 그날부터 둘은 친구가 되었고, 늑대는 한 사람에게 마음을 열었습니다.'],
  ['책갈피에 남긴 약속','헤어지던 날, 둘은 이야기 사이에 책갈피를 꽂았습니다. “우리, 여기서 다시 만나자.” 아직 끝나지 않은 동화에 남겨둔 약속이었습니다.'],
  ['다음 페이지는, 너에게로','약속한 날, 빨간 망토는 직접 늑대를 찾아 숲으로 향했습니다. 길 위에는 늑대가 남긴 발톱자국이 있었습니다. 이제, 당신의 발걸음으로 이야기를 이어가세요.']
];
let bookTurn=null;
function fitBookText(){
  const box=$('storyText');box.style.fontSize='';let size=parseFloat(getComputedStyle(box).fontSize);
  for(let i=0;i<35&&box.scrollHeight>box.clientHeight+1;i++){size*=.96;box.style.fontSize=size+'px';}
}
addEventListener('resize',()=>{if(state.mode==='prologue')fitBookText();});
if(document.fonts)document.fonts.ready.then(()=>{if(state.mode==='prologue')fitBookText();});
function prologue(){
  background('title',0);const page=Math.min(3,Math.floor(state.anim/11));
  if(state.prologuePage===-1){bookTurn=null;show('pageTurn',false);}
  if(page!==state.prologuePage&&!bookTurn){
    const previous=state.prologuePage;
    if(previous>=0&&!reduced){
      setText('turnTitle',STORY[previous][0]);setText('turnText',STORY[previous][1]);
      bookTurn={start:clock,direction:page>previous?1:-1};$('pageTurn').querySelector('.turn-front').style.visibility='visible';$('pageTurn').querySelector('.turn-back').style.visibility='hidden';show('pageTurn');sfx.play('paper');
    }
    state.prologuePage=page;setText('storyTitle',STORY[page][0]);setText('storyText',STORY[page][1]);setText('storyPage',`0${page+1} / 04`);$('storybook').dataset.page=String(page);fitBookText();
  }
  if(bookTurn){const t=clamp((clock-bookTurn.start)/3,0,1),angle=smooth(t)*180;
    $('pageTurn').style.transform=`rotateY(${-angle*bookTurn.direction}deg)`;
    $('pageTurn').style.filter='none';
    $('pageTurn').querySelector('.turn-front').style.visibility=angle<90?'visible':'hidden';
    $('pageTurn').querySelector('.turn-back').style.visibility=angle>=90?'visible':'hidden';
    if(t>=1){bookTurn=null;show('pageTurn',false);}
  }
  if(state.anim>=CONFIG.audio.openingSeconds&&!bookTurn&&!state.paused&&!state.transition)fadeTo(()=>{show('storybook',false);['hud','objective','gameFooter','reticle'].forEach(id=>show(id));changeScene(0);});
}

function render(ts){const dt=Math.min((ts-last)/1000||0,.045);last=ts;music.tick(dt);if(!state.paused&&!state.transition){clock+=dt;state.anim+=dt;}
  ctx.clearRect(0,0,W,H);targetRect=null;
  if(state.mode==='title'){background('title',0);redHood(W*.5,H*.93,Math.min(H*.47,W*.32));particles();}
  else if(state.mode==='prologue'){prologue();}
  else if(state.mode==='chapter'){background(CONFIG.chapters[state.chapter].bg,0);if(state.anim>=3&&!state.paused&&!state.transition){show('chapterCard',false);state.mode='explore';state.anim=0;setText('objective','늑대 발자국 3개를 찾으세요. · 손전등으로 조사 · H 힌트');}}
  else if(state.mode==='drive'){drive(dt);}
  else if(state.mode==='ending'){background('ending',0);wolf(1);redHood(W*.37,H*.82,H*.28);particles();}
  else{
    if(state.mode==='explore'&&!state.paused&&!state.transition){
      const forward=(keys.has('ArrowUp')?1:0)-(keys.has('ArrowDown')?1:0);
      const side=(keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0);
      const moving=(forward!==0&&(forward<0?state.z>0:state.z<1||['next','car','cliff'].includes(state.stage)))||(side!==0&&Math.abs(state.x+side*.01)<.81);
      stepTimer-=dt;if(moving&&stepTimer<=0){sfx.play('step');stepTimer=.44;}
      state.z=clamp(state.z+forward*dt*CONFIG.walkSpeed,0,1);
      state.x=clamp(state.x+side*dt*.5,-.8,.8);
      if(['next','car','cliff'].includes(state.stage)){
        state.exitTravel=clamp(state.exitTravel+forward*dt*CONFIG.walkSpeed,0,.3);
        if(state.exitTravel>=.3)crossExit();
      }
    }
    const view=background(CONFIG.chapters[state.chapter].bg);sceneView=view;if(state.stage==='mark'){const points=footprints();let nearest=Infinity;points.forEach((p,i)=>{if((state.foundPrints||[]).includes(i))return;const d=Math.hypot(state.mouseX*W-(view.x+p[0]*view.w),state.mouseY*H-(view.y+p[1]*view.h));if(d<nearest){nearest=d;state.markFocus=i;}});if(!state.paused)state.hintTime=Math.max(0,(state.hintTime||0)-dt);drawFootprints(view);}
    const tar=target();
    if(state.mode==='explore'&&tar){const x=view.x+tar.pos[0]*view.w,y=view.y+tar.pos[1]*view.h,size=clamp(Math.min(W,H)*.06,26,52)*(1+state.z*.35)*(['paper','folded'].includes(tar.kind)?1.5:1);const near=state.z>=.68;state.lit=Math.hypot(state.mouseX*W-x,state.mouseY*H-y)<flashlightRadius()*.75;state.hover=Math.hypot(state.mouseX*W-x,state.mouseY*H-y)<size*1.3;targetRect={x,y,r:Math.max(38,size*1.3)};
      if(tar.kind==='mark'){}else{ctx.save();ctx.shadowColor='#d9d3a7';ctx.shadowBlur=near&&state.lit?5:0;drawItem(tar.kind,x,y,size);ctx.restore();if(state.stage==='folded')bottle(x+size*1.25,y+6,size/65,false);}
      canvas.style.cursor=state.hover?'pointer':'default';if(frame%8===0){show('interaction',near&&state.lit&&!state.paused&&!state.transition);if(near){setText('interact',`${tar.label}  ↗`);setText('nearHint','E 또는 클릭');}else if(!state.paused)setText('objective',(state.stage==='mark'?`발자국 ${(state.foundPrints||[]).length} / 3 · H 힌트`:tar.label)+'  ·  ↑ 로 앞으로');}
    }else {show('interaction',false);}
    lantern();if(state.stage==='mark'&&state.hintTime>0&&sceneView){footprints().forEach((p,i)=>{if((state.foundPrints||[]).includes(i))return;ctx.save();ctx.globalAlpha=.35+.2*Math.sin(clock*4);ctx.strokeStyle='#dabc80';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(sceneView.x+p[0]*sceneView.w,sceneView.y+p[1]*sceneView.h,28,0,Math.PI*2);ctx.stroke();ctx.restore();});}particles();sleeve();
    if(state.mode==='reunion'){const a=state.anim;if(a>=2&&!state.howlPlayed&&!state.paused&&!state.transition){state.howlPlayed=true;sfx.howl();}wolf((a-2)/7);if(a>3&&a<7)say('안개 너머, 너의 모습이 보였다.');if(a>=7&&a<11)say('말하지 않아도 알 수 있었다. 너도 나를 기다리고 있었다는 걸.');if(a>=11){claw(W*.57,H*.88,55,1.4,smooth((a-11)/2));say('네가 내 앞에 새긴 마지막 흔적. 이번에는, 나에게 남긴 약속.');for(let i=0;i<5;i++)claw(W*(.22+i*.14),H*.91,14,.6);}if(a>16&&!state.transition&&!state.paused)finish();}
  }
  drawPickup();sfx.engine(state.mode==='drive'&&!state.paused&&!state.transition&&!document.hidden,state.mode==='drive'?(driveData?.speed||0)/130:0);
  $('inventory').classList.toggle('acquired',clock-state.acquireAt<.85);frame++;requestAnimationFrame(render);
}
requestAnimationFrame(render);

function footprints(){
  return [[[.34,.57],[.57,.72],[.73,.47]],[[.35,.64],[.53,.47],[.68,.7]],[[.34,.61],[.56,.7],[.69,.48]],[[.33,.61],[.53,.74],[.68,.52]],[[.34,.59],[.52,.73],[.69,.49]]][state.chapter];
}
function paw(x,y,size,alpha){if(art.claw){ctx.save();ctx.globalAlpha=alpha;const h=size,w=h*art.claw.width/art.claw.height;ctx.drawImage(art.claw,x-w/2,y-h/2,w,h);ctx.restore();return;}ctx.save();ctx.translate(x,y);ctx.rotate(-.25);ctx.globalAlpha=alpha;ctx.fillStyle='#b8b6a1';ctx.beginPath();ctx.ellipse(0,size*.15,size*.23,size*.27,0,0,Math.PI*2);ctx.fill();for(let i=0;i<4;i++){ctx.beginPath();ctx.ellipse((i-1.5)*size*.2,-size*.24-Math.sin((i+.5)/4*Math.PI)*size*.15,size*.09,size*.13,(i-1.5)*.2,0,Math.PI*2);ctx.fill();}ctx.restore();}
function drawFootprints(view){footprints().forEach((p,i)=>{if((state.foundPrints||[]).includes(i))return;const x=view.x+p[0]*view.w,y=view.y+p[1]*view.h;const lit=Math.hypot(state.mouseX*W-x,state.mouseY*H-y)<flashlightRadius()*.75;paw(x,y,clamp(H*.065,32,53),lit?.85:.32);if(state.hintTime>0){ctx.save();ctx.strokeStyle='#f8d796';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,30+Math.sin(clock*4)*5,0,Math.PI*2);ctx.stroke();ctx.restore();}});}
const MEMBERS=['EJ','FUMA','K','NICHOLAS','YUMA','JO','HARUA','TAKI','MAKI'];
function openMemberPicker(){openModal('memberPanel','member-EJ');}
function chooseMember(name){letterDrawing.setMode('text');if(!MEMBERS.includes(name))return;state.member=name;closeModal('memberPanel');setText('letterTitle',`${name}에게,`);openModal('letterPanel','letter');}
MEMBERS.forEach(name=>{$('member-'+name).onclick=()=>chooseMember(name);});
$('closeMembers').onclick=()=>closeModal('memberPanel');
$('changeMember').onclick=()=>{closeModal('letterPanel');openMemberPicker();};

function previewLetter(){if(state.mode!=='title'||state.transition)return;state.previewLetter=true;openMemberPicker();}
$('previewLetter').onclick=e=>{e.stopPropagation();previewLetter();};
if(globalThis.location?.hash==='#letter-preview')previewLetter();

// Local review controls are hidden on the published site.
const localReview=globalThis.location?.protocol==='file:'||['localhost','127.0.0.1'].includes(globalThis.location?.hostname);
function inspectStage(destination){
  if(!localReview)return;
  if(state.folding||state.transition){toast('화면 전환이 끝나면 선택해 주세요.');return;}
  sfx.unlock();sfx.stopHowl();sfx.engine(false,0);music.unlock();music.setPaused(false);music.setDucked(1);keys.clear();
  ['title','storybook','chapterCard','memberPanel','letterPanel','letterRead','help','ending','hud','objective','narrative','gameFooter','reticle','interaction'].forEach(id=>show(id,false));
  Object.assign(state,{paused:false,previewLetter:false,mode:'title',stage:'mark',chapter:0,anim:0,z:.78,x:0,lookX:0,lookY:0,mouseX:.5,mouseY:.52,marks:0,bottle:false,sealed:false,key:false,foundPrints:[],markFocus:0,hintTime:0,exitTravel:0,howlPlayed:false,prologuePage:-1,lit:false,acquireAt:-10});
  pickupFlight=null;targetRect=null;sceneView=null;driveData=null;previousFocus=null;$('stageInspector').open=false;
  if(destination==='title'){show('title');$('game').dataset.scene='title';music.stop();return;}
  if(destination==='prologue'){state.mode='prologue';$('game').dataset.scene='book';show('storybook');music.setTrack('mark');return;}
  const chapter=/^[0-4]$/.test(destination)?Number(destination):destination==='letter'?2:destination==='drive'?3:4;
  state.marks=chapter;state.bottle=chapter>=2;state.sealed=chapter>=3;state.key=chapter>=4;
  changeScene(chapter);state.z=.78;['hud','objective','gameFooter','reticle'].forEach(id=>show(id));
  if(/^[0-4]$/.test(destination))return;
  show('chapterCard',false);
  if(destination==='letter'){state.mode='explore';state.stage='write';state.marks=3;state.bottle=true;state.foundPrints=[0,1,2];updateHud();openMemberPicker();return;}
  state.bottle=true;state.sealed=true;state.key=true;updateHud();
  if(destination==='drive'){state.mode='drive';$('game').dataset.scene='drive';driveData=newDrive();show('reticle',false);music.setTrack('accelerate');setText('objective','↑ 길게 눌러 가속 · ↓ 브레이크 · ← → 조향');return;}
  state.marks=5;state.stage='cliff';state.foundPrints=[0,1,2];music.setTrack('mark');updateHud();show('reticle',false);
  if(destination==='reunion'){state.mode='reunion';$('game').dataset.scene='reunion';setText('objective','잠시, 달빛 아래에서 기다려보세요.');return;}
  state.mode='ending';$('game').dataset.scene='ending';show('ending');['hud','objective','gameFooter'].forEach(id=>show(id,false));
}
if(localReview){show('stageInspector');document.querySelectorAll('[data-preview-stage]').forEach(button=>button.addEventListener('click',()=>inspectStage(button.dataset.previewStage)));}

const metalLogo=$('metalLogo');
metalLogo.addEventListener('pointermove',e=>{const r=metalLogo.getBoundingClientRect();metalLogo.style.setProperty('--shine-x',((e.clientX-r.left)/r.width*100)+'%');metalLogo.style.setProperty('--shine-y',((e.clientY-r.top)/r.height*100)+'%');});
