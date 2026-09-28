
"use strict";
const CONFIG_KEY="fitness-ai-supabase-config";
let db=null,user=null,profile=null;
let records={meals:[],activities:[],body:[],workoutSessions:[],workoutExercises:[],photos:[],water:[],sleep:[],steps:[],hr:[]};
let selectedFoods = [];
let currentCategory = "Main";
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const show=id=>{["setupScreen","authScreen","app"].forEach(x=>$("#"+x).classList.toggle("hidden",x!==id))};
const toast=(m,bad=false)=>{const t=$("#toast");t.textContent=m;t.style.background=bad?"#ff7a86":"#c6ff00";t.style.color=bad?"#fff":"#000";t.classList.add("show");setTimeout(()=>t.classList.remove("show"),3000)};
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
  if(!url.includes(".supabase.co") && !url.startsWith("https://")){ toast("Invalid URL",true); return }
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
    target_steps: +f.get("target_steps")||10000,
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
$("#syncButton").onclick=async()=>{ await loadRecords(); render(); toast("Synced") };

async function enterApp(){
  show("app");
  $("#dateLabel").textContent = new Date().toLocaleDateString('en-GB',{weekday:'long', day:'numeric', month:'long'});
  $("#greeting").textContent = `Good ${new Date().getHours()<12?'Morning':new Date().getHours()<18?'Afternoon':'Evening'}, ${profile?.full_name?.split(' ')[0]||'bro'}`;
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
    db.from("meal_logs").select("*").order("logged_at",{ascending:false}).limit(300),
    db.from("activity_logs").select("*").order("logged_at",{ascending:false}).limit(150),
    db.from("body_logs").select("*").order("logged_at",{ascending:false}).limit(300),
    db.from("workout_sessions").select("*").order("logged_at",{ascending:false}).limit(80),
    db.from("workout_exercise_logs").select("*").order("created_at",{ascending:false}).limit(800),
    db.from("water_logs").select("*").order("logged_at",{ascending:false}).limit(200),
    db.from("sleep_logs").select("*").order("logged_at",{ascending:false}).limit(200),
    db.from("progress_photos").select("*").order("logged_at",{ascending:false}).limit(100),
    db.from("steps_logs").select("*").order("logged_at",{ascending:false}).limit(300),
    db.from("heart_rate_logs").select("*").order("logged_at",{ascending:false}).limit(300),
  ];
  const res=await Promise.allSettled(tasks);
  records.meals=res[0].value?.data||[];
  records.activities=res[1].value?.data||[];
  records.body=res[2].value?.data||[];
  records.workoutSessions=res[3].value?.data||[];
  records.workoutExercises=res[4].value?.data||[];
  records.water=res[5].value?.data||[];
  records.sleep=res[6].value?.data||[];
  records.photos=res[7].value?.data||[];
  records.steps=res[8].value?.data||[];
  records.hr=res[9].value?.data||[];
}

function initUI(){
  $$('[data-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
  $$('[data-view-jump]').forEach(b=>b.onclick=()=>switchView(b.dataset.viewJump));
  $$('[data-open]').forEach(b=>b.onclick=()=>{ const d=$("#"+b.dataset.open); const dt=d.querySelector('[name="logged_at"]'); if(dt) dt.value=new Date().toISOString().slice(0,16); d.showModal() });
  $$('[data-close]').forEach(b=>b.onclick=()=>b.closest("dialog").close());
  $$('dialog').forEach(d=>d.addEventListener('click',e=>{ if(e.target===d) d.close() }));
  const sel=$("#workoutTemplateSelect");
  if(sel){ sel.innerHTML=Object.keys(WORKOUT_TEMPLATES).map(k=>`<option>${k}</option>`).join(""); sel.onchange=()=>renderWorkoutEditor(); }
  $("#saveWorkoutBtn").onclick=saveWorkout;
  $("#genReportBtn").onclick=generateReport;
  const cats=Object.keys(FOOD_DB);
  if($("#mealCatTabs")) $("#mealCatTabs").innerHTML=cats.map(c=>`<button type="button" class="tab ${c===currentCategory?'active':''}" data-cat="${c}">${c}</button>`).join("");
  $$('#mealCatTabs [data-cat]').forEach(b=>b.onclick=()=>{ currentCategory=b.dataset.cat; $$('#mealCatTabs .tab').forEach(x=>x.classList.toggle('active',x===b)); renderMealOptions() });
  $("#photoFileInput").onchange=e=>handlePhotoUpload(e.target.files[0]);
  $("#takePhotoBtn").onclick=()=>$("#hiddenCameraInput").click();
  $("#hiddenCameraInput").onchange=e=>handlePhotoUpload(e.target.files[0]);
  $("#foodPhotoInput").onchange=e=>handleFoodPhoto(e.target.files[0]);
  $("#addCustomFood").onclick=()=>{ const n=$("#customFoodName").value.trim(), kc=+$("#customKcal").value, pr=+$("#customPro").value; if(!n||!kc) return toast("Name + kcal needed",true); addSelected({name:n, kcal:kc, protein:pr, carbs:0, fat:0}); };
  $("#customFoodName").onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); $("#addCustomFood").click(); } };
  buildProfileForm();
  $("#refreshButton").onclick=async()=>{ await loadRecords(); render(); toast("Refreshed") };
  $("#exportButton").onclick=exportJSON;
  // Puter hardcoded - no keys needed
  if($("#testAIButton")) $("#testAIButton").onclick=async()=>{
    const out=$("#puterTestOutput");
    if(out){ out.style.display='block'; out.textContent='Testing Puter AI...'; }
    $("#keyStatus").textContent="Testing Puter...";
    try{
      // This is exactly your example
      const response = await puter.ai.chat("Classify the following text as positive, negative, or neutral: 'The product works well but the delivery was late.'", {
        model: 'google/gemini-2.5-flash-lite'
      });
      const text = typeof response === 'string' ? response : response.message?.content || JSON.stringify(response);
      if(out) out.textContent = "✅ Puter Response:\n" + text;
      $("#keyStatus").textContent="✅ Puter AI works! Model: gemini-2.5-flash-lite";
      toast("Puter AI works - hardcoded!");
      // Also test AI module
      const checkin = await AI.testPuter();
      console.log("AI.testPuter", checkin);
    }catch(e){ 
      $("#keyStatus").textContent="❌ "+e.message; 
      if(out) out.textContent = "❌ Error: " + e.message + "\nMake sure https://js.puter.com/v2/ loaded";
      toast(e.message,true); 
    }
  };
  updateAIMode();
  // Forms
  $("#bodyForm").onsubmit=saveBody;
  $("#workoutQuickForm").onsubmit=saveQuickWorkout;
  $("#mealForm").onsubmit=saveMeal;
  $("#sleepForm").onsubmit=saveSleep;
  $("#stepsForm").onsubmit=saveSteps;
  $("#hrForm").onsubmit=saveHR;
}

