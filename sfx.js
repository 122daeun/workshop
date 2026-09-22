/* Original synthesized Foley. No downloads: sounds are built locally after a click. */
class SoundEffects {
  constructor(){this.ctx=null;this.muted=false;this.motor=null;this.motorGain=null;this.seed=1729;}
  unlock(){
    try{const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)return;if(!this.ctx)this.ctx=new C();if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});}catch{}
  }
  random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  play(kind){
    if(this.muted||!this.ctx||this.ctx.state!=='running')return;
    const c=this.ctx,t=c.currentTime;
    const noise=(duration,volume,frequency)=>{const buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),a=buffer.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=(this.random()*2-1)*Math.pow(1-i/a.length,2);
      const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=frequency;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume,t+.008);gain.gain.exponentialRampToValueAtTime(.001,t+duration);source.connect(filter).connect(gain).connect(c.destination);source.start(t);source.stop(t+duration);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};};
    const tone=(frequency,duration,volume,delay=0)=>{const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(frequency,t+delay);o.frequency.exponentialRampToValueAtTime(frequency*.72,t+delay+duration);g.gain.setValueAtTime(.001,t+delay);g.gain.linearRampToValueAtTime(volume,t+delay+.006);g.gain.exponentialRampToValueAtTime(.001,t+delay+duration);o.connect(g).connect(c.destination);o.start(t+delay);o.stop(t+delay+duration);o.onended=()=>{o.disconnect();g.disconnect();};};
    if(kind==='step'){noise(.19,.18,900+this.random()*700);tone(95+this.random()*20,.12,.11);}
    if(kind==='pickup'){noise(.07,.06,2500);tone(740,.3,.11);tone(1110,.36,.08,.07);}
    if(kind==='paper')noise(.42,.16,2100);
    if(kind==='cork'){noise(.06,.14,1300);tone(280,.1,.12);}
    if(kind==='door'){noise(.25,.24,500);tone(65,.35,.2);}
  }
  howl(){
    if(this.muted||!this.ctx||this.ctx.state!=='running')return;
    this.stopHowl();
    const c=this.ctx,duration=5.8,buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),data=buffer.getChannelData(0);
    let phase=0;
    for(let i=0;i<data.length;i++){
      const t=i/c.sampleRate;
      const rise=Math.min(1,t/.9),fall=Math.max(0,(t-2.6)/1.8);
      const hz=240+165*Math.sin(rise*Math.PI/2)-130*fall+5*Math.sin(t*28)+2*Math.sin(t*9);
      phase+=2*Math.PI*hz/c.sampleRate;
      const envelope=Math.min(1,t/.5)*Math.pow(Math.max(0,1-t/duration),.6)*Math.min(1,(duration-t)/.6);
      data[i]=envelope*(Math.sin(phase)*.24+Math.sin(phase*.5)*.14+Math.sin(phase*2)*.065+Math.sin(phase*3)*.022+(this.random()*2-1)*.005);
    }
    const source=c.createBufferSource(),gain=c.createGain(),delay=c.createDelay(1),echo=c.createGain();
    source.buffer=buffer;gain.gain.value=1.35;delay.delayTime.value=.32;echo.gain.value=.32;
    source.connect(gain).connect(c.destination);gain.connect(delay).connect(echo).connect(c.destination);
    source.start();this.howlSource=source;
    source.onended=()=>{source.disconnect();if(this.howlSource===source)this.howlSource=null;setTimeout(()=>{gain.disconnect();delay.disconnect();echo.disconnect();},500);};
    this.howlGain=gain;
  }
  stopHowl(){if(this.howlGain)this.howlGain.gain.value=0;if(this.howlSource){try{this.howlSource.stop();}catch{}this.howlSource=null;}}
  engine(active,speed){
    if(!this.ctx||this.ctx.state!=='running')return;const c=this.ctx;
    if(active&&!this.motor){this.motor=c.createOscillator();this.motor.type='triangle';this.motorGain=c.createGain();this.motorGain.gain.value=0;this.motor.connect(this.motorGain).connect(c.destination);this.motor.start();}
    if(this.motor){this.motor.frequency.setTargetAtTime(38+speed*35,c.currentTime,.2);this.motorGain.gain.setTargetAtTime(active&&!this.muted?.055:0,c.currentTime,.15);}
  }
}
