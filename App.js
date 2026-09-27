
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
  $("#saveGroqBtn").onclick=()=>{
    const c=config()||{}; c.groqKey=$("#groqKeyInput").value.trim(); localStorage.setItem(CONFIG_KEY, JSON.stringify(c)); toast("Groq key saved"); updateAIMode();
  };
  $("#groqKeyInput").value=config()?.groqKey||"";
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
  const c=config()||{};
  const hasGroq=!!c.groqKey;
  const hasGemini=!!c.geminiKey;
  $("#aiModePill").textContent=hasGroq&&hasGemini?"Groq+Gemini":hasGemini?"Gemini":hasGroq?"Groq LLM":"Free AI";
}

function totalsToday(){
  const m=records.meals.filter(x=>isToday(x.logged_at));
  const w=records.water.filter(x=>isToday(x.logged_at));
  const a=records.activities.filter(x=>isToday(x.logged_at));
  const ws=records.workoutSessions.filter(x=>isToday(x.logged_at));
  const sum=(arr,k)=>arr.reduce((s,x)=>s+(Number(x[k])||0),0);
  return {meals:m, water:w, activities:a, workoutSessions:ws, calories:sum(m,"calories"), protein:sum(m,"protein_g"), waterMl:sum(w,"amount_ml")};
}
function totalsYesterday(){
  const m=records.meals.filter(x=>isYesterday(x.logged_at));
  const a=records.activities.filter(x=>isYesterday(x.logged_at));
  const ws=records.workoutSessions.filter(x=>isYesterday(x.logged_at));
  const sum=(arr,k)=>arr.reduce((s,x)=>s+(Number(x[k])||0),0);
  return {meals:m, activities:a, workoutSessions:ws, workoutCount:ws.length, calories:sum(m,"calories"), protein:sum(m,"protein_g"), targetCal:profile.target_calories, targetPro:profile.target_protein_g};
}

async function render(){
  if(!profile) return;
  const t=totalsToday();
  $("#dateLabel").textContent=new Date().toLocaleDateString('en-MY',{weekday:'long', day:'numeric', month:'long'});
  $("#greeting").textContent=`Good day, ${profile.full_name.split(' ')[0]} 👋`;
  // weight
  const latest=records.body[0];
  const startW=profile.starting_weight_kg || (records.body.length? records.body[records.body.length-1].weight_kg : latest?.weight_kg);
  const curW=latest?.weight_kg || 0;
  const lost=startW && curW ? (startW - curW).toFixed(1) : 0;
  $("#weightValue").textContent=curW||"--";
  $("#weightSub").textContent=latest?dayStr(latest.logged_at):"";
  $("#lostValue").textContent=lost;
  $("#lostSub").textContent=startW?`from ${startW}kg`:"";
  $("#calValue").textContent=t.calories;
  $("#calTarget").textContent=`target ${profile.target_calories}`;
  $("#proValue").textContent=Math.round(t.protein);
  $("#proTarget").textContent=`target ${profile.target_protein_g}g`;
  // today's session
  $("#todaySession").innerHTML=t.workoutSessions.length? `${t.workoutSessions[0].session_name} • ${dayStr(t.workoutSessions[0].logged_at)}` : `No workout yet • <em style="color:var(--muted)">Plan: Push Day 6:30pm weights, 7:30pm treadmill</em>`;
  // today's logs
  $("#todayLogs").innerHTML=[...t.meals.map(x=>`<div class="row"><div><strong>${esc(x.meal_name)}</strong><small>${new Date(x.logged_at).toLocaleTimeString()}</small></div><span>${x.calories} kcal • ${x.protein_g}g</span></div>`), ...t.workoutSessions.map(s=>`<div class="row"><div><strong>${esc(s.session_name)}</strong><small>Workout</small></div><span>✓</span></div>`)].join("") || '<div class="empty">Nothing yet today. Log your first meal!</div>';
  // meal dialog KPI
  $("#mealKcal").textContent=`${t.calories}/${profile.target_calories}`;
  $("#mealPro").textContent=`${Math.round(t.protein)}g/${profile.target_protein_g}g`;

  // AI check-in
  const y=totalsYesterday();
  $("#yesterdayCheckin").textContent="Generating check-in...";
  const checkinText=await AI.generateCheckin(profile, y, null);
  $("#yesterdayCheckin").textContent=checkinText;

  renderWorkoutEditor();
  renderRecentWorkouts();
  renderMealOptions();
  renderPhotos();
  updateAIMode();
}