function switchView(id){
  $$('[data-view]').forEach(x=>x.classList.toggle("active",x.dataset.view===id));
  $$('.view').forEach(v=>v.classList.toggle("active",v.id===id));
  window.scrollTo(0,0);
  if(id==="historyView") renderHistory();
  if(id==="photosView") renderPhotos();
  if(id==="reportView") renderLast7();
  if(id==="activityView") renderActivity();
}

function updateAIMode(){
  const pill=$("#aiModePill"); if(!pill) return;
  const isPuter = typeof puter !== "undefined";
  pill.textContent = isPuter ? "Puter • Gemini 2.5 Flash" : "Local AI";
}

function getLast7Data(){
  const now=new Date(); const last7=[]; for(let i=0;i<7;i++){ const d=new Date(now); d.setDate(now.getDate()-i); last7.push(dayStr(d)); }
  const last14=[]; for(let i=0;i<14;i++){ const d=new Date(now); d.setDate(now.getDate()-i); last14.push(dayStr(d)); }
  const meals=records.meals.filter(m=>last7.includes(dayStr(m.logged_at)));
  const activities=records.activities.filter(a=>last7.includes(dayStr(a.logged_at)));
  const sessions=records.workoutSessions.filter(s=>last7.includes(dayStr(s.logged_at)));
  const body=records.body.filter(b=>last7.includes(dayStr(b.logged_at))).sort((a,b)=>new Date(b.logged_at)-new Date(a.logged_at));
  const body14=records.body.filter(b=>last14.includes(dayStr(b.logged_at))).sort((a,b)=>new Date(a.logged_at)-new Date(b.logged_at));
  const sleep=records.sleep.filter(s=>last7.includes(dayStr(s.logged_at)));
  const steps=records.steps.filter(s=>last7.includes(dayStr(s.logged_at)));
  const hr=records.hr.filter(h=>last7.includes(dayStr(h.logged_at)));
  const totalCal=meals.reduce((s,x)=>s+x.calories,0);
  const totalPro=meals.reduce((s,x)=>s+Number(x.protein_g),0);
  const totalDistance=steps.reduce((s,x)=>s+Number(x.distance_km||0),0)+activities.reduce((s,x)=>s+Number(x.distance_km||0),0);
  const dailyCal={}; const dailyPro={}; const dailyWeight={}; const dailySteps={}; const dailySleep={};
  last7.slice().reverse().forEach(d=>{ dailyCal[d]=0; dailyPro[d]=0; dailySteps[d]=0; dailySleep[d]=0; });
  meals.forEach(m=>{ const d=dayStr(m.logged_at); if(dailyCal[d]!==undefined){ dailyCal[d]+=m.calories; dailyPro[d]+=Number(m.protein_g||0); } });
  body.forEach(b=>{ dailyWeight[dayStr(b.logged_at)]=b.weight_kg; });
  steps.forEach(s=>{ const d=dayStr(s.logged_at); if(dailySteps[d]!==undefined) dailySteps[d]+=s.steps; });
  sleep.forEach(s=>{ const d=dayStr(s.logged_at); if(dailySleep[d]!==undefined) dailySleep[d]+=Number(s.duration_hours); });
  const weightChange=body.length>=2? (body[0].weight_kg - body[body.length-1].weight_kg) : 0;
  const weightTrend = body.length>=3? Health.weeklyTrend(body.map(b=>b.weight_kg).reverse()) : 0;
  const avgRecovery = sleep.length? Math.round(sleep.reduce((acc,s)=>acc + Health.recoveryScore({sleepHours:Number(s.duration_hours), restingHR:profile?.resting_hr, stepsYesterday:steps[0]?.steps||0, workoutCount:sessions.length}),0)/sleep.length) : 50;
  return {meals, activities, sessions, bodyLogs:body, body14, sleep, steps, hr, totalCal, totalPro, totalDistance, weightChange, weightTrend, workoutCount:sessions.length, dailyCal, dailyPro, dailyWeight, dailySteps, dailySleep, last7Dates:last7.slice().reverse(), avgRecovery};
}

