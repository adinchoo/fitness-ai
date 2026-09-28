"use strict";
const CONFIG_KEY="fitness-ai-supabase-config-v4";
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
function client(c){ if(!window.supabase) throw new Error("Supabase SDK not loaded"); db=window.supabase.createClient(c.url,c.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}) }
async function boot(){
  const c=config();
  if(!c){ show("setupScreen"); return }
  try{
    client(c);
    const {data:{session}} = await db.auth.getSession();
    if(session){ user=session.user; await enterApp(); }
    else show("authScreen");
    db.auth.onAuthStateChange((ev,s)=>{ if(ev==="SIGNED_OUT") show("authScreen") });
  }catch(e){ console.error(e); show("setupScreen"); toast("Connection failed: "+e.message,true) }
}
$("#setupForm")?.addEventListener("submit", async e=>{
  e.preventDefault();
  const url=$("#setupUrl").value.trim().replace(/\/$/,""), key=$("#setupKey").value.trim();
  localStorage.setItem(CONFIG_KEY, JSON.stringify({url,key}));
  location.reload();
});
$("#changeConnection") && ($("#changeConnection").onclick=()=>{ if(confirm("Change connection?")){ localStorage.removeItem(CONFIG_KEY); location.reload() } });
$$('[data-auth-tab]').forEach(b=>b.onclick=()=>{
  $$('[data-auth-tab]').forEach(x=>x.classList.toggle("active",x===b));
  $("#loginForm").classList.toggle("active",b.dataset.authTab==="login");
  $("#signupForm").classList.toggle("active",b.dataset.authTab==="signup");
});
$("#loginForm")?.addEventListener("submit", async e=>{
  e.preventDefault();
  const f=new FormData(e.currentTarget);
  const {data,error}=await db.auth.signInWithPassword({email:f.get("email").trim(),password:f.get("password")});
  if(error) return toast(error.message,true);
  user=data.user; await enterApp();
});
$("#signupForm")?.addEventListener("submit", async e=>{
  e.preventDefault();
  const f=new FormData(e.currentTarget);
  if(f.get("password")!==f.get("confirm_password")) return toast("Passwords mismatch",true);
  const detail={
    full_name:f.get("full_name").trim(),
    date_of_birth:f.get("date_of_birth"),
    sex_at_birth:f.get("sex_at_birth"),
    height_cm:f.get("height_cm"),
    current_weight_kg:f.get("current_weight_kg"),
    starting_weight_kg:f.get("current_weight_kg"),
    target_weight_kg:f.get("target_weight_kg"),
    primary_goal:f.get("primary_goal"),
    activity_level:f.get("activity_level"),
    target_calories:f.get("target_calories"),
    target_protein_g:f.get("target_protein_g"),
    target_steps:f.get("target_steps")||"10000",
    target_sleep_hours:f.get("target_sleep")||"7.5",
  };
  const {data,error}=await db.auth.signUp({email:f.get("email").trim(),password:f.get("password"),options:{data:detail}});
  if(error) return toast(error.message,true);
  if(data.session){ user=data.user; await enterApp(); toast("Account created"); }
  else { toast("Check email to confirm"); document.querySelector('[data-auth-tab="login"]').click() }
});
$("#forgotButton") && ($("#forgotButton").onclick=async()=>{
  const email=prompt("Email:"); if(!email) return;
  const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:location.href.split("#")[0]});
  toast(error?error.message:"Reset email sent",!!error);
});
$("#logoutButton") && ($("#logoutButton").onclick=async()=>{ await db.auth.signOut(); user=null; profile=null; show("authScreen") });
$("#syncButton") && ($("#syncButton").onclick=async()=>{ await loadRecords(); render(); toast("Synced") });
async function enterApp(){
  show("app");
  $("#dateLabel").textContent = new Date().toLocaleDateString('en-GB',{weekday:'long', day:'numeric', month:'long'});
  await Promise.all([loadProfile(), loadRecords()]);
  $("#greeting").textContent = `Good ${new Date().getHours()<12?'Morning':new Date().getHours()<18?'Afternoon':'Evening'}, ${profile?.full_name?.split(' ')[0]||'bro'}`;
  initUI(); render(); updateAutoSyncUrl();
}
function updateAutoSyncUrl(){
  const c=config(); const el=$("#finalUrl"); if(!el ||!c ||!user) return;
  el.textContent = `${c.url}/functions/v1/health-auto-export?user_id=${user.id}`;
  $("#userIdDisplay").textContent = user.id;
}
async function loadProfile(){
  const {data,error}=await db.from("profiles").select("*").eq("id",user.id).single();
  if(error){
    const meta = user.user_metadata || {};
    const payload = {
      id: user.id,
      full_name: meta.full_name || 'User',
      date_of_birth: meta.date_of_birth || null,
      sex_at_birth: meta.sex_at_birth || 'Male',
      height_cm: parseFloat(meta.height_cm)||170,
      starting_weight_kg: parseFloat(meta.current_weight_kg||meta.starting_weight_kg)||70,
      current_weight_kg: parseFloat(meta.current_weight_kg)||70,
      target_weight_kg: parseFloat(meta.target_weight_kg)||70,
      primary_goal: meta.primary_goal||'lose_weight',
      activity_level: meta.activity_level||'moderate',
      target_calories: parseInt(meta.target_calories)||2200,
      target_protein_g: parseInt(meta.target_protein_g)||180,
      target_steps: parseInt(meta.target_steps)||10000,
      target_sleep_hours: parseFloat(meta.target_sleep_hours)||7.5,
    };
    const {data:ins, error:insErr} = await db.from("profiles").insert(payload).select().single();
    if(insErr){ toast("Profile load failed: "+error.message,true); throw error; }
    profile=ins;
  } else { profile=data; }
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
  records.meals=res[0].value?.data||[]; records.activities=res[1].value?.data||[]; records.body=res[2].value?.data||[];
  records.workoutSessions=res[3].value?.data||[]; records.workoutExercises=res[4].value?.data||[]; records.water=res[5].value?.data||[];
  records.sleep=res[6].value?.data||[]; records.photos=res[7].value?.data||[]; records.steps=res[8].value?.data||[]; records.hr=res[9].value?.data||[];
}
function initUI(){
  $$('[data-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
  $$('[data-view-jump]').forEach(b=>b.onclick=()=>switchView(b.dataset.viewJump));
  $$('[data-open]').forEach(b=>b.onclick=()=>{ const d=$("#"+b.dataset.open); const dt=d.querySelector('[name="logged_at"]'); if(dt) dt.value=new Date().toISOString().slice(0,16); d.showModal() });
  $$('[data-close]').forEach(b=>b.onclick=()=>b.closest("dialog").close());
  $$('dialog').forEach(d=>d.addEventListener('click',e=>{ if(e.target===d) d.close() }));
  const sel=$("#workoutTemplateSelect");
  if(sel){ sel.innerHTML=Object.keys(WORKOUT_TEMPLATES||{}).map(k=>`<option>${k}</option>`).join(""); sel.onchange=()=>renderWorkoutEditor(); }
  $("#saveWorkoutBtn") && ($("#saveWorkoutBtn").onclick=saveWorkout);
  $("#genReportBtn") && ($("#genReportBtn").onclick=generateReport);
  const cats=Object.keys(FOOD_DB||{});
  if($("#mealCatTabs")) $("#mealCatTabs").innerHTML=cats.map(c=>`<button type="button" class="tab ${c===currentCategory?'active':''}" data-cat="${c}">${c}</button>`).join("");
  $$('#mealCatTabs [data-cat]').forEach(b=>b.onclick=()=>{ currentCategory=b.dataset.cat; $$('#mealCatTabs .tab').forEach(x=>x.classList.toggle('active',x===b)); renderMealOptions() });
  $("#photoFileInput") && ($("#photoFileInput").onchange=e=>handlePhotoUpload(e.target.files[0]));
  $("#takePhotoBtn") && ($("#takePhotoBtn").onclick=()=>$("#hiddenCameraInput").click());
  $("#hiddenCameraInput") && ($("#hiddenCameraInput").onchange=e=>handlePhotoUpload(e.target.files[0]));
  const camInput = $("#foodCameraInput");
  const libInput = $("#foodPhotoInput");
  if(camInput){
    camInput.onchange=e=>handleFoodPhoto(e.target.files[0]);
    $("#foodCameraBtn") && ($("#foodCameraBtn").onclick=()=>camInput.click());
    $("#foodCameraBtnSmall") && ($("#foodCameraBtnSmall").onclick=()=>camInput.click());
  }
  if(libInput){
    libInput.onchange=e=>handleFoodPhoto(e.target.files[0]);
    $("#foodLibraryBtn") && ($("#foodLibraryBtn").onclick=()=>libInput.click());
  }
  $("#addCustomFood") && ($("#addCustomFood").onclick=()=>{ const n=$("#customFoodName").value.trim(), kc=+$("#customKcal").value, pr=+$("#customPro").value; if(!n||!kc) return toast("Name + kcal needed",true); addSelected({name:n, kcal:kc, protein:pr, carbs:0, fat:0}); });
  buildProfileForm();
  $("#refreshButton") && ($("#refreshButton").onclick=async()=>{ await loadRecords(); render(); toast("Refreshed") });
  $("#exportButton") && ($("#exportButton").onclick=exportJSON);
  if($("#testPuterButton")){
    $("#testPuterButton").onclick=async()=>{
      $("#puterTestOutput").style.display="block";
      $("#puterTestOutput").textContent="Testing Puter...";
      try{ const res = await AI.testPuter(); $("#puterTestOutput").textContent = res; toast("Puter works!"); updateAIMode(); }
      catch(e){ $("#puterTestOutput").textContent = "❌ " + e.message; toast(e.message,true); }
    };
  }
  updateAIMode();
  $("#bodyForm") && ($("#bodyForm").onsubmit=saveBody);
  $("#workoutQuickForm") && ($("#workoutQuickForm").onsubmit=saveQuickWorkout);
  $("#mealForm") && ($("#mealForm").onsubmit=saveMeal);
  $("#sleepForm") && ($("#sleepForm").onsubmit=saveSleep);
  $("#stepsForm") && ($("#stepsForm").onsubmit=saveSteps);
  $("#hrForm") && ($("#hrForm").onsubmit=saveHR);

  // === GPX FULL REPORT v7.4 ===
  const gpxReportInput = document.getElementById('gpxReportFile');
  if(gpxReportInput){
    gpxReportInput.onchange=e=>{ const f=e.target.files[0]; if(f){ GpxReport.loadFile(f).then(()=>{ switchView('gpxReportView'); toast('GPX/FIT full report loaded: '+f.name); }).catch(err=>toast(err.message,true)); } };
    const dropZone=document.getElementById('gpxDropZone');
    if(dropZone){
      dropZone.ondragover=e=>{ e.preventDefault(); dropZone.style.background='#102c38'; dropZone.style.borderColor='#c6ff00'; };
      dropZone.ondragleave=()=>{ dropZone.style.background=''; dropZone.style.borderColor=''; };
      dropZone.ondrop=e=>{ e.preventDefault(); dropZone.style.background=''; const f=e.dataTransfer.files[0]; if(f){ GpxReport.loadFile(f).then(()=>{ switchView('gpxReportView'); toast('GPX/FIT full report loaded: '+f.name); }).catch(err=>toast(err.message,true)); } };
    }
  }
}
function switchView(id){
  $$('[data-view]').forEach(x=>x.classList.toggle("active",x.dataset.view===id));
  $$('.view').forEach(v=>v.classList.toggle("active",v.id===id));
  window.scrollTo(0,0);
  if(id==="historyView") renderHistory();
  if(id==="photosView") renderPhotos();
  if(id==="reportView") renderLast7();
  if(id==="activityView") renderActivity();
  if(id==="gpxReportView" && window.GpxReport && GpxReport.data){ setTimeout(()=>{ GpxReport.drawMap(); }, 200); }
}
function updateAIMode(){
  const pill=document.getElementById("aiModePill"); if(!pill) return;
  if(typeof puter!== "undefined" && puter.ai){ pill.textContent = "Puter • " + (AI.MODELS?.text || "Gemini 2.0"); pill.style.background="#163a33"; pill.style.color="#5de8b6"; }
  else { pill.textContent = "Local AI"; pill.style.background="#55242e"; pill.style.color="#ffc1c7"; }
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
  return {meals, activities, sessions, bodyLogs:body, body14, sleep, steps, hr, totalCal, totalPro, totalDistance, weightChange, workoutCount:sessions.length, dailyCal, dailyPro, dailyWeight, dailySteps, dailySleep, last7Dates:last7.slice().reverse()};
}
function render(){
  const t=getLast7Data();
  const latestWeight = records.body[0]?.weight_kg || profile.current_weight_kg || 0;
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
  renderMealOptions(); renderTodayLogs(); renderWorkoutEditor(); renderTodaySession();
  const yCal = t.dailyCal[yesterdayStr()]||0;
  const yPro = t.dailyPro[yesterdayStr()]||0;
  const ySteps = t.dailySteps[yesterdayStr()]||0;
  const ySleep = records.sleep.find(s=>isYesterday(s.logged_at));
  const yHR = records.hr.find(h=>isYesterday(h.logged_at));
  AI.generateCheckin(profile, {calories:yCal, targetCal:profile.target_calories, protein:yPro, targetPro:profile.target_protein_g, workoutCount: records.workoutSessions.filter(s=>isYesterday(s.logged_at)).length, steps:ySteps, sleepHours: ySleep?Number(ySleep.duration_hours):0, sleepScore: ySleep?.score||0, avgHR: yHR?.bpm||0}).then(txt=>{ $("#yesterdayCheckin").textContent=txt; });
  drawRings();
}
function renderTodayLogs(){
  const todayItems = [...records.meals.filter(m=>isToday(m.logged_at)),...records.activities.filter(a=>isToday(a.logged_at)),...records.steps.filter(s=>isToday(s.logged_at)),...records.sleep.filter(s=>isToday(s.logged_at)),...records.hr.filter(h=>isToday(h.logged_at)),...records.body.filter(b=>isToday(b.logged_at))].sort((a,b)=>new Date(b.logged_at)-new Date(a.logged_at));
  $("#todayLogs").innerHTML = todayItems.slice(0,12).map(x=>{
    const name = x.meal_name || x.activity_name || (x.steps? `${x.steps} steps • ${x.distance_km}km` : null) || (x.duration_hours? `${x.duration_hours}h sleep score ${x.score||''}` : null) || (x.bpm? `${x.bpm} bpm HR` : null) || `Weight ${x.weight_kg}kg`;
    const meta = x.calories? `${x.calories} kcal` : x.duration_minutes? `${x.duration_minutes} min` : x.steps? `${x.source||'Manual'}` : x.source||'';
    return `<div class="row"><div><strong>${esc(name)}</strong><small>${new Date(x.logged_at).toLocaleTimeString()} • ${esc(meta)}</small></div><span>${x.protein_g? x.protein_g+'g P':''}</span></div>`;
  }).join('') || '<div class="empty">No logs today - start with weight or meal!</div>';
}
function renderTodaySession(){
  const tmpl = localStorage.getItem('fitness-today-template') || 'Push Day';
  const ex = (typeof WORKOUT_TEMPLATES!=="undefined" && WORKOUT_TEMPLATES[tmpl]) || [];
  $("#todaySession").innerHTML = `<strong>${esc(tmpl)}</strong> • ${ex.length} exercises`;
}
function renderMealOptions(){
  const container = $("#mealOptions"); if(!container) return;
  const list = (typeof FOOD_DB!=="undefined" && FOOD_DB[currentCategory]) || [];
  container.innerHTML = list.map((f,idx)=>{
    const isSel = selectedFoods.find(s=>s.idx===idx && s.cat===currentCategory);
    const kcal = f.kcal || f.sizes?.M.kcal || 0;
    const pro = f.protein || f.sizes?.M.protein || 0;
    return `<div class="food-row ${isSel?'selected':''}" onclick="toggleFood(${idx})"><div><strong>${esc(f.name)}</strong><small>${kcal} kcal • ${pro}g P${f.variants?' • S/M/L':''}</small></div>${f.sizes? `<div class="food-size">${Object.keys(f.sizes).map(sz=>`<button class="size-btn ${isSel?.size===sz?'active':''}" onclick="event.stopPropagation(); selectSize(${idx},'${sz}')">${sz}</button>`).join('')}</div>`: `<span>➕</span>`}</div>`;
  }).join('');
}
window.toggleFood = (idx)=>{
  const cat=currentCategory; const existing = selectedFoods.findIndex(s=>s.idx===idx && s.cat===cat);
  if(existing>=0){ selectedFoods.splice(existing,1); }
  else { const f=FOOD_DB[cat][idx]; const size = f.sizes? 'M' : null; const szData = size? f.sizes[size] : f; selectedFoods.push({idx, cat, name:f.name, kcal: szData.kcal||0, protein: szData.protein||0, carbs: szData.carbs||0, fat: szData.fat||0, size}); }
  renderMealOptions(); renderSelected();
};
window.selectSize = (idx,size)=>{
  const cat=currentCategory; const f=FOOD_DB[cat][idx]; const existing = selectedFoods.find(s=>s.idx===idx && s.cat===cat);
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
  e.preventDefault(); if(!selectedFoods.length) return toast("Select food first",true);
  const totalK = selectedFoods.reduce((s,x)=>s+x.kcal,0); const totalP = selectedFoods.reduce((s,x)=>s+Number(x.protein),0); const totalC = selectedFoods.reduce((s,x)=>s+Number(x.carbs||0),0); const totalF = selectedFoods.reduce((s,x)=>s+Number(x.fat||0),0);
  const name = selectedFoods.map(s=>s.name + (s.size?` ${s.size}`:'')).join(' + ');
  const {error} = await db.from('meal_logs').insert({user_id:user.id, meal_name:name, meal_type:currentCategory, category:currentCategory, calories:totalK, protein_g:totalP, carbs_g:totalC, fat_g:totalF, source:'Manual', logged_at:new Date().toISOString()});
  if(error) return toast(error.message,true); selectedFoods=[]; renderMealOptions(); renderSelected(); $("#mealDialog").close(); await loadRecords(); render(); toast(`Logged ${totalK} kcal`);
}
async function saveBody(e){ e.preventDefault(); const fd=new FormData(e.currentTarget); const row={user_id:user.id, weight_kg:parseFloat(fd.get('weight_kg')), body_fat_percent: fd.get('body_fat')? parseFloat(fd.get('body_fat')):null, source:'Manual', logged_at: fd.get('logged_at')? new Date(fd.get('logged_at')).toISOString() : new Date().toISOString()}; const {error}=await db.from('body_logs').insert(row); if(error) return toast(error.message,true); $("#bodyDialog").close(); await loadRecords(); render(); toast("Weight logged"); }
async function saveQuickWorkout(e){ e.preventDefault(); const fd=new FormData(e.currentTarget); const {error}=await db.from('activity_logs').insert({user_id:user.id, activity_name:fd.get('activity_name'), duration_minutes:+fd.get('duration_minutes'), calories_burned:+fd.get('calories_burned')||0, distance_km: parseFloat(fd.get('distance_km'))||0, source:'Manual', logged_at: fd.get('logged_at')? new Date(fd.get('logged_at')).toISOString(): new Date().toISOString()}); if(error) return toast(error.message,true); $("#workoutDialog").close(); await loadRecords(); render(); toast("Workout logged"); }
async function saveSleep(e){ e.preventDefault(); const fd=new FormData(e.currentTarget); const row={user_id:user.id, duration_hours:parseFloat(fd.get('duration_hours')), quality:+fd.get('quality')||3, source:'Manual', logged_at: fd.get('logged_at')? new Date(fd.get('logged_at')).toISOString(): new Date().toISOString()}; const {error}=await db.from('sleep_logs').insert(row); if(error) return toast(error.message,true); $("#sleepDialog").close(); await loadRecords(); render(); toast("Sleep logged"); }
async function saveSteps(e){ e.preventDefault(); const fd=new FormData(e.currentTarget); const row={user_id:user.id, steps:+fd.get('steps'), distance_km:parseFloat(fd.get('distance_km'))||0, source:'Manual', logged_at: fd.get('logged_at')? new Date(fd.get('logged_at')).toISOString(): new Date().toISOString()}; const {error}=await db.from('steps_logs').insert(row); if(error) return toast(error.message,true); $("#stepsDialog").close(); await loadRecords(); render(); toast("Steps logged"); }
async function saveHR(e){ e.preventDefault(); const fd=new FormData(e.currentTarget); const row={user_id:user.id, bpm:+fd.get('bpm'), resting_bpm:+fd.get('resting_bpm')||null, avg_bpm:+fd.get('avg_bpm')||+fd.get('bpm'), source:'Manual', logged_at: fd.get('logged_at')? new Date(fd.get('logged_at')).toISOString(): new Date().toISOString()}; const {error}=await db.from('heart_rate_logs').insert(row); if(error) return toast(error.message,true); $("#hrDialog").close(); await loadRecords(); render(); toast("HR logged"); }
function renderWorkoutEditor(){
  const sel=$("#workoutTemplateSelect"); if(!sel) return;
  const tmpl=sel.value; localStorage.setItem('fitness-today-template', tmpl);
  const list=(WORKOUT_TEMPLATES&&WORKOUT_TEMPLATES[tmpl])||[];
  $("#workoutEditor").innerHTML = `<h4>${esc(tmpl)} • ${list.length} exercises</h4>` + list.map((ex,i)=>`<div class="row"><div><strong>${esc(ex.name)}</strong><small>${ex.sets}x${ex.reps} • ${ex.weight}kg</small></div><div class="food-size"><input type="number" placeholder="kg" id="w_${i}" value="${ex.weight}" style="width:70px"></div></div>`).join('') + `<small class="muted">Edit weights then Save</small>`;
}
async function saveWorkout(){
  const sel=$("#workoutTemplateSelect"); const tmpl=sel.value;
  const {data:session, error:se} = await db.from('workout_sessions').insert({user_id:user.id, session_name:tmpl, logged_at:new Date().toISOString()}).select().single();
  if(se) return toast(se.message,true);
  const exs=WORKOUT_TEMPLATES[tmpl].map((ex,i)=>{ const w=parseFloat(document.getElementById("w_"+i)?.value)||0; return {session_id:session.id, user_id:user.id, exercise_name:ex.name, sets:ex.sets, reps:ex.reps, weight_kg:w}; });
  const {error}=await db.from('workout_exercise_logs').insert(exs);
  if(error) return toast(error.message,true); await loadRecords(); render(); toast("Workout saved");
}
async function handleFoodPhoto(file){
  if(!file) return;
  const status = $("#foodPhotoStatus");
  if(status) status.textContent = "🔍 Analyzing with Puter AI...";
  toast("Analyzing meal photo...");
  const res = await AI.analyzeFoodPhoto(file);
  if(res.error){ if(status) status.textContent = "❌ " + res.error; return toast(res.error,true); }
  if(status) status.textContent = `✅ ${res.name} • ${res.calories} kcal • P ${res.protein_g||0}g`;
  addSelected({name:res.name, kcal:res.calories, protein:res.protein_g||0, carbs:res.carbs_g||0, fat:res.fat_g||0});
  toast(`Added ${res.name}`);
}
async function handlePhotoUpload(file){
  if(!file) return; toast("Uploading photo...");
  const path = `${user.id}/${Date.now()}_${file.name}`;
  const {error} = await db.storage.from('progress-photos').upload(path, file);
  if(error) return toast(error.message,true);
  const {data:{publicUrl}} = db.storage.from('progress-photos').getPublicUrl(path);
  let url = publicUrl;
  try{ const {data} = await db.storage.from('progress-photos').createSignedUrl(path, 3600*24*365); if(data?.signedUrl) url=data.signedUrl; }catch{}
  await db.from('progress_photos').insert({user_id:user.id, photo_url:url, photo_type:document.getElementById("photoType").value||'Front', logged_at:new Date().toISOString()});
  await loadRecords(); renderPhotos(); toast("Photo saved");
}
function renderPhotos(){ $("#photoGrid").innerHTML = records.photos.map(p=>`<div><img src="${p.photo_url}" loading="lazy"><small>${esc(p.photo_type)} • ${new Date(p.logged_at).toLocaleDateString()}</small></div>`).join('') || '<div class="empty">No photos yet</div>'; }
function drawWeightChart(canvasId, weights, labels, targetWeight){
  const canvas=document.getElementById(canvasId); if(!canvas ||!weights.length) return;
  const ctx=canvas.getContext("2d"); const dpr=window.devicePixelRatio||1; const rect=canvas.getBoundingClientRect();
  canvas.width=rect.width*dpr; canvas.height=200*dpr; ctx.scale(dpr,dpr); const W=rect.width, H=200; ctx.clearRect(0,0,W,H);
  const pad=30; const min=Math.min(...weights, targetWeight||999)-1; const max=Math.max(...weights, targetWeight||0)+1; const range=Math.max(max-min,2);
  ctx.strokeStyle="#1e324a"; ctx.setLineDash([4,6]); ctx.lineWidth=1; for(let i=0;i<4;i++){ const y=pad + (H-pad*2)*(i/3); ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(W-pad,y); ctx.stroke(); } ctx.setLineDash([]);
  if(targetWeight){ const yT=H - pad - ((targetWeight-min)/range)*(H-pad*2); ctx.strokeStyle="#5de8b6"; ctx.setLineDash([6,6]); ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(pad,yT); ctx.lineTo(W-pad,yT); ctx.stroke(); ctx.setLineDash([]); }
  ctx.strokeStyle="#d4ff32"; ctx.lineWidth=2.5; ctx.beginPath(); weights.forEach((wt,i)=>{ const x=pad + (i/(weights.length-1||1))*(W-pad*2); const y=H - pad - ((wt-min)/range)*(H-pad*2); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke();
}
function drawBar(canvasId, map, target){
  const canvas=document.getElementById(canvasId); if(!canvas) return;
  const ctx=canvas.getContext("2d"); const dpr=window.devicePixelRatio||1; const rect=canvas.getBoundingClientRect();
  canvas.width=rect.width*dpr; canvas.height=160*dpr; ctx.scale(dpr,dpr); const W=rect.width, H=160; ctx.clearRect(0,0,W,H);
  const entries=Object.entries(map); if(!entries.length) return; const vals=entries.map(e=>e[1]); const max=Math.max(...vals, target||0, 100); const pad=24; const barW=(W-pad*2)/entries.length - 8;
  entries.forEach(([date,val],i)=>{ const x=pad + i*((W-pad*2)/entries.length) + 4; const h=Math.max(4, (val/max)*(H-40)); const y=H-24-h; ctx.fillStyle="#294058"; ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(x,y,barW,h,6); else ctx.rect(x,y,barW,h); ctx.fill(); });
}
function drawRings(){
  const canvas=document.getElementById('ringsCanvas'); if(!canvas) return;
  const ctx=canvas.getContext('2d'); const dpr=window.devicePixelRatio||1; const rect=canvas.getBoundingClientRect();
  canvas.width=rect.width*dpr; canvas.height=160*dpr; ctx.scale(dpr,dpr); const W=rect.width, H=160; ctx.clearRect(0,0,W,H);
  const todayCal = records.meals.filter(m=>isToday(m.logged_at)).reduce((s,x)=>s+x.calories,0);
  const todaySteps = records.steps.filter(s=>isToday(s.logged_at)).reduce((s,x)=>s+x.steps,0);
  const todayWorkout = records.workoutSessions.filter(s=>isToday(s.logged_at)).length;
  const rings = [{label:'CAL', value: Math.min(todayCal/(profile.target_calories||2200),1), color:'#5de8b6'},{label:'STEPS', value: Math.min(todaySteps/(profile.target_steps||10000),1), color:'#58a9ff'},{label:'WORK', value: Math.min(todayWorkout/1,1), color:'#c6ff00'},];
  const cx=W/2, cy=H/2+10;
  rings.forEach((r,i)=>{ const radius = 50 - i*14; const start = -Math.PI/2; const end = start + r.value*2*Math.PI; ctx.strokeStyle="#1e324a"; ctx.lineWidth=10; ctx.beginPath(); ctx.arc(cx,cy,radius,start,start+2*Math.PI); ctx.stroke(); ctx.strokeStyle=r.color; ctx.lineWidth=10; ctx.lineCap='round'; ctx.beginPath(); ctx.arc(cx,cy,radius,start,end); ctx.stroke(); ctx.fillStyle=r.color; ctx.font="10px Inter"; ctx.fillText(`${r.label} ${Math.round(r.value*100)}%`, cx+60, cy-30 + i*18); });
}
function renderActivity(){
  const last14Steps={}; for(let i=13;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); last14Steps[dayStr(d)]=0; }
  records.steps.forEach(s=>{ const d=dayStr(s.logged_at); if(last14Steps[d]!==undefined) last14Steps[d]+=s.steps; });
  drawBar('stepsChart', last14Steps, profile.target_steps||10000);
  const last14HR={}; for(let i=13;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); last14HR[dayStr(d)]=0; }
  const hrCount={}; records.hr.forEach(h=>{ const d=dayStr(h.logged_at); if(last14HR[d]!==undefined){ last14HR[d]+=h.bpm; hrCount[d]=(hrCount[d]||0)+1; } });
  Object.keys(last14HR).forEach(k=>{ if(hrCount[k]) last14HR[k]=Math.round(last14HR[k]/hrCount[k]); });
  drawBar('hrChart', last14HR, profile.resting_hr||60);
  const last14Sleep={}; for(let i=13;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); last14Sleep[dayStr(d)]=0; }
  records.sleep.forEach(s=>{ const d=dayStr(s.logged_at); if(last14Sleep[d]!==undefined) last14Sleep[d]+=Number(s.duration_hours); });
  drawBar('sleepChart', last14Sleep, profile.target_sleep_hours||7.5);
}
function renderLast7(){
  const d=getLast7Data(); const el=$("#last7Summary"); if(!el) return;
  el.innerHTML=`<div class="row"><div>Meals</div><span>${d.meals.length} items</span></div><div class="row"><div>Avg kcal</div><span>${d.meals.length?Math.round(d.totalCal/7):0} kcal</span></div><div class="row"><div>Workouts</div><span>${d.workoutCount}</span></div><div class="row"><div>Steps avg</div><span>${d.steps.length? Math.round(d.steps.reduce((s,x)=>s+x.steps,0)/7).toLocaleString():0}</span></div>`;
}
async function generateReport(){
  const btn=$("#genReportBtn"); if(btn){ btn.disabled=true; btn.textContent="Generating..."; }
  try{ const last7=getLast7Data(); const reportText=await AI.generateWeeklyReport(profile, last7); const el=$("#weeklyReport"); if(el) el.innerHTML=`<div class="ai-text">${esc(reportText)}</div>`; renderLast7(); }
  catch(e){ toast(e.message,true) } finally{ if(btn){ btn.disabled=false; btn.textContent="Generate This Week's Report" } }
}
function renderHistory(){
  if(!records.body.length) return;
  const sorted=[...records.body].sort((a,b)=>new Date(a.logged_at)-new Date(b.logged_at));
  const weights=sorted.map(b=>b.weight_kg); const labels=sorted.map(b=>dayStr(b.logged_at).slice(5));
  drawWeightChart("weightChart", weights, labels, profile.target_weight_kg);
  if($("#allLogs")){
    $("#allLogs").innerHTML=[...records.meals,...records.workoutSessions,...records.body].sort((a,b)=>new Date(b.logged_at)-new Date(a.logged_at)).slice(0,40).map(x=>{
      const name=x.meal_name||x.session_name||`Weight ${x.weight_kg}kg`;
      return `<div class="row"><div><strong>${esc(name)}</strong><small>${new Date(x.logged_at).toLocaleString()}</small></div></div>`;
    }).join("") || '<div class="empty">No logs</div>';
  }
}
function buildProfileForm(){
  const f=$("#profileForm"); if(!profile ||!f) return;
  f.innerHTML=`
    <label>Full name<input name="full_name" value="${esc(profile.full_name)}" required></label>
    <label>DOB<input name="date_of_birth" type="date" value="${profile.date_of_birth||''}" required></label>
    <label>Height cm<input name="height_cm" type="number" step="0.1" value="${profile.height_cm}" required></label>
    <label>Target weight<input name="target_weight_kg" type="number" step="0.1" value="${profile.target_weight_kg}" required></label>
    <label>Calories target<input name="target_calories" type="number" value="${profile.target_calories}" required></label>
    <label>Protein target<input name="target_protein_g" type="number" value="${profile.target_protein_g}" required></label>
    <label>Steps target<input name="target_steps" type="number" value="${profile.target_steps||10000}"></label>
    <label>Sleep target h<input name="target_sleep_hours" type="number" step="0.1" value="${profile.target_sleep_hours||7.5}"></label>
    <button class="btn primary full" type="submit">Save profile</button>
  `;
  f.onsubmit=async e=>{
    e.preventDefault(); const fd=new FormData(f);
    const row={full_name:fd.get("full_name"), date_of_birth:fd.get("date_of_birth"), height_cm:+fd.get("height_cm"), target_weight_kg:+fd.get("target_weight_kg"), target_calories:+fd.get("target_calories"), target_protein_g:+fd.get("target_protein_g"), target_steps:+fd.get("target_steps")||10000, target_sleep_hours:+fd.get("target_sleep_hours")||7.5};
    const {data,error}=await db.from("profiles").update(row).eq("id",user.id).select().single();
    if(error) return toast(error.message,true); profile=data; toast("Profile updated"); render();
  };
}
function exportJSON(){ const blob=new Blob([JSON.stringify({profile, records},null,2)],{type:"application/json"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`fitness-v7.4-export-${todayStr()}.json`; a.click(); }
$("#deleteAccountData") && ($("#deleteAccountData").onclick=async()=>{
  if(!confirm("Delete all health records?")) return;
  for(const t of ["meal_logs","activity_logs","body_logs","workout_sessions","water_logs","sleep_logs","steps_logs","heart_rate_logs"]){ await db.from(t).delete().eq("user_id",user.id); }
  await loadRecords(); render(); toast("Deleted");
});
window.handleGarminImport = async(fileOverride)=>{
  const file=fileOverride || $("#garminFile")?.files[0]; if(!file) return toast("Select file",true);
  if(file.name.toLowerCase().endsWith('.fit')) return handleFitImport(file);
  if(file.name.toLowerCase().endsWith('.gpx')) return handleGpxImport(file);
  $("#garminStatus").textContent="Parsing Garmin...";
  try{
    const data=await Integrations.importGarmin(file);
    let total=data.activities?.length||0;
    if(data.activities){ for(let a of data.activities){ await db.from('activity_logs').insert({user_id:user.id, activity_name:a.activity_name, duration_minutes:a.duration_minutes||0, distance_km:a.distance_km||0, calories_burned:a.calories_burned||0, source:'Garmin', logged_at:new Date(a.logged_at).toISOString()}); } }
    $("#garminStatus").textContent=`✅ Imported ${total} records`; await loadRecords(); render(); toast(`Garmin imported ${total}`);
  }catch(e){ $("#garminStatus").textContent="❌ "+e.message; toast(e.message,true); }
};
window.handleStravaImport = async(fileOverride)=>{
  const file=fileOverride || $("#stravaFile")?.files[0]; if(!file) return toast("Select file",true);
  $("#stravaStatus").textContent="Parsing Strava...";
  try{
    const activities=await Integrations.importStrava(file);
    let inserted=0;
    for(let a of activities){ await db.from('activity_logs').insert({user_id:user.id, activity_name:a.activity_name, duration_minutes:a.duration_minutes||0, distance_km:a.distance_km||0, calories_burned:a.calories_burned||0, source:'Strava', logged_at: new Date(a.logged_at).toISOString()}); if(a.avg_hr) await db.from('heart_rate_logs').insert({user_id:user.id, bpm:a.avg_hr, avg_bpm:a.avg_hr, max_bpm:a.max_hr||null, source:'Strava', logged_at: new Date(a.logged_at).toISOString()}); inserted++; }
    $("#stravaStatus").textContent=`✅ Imported ${inserted} Strava`; await loadRecords(); render(); toast(`Strava imported`);
  }catch(e){ $("#stravaStatus").textContent="❌ "+e.message; toast(e.message,true); }
};
window.handleZeppImport = async(fileOverride)=>{
  const file=fileOverride || $("#zeppFile")?.files[0]; if(!file) return toast("Select file",true);
  $("#zeppStatus").textContent="Parsing Zepp...";
  try{
    const weights=await Integrations.importZepp(file);
    for(let w of weights){ await db.from('body_logs').insert({user_id:user.id, weight_kg:w.weight_kg, body_fat_percent:w.body_fat_percent, source:'Zepp', logged_at: new Date(w.logged_at).toISOString()}); }
    $("#zeppStatus").textContent=`✅ Imported ${weights.length} weight`; await loadRecords(); render(); toast("Zepp imported");
  }catch(e){ $("#zeppStatus").textContent="❌ "+e.message; toast(e.message,true); }
};
window.handleFitImport = async(fileOverride)=>{
  const file = fileOverride || document.getElementById("fitFile")?.files[0] || document.getElementById("quickImportFile")?.files[0];
  if(!file) return toast("Select .fit file",true);
  const statusEl = document.getElementById("fitStatus") || document.getElementById("quickImportStatus") || document.getElementById("garminStatus");
  if(statusEl) statusEl.textContent = "Parsing FIT FULL...";
  try{
    // NEW: Show full report immediately
    if(window.GpxReport){ try{ await GpxReport.loadFile(file); switchView('gpxReportView'); }catch(e){ console.warn("GPX report load failed",e); } }
    const activities = await Integrations.importFit(file);
    if(!activities.length) throw new Error("No sessions in FIT");
    let inserted=0;
    for(let a of activities){
      await db.from('activity_logs').insert({user_id:user.id, activity_name:a.activity_name, duration_minutes:a.duration_minutes, distance_km:a.distance_km, calories_burned:a.calories_burned||0, source:'FIT', logged_at: new Date(a.logged_at).toISOString()});
      if(a.avg_hr) await db.from('heart_rate_logs').insert({user_id:user.id, bpm:a.avg_hr, avg_bpm:a.avg_hr, max_bpm:a.max_hr||null, source:'FIT', logged_at: new Date(a.logged_at).toISOString()});
      inserted++;
    }
    await db.from('integration_imports').insert({user_id:user.id, provider:'fit', file_name:file.name, records_count:inserted});
    if(statusEl) statusEl.textContent = `✅ Imported ${inserted} FIT FULL: ${activities.map(a=>`${a.activity_name} ${a.distance_km}km ${a.duration_minutes}min`).join(' | ')} - Check GPX Report tab for full data`;
    await loadRecords(); render(); toast(`FIT FULL imported ${inserted} + full report shown`);
  }catch(e){ console.error(e); if(statusEl) statusEl.textContent = "❌ "+e.message; toast(e.message,true); }
};
window.handleQuickImport = async()=>{
  const file=document.getElementById("quickImportFile")?.files[0]; const type=document.getElementById("quickImportType")?.value; if(!file) return toast("Select file",true);
  const st=document.getElementById("quickImportStatus"); if(st) st.textContent="Importing...";
  try{
    const l=file.name.toLowerCase(); if(l.endsWith('.gpx') || type==='gpx') return handleGpxImport(file);
    if(l.endsWith('.fit') || type==='fit') return handleFitImport(file);
    if(type==='zepp') return handleZeppImport(file);
    if(type==='strava') return handleStravaImport(file);
    if(type==='garmin') return handleGarminImport(file);
  }catch(e){ if(st) st.textContent="❌ "+e.message; }
};
boot();
window.handleGpxImport = async(fileOverride)=>{
  const file=fileOverride||document.getElementById('gpxFile')?.files[0]||document.getElementById('fitFile')?.files[0]||document.getElementById('quickImportFile')?.files[0];
  if(!file) return toast('Select .gpx',true);
  const el=document.getElementById('gpxStatus')||document.getElementById('fitStatus')||document.getElementById('quickImportStatus');
  if(el) el.textContent=`Parsing GPX FULL ${file.name}...`;
  try{
    // NEW: Show full report immediately with ALL data
    if(window.GpxReport){ try{ await GpxReport.loadFile(file); switchView('gpxReportView'); }catch(e){ console.warn("GPX report load",e); } }
    const acts=await Integrations.importGpx(file);
    let ins=0;
    for(let a of acts){
      await db.from('activity_logs').insert({user_id:user.id, activity_name:a.activity_name, duration_minutes:a.duration_minutes, distance_km:a.distance_km, calories_burned:a.calories_burned||0, source:'GPX', logged_at:new Date(a.logged_at).toISOString()});
      if(a.avg_hr) await db.from('heart_rate_logs').insert({user_id:user.id, bpm:a.avg_hr, avg_bpm:a.avg_hr, max_bpm:a.max_hr||null, source:'GPX', logged_at:new Date(a.logged_at).toISOString()});
      ins++;
    }
    if(el) el.textContent=`✅ Imported ${ins} GPX FULL: ${acts.map(a=>`${a.activity_name} ${a.distance_km}km`).join(' | ')} - Full report in GPX Report tab`;
    await loadRecords(); render(); toast(`GPX FULL imported ${ins} + full report`);
  }catch(e){ if(el) el.textContent='❌ '+e.message; toast(e.message,true); }
};
