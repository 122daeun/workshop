/* Stroke history stays in memory. Fixed drawing coordinates preserve art on resize. */
class LetterDrawing {
  constructor(canvas,onChange){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.onChange=onChange;this.strokes=[];this.active=null;this.pointer=null;this.color='#3d3530';this.erasing=false;this.hasInk=false;this.mode='text';this.brush='round';
    this.colors=Array.from(document.querySelectorAll('.pen-color'));
    this.colors.forEach(button=>button.addEventListener('click',()=>{this.color=button.dataset.color;this.erasing=false;this.updateTools();}));
    document.getElementById('eraser').onclick=()=>{this.erasing=true;this.setMode('draw');this.updateTools();};
    document.getElementById('undoDrawing').onclick=()=>{if(this.active)this.finish();this.strokes.pop();this.redraw();this.changed();};
    document.getElementById('clearDrawing').onclick=()=>this.reset();
    canvas.addEventListener('pointerdown',e=>{if(this.mode!=='draw'||this.pointer!==null||e.button!==0)return;e.preventDefault();this.pointer=e.pointerId;canvas.setPointerCapture(e.pointerId);this.active={color:this.color,erase:this.erasing,brush:this.brush,size:Number(document.getElementById('penSize').value),points:[this.point(e)]};this.strokes.push(this.active);this.paint(this.active);});
    canvas.addEventListener('pointermove',e=>{if(e.pointerId!==this.pointer||!this.active)return;e.preventDefault();const p=this.point(e),last=this.active.points.at(-1);if(Math.hypot(p.x-last.x,p.y-last.y)<.8)return;this.active.points.push(p);this.paint({...this.active,points:[last,p]});});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{if(e.pointerId===this.pointer)this.finish();});
  }
  setMode(mode){if(this.active)this.finish();this.mode=mode;this.canvas.style.pointerEvents=mode==='draw'?'auto':'none';document.getElementById('textMode')?.setAttribute('aria-pressed',String(mode==='text'));document.getElementById('penMode')?.setAttribute('aria-pressed',String(mode==='draw'&&!this.erasing));document.getElementById('eraser')?.setAttribute('aria-pressed',String(mode==='draw'&&this.erasing));}
  point(e){const r=this.canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*this.canvas.width/r.width,y:(e.clientY-r.top)*this.canvas.height/r.height};}
  paint(stroke){const c=this.ctx;c.save();c.globalCompositeOperation=stroke.erase?'destination-out':'source-over';c.strokeStyle=c.fillStyle=stroke.color;c.lineWidth=stroke.erase?Math.max(48,stroke.size*5):stroke.size;c.lineCap=stroke.brush==='flat'?'butt':'round';c.lineJoin='round';if(!stroke.erase&&stroke.brush==='ink')c.lineWidth*=.4;if(!stroke.erase&&stroke.brush==='flat')c.lineWidth*=1.5;const p=stroke.points;
    if(p.length===1){c.beginPath();c.arc(p[0].x,p[0].y,c.lineWidth/2,0,Math.PI*2);c.fill();}
    else{c.beginPath();c.moveTo(p[0].x,p[0].y);for(let i=1;i<p.length;i++)c.lineTo(p[i].x,p[i].y);c.stroke();}c.restore();
  }
  finish(){const id=this.pointer;this.pointer=null;this.active=null;if(id!==null&&this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);this.changed();}
  redraw(){this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);this.strokes.forEach(s=>this.paint(s));}
  changed(){const data=this.ctx.getImageData(0,0,this.canvas.width,this.canvas.height).data;this.hasInk=false;for(let i=3;i<data.length;i+=4)if(data[i]){this.hasInk=true;break;}document.getElementById('undoDrawing').disabled=!this.strokes.length;document.getElementById('clearDrawing').disabled=!this.strokes.length;this.onChange();}
  updateTools(){this.colors.forEach(b=>b.setAttribute('aria-pressed',String(!this.erasing&&b.dataset.color===this.color)));document.getElementById('eraser').setAttribute('aria-pressed',String(this.erasing));this.canvas.style.cursor=this.erasing?'none':'crosshair';}
  snapshot(){return this.canvas.toDataURL('image/png');}
  reset(){this.active=null;if(this.pointer!==null&&this.canvas.hasPointerCapture(this.pointer))this.canvas.releasePointerCapture(this.pointer);this.pointer=null;this.strokes=[];this.redraw();this.changed();}
}