function render(){
  const t=getLast7Data();
  const latestWeight = records.body[0]?.weight_kg || profile.starting_weight_kg || 0;
  const startWeight = [...records.body].sort((a,b)=>new Date(a.logged_at)-new Date(b.logged_at))[0]?.weight_kg || profile.starting_weight_kg || latestWeight;
  $("#weightValue").textContent = latestWeight || "--";
  $("#lostValue").textContent = (startWeight - latestWeight).toFixed(1);
  $("#weightSub").textContent = `Start ${startWeight}kg`;
  $("#lostSub").textContent = startWeight>latestWeight? `${(startWeight-latestWeight).toFixed(1)}kg down` : "Keep going";
  const todayCal = records.meals.filter(m=>isToday(m.logged_at)).reduce((s,x)=>s+x.calories,0);
  const todayPro = records.meals.filter(m=>isToday(m.logged_at)).reduce((s,x)=>s+Number(x.protein_g),0);
  $("#calValue").textContent = todayCal;
  $("#calTarget").textContent = `${profile.target_calories} kcal target`;
  $("#proValue").textContent = Math.round(todayPro);
  $("#proTarget").textContent = `${profile.target_protein_g}g target`;
  const todaySteps = records.steps.filter(s=>isToday(s.logged_at)).reduce((s,x)=>s+x.steps,0);
  const todayDist = records.steps.filter(s=>isToday(s.logged_at)).reduce((s,x)=>s+Number(x.distance_km),0);
  $("#stepsValue").textContent = todaySteps.toLocaleString();
  $("#stepsSub").textContent = `${todayDist.toFixed(1)}km • ${profile.target_steps||10000} target`;
  const lastSleep = records.sleep[0];
  $("#sleepValue").textContent = lastSleep? Number(lastSleep.duration_hours).toFixed(1) : "--";
  $("#sleepSub").textContent = lastSleep? `Score ${lastSleep.score||'--'} • Q${lastSleep.quality}/5` : "No data";
  const lastHR = records.hr[0];
  $("#hrValue").textContent = lastHR? lastHR.bpm : "--";
  $("#hrSub").textContent = lastHR? `Rest ${lastHR.resting_bpm||profile.resting_hr||'--'} bpm` : `Rest ${profile.resting_hr||60} bpm`;

  // Recovery
  const recovery = Health.recoveryScore({sleepHours:lastSleep?Number(lastSleep.duration_hours):0, restingHR:profile.resting_hr, avgHR:lastHR?.bpm, stepsYesterday:todaySteps, workoutCount:records.workoutSessions.filter(s=>isToday(s.logged_at)).length});
  const readiness = Health.readiness({sleepHours:lastSleep?Number(lastSleep.duration_hours):0, sleepScore:lastSleep?.score||0, recovery});
  $("#readinessLabel").textContent = `🔋 ${readiness.label} • Recovery ${recovery}%`;
  $("#readinessLabel").style.color = readiness.color;
  $("#recoveryBar").innerHTML = `<div style="width:${recovery}%;background:${readiness.color};height:100%"></div>`;

  renderMealOptions();
  renderTodayLogs();
  renderWorkoutEditor();
  renderTodaySession();

  // AI checkin yesterday
  const yCal = t.dailyCal[yesterdayStr()]||0;
  const yPro = t.dailyPro[yesterdayStr()]||0;
  const ySteps = t.dailySteps[yesterdayStr()]||0;
  const ySleep = records.sleep.find(s=>isYesterday(s.logged_at));
  const yHR = records.hr.find(h=>isYesterday(h.logged_at));
  AI.generateCheckin(profile, {
    calories:yCal, targetCal:profile.target_calories,
    protein:yPro, targetPro:profile.target_protein_g,
    workoutCount: records.workoutSessions.filter(s=>isYesterday(s.logged_at)).length,
    steps:ySteps, distance: records.steps.filter(s=>dayStr(s.logged_at)===yesterdayStr()).reduce((a,b)=>a+Number(b.distance_km),0),
    sleepHours: ySleep?Number(ySleep.duration_hours):0, sleepScore: ySleep?.score||0,
    avgHR: yHR?.bpm||0, recovery, readiness
  }).then(txt=>{ $("#yesterdayCheckin").textContent=txt; });

  drawRings();
}

function renderTodayLogs(){
  const todayItems = [...records.meals.filter(m=>isToday(m.logged_at)), ...records.activities.filter(a=>isToday(a.logged_at)), ...records.steps.filter(s=>isToday(s.logged_at)), ...records.sleep.filter(s=>isToday(s.logged_at)), ...records.hr.filter(h=>isToday(h.logged_at)), ...records.body.filter(b=>isToday(b.logged_at))].sort((a,b)=>new Date(b.logged_at)-new Date(a.logged_at));
  $("#todayLogs").innerHTML = todayItems.slice(0,12).map(x=>{
    const name = x.meal_name || x.activity_name || (x.steps? `${x.steps} steps • ${x.distance_km}km` : null) || (x.duration_hours? `${x.duration_hours}h sleep score ${x.score||''}` : null) || (x.bpm? `${x.bpm} bpm HR` : null) || `Weight ${x.weight_kg}kg`;
    const meta = x.calories? `${x.calories} kcal` : x.duration_minutes? `${x.duration_minutes} min` : x.steps? `${x.source||'Manual'}` : x.source||'';
    return `<div class="row"><div><strong>${esc(name)}</strong><small>${new Date(x.logged_at).toLocaleTimeString()} • ${esc(meta)}</small></div><span>${x.protein_g? x.protein_g+'g P':''}</span></div>`;
  }).join('') || '<div class="empty">No logs today - start with weight or meal!</div>';
}

function renderTodaySession(){
  const tmpl = localStorage.getItem('fitness-today-template') || 'Push Day';
  const ex = WORKOUT_TEMPLATES[tmpl] || [];
  $("#todaySession").innerHTML = `<strong>${esc(tmpl)}</strong> • ${ex.length} exercises<br><small class="muted">${ex.slice(0,3).map(e=>esc(e.name)).join(', ')}${ex.length>3?'...':''}</small>`;
}

function renderMealOptions(){
  const container = $("#mealOptions"); if(!container) return;
  const list = FOOD_DB[currentCategory] || [];
  container.innerHTML = list.map((f,idx)=>{
    const isSel = selectedFoods.find(s=>s.idx===idx && s.cat===currentCategory);
    const kcal = f.kcal || f.sizes?.M.kcal || 0;
    const pro = f.protein || f.sizes?.M.protein || 0;
    return `<div class="food-row ${isSel?'selected':''}" onclick="toggleFood(${idx})">
      <div><strong>${esc(f.name)}</strong><small>${kcal} kcal • ${pro}g P${f.variants?' • S/M/L':''}</small></div>
      ${f.sizes? `<div class="food-size">${Object.keys(f.sizes).map(sz=>`<button class="size-btn ${isSel?.size===sz?'active':''}" onclick="event.stopPropagation(); selectSize(${idx},'${sz}')">${sz}</button>`).join('')}</div>`: `<span>➕</span>`}
    </div>`;
  }).join('');
}

