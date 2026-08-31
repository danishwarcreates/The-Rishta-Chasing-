(() => {
"use strict";
const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");
const $=id=>document.getElementById(id);
const ui={orientation:$("orientation"),home:$("home"),settings:$("settings"),achievements:$("achievements"),pause:$("pause"),gameover:$("gameover"),hud:$("hud"),jump:$("jumpBtn"),dialogue:$("dialogue"),toast:$("toast")};

let W=0,H=0,dpr=1,last=0,raf=0,running=false,paused=false,gameTime=0,distance=0,score=0,coins=0,speed=360,lives=3;
let groundY=0,player,obstacles=[],tokens=[],particles=[],rishta=null,nextObstacle=1.8,nextRishta=170,dialogueTimer=0,dialogueKind="";
let dayCycle=0,shake=0,runStarted=false,nearMissCooldown=0;
let musicOn=localStorage.getItem("raw_music")!=="0",soundOn=localStorage.getItem("raw_sound")!=="0";
let best=Number(localStorage.getItem("raw_best")||0);
const achKey="raw_achievements";
let achievements=JSON.parse(localStorage.getItem(achKey)||"{}");

const maleLines=["Apni pasand to bataiye 😉","Hey girl with the beautiful smile ❤️","My lovely rebellious girl 😏","Cuteness overloaded 🥰","Kaha bhaag rahi hain aap? 😂","Movie date par chalengi? 🎬","I'm yours, you're mine ❤️","Mujhse shaadi karengi? 💍","Itna bhi kya bhaagna? 😏","Aaj toh pakad lunga aapko. 😉","Coffee pe chalengi? ☕","Aap se milna zaroori tha 😄","Ek minute, baat toh suniye!","Aap itna kyun bhaagti hain? 😂"];
const femaleLines=["दिमाग मत खाओ","बोली ना I'm not interested in you","परेशान मत करो","Irritate मत करो","last warning block कर दूंगी","Don't message","stay away","stay away बोली समझ नहीं आता","दूर रहो मुझसे","not interested","मैं अपनी पसंद क्यों बताऊं","कौन हो तुम","मुझे परेशान मत करो","बस करो अब","मेरा पीछा मत करो","Flirt मत करो","कितनी बार बोलूं?","समझ क्यों नहीं आता?","मुझे अकेला छोड़ो","बस, बहुत हो गया","मेरे पीछे मत आओ","मैंने मना किया ना","Seriously? फिर से?","मुझे कोई interest नहीं है","अपनी ये lines किसी और को सुनाओ"];
const envs=["LABORATORY","LAB CORRIDOR","CITY","PARK","NIGHT CITY"];

function resize(){
  dpr=Math.min(devicePixelRatio||1,2); W=innerWidth; H=innerHeight;
  canvas.width=Math.floor(W*dpr); canvas.height=Math.floor(H*dpr); ctx.setTransform(dpr,0,0,dpr,0,0);
  groundY=H*.78;
  if(player) player.y=Math.min(player.y,groundY-player.h);
}
addEventListener("resize",resize); addEventListener("orientationchange",()=>setTimeout(resize,120)); resize();

function landscape(){return innerWidth>=innerHeight;}
function show(el){el.classList.remove("hidden")} function hide(el){el.classList.add("hidden")}
function setScreen(name){
  [ui.orientation,ui.home,ui.settings,ui.achievements,ui.pause,ui.gameover].forEach(hide);
  if(name==="orientation")show(ui.orientation); if(name==="home")show(ui.home);
  if(name==="settings")show(ui.settings); if(name==="ach")show(ui.achievements);
  if(name==="pause")show(ui.pause); if(name==="gameover")show(ui.gameover);
}
function updateOrientation(){
  if(!landscape() && running){paused=true; setScreen("orientation");}
}
function updateBestText(){$("bestText").textContent=`Best score: ${String(best).padStart(6,"0")}`;}
function save(){localStorage.setItem("raw_best",String(best));localStorage.setItem(achKey,JSON.stringify(achievements));}
function unlock(id,label){
  if(!achievements[id]){achievements[id]=Date.now();save();toast(`Achievement unlocked: ${label} 🏆`);}
}
function toast(t){ui.toast.textContent=t;ui.toast.classList.add("show");setTimeout(()=>ui.toast.classList.remove("show"),1700)}

function start(){
  if(!landscape()){setScreen("orientation");return;}
  hide(ui.home);hide(ui.gameover);hide(ui.pause);hide(ui.settings);hide(ui.achievements);show(ui.hud);show(ui.jump);
  running=true;paused=false;runStarted=true;gameTime=0;distance=0;score=0;coins=0;lives=3;speed=330;dayCycle=0;
  obstacles=[];tokens=[];particles=[];rishta=null;nextObstacle=1.5;nextRishta=170;dialogueTimer=0;
  player={x:W*.18,y:groundY-72,w:42,h:72,vy:0,onGround:true,coyote:.12,anim:0,pose:"run",blink:0};
  updateHud(); last=performance.now(); cancelAnimationFrame(raf); raf=requestAnimationFrame(loop);
  beep(660,.07,"triangle"); musicTick();
}
function restart(){start();}
function home(){running=false;paused=false;hide(ui.hud);hide(ui.jump);setScreen("home");updateBestText();}
function pause(){if(!running)return;paused=true;setScreen("pause");}
function resume(){if(!running)return;if(!landscape()){setScreen("orientation");return;}paused=false;hide(ui.pause);show(ui.hud);show(ui.jump);last=performance.now();raf=requestAnimationFrame(loop);}
function jump(){
  if(!running||paused)return;
  if(player.onGround||player.coyote>0){player.vy=-850;player.onGround=false;player.coyote=0;player.pose="jump";beep(520,.09,"square");}
}
addEventListener("keydown",e=>{if(["Space","ArrowUp","KeyW"].includes(e.code)){e.preventDefault();jump()} if(e.code==="Escape"&&running){paused?resume():pause()}});
$("jumpBtn").addEventListener("pointerdown",e=>{e.preventDefault();jump()});
canvas.addEventListener("pointerdown",e=>{if(running&&!paused)jump()});

function beep(freq,dur,type="sine"){
  if(!soundOn)return;
  try{const A=new (AudioContext||webkitAudioContext)(),o=A.createOscillator(),g=A.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.045,A.currentTime);g.gain.exponentialRampToValueAtTime(.001,A.currentTime+dur);o.connect(g);g.connect(A.destination);o.start();o.stop(A.currentTime+dur);setTimeout(()=>A.close(),dur*1000+40)}catch{}
}
let musicTimer=null;
function musicTick(){
  if(!running||paused||!musicOn)return;
  beep(220+(Math.floor(gameTime*2)%4)*55,.07,"sine");
  clearTimeout(musicTimer);musicTimer=setTimeout(musicTick,Math.max(650,1050-(speed-330)*.65));
}
function speakCue(){beep(280,.08,"sawtooth");setTimeout(()=>beep(190,.08,"sawtooth"),90)}

function envIndex(){return Math.min(4,Math.floor(distance/1600));}
function drawSky(){
  const t=(Math.sin(dayCycle*Math.PI*2-Math.PI/2)+1)/2;
  const night=envIndex()===4?Math.max(.72,1-t):1-t;
  const top=`hsl(${330-210*night} ${65-25*night}% ${88-68*night}%)`, bot=`hsl(${35-220*night} ${62-20*night}% ${79-56*night}%)`;
  const g=ctx.createLinearGradient(0,0,0,groundY);g.addColorStop(0,top);g.addColorStop(1,bot);ctx.fillStyle=g;ctx.fillRect(0,0,W,groundY);
  // sun/moon
  const a=dayCycle*Math.PI*2-Math.PI/2;const sx=W*.78+Math.cos(a)*W*.28, sy=groundY*.34+Math.sin(a)*groundY*.25;
  ctx.globalAlpha=.8;ctx.fillStyle=night>.5?"#fff2b8":"#fff5bf";ctx.beginPath();ctx.arc(sx,sy,Math.min(W,H)*.045,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
}
function drawBackground(dt){
  const e=envIndex();const par=distance*.12;
  ctx.fillStyle=e>=3?"rgba(80,75,115,.48)":"rgba(125,128,158,.35)";
  for(let i=-1;i<18;i++){
    const x=i*100-(par%100), h=35+(i*37%95+95)%95;
    ctx.fillRect(x,groundY-55-h,74,h);
    if(e>=2){ctx.fillStyle="rgba(255,240,170,.5)";for(let yy=groundY-48-h+12;yy<groundY-60;yy+=18)ctx.fillRect(x+12,yy,7,7);}
    ctx.fillStyle=e>=3?"rgba(80,75,115,.48)":"rgba(125,128,158,.35)";
  }
  // lab silhouettes/signage
  if(e<2){ctx.fillStyle="rgba(255,255,255,.52)";for(let i=0;i<6;i++){let x=i*220-(par*1.7%220);ctx.fillRect(x,groundY-135,180,75);ctx.fillStyle="rgba(215,126,162,.35)";ctx.fillRect(x+20,groundY-112,65,8);ctx.fillStyle="rgba(255,255,255,.52)"}}
  if(e===3){ctx.fillStyle="rgba(60,110,68,.5)";for(let i=0;i<12;i++){let x=i*130-(par*1.3%130);ctx.beginPath();ctx.arc(x+50,groundY-95,45,0,Math.PI*2);ctx.fill();}}
}
function drawGround(){
  ctx.fillStyle=envIndex()>=2?"#3b3d48":"#b9a17e";ctx.fillRect(0,groundY,W,H-groundY);
  ctx.fillStyle=envIndex()>=2?"#575b67":"#d9c49d";ctx.fillRect(0,groundY,W,7);
  const off=(distance*1.5)%70;ctx.fillStyle=envIndex()>=2?"rgba(255,255,255,.16)":"rgba(75,60,45,.16)";
  for(let x=-70-off;x<W+70;x+=70){ctx.fillRect(x,groundY+34,38,5);}
}
function roundRect(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}

function drawPlayer(){
  const p=player,x=p.x,y=p.y;ctx.save();ctx.translate(x,y);
  // hair behind
  ctx.fillStyle="#352335";ctx.beginPath();ctx.ellipse(20,18,18,27,0,0,Math.PI*2);ctx.fill();ctx.fillRect(3,15,13,37);
  // legs
  const swing=Math.sin(p.anim*12)*8;ctx.strokeStyle="#3b3444";ctx.lineWidth=8;ctx.lineCap="round";
  ctx.beginPath();ctx.moveTo(18,58);ctx.lineTo(13+swing,70);ctx.stroke();ctx.beginPath();ctx.moveTo(27,58);ctx.lineTo(33-swing,70);ctx.stroke();
  // shoes
  ctx.strokeStyle="#f7f7fa";ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(10+swing,70);ctx.lineTo(1+swing,70);ctx.stroke();ctx.beginPath();ctx.moveTo(32-swing,70);ctx.lineTo(42-swing,70);ctx.stroke();
  // coat
  roundRect(8,20,28,40,8,"#fffdfd");ctx.fillStyle="#f28bab";ctx.fillRect(10,34,24,20);
  // badge
  roundRect(28,31,7,9,2,"#8bc6e9");
  // arm
  ctx.strokeStyle="#fffdfd";ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(10,31);ctx.lineTo(1-swing*.3,45);ctx.stroke();
  ctx.beginPath();ctx.moveTo(34,31);ctx.lineTo(40+swing*.3,44);ctx.stroke();
  // head, side/back-side: tiny profile indication
  ctx.fillStyle="#f3c7a9";ctx.beginPath();ctx.arc(20,12,12,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#352335";ctx.beginPath();ctx.arc(16,8,13,3.2,6.2);ctx.fill();
  ctx.fillRect(6,7,7,18);
  // hair strands
  ctx.strokeStyle="#352335";ctx.lineWidth=3;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(5+i*3,18);ctx.quadraticCurveTo(-2+i*2,30,5+i*3,42);ctx.stroke();}
  ctx.restore();
}
function drawObstacle(o){
  ctx.save();ctx.translate(o.x,o.y);
  if(o.type==="chair"){roundRect(4,20,44,9,3,"#745e61");ctx.fillRect(9,0,7,48);ctx.fillRect(38,0,7,48);ctx.strokeStyle="#745e61";ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(11,29);ctx.lineTo(4,62);ctx.moveTo(41,29);ctx.lineTo(48,62);ctx.stroke();}
  else if(o.type==="barrier"){roundRect(0,25,58,20,4,"#f5b34e");ctx.fillStyle="#fff1d1";for(let i=4;i<55;i+=18)ctx.fillRect(i,25,8,20);ctx.fillStyle="#555";ctx.fillRect(5,45,8,18);ctx.fillRect(45,45,8,18);}
  else if(o.type==="trolley"){roundRect(0,22,65,32,7,"#a8b6bf");ctx.fillStyle="#71818a";ctx.fillRect(7,12,50,10);ctx.fillStyle="#343b43";ctx.beginPath();ctx.arc(14,59,7,0,Math.PI*2);ctx.arc(52,59,7,0,Math.PI*2);ctx.fill();}
  else if(o.type==="rack"){roundRect(5,15,48,45,5,"#e5d7cf");for(let i=0;i<4;i++){ctx.fillStyle=i%2?"#e58b9e":"#7db8dd";ctx.beginPath();ctx.roundRect(10+i*11,23,8,25,4);ctx.fill();}ctx.fillStyle="#9d817a";ctx.fillRect(2,58,55,6);}
  else if(o.type==="bottle"){roundRect(10,20,38,42,7,"#9bd2b5");roundRect(20,5,18,18,4,"#a8c9c1");ctx.fillStyle="rgba(255,255,255,.7)";ctx.fillRect(17,34,24,10);}
  else {roundRect(0,25,58,38,5,"#b87955");ctx.fillStyle="#e8bd91";ctx.fillRect(8,34,42,6);ctx.strokeStyle="#79503e";ctx.strokeRect(0,25,58,38);}
  ctx.restore();
}
function drawRishta(r){
  ctx.save();ctx.translate(r.x,r.y);
  // shadow
  ctx.globalAlpha=.18;ctx.fillStyle="#000";ctx.beginPath();ctx.ellipse(31,72,30,7,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  // legs
  ctx.strokeStyle="#262335";ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(22,58);ctx.lineTo(18,73);ctx.moveTo(39,58);ctx.lineTo(44,73);ctx.stroke();
  // sherwani
  roundRect(10,22,43,40,9,"#caa86b");ctx.fillStyle="#f6ead0";ctx.fillRect(27,25,7,35);ctx.fillStyle="#8d6a42";ctx.beginPath();ctx.arc(30,33,2,0,Math.PI*2);ctx.arc(30,42,2,0,Math.PI*2);ctx.fill();
  // head/turban
  ctx.fillStyle="#d9a77f";ctx.beginPath();ctx.arc(31,13,13,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#c9a15d";ctx.beginPath();ctx.arc(31,7,15,Math.PI,Math.PI*2);ctx.fill();ctx.fillRect(18,7,27,7);
  // arms + garland
  ctx.strokeStyle="#d9a77f";ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(14,31);ctx.lineTo(2,48);ctx.moveTo(49,31);ctx.lineTo(61,48);ctx.stroke();
  ctx.strokeStyle="#ef6e9a";ctx.lineWidth=5;ctx.beginPath();ctx.arc(31,50,19,0,Math.PI);ctx.stroke();
  for(let i=0;i<7;i++){ctx.fillStyle=i%2?"#f4c84b":"#e76e93";ctx.beginPath();ctx.arc(14+i*5.7,51+Math.sin(i)*2,3.5,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}
function drawToken(t){
  ctx.save();ctx.translate(t.x,t.y);ctx.rotate(t.spin);ctx.shadowColor="rgba(255,255,255,.7)";ctx.shadowBlur=10;
  ctx.fillStyle="#7bc4e8";ctx.beginPath();ctx.arc(0,0,12,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  ctx.fillStyle="#fff";ctx.fillRect(-2,-8,4,16);ctx.fillRect(-7,-2,14,4);ctx.restore();
}
function spawnObstacle(x= W+80){
  const types=["rack","box","chair","trolley","barrier","bottle"];
  const type=types[Math.floor(Math.random()*types.length)];
  const sizes={rack:[58,64],box:[58,63],chair:[55,62],trolley:[65,66],barrier:[58,63],bottle:[58,63]};
  const [w,h]=sizes[type];obstacles.push({x,y:groundY-h,w,h,type,passed:false});
}
function spawnTokenLine(x=W+90){
  const count=Math.random()<.35?3:1;for(let i=0;i<count;i++)tokens.push({x:x+i*42,y:groundY-90-Math.random()*40,spin:0});
}
function spawnRishta(){
  const h=74,w=64;rishta={x:W+100,y:groundY-h,w,h,t:0,phase:0,warning:false,line:maleLines[Math.floor(Math.random()*maleLines.length)]};
  showDialogue(rishta.line,3.2);speakCue();rishta.warning=true;
}
function showDialogue(text,sec){
  ui.dialogue.textContent=text;ui.dialogue.classList.add("show");dialogueTimer=sec;
}
function collision(a,b){
  return a.x+8<b.x+b.w-7&&a.x+a.w-8>b.x+7&&a.y+8<b.y+b.h-5&&a.y+a.h-5>b.y+6;
}
function particlesAt(x,y,n=10,kind="star"){
  for(let i=0;i<n;i++)particles.push({x,y,vx:(Math.random()-.5)*220,vy:-Math.random()*260-40,life:.7+Math.random()*.5,kind});
}
function loseLife(kind){
  lives--;shake=.18;beep(110,.15,"sawtooth");particlesAt(player.x+20,player.y+35,14);
  if(kind==="rishta"){show($("collisionMessage"));beep(300,.12,"triangle");setTimeout(()=>beep(520,.18,"triangle"),120);}
  else showDialogue("Oops! 😵",1.2);
  if(lives<=0){endRun(kind==="rishta");}
}
function endRun(rishtaHit=false){
  running=false;paused=false;hide(ui.hud);hide(ui.jump);
  const oldBest=best;best=Math.max(best,Math.floor(score));if(best>oldBest){unlock("best","Speed Demon");}
  if(distance>=500)unlock("first","First Run");
  if(coins>=20)unlock("tokens","Token Collector");
  setScreen("gameover");
  $("finalDistance").textContent=`${Math.floor(distance)}m`;$("finalScore").textContent=String(Math.floor(score)).padStart(6,"0");
  $("newBest").classList.toggle("hidden",best<=oldBest);
  $("collisionMessage").classList.toggle("hidden",!rishtaHit);
  $("gameoverTitle").textContent=rishtaHit?"THE RISHTA GOT YOU 😂":"GAME OVER";
  save();updateBestText();
}
function milestoneCheck(){
  const ms=[500,1000,2000,5000,10000];
  for(const m of ms)if(Math.floor(distance)===m){const bonus=m===500?50:m===1000?100:m===2000?150:m===5000?300:750;coins+=bonus;toast(`${m}m! +${bonus} Lab Coins 🧪`);beep(880,.1);particlesAt(W*.5,groundY*.3,25);if(m>=5000)unlock("marathon","Marathon Runner");}
}
function update(dt){
  gameTime+=dt;distance+=speed*dt/30; // pixels/sec -> roughly 12m/s at 360
  score+=speed*dt*.12;
  speed=Math.min(900,330+distance*.075); // gradual
  dayCycle=(distance/7000)%1;
  player.anim+=dt;player.blink-=dt;player.coyote=Math.max(0,player.coyote-dt);
  player.vy+=2250*dt;player.y+=player.vy*dt;
  if(player.y>=groundY-player.h){if(!player.onGround&&player.vy>100)beep(220,.04,"square");player.y=groundY-player.h;player.vy=0;player.onGround=true;player.pose="run";}else player.onGround=false;
  // fair obstacle schedule
  nextObstacle-=dt;
  if(nextObstacle<=0){
    spawnObstacle();
    if(Math.random()<.72)spawnTokenLine(W+150+Math.random()*90);
    const minGap=Math.max(1.05,1.75-(speed-330)/650);
    nextObstacle=minGap+Math.random()*.9;
  }
  if(distance>=nextRishta && !rishta){
    spawnRishta();nextRishta=distance+300+Math.random()*430;
  }
  for(const o of obstacles)o.x-=speed*dt;
  for(const t of tokens){t.x-=speed*dt;t.spin+=dt*5;}
  if(rishta){rishta.x-=speed*(.72+Math.min(.42,distance/8000))*dt;rishta.t+=dt;if(rishta.x< -100){rishta=null;}}
  for(let i=obstacles.length-1;i>=0;i--){const o=obstacles[i];if(collision(player,o)){obstacles.splice(i,1);loseLife("normal");continue}if(o.x+o.w<player.x&&!o.passed){o.passed=true;score+=25;unlock("dodger","Lab Runner");}}
  for(let i=tokens.length-1;i>=0;i--){const t=tokens[i];if(Math.hypot(t.x-(player.x+20),t.y-(player.y+30))<28){tokens.splice(i,1);coins++;score+=40;particlesAt(t.x,t.y,8);beep(760,.05,"triangle");unlock("tokens","Token Collector");}}
  if(rishta&&collision(player,rishta)){
    rishta=null;loseLife("rishta");
  } else if(rishta&&rishta.x+rishta.w<player.x&&rishta.x+rishta.w>player.x-40){
    score+=100;showDialogue(femaleLines[Math.floor(Math.random()*femaleLines.length)],3.0);beep(920,.08,"triangle");particlesAt(player.x+20,player.y,14);unlock("rishta","Rishta Dodger");
    if(Math.random()<.3)unlock("flirt","Flirt Dodger");
  }
  if(dialogueTimer>0){dialogueTimer-=dt;if(dialogueTimer<=0)ui.dialogue.classList.remove("show")}
  nearMissCooldown-=dt;
  if(shake>0)shake-=dt;
  for(let i=particles.length-1;i>=0;i--){let p=particles[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=500*dt;if(p.life<=0)particles.splice(i,1)}
  milestoneCheck();updateHud();
}
function updateHud(){ $("distanceHud").textContent=String(Math.floor(distance)).padStart(6,"0")+"m";$("coinHud").textContent="🧪 "+coins;$("livesHud").textContent="❤️".repeat(lives)+"🖤".repeat(3-lives);}
function draw(){
  ctx.save();if(shake>0)ctx.translate((Math.random()-.5)*8,(Math.random()-.5)*5);
  drawSky();drawBackground();drawGround();
  for(const t of tokens)drawToken(t);for(const o of obstacles)drawObstacle(o);if(rishta)drawRishta(rishta);if(player)drawPlayer();
  for(const p of particles){ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.kind==="star"?"#fff":"#f28bab";ctx.fillRect(p.x,p.y,4,4)}ctx.globalAlpha=1;
  ctx.restore();
  // environment label
  if(running&&gameTime<3){ctx.fillStyle="rgba(255,255,255,.7)";ctx.font="800 14px system-ui";ctx.fillText(envs[envIndex()],18,H-18)}
}
function loop(now){
  if(!running||paused)return;const dt=Math.min(.033,(now-last)/1000);last=now;update(dt);draw();raf=requestAnimationFrame(loop);
}

function renderAchievements(){
  const defs=[["first","🏃 First Run"],["lab","🧪 Lab Runner"],["tokens","💗 Token Collector"],["rishta","💍 Rishta Dodger"],["flirt","😉 Flirt Dodger"],["best","⚡ Speed Demon"],["marathon","🏆 Marathon Runner"]];
  $("achievementList").innerHTML=defs.map(([id,label])=>`<div class="achievement-row ${achievements[id]?"":"locked"}">${achievements[id]?"🏆":"🔒"} ${label}</div>`).join("");
}
$("orientationContinue").onclick=()=>{if(landscape())setScreen("home");else toast("Please turn the phone sideways ↔️")};
$("startBtn").onclick=start;$("pauseBtn").onclick=pause;$("resumeBtn").onclick=resume;$("restartPauseBtn").onclick=restart;$("homePauseBtn").onclick=home;$("restartBtn").onclick=restart;$("homeBtn").onclick=home;
$("settingsBtn").onclick=()=>setScreen("settings");$("closeSettings").onclick=()=>setScreen("home");
$("musicBtn").onclick=()=>{musicOn=!musicOn;localStorage.setItem("raw_music",musicOn?"1":"0");$("musicBtn").textContent=`🎵 MUSIC: ${musicOn?"ON":"OFF"}`;if(musicOn&&running)musicTick()};
$("soundBtn").onclick=()=>{soundOn=!soundOn;localStorage.setItem("raw_sound",soundOn?"1":"0");$("soundBtn").textContent=`🔊 SOUND: ${soundOn?"ON":"OFF"}`};
$("achBtn").onclick=()=>{renderAchievements();setScreen("ach")};$("closeAchievements").onclick=()=>setScreen("settings");$("bestBtn").onclick=()=>toast(`Best score: ${String(best).padStart(6,"0")}`);
updateBestText();$("musicBtn").textContent=`🎵 MUSIC: ${musicOn?"ON":"OFF"}`;$("soundBtn").textContent=`🔊 SOUND: ${soundOn?"ON":"OFF"}`;
setScreen(landscape()?"home":"orientation");
setInterval(()=>{if(running&&!landscape())updateOrientation()},400);
})();
/* =========================
   PASSWORD PROTECTION
========================= */

// CHANGE ONLY THIS PASSWORD
const SECRET_PASSWORD = "01032000";

const lockScreen = document.getElementById("lockScreen");
const passwordInput = document.getElementById("passwordInput");
const unlockBtn = document.getElementById("unlockBtn");
const passwordError = document.getElementById("passwordError");

function unlockGame() {
  const enteredPassword = passwordInput.value.trim();

  if (enteredPassword === SECRET_PASSWORD) {
    lockScreen.classList.add("hidden");

    // Remember unlock during this browser session
    sessionStorage.setItem("rishtaGameUnlocked", "true");

  } else {
    passwordError.textContent = "Incorrect password 🤭 Try again!";
    passwordInput.value = "";
    passwordInput.focus();
  }
}

unlockBtn.addEventListener("click", unlockGame);

passwordInput.addEventListener("keydown", function(event) {
  if (event.key === "Enter") {
    unlockGame();
  }
});

// Keep unlocked during current session
if (sessionStorage.getItem("rishtaGameUnlocked") === "true") {
  lockScreen.classList.add("hidden");
}
