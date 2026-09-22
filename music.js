/* Local soundtrack mixer. Audio stays on this computer; no network requests.
   Audio elements are unlocked together by the first user click, then smoothly
   crossfaded by the game's animation clock. No extra libraries are needed. */
class MusicController {
  constructor(config,onError=()=>{},onChange=()=>{}){
    this.config=config;this.onError=onError;this.onChange=onChange;
    this.clips=new Map();this.current=null;this.unlocked=false;
    this.muted=false;this.paused=false;this.duck=1;this.needsGesture=false;
  }
  unlock(){
    if(this.unlocked){if(this.current&&!this.muted&&!this.paused)this.playClip(this.clips.get(this.current));return;}
    this.unlocked=true;
    for(const [key,src] of Object.entries(this.config.tracks)){
      const audio=new Audio(src);audio.muted=this.muted;audio.preload='auto';audio.volume=0;audio.loop=false;
      const clip={key,audio,level:0,from:0,target:0,elapsed:0,seconds:0,starting:false,failed:false};
      this.clips.set(key,clip);
      audio.addEventListener('ended',()=>{
        clip.level=0;audio.volume=0;
        if(this.current===key&&!this.paused&&!this.muted){this.seekStart(clip);this.playClip(clip);this.ramp(clip,1,this.config.fadeIn);}
      });
      audio.addEventListener('error',()=>{if(!clip.failed){clip.failed=true;this.onError('음악 파일을 재생할 수 없어요. 음소거 상태로도 계속 플레이할 수 있어요.');}});
      // Every play() occurs in the same gesture, at zero volume.
      const p=audio.play();
      if(p&&p.then)p.then(()=>{if(this.current!==key||this.paused||this.muted)audio.pause();}).catch(()=>{if(this.current===key){this.needsGesture=true;this.onChange();}});
    }
  }
  seekStart(clip){
    const apply=()=>{const duration=clip.audio.duration;if(!Number.isFinite(duration)||duration<=0)return;
      const configured=this.config.startAt?.[clip.key];
      clip.audio.currentTime=Math.max(0,Math.min(duration-5,Number.isFinite(configured)?configured:duration*(this.config.startRatio??0)));
    };
    if(Number.isFinite(clip.audio.duration))apply();
    else clip.audio.addEventListener('loadedmetadata',apply,{once:true});
  }
  playClip(clip){
    if(!clip||clip.starting||clip.failed||this.muted||this.paused)return;
    clip.starting=true;
    const p=clip.audio.play();
    if(p&&p.then)p.then(()=>{clip.starting=false;if(this.muted||this.paused){clip.audio.volume=0;clip.audio.pause();}this.needsGesture=false;this.onChange();}).catch(()=>{clip.starting=false;this.needsGesture=true;this.onChange();});
    else clip.starting=false;
  }
  ramp(clip,target,seconds){clip.from=clip.level;clip.target=target;clip.elapsed=0;clip.seconds=Math.max(.01,seconds);}
  setTrack(key){
    if(!this.config.tracks[key])return;
    const changed=this.current!==key;this.current=key;
    if(!this.unlocked)return;
    for(const [id,clip] of this.clips){
      if(id===key){if(changed){this.seekStart(clip);clip.audio.volume=0;clip.level=0;}if(!this.paused&&!this.muted)this.playClip(clip);this.ramp(clip,this.paused||this.muted?0:1,this.config.fadeIn);}
      else this.ramp(clip,0,this.config.fadeOut);
    }
    this.onChange();
  }
  setPaused(value){this.paused=value;for(const [id,clip] of this.clips){if(id===this.current){if(!value&&!this.muted)this.playClip(clip);this.ramp(clip,value||this.muted?0:1,value?this.config.fadeOut:this.config.fadeIn);}else this.ramp(clip,0,this.config.fadeOut);}}
  setDucked(value){this.duck=value;}
  toggle(){
    this.muted=!this.muted;
    this.needsGesture=false;
    if(this.muted){
      for(const clip of this.clips.values()){
        clip.audio.muted=true;clip.audio.volume=0;clip.audio.pause();
        clip.level=0;this.ramp(clip,0,.01);
      }
    }else{
      for(const clip of this.clips.values())clip.audio.muted=false;
      this.unlock();this.setPaused(this.paused);
    }
    this.onChange();
  }
  suspend(){for(const clip of this.clips.values()){clip.audio.pause();clip.audio.volume=0;clip.level=0;} }
  resume(){if(this.current&&!this.paused&&!this.muted){const clip=this.clips.get(this.current);if(clip){this.playClip(clip);this.ramp(clip,1,this.config.fadeIn);}}}
  stop(){this.current=null;for(const clip of this.clips.values())this.ramp(clip,0,this.config.fadeOut);}
  tick(dt){
    for(const [id,clip] of this.clips){
      if(this.muted){clip.audio.muted=true;clip.audio.volume=0;clip.audio.pause();continue;}
      clip.elapsed=Math.min(clip.seconds,clip.elapsed+dt);
      const t=clip.seconds?clip.elapsed/clip.seconds:1,ease=t*t*(3-2*t);
      clip.level=clip.from+(clip.target-clip.from)*ease;
      const a=clip.audio;
      const remaining=Number.isFinite(a.duration)?a.duration-a.currentTime:Infinity;
      const tail=Math.min(1,Math.max(0,remaining/this.config.fadeOut));
      const goal=clip.level*this.config.volume*tail*(id===this.current?this.duck:1);
      // The envelope and a short smoothing step also soften duck / mute changes.
      a.volume=Math.max(0,Math.min(1,a.volume+(goal-a.volume)*Math.min(1,dt*7)));
      if(clip.target===0&&clip.elapsed>=clip.seconds&&a.volume<.001){a.volume=0;a.pause();if(id!==this.current)a.currentTime=0;}
    }
  }
}