window.toggleFood = (idx)=>{
  const cat=currentCategory;
  const existing = selectedFoods.findIndex(s=>s.idx===idx && s.cat===cat);
  if(existing>=0){ selectedFoods.splice(existing,1); }
  else {
    const f=FOOD_DB[cat][idx];
    const size = f.sizes? 'M' : null;
    const szData = size? f.sizes[size] : f;
    selectedFoods.push({idx, cat, name:f.name, kcal: szData.kcal||szData.kcal, protein: szData.protein||f.protein||0, carbs: szData.carbs||f.carbs||0, fat: szData.fat||f.fat||0, size});
  }
  renderMealOptions(); renderSelected();
};
window.selectSize = (idx,size)=>{
  const cat=currentCategory; const f=FOOD_DB[cat][idx];
  const existing = selectedFoods.find(s=>s.idx===idx && s.cat===cat);
  const szData = f.sizes[size];
  if(existing){ existing.size=size; existing.kcal=szData.kcal; existing.protein=szData.protein; }
  else { selectedFoods.push({idx, cat, name:f.name, kcal:szData.kcal, protein:szData.protein, carbs:szData.carbs||0, fat:szData.fat||0, size}); }
  renderMealOptions(); renderSelected();
};
function addSelected(item){ selectedFoods.push({idx:-1, cat:'Custom', name:item.name, kcal:item.kcal, protein:item.protein, carbs:item.carbs||0, fat:item.fat||0, size:null}); renderSelected(); }

function renderSelected(){
  const cont=$("#mealSelected"); if(!cont) return;
  const totalK = selectedFoods.reduce((s,x)=>s+x.kcal,0);
  const totalP = selectedFoods.reduce((s,x)=>s+Number(x.protein),0);
  $("#mealKcal").textContent = `${totalK}/${profile.target_calories}`;
  $("#mealPro").textContent = `${Math.round(totalP)}g/${profile.target_protein_g}g`;
  $("#logMealBtn").textContent = `Log ${selectedFoods.length} • ${totalK} kcal`;
  cont.innerHTML = selectedFoods.map((s,i)=>`<div class="food-row selected"><div><strong>${esc(s.name)} ${s.size?`(${s.size})`:''}</strong><small>${s.kcal} kcal • ${s.protein}g</small></div><button class="link-btn" onclick="removeSelected(${i})">✕</button></div>`).join('');
}
window.removeSelected = (i)=>{ selectedFoods.splice(i,1); renderMealOptions(); renderSelected(); };

async function saveMeal(e){
  e.preventDefault();
  if(!selectedFoods.length) return toast("Select food first",true);
  const totalK = selectedFoods.reduce((s,x)=>s+x.kcal,0);
  const totalP = selectedFoods.reduce((s,x)=>s+Number(x.protein),0);
  const totalC = selectedFoods.reduce((s,x)=>s+Number(x.carbs||0),0);
  const totalF = selectedFoods.reduce((s,x)=>s+Number(x.fat||0),0);
  const name = selectedFoods.map(s=>s.name + (s.size?` ${s.size}`:'')).join(' + ');
  const {error} = await db.from('meal_logs').insert({user_id:user.id, meal_name:name, meal_type:currentCategory, category:currentCategory, calories:totalK, protein_g:totalP, carbs_g:totalC, fat_g:totalF, source:'Manual', logged_at:new Date().toISOString()});
  if(error) return toast(error.message,true);
  selectedFoods=[]; renderMealOptions(); renderSelected();
  $("#mealDialog").close(); await loadRecords(); render(); toast(`Logged ${totalK} kcal`);
}

async function saveBody(e){
  e.preventDefault();
  const fd=new FormData(e.currentTarget);
  const row={user_id:user.id, weight_kg:parseFloat(fd.get('weight_kg')), body_fat_percent: fd.get('body_fat')? parseFloat(fd.get('body_fat')):null, source:'Manual', logged_at: fd.get('logged_at')? new Date(fd.get('logged_at')).toISOString() : new Date().toISOString()};
  const {error}=await db.from('body_logs').insert(row);
  if(error) return toast(error.message,true);
  $("#bodyDialog").close(); await loadRecords(); render(); toast("Weight logged");
}
async function saveQuickWorkout(e){
  e.preventDefault();
  const fd=new FormData(e.currentTarget);
  const {error}=await db.from('activity_logs').insert({user_id:user.id, activity_name:fd.get('activity_name'), duration_minutes:+fd.get('duration_minutes'), calories_burned:+fd.get('calories_burned')||0, distance_km: parseFloat(fd.get('distance_km'))||0, source:'Manual', logged_at: fd.get('logged_at')? new Date(fd.get('logged_at')).toISOString(): new Date().toISOString()});
  if(error) return toast(error.message,true);
  $("#workoutDialog").close(); await loadRecords(); render(); toast("Workout logged");
}
async function saveSleep(e){
  e.preventDefault();
  const fd=new FormData(e.currentTarget);
  const row={user_id:user.id, duration_hours:parseFloat(fd.get('duration_hours')), quality:+fd.get('quality')||3, deep_minutes:+fd.get('deep_minutes')||0, light_minutes:+fd.get('light_minutes')||0, rem_minutes:+fd.get('rem_minutes')||0, awake_minutes:+fd.get('awake_minutes')||0, score:+fd.get('score')||0, source:'Manual', logged_at: fd.get('logged_at')? new Date(fd.get('logged_at')).toISOString(): new Date().toISOString()};
  const {error}=await db.from('sleep_logs').insert(row);
  if(error) return toast(error.message,true);
  $("#sleepDialog").close(); await loadRecords(); render(); toast("Sleep logged");
}
async function saveSteps(e){
  e.preventDefault();
  const fd=new FormData(e.currentTarget);
  const row={user_id:user.id, steps:+fd.get('steps'), distance_km:parseFloat(fd.get('distance_km'))||0, calories_burned:+fd.get('calories_burned')||0, source:'Manual', logged_at: fd.get('logged_at')? new Date(fd.get('logged_at')).toISOString(): new Date().toISOString()};
  const {error}=await db.from('steps_logs').insert(row);
  if(error) return toast(error.message,true);
  $("#stepsDialog").close(); await loadRecords(); render(); toast("Steps logged");
}
async function saveHR(e){
  e.preventDefault();
  const fd=new FormData(e.currentTarget);
  const row={user_id:user.id, bpm:+fd.get('bpm'), resting_bpm:+fd.get('resting_bpm')||null, avg_bpm:+fd.get('avg_bpm')||+fd.get('bpm'), source:'Manual', logged_at: fd.get('logged_at')? new Date(fd.get('logged_at')).toISOString(): new Date().toISOString()};
  const {error}=await db.from('heart_rate_logs').insert(row);
  if(error) return toast(error.message,true);
  $("#hrDialog").close(); await loadRecords(); render(); toast("HR logged");
}