// MEAL LOGGING with S/M/L
function renderMealOptions(){
  const list=FOOD_DB[currentCategory]||[];
  $("#mealOptions").innerHTML=list.map((f,i)=>{
    if(f.sizes){
      const selected=selectedFoods.find(s=>s.base===f.name);
      const activeSize=selected?.size||"M";
      return `<div class="food-row ${selected?'selected':''}" data-idx="${i}">
        <div><strong>${esc(f.name)}</strong><small>${selected?`${selected.kcal} kcal • ${selected.protein}g protein`:'Choose size S/M/L'}</small></div>
        <div class="food-size">
          ${Object.keys(f.sizes).map(sz=>`<button type="button" class="size-btn ${activeSize===sz && selected?'active':''}" data-size="${sz}" data-idx="${i}">${sz}</button>`).join("")}
        </div>
      </div>`;
    } else {
      const isSel=selectedFoods.some(s=>s.base===f.name && !s.size);
      return `<div class="food-row ${isSel?'selected':''}" data-idx="${i}"><div><strong>${esc(f.name)}</strong><small>${f.kcal} kcal • ${f.protein||0}g protein</small></div><span>${isSel?'✓':'+'}</span></div>`;
    }
  }).join("");
  // attach
  $$('#mealOptions .food-row').forEach(row=>{
    row.onclick=(e)=>{
      if(e.target.classList.contains('size-btn')) return;
      const idx=+row.dataset.idx;
      const food=list[idx];
      if(food.sizes){
        // default M if no selection
        toggleFood(food, "M");
      } else {
        toggleFood(food, null);
      }
    };
  });
  $$('#mealOptions .size-btn').forEach(btn=>{
    btn.onclick=(e)=>{
      e.stopPropagation();
      const idx=+btn.dataset.idx;
      const size=btn.dataset.size;
      const food=list[idx];
      toggleFood(food, size);
    }
  });
  renderSelectedFoods();
}

function toggleFood(food, size){
  const base=food.name;
  if(food.sizes){
    const sz=size||"M";
    const data=food.sizes[sz];
    const existingIdx=selectedFoods.findIndex(f=>f.base===base);
    if(existingIdx>=0 && selectedFoods[existingIdx].size===sz){
      selectedFoods.splice(existingIdx,1);
    } else {
      const entry={base, name:`${base} (${sz})`, kcal:data.kcal, protein:data.protein||data.protein_g||0, carbs:data.carbs||0, fat:data.fat||0, category:currentCategory, size:sz};
      if(existingIdx>=0) selectedFoods[existingIdx]=entry; else selectedFoods.push(entry);
    }
  } else {
    const existingIdx=selectedFoods.findIndex(f=>f.base===base && !f.size);
    if(existingIdx>=0) selectedFoods.splice(existingIdx,1);
    else selectedFoods.push({base, name:base, kcal:food.kcal, protein:food.protein||0, carbs:food.carbs||0, fat:food.fat||0, category:currentCategory, size:null});
  }
  renderMealOptions();
}

function renderSelectedFoods(){
  const totalK=selectedFoods.reduce((s,f)=>s+f.kcal,0);
  const totalP=selectedFoods.reduce((s,f)=>s+f.protein,0);
  $("#mealSelected").innerHTML=selectedFoods.map((f,i)=>`<div class="row"><div><strong>${esc(f.name)}</strong><small>${f.kcal} kcal • ${f.protein}g</small></div><button type="button" class="link-btn" data-rem="${i}">Remove</button></div>`).join("");
  $("#logMealBtn").textContent=`Log ${selectedFoods.length} item(s) • ${totalK} kcal, ${totalP}g protein`;
  $$('#mealSelected [data-rem]').forEach(b=>b.onclick=()=>{ selectedFoods.splice(+b.dataset.rem,1); renderMealOptions(); });
}

$("#addCustomFood").onclick=()=>{
  const name=$("#customFoodName").value.trim();
  const kcal=+$("#customKcal").value || 0;
  const pro=+$("#customPro").value || 0;
  if(!name) return toast("Enter food name",true);
  selectedFoods.push({base:name, name, kcal:kcal||0, protein:pro||0, carbs:0, fat:0, category:"Custom", size:null});
  $("#customFoodName").value=""; $("#customKcal").value=""; $("#customPro").value="";
  renderMealOptions();
};

