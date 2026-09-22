/* Shared paper coordinates keep decorations aligned with the typed letter. */
let inkHue=25,inkSaturation=.21,inkValue=.24;
function hsvHex(h,s,v){const k=n=>(n+h/60)%6,f=n=>v-v*s*Math.max(0,Math.min(k(n),4-k(n),1));return '#'+[f(5),f(3),f(1)].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('');}
function hexHsv(hex){const a=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255),max=Math.max(...a),min=Math.min(...a),d=max-min;let h=0;if(d){h=max===a[0]?((a[1]-a[2])/d)%6:max===a[1]?(a[2]-a[0])/d+2:(a[0]-a[1])/d+4;h=(h*60+360)%360;}return [h,max?d/max:0,max];}
function updateInk(activate=true){const color=hsvHex(inkHue,inkSaturation,inkValue);letterDrawing.color=color;letterDrawing.erasing=false;$('colorSwatch').style.background=color;$('customColor').value=color;$('colorHex').value=color;$('colorSV').style.backgroundColor=hsvHex(inkHue,1,1);$('hueHandle').style.transform=`rotate(${inkHue}deg) translateY(-48px)`;$('svHandle').style.left=(inkSaturation*100)+'%';$('svHandle').style.top=((1-inkValue)*100)+'%';$('colorSaturation').value=Math.round(inkSaturation*100);$('colorBrightness').value=Math.round(inkValue*100);$('hueWheel').setAttribute('aria-valuenow',String(Math.round(inkHue)));if(activate)letterDrawing.setMode('draw');letterDrawing.updateTools();}
$('textMode').onclick=()=>letterDrawing.setMode('text');$('penMode').onclick=()=>{letterDrawing.erasing=false;letterDrawing.setMode('draw');letterDrawing.updateTools();};
function dragColor(el,change){let pointer=null;el.addEventListener('pointerdown',e=>{if(e.button!==0)return;pointer=e.pointerId;el.setPointerCapture(pointer);change(e);e.preventDefault();});el.addEventListener('pointermove',e=>{if(pointer===e.pointerId)change(e);});for(const type of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(type,()=>pointer=null);}
dragColor($('hueWheel'),e=>{const r=$('hueWheel').getBoundingClientRect();inkHue=(Math.atan2(e.clientX-r.left-r.width/2,-(e.clientY-r.top-r.height/2))*180/Math.PI+360)%360;updateInk();});
$('hueWheel').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();inkHue=(inkHue+(['ArrowRight','ArrowUp'].includes(e.key)?2:358))%360;updateInk();});
dragColor($('colorSV'),e=>{const r=$('colorSV').getBoundingClientRect();inkSaturation=clamp((e.clientX-r.left)/r.width,0,1);inkValue=1-clamp((e.clientY-r.top)/r.height,0,1);updateInk();});
$('colorSaturation').oninput=e=>{inkSaturation=Number(e.target.value)/100;updateInk();};$('colorBrightness').oninput=e=>{inkValue=Number(e.target.value)/100;updateInk();};
for(const id of ['customColor','colorHex'])$(id).addEventListener('input',e=>{if(/^#[0-9a-f]{6}$/i.test(e.target.value)){[inkHue,inkSaturation,inkValue]=hexHsv(e.target.value);updateInk();}});
letterDrawing.setMode('text');updateInk(false);
const letterPaperImage=new Image();letterPaperImage.src='assets/letter-paper-transparent.png';
function letterFace(){const c=document.createElement('canvas');c.width=900;c.height=1200;const x=c.getContext('2d');x.fillStyle='#e4c893';x.fillRect(0,0,900,1200);if(letterPaperImage.complete&&letterPaperImage.naturalWidth)x.drawImage(letterPaperImage,0,0,900,1200);x.fillStyle='#483321';x.font='40px Songam, serif';x.fillText($('letterTitle').textContent,108,207);x.font='24.3px Songam, serif';let y=300;for(const paragraph of $('letter').value.split('\n')){let line='';for(const ch of paragraph){if(x.measureText(line+ch).width>684){x.fillText(line,108,y);y+=38.88;line=ch;}else line+=ch;}x.fillText(line,108,y);y+=38.88;}x.drawImage($('letterDrawing'),0,0);return c.toDataURL('image/png');}
async function animateLetterFold(){
  if(document.fonts)await document.fonts.ready;
  try{await letterPaperImage.decode();}catch(e){console.warn('Paper texture unavailable',e);}
  if(letterDrawing.active)letterDrawing.finish();
  const overlay=$('letterFoldScene'),studio=$('letterPanel').querySelector('.letter-studio');
  const face=letterFace();overlay.querySelectorAll('.fold-piece').forEach(p=>p.style.backgroundImage=`url("${face}")`);
  studio.inert=true;overlay.hidden=false;overlay.classList.remove('folding');void overlay.offsetWidth;overlay.classList.add('folding');sfx.play('paper');
  try{await new Promise(resolve=>setTimeout(resolve,reduced?200:2900));}finally{overlay.hidden=true;overlay.classList.remove('folding');studio.inert=false;}
}

$('penMode').onclick=()=>{const deselect=letterDrawing.mode==='draw'&&!letterDrawing.erasing;letterDrawing.erasing=false;letterDrawing.setMode(deselect?'text':'draw');letterDrawing.updateTools();$('brushOptions').hidden=deselect;$('penMode').setAttribute('aria-expanded',String(!deselect));};
$('closeBrushOptions').onclick=()=>{$('brushOptions').hidden=true;$('penMode').setAttribute('aria-expanded','false');};
$('brushType').onchange=e=>{letterDrawing.brush=e.target.value;letterDrawing.erasing=false;letterDrawing.setMode('draw');letterDrawing.updateTools();};
$('letterPanel').addEventListener('pointermove',e=>{const c=$('eraserCursor');const over=e.target===$('letterDrawing');c.hidden=!(over&&letterDrawing.mode==='draw'&&letterDrawing.erasing);c.style.left=e.clientX+'px';c.style.top=e.clientY+'px';});
$('letterPanel').addEventListener('pointerleave',()=>{$('eraserCursor').hidden=true;});
for(const id of ['textMode','penMode','closeLetter','foldLetter'])$(id).addEventListener('click',()=>{$('eraserCursor').hidden=true;});

$('eraser').onclick=()=>{const deselect=letterDrawing.mode==='draw'&&letterDrawing.erasing;letterDrawing.erasing=!deselect;letterDrawing.setMode(deselect?'text':'draw');letterDrawing.updateTools();$('eraserCursor').hidden=true;$('brushOptions').hidden=true;$('penMode').setAttribute('aria-expanded','false');};