function renderWorkoutEditor(){
  const sel=$("#workoutTemplateSelect"); if(!sel) return;
  const tmpl=sel.value; localStorage.setItem('fitness-today-template', tmpl);
  const list=WORKOUT_TEMPLATES[tmpl]||[];
  $("#workoutEditor").innerHTML = `<h4>${esc(tmpl)} • ${list.length} exercises</h4>` + list.map((ex,i)=>`<div class="row"><div><strong>${esc(ex.name)}</strong><small>${ex.sets}x${ex.reps} • ${ex.weight}kg</small></div><div class="food-size"><input type="number" placeholder="kg" id="w_${i}" value="${ex.weight}" style="width:70px"></div></div>`).join('') + `<small class="muted">Edit weights then Save Workout - will save as session + exercises</small>`;
}
async function saveWorkout(){
  const sel=$("#workoutTemplateSelect"); const tmpl=sel.value;
  const {data:session, error:se} = await db.from('workout_sessions').insert({user_id:user.id, session_name:tmpl, logged_at:new Date().toISOString()}).select().single();
  if(se) return toast(se.message,true);
  const exs=WORKOUT_TEMPLATES[tmpl].map((ex,i)=>{
    const w=parseFloat($("#w_"+i)?.value)||0;
    return {session_id:session.id, user_id:user.id, exercise_name:ex.name, sets:ex.sets, reps:ex.reps, weight_kg:w};
  });
  const {error}=await db.from('workout_exercise_logs').insert(exs);
  if(error) return toast(error.message,true);
  await loadRecords(); render(); toast("Workout saved");
}

async function handleFoodPhoto(file){
  if(!file) return;
  $("#foodPhotoStatus").textContent="Analyzing...";
  const res = await AI.analyzeFoodPhoto(file);
  if(res.error){ $("#foodPhotoStatus").textContent="❌ "+res.error; return toast(res.error,true); }
  $("#foodPhotoStatus").textContent=`✅ ${res.name} ${res.calories} kcal`;
  addSelected({name:res.name+" (AI Photo)", kcal:res.calories, protein:res.protein_g||0, carbs:res.carbs_g||0, fat:res.fat_g||0});
}

async function handlePhotoUpload(file){
  if(!file) return;
  toast("Uploading photo...");
  const path = `${user.id}/${Date.now()}_${file.name}`;
  const {error} = await db.storage.from('progress-photos').upload(path, file);
  if(error) return toast(error.message,true);
  const {data:{publicUrl}} = db.storage.from('progress-photos').getPublicUrl(path);
  // try signed if private
  let url = publicUrl;
  try{ const {data} = await db.storage.from('progress-photos').createSignedUrl(path, 3600*24*365); if(data?.signedUrl) url=data.signedUrl; }catch{}
  await db.from('progress_photos').insert({user_id:user.id, photo_url:url, photo_type:$("#photoType").value||'Front', logged_at:new Date().toISOString()});
  await loadRecords(); renderPhotos(); toast("Photo saved");
}

function renderPhotos(){
  $("#photoGrid").innerHTML = records.photos.map(p=>`<div><img src="${p.photo_url}" loading="lazy"><small>${esc(p.photo_type)} • ${new Date(p.logged_at).toLocaleDateString()}</small></div>`).join('') || '<div class="empty">No photos yet</div>';
}