$("#mealForm").addEventListener("submit", async e=>{
  e.preventDefault();
  if(!selectedFoods.length) return toast("Select foods first",true);
  const btn=e.submitter; btn.disabled=true;
  try{
    const rows=selectedFoods.map(f=>({user_id:user.id, meal_name:f.name, meal_type:f.category, category:f.category, size:f.size, calories:f.kcal, protein_g:f.protein, carbs_g:f.carbs||0, fat_g:f.fat||0, logged_at:new Date().toISOString()}));
    const {data,error}=await db.from("meal_logs").insert(rows).select();
    if(error) throw error;
    records.meals.unshift(...data.reverse());
    selectedFoods=[]; renderMealOptions(); e.target.closest("dialog").close(); render(); toast(`Logged ${data.length} foods`);
  }catch(err){ toast(err.message,true) } finally{ btn.disabled=false }
});

// WORKOUT
function renderWorkoutEditor(){
  const tmpl=$("#workoutTemplateSelect").value || "Push Day";
  const exs=WORKOUT_TEMPLATES[tmpl]||[];
  $("#workoutEditor").innerHTML=exs.map((ex,i)=>`
    <div class="row" style="align-items:center">
      <div style="flex:1"><strong>${esc(ex.name)}</strong><small>Set ${ex.sets} x ${ex.reps} reps</small></div>
      <div style="display:flex;gap:6px;align-items:center">
        <label style="font-size:10px">kg<input data-ex="${i}" data-k="weight" type="number" value="${ex.weight}" style="width:64px"></label>
        <label style="font-size:10px">reps<input data-ex="${i}" data-k="reps" type="number" value="${ex.reps}" style="width:56px"></label>
        <label style="font-size:10px">sets<input data-ex="${i}" data-k="sets" type="number" value="${ex.sets}" style="width:48px"></label>
      </div>
    </div>
  `).join("");
}

async function saveWorkout(){
  const tmpl=$("#workoutTemplateSelect").value;
  const btn=$("#saveWorkoutBtn"); btn.disabled=true;
  try{
    const inputs=$$('#workoutEditor input');
    const exs=WORKOUT_TEMPLATES[tmpl].map((ex,i)=>{
      const w=inputs.find(inp=>+inp.dataset.ex===i && inp.dataset.k==="weight")?.value||0;
      const r=inputs.find(inp=>+inp.dataset.ex===i && inp.dataset.k==="reps")?.value||ex.reps;
      const s=inputs.find(inp=>+inp.dataset.ex===i && inp.dataset.k==="sets")?.value||ex.sets;
      return {name:ex.name, weight:+w, reps:+r, sets:+s};
    });
    const {data:session,error:e1}=await db.from("workout_sessions").insert({user_id:user.id, session_name:tmpl, logged_at:new Date().toISOString()}).select().single();
    if(e1) throw e1;
    const logs=exs.map(ex=>({session_id:session.id, user_id:user.id, exercise_name:ex.name, sets:ex.sets, reps:ex.reps, weight_kg:ex.weight}));
    const {error:e2}=await db.from("workout_exercise_logs").insert(logs);
    if(e2) throw e2;
    records.workoutSessions.unshift(session);
    renderRecentWorkouts(); toast("Workout saved"); switchView("homeView"); await loadRecords(); render();
  }catch(err){ toast(err.message,true) } finally{ btn.disabled=false }
}

function renderRecentWorkouts(){
  const el=$("#recentWorkouts");
  if(!records.workoutSessions.length){ el.innerHTML='<div class="empty">No workouts yet</div>'; return }
  el.innerHTML=records.workoutSessions.slice(0,5).map(s=>`<div class="row"><div><strong>${esc(s.session_name)}</strong><small>${new Date(s.logged_at).toLocaleString()}</small></div><span>✓</span></div>`).join("");
}

// BODY
$("#bodyForm").addEventListener("submit", async e=>{
  e.preventDefault();
  const fd=new FormData(e.currentTarget);
  const row={user_id:user.id, weight_kg:+fd.get("weight_kg"), logged_at:new Date(fd.get("logged_at")).toISOString()};
  const {data,error}=await db.from("body_logs").insert(row).select().single();
  if(error) return toast(error.message,true);
  records.body.unshift(data); e.currentTarget.reset(); e.currentTarget.closest("dialog").close(); render(); toast("Weight logged");
});
$("#workoutQuickForm").addEventListener("submit", async e=>{
  e.preventDefault();
  const fd=new FormData(e.currentTarget);
  const row={user_id:user.id, activity_name:fd.get("activity_name"), duration_minutes:+fd.get("duration_minutes"), calories_burned:+fd.get("calories_burned")||0, logged_at:new Date(fd.get("logged_at")).toISOString()};
  const {data,error}=await db.from("activity_logs").insert(row).select().single();
  if(error) return toast(error.message,true);
  records.activities.unshift(data); e.currentTarget.reset(); e.currentTarget.closest("dialog").close(); render(); toast("Activity saved");
});

