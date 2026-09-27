
"use strict";
const CONFIG_KEY="fitness-ai-supabase-config";
let db=null,user=null,profile=null;
let records={meals:[],activities:[],body:[],workoutSessions:[],workoutExercises:[],photos:[],water:[],sleep:[]};
let selectedFoods = []; // for meal dialog
let currentCategory = "Main";
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const show=id=>{["setupScreen","authScreen","app"].forEach(x=>$("#"+x).classList.toggle("hidden",x!==id))};
const toast=(m,bad=false)=>{const t=$("#toast");t.textContent=m;t.style.background=bad?"#ff7a86":"#c6ff00";t.style.color=bad?"#fff":"#000";t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2600)};
const esc=v=>{const d=document.createElement("div");d.textContent=String(v??"");return d.innerHTML};
const config=()=>{try{return JSON.parse(localStorage.getItem(CONFIG_KEY)||"null")}catch{return null}};
const dayStr=d=>{const dt=new Date(d);return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`};
const todayStr=()=>dayStr(new Date());
const yesterdayStr=()=>{const d=new Date();d.setDate(d.getDate()-1);return dayStr(d)};
const isSameDay=(a,b)=>dayStr(a)===dayStr(b);
const isToday=d=>isSameDay(d,new Date());
const isYesterday=d=>isSameDay(d, new Date(Date.now()-86400000));

function client(c){ db=window.supabase.createClient(c.url,c.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}) }

async function boot(){
  const c=config();
  if(!c){ show("setupScreen"); return }
  try{
    client(c);
    const {data:{session}} = await db.auth.getSession();
    if(session){ user=session.user; await enterApp(); }
    else show("authScreen");
    db.auth.onAuthStateChange((ev,s)=>{ if(ev==="SIGNED_OUT") show("authScreen") });
  }catch(e){ console.error(e); show("setupScreen"); toast("Connection failed",true) }
}

$("#setupForm").addEventListener("submit", async e=>{
  e.preventDefault();
  const url=$("#setupUrl").value.trim().replace(/\/$/,""), key=$("#setupKey").value.trim(), groq=$("#setupGroq")?.value.trim()||"", gemini=$("#setupGemini")?.value.trim()||"";
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)){ toast("Invalid Supabase URL",true); return }
  localStorage.setItem(CONFIG_KEY, JSON.stringify({url,key,groqKey:groq,geminiKey:gemini}));
  location.reload();
});
$("#changeConnection").onclick=()=>{ if(confirm("Change Supabase connection?")){ localStorage.removeItem(CONFIG_KEY); location.reload() } };

$$('[data-auth-tab]').forEach(b=>b.onclick=()=>{
  $$('[data-auth-tab]').forEach(x=>x.classList.toggle("active",x===b));
  $("#loginForm").classList.toggle("active",b.dataset.authTab==="login");
  $("#signupForm").classList.toggle("active",b.dataset.authTab==="signup");
});
$("#loginForm").addEventListener("submit", async e=>{
  e.preventDefault();
  const f=new FormData(e.currentTarget);
  const {data,error}=await db.auth.signInWithPassword({email:f.get("email").trim(),password:f.get("password")});
  if(error) return toast(error.message,true);
  user=data.user; await enterApp();
});
$("#signupForm").addEventListener("submit", async e=>{
  e.preventDefault();
  const f=new FormData(e.currentTarget);
  if(f.get("password")!==f.get("confirm_password")) return toast("Passwords mismatch",true);
  const detail={
    full_name:f.get("full_name").trim(),
    date_of_birth:f.get("date_of_birth"),
    sex_at_birth:f.get("sex_at_birth"),
    height_cm:+f.get("height_cm"),
    current_weight_kg:+f.get("current_weight_kg"),
    target_weight_kg:+f.get("target_weight_kg"),
    primary_goal:f.get("primary_goal"),
    activity_level:f.get("activity_level"),
    target_calories:+f.get("target_calories"),
    target_protein_g:+f.get("target_protein_g"),
  };
  const {data,error}=await db.auth.signUp({email:f.get("email").trim(),password:f.get("password"),options:{data:detail}});
  if(error) return toast(error.message,true);
  if(data.session){ user=data.user; await enterApp(); toast("Account created"); }
  else { toast("Check email to confirm, then sign in"); document.querySelector('[data-auth-tab="login"]').click() }
});
$("#forgotButton").onclick=async()=>{
  const email=prompt("Email:");
  if(!email) return;
  const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:location.href.split("#")[0]});
  toast(error?error.message:"Reset email sent",!!error);
};
$("#logoutButton").onclick=async()=>{ await db.auth.signOut(); user=null; profile=null; show("authScreen") };

async function enterApp(){
  show("app");
  await Promise.all([loadProfile(), loadRecords()]);
  initUI();
  render();
}

async function loadProfile(){
  const {data,error}=await db.from("profiles").select("*").eq("id",user.id).single();
  if(error) throw toast("Profile load failed: "+error.message,true);
  profile=data;
}
async function loadRecords(){
  const tasks=[
    db.from("meal_logs").select("*").order("logged_at",{ascending:false}).limit(200),
    db.from("activity_logs").select("*").order("logged_at",{ascending:false}).limit(100),
    db.from("body_logs").select("*").order("logged_at",{ascending:false}).limit(200),
    db.from("workout_sessions").select("*").order("logged_at",{ascending:false}).limit(50),
    db.from("workout_exercise_logs").select("*").order("created_at",{ascending:false}).limit(500),
    db.from("water_logs").select("*").order("logged_at",{ascending:false}).limit(200),
    db.from("sleep_logs").select("*").order("logged_at",{ascending:false}).limit(100),
    db.from("progress_photos").select("*").order("logged_at",{ascending:false}).limit(100),
  ];
  const res=await Promise.all(tasks);
  records.meals=res[0].data||[];
  records.activities=res[1].data||[];
  records.body=res[2].data||[];
  records.workoutSessions=res[3].data||[];
  records.workoutExercises=res[4].data||[];
  records.water=res[5].data||[];
  records.sleep=res[6].data||[];
  records.photos=res[7].data||[];
}

function initUI(){
  // nav
  $$('[data-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
  $$('[data-view-jump]').forEach(b=>b.onclick=()=>switchView(b.dataset.viewJump));
  $$('[data-open]').forEach(b=>b.onclick=()=>{ const d=$("#"+b.dataset.open); const dt=d.querySelector('[name="logged_at"]'); if(dt) dt.value=new Date().toISOString().slice(0,16); d.showModal() });
  $$('[data-close]').forEach(b=>b.onclick=()=>b.closest("dialog").close());
  $$('dialog').forEach(d=>d.addEventListener('click',e=>{ if(e.target===d) d.close() }));
  // workout template select
  const sel=$("#workoutTemplateSelect");
  sel.innerHTML=Object.keys(WORKOUT_TEMPLATES).map(k=>`<option>${k}</option>`).join("");
  sel.onchange=()=>renderWorkoutEditor();
  $("#saveWorkoutBtn").onclick=saveWorkout;
  $("#genReportBtn").onclick=generateReport;
  // meal tabs
  const cats=Object.keys(FOOD_DB);
  $("#mealCatTabs").innerHTML=cats.map(c=>`<button type="button" class="tab ${c===currentCategory?'active':''}" data-cat="${c}">${c}</button>`).join("");
  $$('#mealCatTabs [data-cat]').forEach(b=>b.onclick=()=>{ currentCategory=b.dataset.cat; $$('#mealCatTabs .tab').forEach(x=>x.classList.toggle('active',x===b)); renderMealOptions() });
  // photo
  $("#photoFileInput").onchange=e=>handlePhotoUpload(e.target.files[0]);
  $("#takePhotoBtn").onclick=()=>$("#hiddenCameraInput").click();
  $("#hiddenCameraInput").onchange=e=>handlePhotoUpload(e.target.files[0]);
  // profile form
  buildProfileForm();
  $("#refreshButton").onclick=async()=>{ await loadRecords(); render(); toast("Refreshed") };
  $("#exportButton").onclick=exportJSON;
  const saveAllKeys=()=>{
    const c=config()||{};
    const groq=$("#groqKeyInput")?.value.trim()||"";
    const gemini=$("#geminiKeyInput")?.value.trim()||"";
    if(gemini && !gemini.startsWith("AIza")){
      toast("Gemini key must start with AIza... Get correct key at aistudio.google.com/app/apikey", true);
      $("#keyStatus").textContent="❌ Gemini key wrong format. Should start with AIza..., not AQ.";
      return;
    }
    c.groqKey=groq; c.geminiKey=gemini;
    localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
    toast("Keys saved: "+(groq?"Groq ":"")+(gemini?"Gemini":""));
    $("#keyStatus").textContent="✅ Saved: "+(groq?"Groq ✔ ":"")+(gemini?"Gemini ✔":"")+" - Try Test Photo AI";
    updateAIMode();
  };
  if($("#saveKeysBtn")) $("#saveKeysBtn").onclick=saveAllKeys;
  if($("#saveGroqBtn")) $("#saveGroqBtn").onclick=saveAllKeys;
  if($("#groqKeyInput")) $("#groqKeyInput").value=config()?.groqKey||"";
  if($("#geminiKeyInput")) $("#geminiKeyInput").value=config()?.geminiKey||"";
  if($("#testAIButton")) $("#testAIButton").onclick=async()=>{
    const c=config()||{};
    if(!c.geminiKey && !c.groqKey){ toast("Add a key first", true); return; }
    $("#keyStatus").textContent="Testing...";
    try{
      const fakeFile = new Blob(["test"],{type:"image/jpeg"});
      // Just test key validity via simple prompt, not photo
      if(c.geminiKey){
        const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${c.geminiKey}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:"Say ok"}]}]})});
        const data=await res.json();
        if(data.error) throw new Error(data.error.message);
        $("#keyStatus").textContent="✅ Gemini key works!";
        toast("Gemini works!");
      } else {
        const res=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{"Authorization":"Bearer "+c.groqKey,"Content-Type":"application/json"},body:JSON.stringify({model:"llama-3.1-8b-instant",messages:[{role:"user",content:"Say ok"}],max_tokens:10})});
        const data=await res.json();
        if(data.error) throw new Error(data.error.message);
        $("#keyStatus").textContent="✅ Groq key works! But Groq vision deprecated, use Gemini for photos.";
        toast("Groq works but use Gemini for photos");
      }
    }catch(e){ $("#keyStatus").textContent="❌ Key error: "+e.message; toast(e.message, true); }
  };
  updateAIMode();
}

function switchView(id){
  $$('[data-view]').forEach(x=>x.classList.toggle("active",x.dataset.view===id));
  $$('.view').forEach(v=>v.classList.toggle("active",v.id===id));
  window.scrollTo(0,0);
  if(id==="historyView") renderHistory();
  if(id==="photosView") renderPhotos();
  if(id==="reportView") renderLast7();
}


function updateAIMode(){
  const c=config()||{}; const hasGroq=!!c.groqKey; const hasGemini=!!c.geminiKey;
  const pill=$("#aiModePill"); if(!pill) return;
  pill.textContent=hasGroq&&hasGemini?"Groq+Gemini":hasGemini?"Gemini":hasGroq?"Groq LLM":"Free AI";
}

function getLast7Data(){
  const now=new Date(); const last7=[];
  for(let i=0;i<7;i++){ const d=new Date(now); d.setDate(now.getDate()-i); last7.push(dayStr(d)); }
  const last14=[]; for(let i=0;i<14;i++){ const d=new Date(now); d.setDate(now.getDate()-i); last14.push(dayStr(d)); }
  const meals=records.meals.filter(m=>last7.includes(dayStr(m.logged_at)));
  const activities=records.activities.filter(a=>last7.includes(dayStr(a.logged_at)));
  const sessions=records.workoutSessions.filter(s=>last7.includes(dayStr(s.logged_at)));
  const body=records.body.filter(b=>last7.includes(dayStr(b.logged_at))).sort((a,b)=>new Date(b.logged_at)-new Date(a.logged_at));
  const body14=records.body.filter(b=>last14.includes(dayStr(b.logged_at))).sort((a,b)=>new Date(a.logged_at)-new Date(b.logged_at));
  const water=records.water.filter(w=>last7.includes(dayStr(w.logged_at))).reduce((s,x)=>s+x.amount_ml,0);
  const totalCal=meals.reduce((s,x)=>s+x.calories,0);
  const totalPro=meals.reduce((s,x)=>s+Number(x.protein_g),0);
  // daily aggregates for chart
  const dailyCal={}; const dailyPro={}; const dailyWeight={};
  last7.slice().reverse().forEach(d=>{ dailyCal[d]=0; dailyPro[d]=0; });
  meals.forEach(m=>{ const d=dayStr(m.logged_at); if(dailyCal[d]!==undefined){ dailyCal[d]+=m.calories; dailyPro[d]+=Number(m.protein_g||0); } });
  body.forEach(b=>{ const d=dayStr(b.logged_at); dailyWeight[d]=b.weight_kg; });
  const weightChange=body.length>=2? (body[0].weight_kg - body[body.length-1].weight_kg) : 0;
  return {meals, activities, sessions, bodyLogs:body, body14, water, totalCal, totalPro, weightChange, workoutCount:sessions.length, dailyCal, dailyPro, dailyWeight, last7Dates:last7.slice().reverse()};
}

function drawWeightChart(canvasId, weights, labels, targetWeight){
  const canvas=document.getElementById(canvasId); if(!canvas || !weights.length) return;
  const ctx=canvas.getContext("2d");
  const dpr=window.devicePixelRatio||1;
  const rect=canvas.getBoundingClientRect();
  canvas.width=rect.width*dpr; canvas.height=200*dpr;
  ctx.scale(dpr,dpr);
  const W=rect.width, H=200;
  ctx.clearRect(0,0,W,H);
  const pad=30;
  const min=Math.min(...weights, targetWeight||999)-1;
  const max=Math.max(...weights, targetWeight||0)+1;
  const range=Math.max(max-min,2);
  // grid
  ctx.strokeStyle="#1e324a"; ctx.setLineDash([4,6]); ctx.lineWidth=1;
  for(let i=0;i<4;i++){ const y=pad + (H-pad*2)*(i/3); ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(W-pad,y); ctx.stroke(); }
  ctx.setLineDash([]);
  // target line
  if(targetWeight){
    const yT=H - pad - ((targetWeight-min)/range)*(H-pad*2);
    ctx.strokeStyle="#5de8b6"; ctx.setLineDash([6,6]); ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(pad,yT); ctx.lineTo(W-pad,yT); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle="#5de8b6"; ctx.font="10px Inter"; ctx.fillText(targetWeight+"kg target", W-90, yT-6);
  }
  // weight line
  ctx.strokeStyle="#d4ff32"; ctx.lineWidth=2.5; ctx.beginPath();
  weights.forEach((wt,i)=>{
    const x=pad + (i/(weights.length-1||1))*(W-pad*2);
    const y=H - pad - ((wt-min)/range)*(H-pad*2);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();
  // dots + projection dashed to target
  ctx.fillStyle="#d4ff32";
  weights.forEach((wt,i)=>{
    const x=pad + (i/(weights.length-1||1))*(W-pad*2);
    const y=H - pad - ((wt-min)/range)*(H-pad*2);
    ctx.beginPath(); ctx.arc(x,y, i===weights.length-1?5:3.5,0,Math.PI*2); ctx.fill();
    if(i===weights.length-1){ ctx.strokeStyle="#d4ff32"; ctx.fillStyle="#09131f"; ctx.lineWidth=2; ctx.stroke(); ctx.fillStyle="#d4ff32"; }
  });
  // projection to target if declining
  if(targetWeight && weights.length>=2 && weights[weights.length-1] > targetWeight){
    const lastW=weights[weights.length-1];
    const firstW=weights[0];
    const rate=(lastW-firstW)/(weights.length-1);
    if(rate<0){
      const lastX=pad + (W-pad*2);
      const lastY=H - pad - ((lastW-min)/range)*(H-pad*2);
      const targetY=H - pad - ((targetWeight-min)/range)*(H-pad*2);
      const targetX=W-pad+20;
      ctx.strokeStyle="#d4ff32"; ctx.setLineDash([6,6]); ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(lastX,lastY); ctx.lineTo(targetX,targetY+60); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  // x labels
  ctx.fillStyle="#6b819a"; ctx.font="10px Inter";
  labels.forEach((lb,i)=>{
    if(i%Math.ceil(labels.length/4)===0 || i===labels.length-1){
      const x=pad + (i/(weights.length-1||1))*(W-pad*2);
      ctx.fillText(lb, x-10, H-4);
    }
  });
}

function drawCalBar(canvasId, dailyCal, targetCal){
  const canvas=document.getElementById(canvasId); if(!canvas) return;
  const ctx=canvas.getContext("2d");
  const dpr=window.devicePixelRatio||1;
  const rect=canvas.getBoundingClientRect();
  canvas.width=rect.width*dpr; canvas.height=160*dpr;
  ctx.scale(dpr,dpr);
  const W=rect.width, H=160;
  ctx.clearRect(0,0,W,H);
  const vals=Object.values(dailyCal);
  if(!vals.length) return;
  const max=Math.max(...vals, targetCal, 500);
  const pad=24; const barW=(W-pad*2)/vals.length - 8;
  Object.entries(dailyCal).forEach(([date,val],i)=>{
    const x=pad + i*((W-pad*2)/vals.length) + 4;
    const h=Math.max(4, (val/max)*(H-40));
    const y=H-24-h;
    ctx.fillStyle= val>=targetCal*0.8 && val<=targetCal*1.2 ? "#5de8b6" : "#294058";
    ctx.beginPath(); ctx.roundRect(x,y,barW,h,6); ctx.fill();
    ctx.fillStyle="#99aabd"; ctx.font="9px Inter"; ctx.fillText(date.slice(5), x, H-6);
  });
  // target line
  if(targetCal){
    const yT=H-24 - (targetCal/max)*(H-40);
    ctx.strokeStyle="#5de8b6"; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.moveTo(pad,yT); ctx.lineTo(W-pad,yT); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle="#5de8b6"; ctx.font="9px Inter"; ctx.fillText("target "+targetCal, W-70, yT-4);
  }
}

function renderLast7(){
  const d=getLast7Data();
  const el=$("#last7Summary");
  if(!el) return;
  el.innerHTML=`
    <div class="row"><div>Meals logged</div><span>${d.meals.length} items</span></div>
    <div class="row"><div>Avg kcal</div><span>${d.meals.length?Math.round(d.totalCal/7):0} kcal</span></div>
    <div class="row"><div>Avg protein</div><span>${d.meals.length?Math.round(d.totalPro/7):0} g</span></div>
    <div class="row"><div>Workouts</div><span>${d.workoutCount} sessions</span></div>
    <div class="row"><div>Weight change</div><span>${d.weightChange.toFixed(1)} kg</span></div>
  `;
  // draw report graphs if canvas exist
  if(document.getElementById("reportWeightChart")){
    const weights=d.last7Dates.map(date=>d.dailyWeight[date]||null).filter(v=>v!==null);
    const labels=d.last7Dates.filter(date=>d.dailyWeight[date]).map(date=>date.slice(5));
    // fallback to body logs sorted
    let wts=weights;
    let lbs=labels;
    if(wts.length<2){
      const sorted=[...records.body].sort((a,b)=>new Date(a.logged_at)-new Date(b.logged_at)).slice(-7);
      wts=sorted.map(b=>b.weight_kg);
      lbs=sorted.map(b=>dayStr(b.logged_at).slice(5));
    }
    if(wts.length) drawWeightChart("reportWeightChart", wts, lbs, profile.target_weight_kg);
  }
  if(document.getElementById("reportCalChart")){
    drawCalBar("reportCalChart", d.dailyCal, profile.target_calories);
  }
}

async function generateReport(){
  const btn=$("#genReportBtn"); if(btn){ btn.disabled=true; btn.textContent="Generating..."; }
  try{
    const last7=getLast7Data();
    const reportText=await AI.generateWeeklyReport(profile, last7);
    const el=$("#weeklyReport"); if(el) el.innerHTML=`<div class="ai-text">${esc(reportText)}</div>`;
    renderLast7();
  }catch(e){ toast(e.message,true) } finally{ if(btn){ btn.disabled=false; btn.textContent="Generate This Week's Report" } }
}

// HISTORY with fixed graph like screenshot
function renderHistory(){
  if(!records.body.length) return;
  const sorted=[...records.body].sort((a,b)=>new Date(a.logged_at)-new Date(b.logged_at));
  const weights=sorted.map(b=>b.weight_kg);
  const labels=sorted.map(b=>dayStr(b.logged_at).slice(5));
  drawWeightChart("weightChart", weights, labels, profile.target_weight_kg);

  const first=sorted[0]?.weight_kg||0;
  const last=sorted[sorted.length-1]?.weight_kg||0;
  if($("#hStart")) $("#hStart").textContent=(first||"--")+" kg";
  if($("#hNow")) $("#hNow").textContent=(last||"--")+" kg";
  const days=(new Date(sorted[sorted.length-1].logged_at)-new Date(sorted[0].logged_at))/86400000||1;
  const rate=((last - first)/ (days/7)).toFixed(2);
  if($("#hRate")) $("#hRate").textContent=rate+" kg/wk";

  const cur=last;
  const avgLoss=parseFloat(rate);
  const target=profile.target_weight_kg||83;
  const remaining=cur-target;
  const daysToGoal= avgLoss<0 ? Math.ceil(remaining / Math.abs(avgLoss) *7) : 0;
  if($("#projection")){
    const next1=(cur+avgLoss).toFixed(1);
    const next2=(cur+avgLoss*2).toFixed(1);
    const wedding=(cur+avgLoss*10).toFixed(1); // placeholder like screenshot
    $("#projection").innerHTML=`
      <div class="proj-card"><span>NEXT WEEK</span><strong>${next1}</strong><small>kg</small></div>
      <div class="proj-card"><span>IN 2 WEEKS</span><strong>${next2}</strong><small>kg</small></div>
      <div class="proj-card highlight"><span>WEDDING</span><strong>${wedding}</strong><small>kg</small></div>
    `;
    const sub=document.createElement("div");
    sub.className="muted"; sub.style="margin-top:10px;font-size:12px";
    sub.textContent=`On track to hit ${target}kg goal · ${daysToGoal>0?daysToGoal+"d to go":""}`;
    $("#projection").parentElement.appendChild(sub);
  }
  // last 14 grid
  const last14Map={}; sorted.forEach(b=>{ last14Map[dayStr(b.logged_at)]=b.weight_kg; });
  const now=new Date();
  const days14=[];
  for(let i=13;i>=0;i--){ const d=new Date(now); d.setDate(now.getDate()-i); days14.push(d); }
  if($("#last14")){
    $("#last14").innerHTML=days14.map(d=>{
      const ds=dayStr(d);
      const w=last14Map[ds];
      const dayName=d.toLocaleDateString('en',{weekday:'short'});
      const dayNum=d.getDate();
      return `<div class="${w?'has':''}"><span>${dayName}</span><span>${dayNum}</span><strong>${w? w.toFixed(2) : "—"}</strong></div>`;
    }).join("");
  }

  if($("#allLogs")){
    $("#allLogs").innerHTML=[...records.meals, ...records.workoutSessions, ...records.body].sort((a,b)=>new Date(b.logged_at)-new Date(a.logged_at)).slice(0,30).map(x=>{
      const name=x.meal_name||x.session_name||`Weight ${x.weight_kg}kg`;
      return `<div class="row"><div><strong>${esc(name)}</strong><small>${new Date(x.logged_at).toLocaleString()}</small></div><span>${x.calories?x.calories+' kcal':''}</span></div>`;
    }).join("") || '<div class="empty">No logs</div>';
  }
}

function buildProfileForm(){
  const f=$("#profileForm");
  if(!profile) return;
  f.innerHTML=`
    <label>Full name<input name="full_name" value="${esc(profile.full_name)}" required></label>
    <label>Date of birth<input name="date_of_birth" type="date" value="${profile.date_of_birth}" required></label>
    <label>Height cm<input name="height_cm" type="number" step="0.1" value="${profile.height_cm}" required></label>
    <label>Target weight<input name="target_weight_kg" type="number" step="0.1" value="${profile.target_weight_kg}" required></label>
    <label>Calories target<input name="target_calories" type="number" value="${profile.target_calories}" required></label>
    <label>Protein target<input name="target_protein_g" type="number" value="${profile.target_protein_g}" required></label>
    <label class="full">Allergies<input name="allergies" value="${esc(profile.allergies||'')}"></label>
    <button class="btn primary full" type="submit">Save profile</button>
  `;
  f.onsubmit=async e=>{
    e.preventDefault();
    const fd=new FormData(f);
    const row={full_name:fd.get("full_name"), date_of_birth:fd.get("date_of_birth"), height_cm:+fd.get("height_cm"), target_weight_kg:+fd.get("target_weight_kg"), target_calories:+fd.get("target_calories"), target_protein_g:+fd.get("target_protein_g"), allergies:fd.get("allergies")};
    const {data,error}=await db.from("profiles").update(row).eq("id",user.id).select().single();
    if(error) return toast(error.message,true);
    profile=data; toast("Profile updated"); render();
  };
}

function exportJSON(){
  const blob=new Blob([JSON.stringify({profile, records},null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`fitness-export-${todayStr()}.json`; a.click();
}
$("#deleteAccountData").onclick=async()=>{
  if(!confirm("Delete all health records? Profile stays.")) return;
  for(const t of ["meal_logs","activity_logs","body_logs","workout_sessions","water_logs","sleep_logs"]){
    await db.from(t).delete().eq("user_id",user.id);
  }
  await loadRecords(); render(); toast("Deleted");
};

boot();