// Charts helpers
function drawWeightChart(canvasId, weights, labels, targetWeight){
  const canvas=document.getElementById(canvasId); if(!canvas || !weights.length) return;
  const ctx=canvas.getContext("2d"); const dpr=window.devicePixelRatio||1; const rect=canvas.getBoundingClientRect();
  canvas.width=rect.width*dpr; canvas.height=200*dpr; ctx.scale(dpr,dpr); const W=rect.width, H=200; ctx.clearRect(0,0,W,H);
  const pad=30; const min=Math.min(...weights, targetWeight||999)-1; const max=Math.max(...weights, targetWeight||0)+1; const range=Math.max(max-min,2);
  ctx.strokeStyle="#1e324a"; ctx.setLineDash([4,6]); ctx.lineWidth=1; for(let i=0;i<4;i++){ const y=pad + (H-pad*2)*(i/3); ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(W-pad,y); ctx.stroke(); } ctx.setLineDash([]);
  if(targetWeight){ const yT=H - pad - ((targetWeight-min)/range)*(H-pad*2); ctx.strokeStyle="#5de8b6"; ctx.setLineDash([6,6]); ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(pad,yT); ctx.lineTo(W-pad,yT); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle="#5de8b6"; ctx.font="10px Inter"; ctx.fillText(targetWeight+"kg target", W-90, yT-6); }
  ctx.strokeStyle="#d4ff32"; ctx.lineWidth=2.5; ctx.beginPath(); weights.forEach((wt,i)=>{ const x=pad + (i/(weights.length-1||1))*(W-pad*2); const y=H - pad - ((wt-min)/range)*(H-pad*2); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke();
  ctx.fillStyle="#d4ff32"; weights.forEach((wt,i)=>{ const x=pad + (i/(weights.length-1||1))*(W-pad*2); const y=H - pad - ((wt-min)/range)*(H-pad*2); ctx.beginPath(); ctx.arc(x,y, i===weights.length-1?5:3.5,0,Math.PI*2); ctx.fill(); });
  ctx.fillStyle="#6b819a"; ctx.font="10px Inter"; labels.forEach((lb,i)=>{ if(i%Math.ceil(labels.length/4)===0 || i===labels.length-1){ const x=pad + (i/(weights.length-1||1))*(W-pad*2); ctx.fillText(lb, x-10, H-4); } });
}
function drawBar(canvasId, map, target){
  const canvas=document.getElementById(canvasId); if(!canvas) return;
  const ctx=canvas.getContext("2d"); const dpr=window.devicePixelRatio||1; const rect=canvas.getBoundingClientRect();
  canvas.width=rect.width*dpr; canvas.height=160*dpr; ctx.scale(dpr,dpr); const W=rect.width, H=160; ctx.clearRect(0,0,W,H);
  const entries=Object.entries(map); if(!entries.length) return; const vals=entries.map(e=>e[1]); const max=Math.max(...vals, target||0, 100); const pad=24; const barW=(W-pad*2)/entries.length - 8;
  entries.forEach(([date,val],i)=>{ const x=pad + i*((W-pad*2)/entries.length) + 4; const h=Math.max(4, (val/max)*(H-40)); const y=H-24-h; ctx.fillStyle= target && val>=target*0.8 && val<=target*1.2 ? "#5de8b6" : "#294058"; ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(x,y,barW,h,6); else ctx.rect(x,y,barW,h); ctx.fill(); ctx.fillStyle="#99aabd"; ctx.font="9px Inter"; ctx.fillText(date.slice(5), x, H-6); });
  if(target){ const yT=H-24 - (target/max)*(H-40); ctx.strokeStyle="#5de8b6"; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.moveTo(pad,yT); ctx.lineTo(W-pad,yT); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle="#5de8b6"; ctx.font="9px Inter"; ctx.fillText("target "+target, W-70, yT-4); }
}
function drawRings(){
  const canvas=document.getElementById('ringsCanvas'); if(!canvas) return;
  const ctx=canvas.getContext('2d'); const dpr=window.devicePixelRatio||1; const rect=canvas.getBoundingClientRect();
  canvas.width=rect.width*dpr; canvas.height=160*dpr; ctx.scale(dpr,dpr); const W=rect.width, H=160; ctx.clearRect(0,0,W,H);
  const todayCal = records.meals.filter(m=>isToday(m.logged_at)).reduce((s,x)=>s+x.calories,0);
  const todaySteps = records.steps.filter(s=>isToday(s.logged_at)).reduce((s,x)=>s+x.steps,0);
  const todayWorkout = records.workoutSessions.filter(s=>isToday(s.logged_at)).length;
  const rings = [
    {label:'CAL', value: Math.min(todayCal/(profile.target_calories||2200),1), color:'#5de8b6'},
    {label:'STEPS', value: Math.min(todaySteps/(profile.target_steps||10000),1), color:'#58a9ff'},
    {label:'WORK', value: Math.min(todayWorkout/1,1), color:'#c6ff00'},
  ];
  const cx=W/2, cy=H/2+10;
  rings.forEach((r,i)=>{
    const radius = 50 - i*14; const start = -Math.PI/2; const end = start + r.value*2*Math.PI;
    ctx.strokeStyle="#1e324a"; ctx.lineWidth=10; ctx.beginPath(); ctx.arc(cx,cy,radius,start,start+2*Math.PI); ctx.stroke();
    ctx.strokeStyle=r.color; ctx.lineWidth=10; ctx.lineCap='round'; ctx.beginPath(); ctx.arc(cx,cy,radius,start,end); ctx.stroke();
    ctx.fillStyle=r.color; ctx.font="10px Inter"; ctx.fillText(`${r.label} ${Math.round(r.value*100)}%`, cx+60, cy-30 + i*18);
  });
}

function renderActivity(){
  const t=getLast7Data();
  // Steps chart last 14
  const last14Steps={}; for(let i=13;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); last14Steps[dayStr(d)]=0; }
  records.steps.forEach(s=>{ const d=dayStr(s.logged_at); if(last14Steps[d]!==undefined) last14Steps[d]+=s.steps; });
  drawBar('stepsChart', last14Steps, profile.target_steps||10000);
  // HR chart
  const last14HR={}; for(let i=13;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); last14HR[dayStr(d)]=0; }
  const hrCount={}; records.hr.forEach(h=>{ const d=dayStr(h.logged_at); if(last14HR[d]!==undefined){ last14HR[d]+=h.bpm; hrCount[d]=(hrCount[d]||0)+1; } });
  Object.keys(last14HR).forEach(k=>{ if(hrCount[k]) last14HR[k]=Math.round(last14HR[k]/hrCount[k]); });
  drawBar('hrChart', last14HR, profile.resting_hr||60);
  const resting = records.hr.length? Math.min(...records.hr.map(h=>h.bpm)) : profile.resting_hr||60;
  const avg = records.hr.length? Math.round(records.hr.reduce((s,x)=>s+x.bpm,0)/records.hr.length) : 0;
  if($("#restingHrVal")) $("#restingHrVal").textContent = resting + " bpm";
  if($("#avgHrVal")) $("#avgHrVal").textContent = avg ? avg+" bpm" : "--";
  if($("#vo2Val")) $("#vo2Val").textContent = Health.estimateVO2Max(resting, 30, profile.sex_at_birth||'Male');
  // Sleep chart
  const last14Sleep={}; for(let i=13;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); last14Sleep[dayStr(d)]=0; }
  records.sleep.forEach(s=>{ const d=dayStr(s.logged_at); if(last14Sleep[d]!==undefined) last14Sleep[d]+=Number(s.duration_hours); });
  drawBar('sleepChart', last14Sleep, profile.target_sleep_hours||7.5);
  const totalDist = records.steps.reduce((s,x)=>s+Number(x.distance_km),0) + records.activities.reduce((s,x)=>s+Number(x.distance_km||0),0);
  $("#sleepStats").innerHTML = `<div class="row"><div>Avg last 7d</div><span>${(records.sleep.slice(0,7).reduce((a,b)=>a+Number(b.duration_hours),0)/Math.max(1,records.sleep.slice(0,7).length)).toFixed(1)}h</span></div>`;
  $("#distanceStats").innerHTML = `<div class="row"><div>Total walked</div><span>${totalDist.toFixed(1)} km</span></div><div class="row"><div>Last 7 days</div><span>${t.totalDistance.toFixed(1)} km</span></div>`;
}