// FOOD PHOTO AI
$("#foodPhotoInput").onchange = async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  $("#foodPhotoStatus").textContent = "🧠 AI analyzing food...";
  try{
    const result = await AI.analyzeFoodPhoto(file);
    if(result.error){ $("#foodPhotoStatus").textContent = result.error; toast(result.error,true); return; }
    $("#foodPhotoStatus").textContent = `Detected: ${result.name} ~ ${result.calories} kcal, ${result.protein_g}g protein`;
    selectedFoods.push({
      base: result.name,
      name: result.name + " (AI)",
      kcal: Math.round(result.calories),
      protein: Math.round(result.protein_g||0),
      carbs: Math.round(result.carbs_g||0),
      fat: Math.round(result.fat_g||0),
      category: "AI Scan",
      size: null
    });
    renderMealOptions();
    toast(`Added ${result.name}`);
  }catch(err){ $("#foodPhotoStatus").textContent = err.message; toast(err.message,true); }
  e.target.value = "";
};

// PHOTOS
async function handlePhotoUpload(file){
  if(!file) return;
  const type=$("#photoType").value||"Front";
  toast("Uploading...");
  try{
    const path=`${user.id}/${Date.now()}_${file.name}`;
    const {error:upErr}=await db.storage.from("progress-photos").upload(path, file);
    if(upErr) throw upErr;
    const {data:{publicUrl}} = db.storage.from("progress-photos").getPublicUrl(path);
    // For private bucket, getPublicUrl still works but needs auth; we store path as url for simplicity use path
    const {data,error}=await db.from("progress_photos").insert({user_id:user.id, photo_url:path, photo_type:type, logged_at:new Date().toISOString()}).select().single();
    if(error) throw error;
    records.photos.unshift(data); renderPhotos(); toast("Photo added");
  }catch(err){ console.error(err); toast(err.message,true) }
}
function renderPhotos(){
  const grid=$("#photoGrid");
  if(!records.photos.length){ grid.innerHTML='<div class="empty">No photos yet. Add front/back progress pics.</div>'; return }
  grid.innerHTML=records.photos.map(p=>{
    const {data:{publicUrl}} = db.storage.from("progress-photos").getPublicUrl(p.photo_url);
    // If bucket private, publicUrl will 403; try create signed url fallback - for now use publicUrl
    return `<div class="panel" style="padding:8px"><img src="${publicUrl}" alt="${p.photo_type}" loading="lazy" onerror="this.style.display='none'"><div style="display:flex;justify-content:space-between;margin-top:6px"><small>${esc(p.photo_type)} • ${dayStr(p.logged_at)}</small></div></div>`;
  }).join("");
}

// REPORT
function getLast7Data(){
  const now=new Date();
  const last7=[];
  for(let i=0;i<7;i++){ const d=new Date(now); d.setDate(now.getDate()-i); last7.push(dayStr(d)); }
  const meals=records.meals.filter(m=>last7.includes(dayStr(m.logged_at)));
  const activities=records.activities.filter(a=>last7.includes(dayStr(a.logged_at)));
  const sessions=records.workoutSessions.filter(s=>last7.includes(dayStr(s.logged_at)));
  const body=records.body.filter(b=>last7.includes(dayStr(b.logged_at))).sort((a,b)=>new Date(b.logged_at)-new Date(a.logged_at));
  const water=records.water.filter(w=>last7.includes(dayStr(w.logged_at))).reduce((s,x)=>s+x.amount_ml,0);
  const totalCal=meals.reduce((s,x)=>s+x.calories,0);
  const totalPro=meals.reduce((s,x)=>s+Number(x.protein_g),0);
  const daysLogged=new Set(meals.map(m=>dayStr(m.logged_at))).size;
  const weightChange=body.length>=2? (body[0].weight_kg - body[body.length-1].weight_kg) : 0;
  const workoutDays=new Set(sessions.map(s=>dayStr(s.logged_at))).size;
  return {meals, activities, sessions, bodyLogs:body, water, totalCal, totalPro, daysLogged, weightChange, workoutCount:sessions.length, workoutDays};
}
function renderLast7(){
  const d=getLast7Data();
  $("#last7Summary").innerHTML=`
    <div class="row"><div>Meals logged</div><span>${d.meals.length} items</span></div>
    <div class="row"><div>Avg kcal</div><span>${d.meals.length?Math.round(d.totalCal/7):0} kcal</span></div>
    <div class="row"><div>Avg protein</div><span>${d.meals.length?Math.round(d.totalPro/7):0} g</span></div>
    <div class="row"><div>Workouts</div><span>${d.workoutCount} sessions</span></div>
    <div class="row"><div>Weight change</div><span>${d.weightChange.toFixed(1)} kg</span></div>
  `;
}
async function generateReport(){
  const btn=$("#genReportBtn"); btn.disabled=true; btn.textContent="Generating...";
  try{
    const last7=getLast7Data();
    const reportText=await AI.generateWeeklyReport(profile, last7);
    $("#weeklyReport").innerHTML=`<div class="ai-text">${esc(reportText)}</div>`;
  }catch(e){ toast(e.message,true) } finally{ btn.disabled=false; btn.textContent="Generate This Week's Report" }
}