function renderLast7(){
  const d=getLast7Data();
  const el=$("#last7Summary"); if(!el) return;
  el.innerHTML=`
    <div class="row"><div>Meals</div><span>${d.meals.length} items</span></div>
    <div class="row"><div>Avg kcal</div><span>${d.meals.length?Math.round(d.totalCal/7):0} kcal</span></div>
    <div class="row"><div>Avg protein</div><span>${d.meals.length?Math.round(d.totalPro/7):0} g</span></div>
    <div class="row"><div>Workouts</div><span>${d.workoutCount}</span></div>
    <div class="row"><div>Steps avg</div><span>${d.steps.length? Math.round(d.steps.reduce((s,x)=>s+x.steps,0)/7).toLocaleString():0}</span></div>
    <div class="row"><div>Sleep avg</div><span>${d.sleep.length? (d.sleep.reduce((s,x)=>s+Number(x.duration_hours),0)/d.sleep.length).toFixed(1):0}h</span></div>
  `;
  if(document.getElementById("reportWeightChart")){
    let wts = d.last7Dates.map(date=>d.dailyWeight[date]||null).filter(v=>v!==null);
    let lbs = d.last7Dates.filter(date=>d.dailyWeight[date]).map(date=>date.slice(5));
    if(wts.length<2){
      const sorted=[...records.body].sort((a,b)=>new Date(a.logged_at)-new Date(b.logged_at)).slice(-7);
      wts=sorted.map(b=>b.weight_kg); lbs=sorted.map(b=>dayStr(b.logged_at).slice(5));
    }
    if(wts.length) drawWeightChart("reportWeightChart", wts, lbs, profile.target_weight_kg);
  }
  if(document.getElementById("reportCalChart")) drawBar("reportCalChart", d.dailyCal, profile.target_calories);
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

function renderHistory(){
  if(!records.body.length) return;
  const sorted=[...records.body].sort((a,b)=>new Date(a.logged_at)-new Date(b.logged_at));
  const weights=sorted.map(b=>b.weight_kg);
  const labels=sorted.map(b=>dayStr(b.logged_at).slice(5));
  drawWeightChart("weightChart", weights, labels, profile.target_weight_kg);
  const first=sorted[0]?.weight_kg||0; const last=sorted[sorted.length-1]?.weight_kg||0;
  if($("#hStart")) $("#hStart").textContent=(first||"--")+" kg";
  if($("#hNow")) $("#hNow").textContent=(last||"--")+" kg";
  const days=(new Date(sorted[sorted.length-1].logged_at)-new Date(sorted[0].logged_at))/86400000||1;
  const rate=((last - first)/ (days/7)).toFixed(2);
  if($("#hRate")) $("#hRate").textContent=rate+" kg/wk";
  const cur=last; const avgLoss=parseFloat(rate); const target=profile.target_weight_kg||83;
  const remaining=cur-target; const daysToGoal= avgLoss<0 ? Math.ceil(remaining / Math.abs(avgLoss) *7) : 0;
  if($("#projection")){
    const next1=(cur+avgLoss).toFixed(1); const next2=(cur+avgLoss*2).toFixed(1); const wedding=(cur+avgLoss*10).toFixed(1);
    $("#projection").innerHTML=`
      <div class="proj-card"><span>NEXT WEEK</span><strong>${next1}</strong><small>kg</small></div>
      <div class="proj-card"><span>IN 2 WEEKS</span><strong>${next2}</strong><small>kg</small></div>
      <div class="proj-card highlight"><span>WEDDING</span><strong>${wedding}</strong><small>kg</small></div>
    `;
  }
  const last14Map={}; sorted.forEach(b=>{ last14Map[dayStr(b.logged_at)]=b.weight_kg; });
  const now=new Date(); const days14=[];
  for(let i=13;i>=0;i--){ const d=new Date(now); d.setDate(now.getDate()-i); days14.push(d); }
  if($("#last14")){
    $("#last14").innerHTML=days14.map(d=>{
      const ds=dayStr(d); const w=last14Map[ds]; const dayName=d.toLocaleDateString('en',{weekday:'short'}); const dayNum=d.getDate();
      return `<div class="${w?'has':''}"><span>${dayName}</span><span>${dayNum}</span><strong>${w? w.toFixed(2) : "—"}</strong></div>`;
    }).join("");
  }
  if($("#allLogs")){
    $("#allLogs").innerHTML=[...records.meals, ...records.workoutSessions, ...records.body, ...records.steps, ...records.sleep].sort((a,b)=>new Date(b.logged_at)-new Date(a.logged_at)).slice(0,40).map(x=>{
      const name=x.meal_name||x.session_name||(x.steps? `${x.steps} steps` : null)||(x.duration_hours? `${x.duration_hours}h sleep`: null)||`Weight ${x.weight_kg}kg`;
      return `<div class="row"><div><strong>${esc(name)}</strong><small>${new Date(x.logged_at).toLocaleString()}</small></div><span>${x.calories?x.calories+' kcal':''}</span></div>`;
    }).join("") || '<div class="empty">No logs</div>';
  }
}

function buildProfileForm(){
  const f=$("#profileForm"); if(!profile || !f) return;
  f.innerHTML=`
    <label>Full name<input name="full_name" value="${esc(profile.full_name)}" required></label>
    <label>DOB<input name="date_of_birth" type="date" value="${profile.date_of_birth}" required></label>
    <label>Height cm<input name="height_cm" type="number" step="0.1" value="${profile.height_cm}" required></label>
    <label>Target weight<input name="target_weight_kg" type="number" step="0.1" value="${profile.target_weight_kg}" required></label>
    <label>Calories target<input name="target_calories" type="number" value="${profile.target_calories}" required></label>
    <label>Protein target<input name="target_protein_g" type="number" value="${profile.target_protein_g}" required></label>
    <label>Steps target<input name="target_steps" type="number" value="${profile.target_steps||10000}"></label>
    <label>Sleep target h<input name="target_sleep_hours" type="number" step="0.1" value="${profile.target_sleep_hours||7.5}"></label>
    <label>Resting HR<input name="resting_hr" type="number" value="${profile.resting_hr||60}"></label>
    <label class="full">Allergies<input name="allergies" value="${esc(profile.allergies||'')}"></label>
    <button class="btn primary full" type="submit">Save profile</button>
  `;
  f.onsubmit=async e=>{
    e.preventDefault();
    const fd=new FormData(f);
    const row={full_name:fd.get("full_name"), date_of_birth:fd.get("date_of_birth"), height_cm:+fd.get("height_cm"), target_weight_kg:+fd.get("target_weight_kg"), target_calories:+fd.get("target_calories"), target_protein_g:+fd.get("target_protein_g"), target_steps:+fd.get("target_steps")||10000, target_sleep_hours:+fd.get("target_sleep_hours")||7.5, resting_hr:+fd.get("resting_hr")||60, allergies:fd.get("allergies")};
    const {data,error}=await db.from("profiles").update(row).eq("id",user.id).select().single();
    if(error) return toast(error.message,true);
    profile=data; toast("Profile updated"); render();
  };
}

function exportJSON(){
  const blob=new Blob([JSON.stringify({profile, records},null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`fitness-v4-export-${todayStr()}.json`; a.click();
}
$("#deleteAccountData").onclick=async()=>{
  if(!confirm("Delete all health records? Profile stays.")) return;
  for(const t of ["meal_logs","activity_logs","body_logs","workout_sessions","water_logs","sleep_logs","steps_logs","heart_rate_logs"]){
    await db.from(t).delete().eq("user_id",user.id);
  }
  await loadRecords(); render(); toast("Deleted");
};

// ---- IMPORT HANDLERS ----
window.handleGarminImport = async()=>{
  const file=$("#garminFile").files[0]; if(!file) return toast("Select file",true);
  $("#garminStatus").textContent="Parsing Garmin...";
  try{
    const data=await Integrations.importGarmin(file);
    let total=0;
    if(data.activities.length) total+= await Integrations.saveBatch(db,user.id,'activity', data.activities);
    if(data.steps.length) total+= await Integrations.saveBatch(db,user.id,'steps', data.steps);
    if(data.sleep.length) total+= await Integrations.saveBatch(db,user.id,'sleep', data.sleep);
    await db.from('integration_imports').insert({user_id:user.id, provider:'garmin', file_name:file.name, records_count:total, raw_summary:data});
    $("#garminStatus").textContent=`✅ Imported ${total} records`;
    await loadRecords(); render(); toast(`Garmin imported ${total}`);
  }catch(e){ $("#garminStatus").textContent="❌ "+e.message; toast(e.message,true); }
};
window.handleStravaImport = async()=>{
  const file=$("#stravaFile").files[0]; if(!file) return toast("Select file",true);
  $("#stravaStatus").textContent="Parsing Strava...";
  try{
    const activities=await Integrations.importStrava(file, user.id);
    let inserted=0;
    for(let a of activities){
      if(a.distance_km) await db.from('activity_logs').insert({user_id:user.id, activity_name:a.activity_name, duration_minutes:a.duration_minutes||0, distance_km:a.distance_km, calories_burned:a.calories_burned||0, source:'Strava', logged_at: new Date(a.logged_at).toISOString()});
      if(a.avg_hr) await db.from('heart_rate_logs').insert({user_id:user.id, bpm:a.avg_hr, avg_bpm:a.avg_hr, max_bpm:a.max_hr||null, source:'Strava', logged_at: new Date(a.logged_at).toISOString()});
      if(a.steps) await db.from('steps_logs').insert({user_id:user.id, steps:a.steps, distance_km:a.distance_km||0, source:'Strava', logged_at: new Date(a.logged_at).toISOString()});
      inserted++;
    }
    await db.from('integration_imports').insert({user_id:user.id, provider:'strava', file_name:file.name, records_count:inserted});
    $("#stravaStatus").textContent=`✅ Imported ${inserted} Strava activities`;
    await loadRecords(); render(); toast(`Strava imported`);
  }catch(e){ $("#stravaStatus").textContent="❌ "+e.message; toast(e.message,true); }
};
window.handleZeppImport = async()=>{
  const file=$("#zeppFile").files[0]; if(!file) return toast("Select file",true);
  $("#zeppStatus").textContent="Parsing Zepp...";
  try{
    const weights=await Integrations.importZepp(file);
    for(let w of weights){ await db.from('body_logs').insert({user_id:user.id, weight_kg:w.weight_kg, body_fat_percent:w.body_fat_percent, muscle_mass_kg:w.muscle_mass_kg, bmi:w.bmi, source:'Zepp', logged_at: new Date(w.logged_at).toISOString()}); }
    await db.from('integration_imports').insert({user_id:user.id, provider:'zepp', file_name:file.name, records_count:weights.length});
    $("#zeppStatus").textContent=`✅ Imported ${weights.length} weight records from Xiaomi Scale`;
    await loadRecords(); render(); toast("Zepp imported");
  }catch(e){ $("#zeppStatus").textContent="❌ "+e.message; toast(e.message,true); }
};
window.handleQuickImport = async()=>{
  const file=$("#quickImportFile").files[0]; const type=$("#quickImportType").value; if(!file) return toast("Select file",true);
  $("#quickImportStatus").textContent="Importing...";
  try{
    if(type==='zepp') { $("#zeppFile").files = $("#quickImportFile").files; return handleZeppImport(); }
    if(type==='strava') { $("#stravaFile").files = $("#quickImportFile").files; return handleStravaImport(); }
    if(type==='garmin') { $("#garminFile").files = $("#quickImportFile").files; return handleGarminImport(); }
  }catch(e){ $("#quickImportStatus").textContent="❌ "+e.message; }
};

boot();