// HISTORY
function renderHistory(){
  if(!records.body.length) return;
  const sorted=[...records.body].sort((a,b)=>new Date(a.logged_at)-new Date(b.logged_at));
  const labels=sorted.map(b=>dayStr(b.logged_at).slice(5));
  const weights=sorted.map(b=>b.weight_kg);
  // simple canvas chart
  const canvas=$("#weightChart");
  const ctx=canvas.getContext("2d");
  const w=canvas.width=canvas.clientWidth*2; const h=canvas.height=200*2;
  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle="#2a2a2a"; ctx.lineWidth=1;
  for(let i=0;i<4;i++){ const y=(h/4)*i; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke() }
  const min=Math.min(...weights)-1, max=Math.max(...weights)+1, range=max-min||1;
  ctx.strokeStyle="#c6ff00"; ctx.lineWidth=3; ctx.beginPath();
  weights.forEach((wt,i)=>{ const x=(i/(weights.length-1||1))* (w-40)+20; const y=h - ((wt-min)/range)*(h-40)-20; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y) });
  ctx.stroke();
  ctx.fillStyle="#c6ff00"; weights.forEach((wt,i)=>{ const x=(i/(weights.length-1||1))* (w-40)+20; const y=h - ((wt-min)/range)*(h-40)-20; ctx.beginPath(); ctx.arc(x,y,6,0,Math.PI*2); ctx.fill() });

  $("#hStart").textContent=(sorted[0]?.weight_kg||"--")+" kg";
  $("#hNow").textContent=(sorted[sorted.length-1]?.weight_kg||"--")+" kg";
  const days=(new Date(sorted[sorted.length-1].logged_at)-new Date(sorted[0].logged_at))/86400000||1;
  const rate=((sorted[sorted.length-1].weight_kg - sorted[0].weight_kg)/ (days/7)).toFixed(2);
  $("#hRate").textContent=rate+" kg/wk";

  // projection
  const cur=sorted[sorted.length-1].weight_kg;
  const avgLoss=parseFloat(rate);
  $("#projection").innerHTML=`
    <div><span>NEXT WEEK</span><strong>${(cur+avgLoss).toFixed(1)} kg</strong></div>
    <div><span>IN 2 WEEKS</span><strong>${(cur+avgLoss*2).toFixed(1)} kg</strong></div>
    <div><span>IN 4 WEEKS</span><strong>${(cur+avgLoss*4).toFixed(1)} kg</strong></div>
  `;
  // last 14
  const last14=sorted.slice(-14);
  $("#last14").innerHTML=last14.map(b=>`<div><span>${dayStr(b.logged_at).slice(5)}</span><strong>${b.weight_kg}</strong></div>`).join("");

  $("#allLogs").innerHTML=[...records.meals, ...records.workoutSessions, ...records.body].sort((a,b)=>new Date(b.logged_at)-new Date(a.logged_at)).slice(0,30).map(x=>{
    const name=x.meal_name||x.session_name||`Weight ${x.weight_kg}kg`;
    return `<div class="row"><div><strong>${esc(name)}</strong><small>${new Date(x.logged_at).toLocaleString()}</small></div><span>${x.calories?x.calories+' kcal':''}</span></div>`;
  }).join("") || '<div class="empty">No logs</div>';
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
