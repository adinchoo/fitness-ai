window.handleGarminImport = async(fileOverride)=>{
  const file=fileOverride || $("#garminFile").files[0]; if(!file) return toast("Select file",true);
  if(file.name.toLowerCase().endsWith('.fit')) return handleFitImport(file);
  $("#garminStatus").textContent="Parsing Garmin...";
  try{
    const data=await Integrations.importGarmin(file);
    let total=0;
    if(data.activities.length) total+= await Integrations.saveBatch(db,user.id,'activity', data.activities);
    if(data.steps.length) total+= await Integrations.saveBatch(db,user.id,'steps', data.steps);
    if(data.sleep.length) total+= await Integrations.saveBatch(db,user.id,'sleep', data.sleep);
    await db.from('integration_imports').insert({user_id:user.id, provider:'garmin', file_name:file.name, records_count:total});
    $("#garminStatus").textContent=`✅ Imported ${total} records`;
    await loadRecords(); render(); toast(`【entity-Garmin¦canonical_name=Garmin】 imported ${total}`);
  }catch(e){ $("#garminStatus").textContent="❌ "+e.message; toast(e.message,true); }
};

window.handleStravaImport = async(fileOverride)=>{
  const file=fileOverride || $("#stravaFile").files[0]; if(!file) return toast("Select file",true);
  $("#stravaStatus").textContent="Parsing Strava...";
  try{
    const activities=await Integrations.importStrava(file);
    let inserted=0;
    for(let a of activities){
      if(a.distance_km || a.duration_minutes) await db.from('activity_logs').insert({user_id:user.id, activity_name:a.activity_name, duration_minutes:a.duration_minutes||0, distance_km:a.distance_km||0, calories_burned:a.calories_burned||0, source:'Strava', logged_at: new Date(a.logged_at).toISOString()});
      if(a.avg_hr) await db.from('heart_rate_logs').insert({user_id:user.id, bpm:a.avg_hr, avg_bpm:a.avg_hr, max_bpm:a.max_hr||null, source:'Strava', logged_at: new Date(a.logged_at).toISOString()});
      inserted++;
    }
    await db.from('integration_imports').insert({user_id:user.id, provider:'strava', file_name:file.name, records_count:inserted});
    $("#stravaStatus").textContent=`✅ Imported ${inserted} Strava activities`;
    await loadRecords(); render(); toast(`Strava imported`);
  }catch(e){ $("#stravaStatus").textContent="❌ "+e.message; toast(e.message,true); }
};

window.handleZeppImport = async(fileOverride)=>{
  const file=fileOverride || $("#zeppFile").files[0]; if(!file) return toast("Select file",true);
  $("#zeppStatus").textContent="Parsing Zepp...";
  try{
    const weights=await Integrations.importZepp(file);
    for(let w of weights){ await db.from('body_logs').insert({user_id:user.id, weight_kg:w.weight_kg, body_fat_percent:w.body_fat_percent, source:'Zepp', logged_at: new Date(w.logged_at).toISOString()}); }
    await db.from('integration_imports').insert({user_id:user.id, provider:'zepp', file_name:file.name, records_count:weights.length});
    $("#zeppStatus").textContent=`✅ Imported ${weights.length} weight records`;
    await loadRecords(); render(); toast("Zepp imported");
  }catch(e){ $("#zeppStatus").textContent="❌ "+e.message; toast(e.message,true); }
};

window.handleFitImport = async(fileOverride)=>{
  const file = fileOverride || document.getElementById("fitFile")?.files[0] || document.getElementById("quickImportFile")?.files[0];
  if(!file) return toast("Select.fit file",true);
  const statusEl = document.getElementById("fitStatus") || document.getElementById("quickImportStatus") || document.getElementById("garminStatus");
  if(statusEl) statusEl.textContent = "Parsing FIT...";
  try{
    const activities = await Integrations.importFit(file);
    if(!activities.length) throw new Error("No sessions found in FIT");
    let inserted=0;
    for(let a of activities){
      const {error: actErr} = await db.from('activity_logs').insert({user_id:user.id, activity_name:a.activity_name, duration_minutes:a.duration_minutes, distance_km:a.distance_km, calories_burned:a.calories_burned||0, source:'FIT', logged_at: new Date(a.logged_at).toISOString()});
      if(actErr) throw actErr;
      if(a.avg_hr){
        await db.from('heart_rate_logs').insert({user_id:user.id, bpm:a.avg_hr, avg_bpm:a.avg_hr, max_bpm:a.max_hr||null, source:'FIT', logged_at: new Date(a.logged_at).toISOString()});
      }
      inserted++;
    }
    await db.from('integration_imports').insert({user_id:user.id, provider:'fit', file_name:file.name, records_count:inserted});
    if(statusEl) statusEl.textContent = `✅ Imported ${inserted} FIT: ${activities.map(a=>`${a.activity_name} ${a.distance_km}km ${a.duration_minutes}min`).join(' | ')}`;
    await loadRecords(); render(); toast(`FIT imported ${inserted}`);
  }catch(e){
    console.error(e);
    if(statusEl) statusEl.textContent = "❌ "+e.message;
    toast(e.message,true);
  }
};

window.handleQuickImport = async()=>{
  const file=document.getElementById("quickImportFile").files[0]; const type=document.getElementById("quickImportType").value; if(!file) return toast("Select file",true);
  document.getElementById("quickImportStatus").textContent="Importing...";
  try{
    if(type==='fit' || file.name.toLowerCase().endsWith('.fit')) return handleFitImport(file);
    if(type==='zepp') return handleZeppImport(file);
    if(type==='strava') return handleStravaImport(file);
    if(type==='garmin') return handleGarminImport(file);
  }catch(e){ document.getElementById("quickImportStatus").textContent="❌ "+e.message; }
};

window.handleGarminImport = async(fileOverride)=>{
  const file=fileOverride || $("#garminFile").files[0]; if(!file) return toast("Select file",true);
  if(file.name.toLowerCase().endsWith('.fit')) return handleFitImport(file);
  $("#garminStatus").textContent="Parsing Garmin...";
  try{
    const data=await Integrations.importGarmin(file);
    let total=0;
    if(data.activities.length) total+= await Integrations.saveBatch(db,user.id,'activity', data.activities);
    if(data.steps.length) total+= await Integrations.saveBatch(db,user.id,'steps', data.steps);
    if(data.sleep.length) total+= await Integrations.saveBatch(db,user.id,'sleep', data.sleep);
    await db.from('integration_imports').insert({user_id:user.id, provider:'garmin', file_name:file.name, records_count:total});
    $("#garminStatus").textContent=`✅ Imported ${total} records`;
    await loadRecords(); render(); toast(`【entity-Garmin¦canonical_name=Garmin】 imported ${total}`);
  }catch(e){ $("#garminStatus").textContent="❌ "+e.message; toast(e.message,true); }
};

window.handleStravaImport = async(fileOverride)=>{
  const file=fileOverride || $("#stravaFile").files[0]; if(!file) return toast("Select file",true);
  $("#stravaStatus").textContent="Parsing Strava...";
  try{
    const activities=await Integrations.importStrava(file);
    let inserted=0;
    for(let a of activities){
      if(a.distance_km || a.duration_minutes) await db.from('activity_logs').insert({user_id:user.id, activity_name:a.activity_name, duration_minutes:a.duration_minutes||0, distance_km:a.distance_km||0, calories_burned:a.calories_burned||0, source:'Strava', logged_at: new Date(a.logged_at).toISOString()});
      if(a.avg_hr) await db.from('heart_rate_logs').insert({user_id:user.id, bpm:a.avg_hr, avg_bpm:a.avg_hr, max_bpm:a.max_hr||null, source:'Strava', logged_at: new Date(a.logged_at).toISOString()});
      inserted++;
    }
    await db.from('integration_imports').insert({user_id:user.id, provider:'strava', file_name:file.name, records_count:inserted});
    $("#stravaStatus").textContent=`✅ Imported ${inserted} Strava activities`;
    await loadRecords(); render(); toast(`Strava imported`);
  }catch(e){ $("#stravaStatus").textContent="❌ "+e.message; toast(e.message,true); }
};

window.handleZeppImport = async(fileOverride)=>{
  const file=fileOverride || $("#zeppFile").files[0]; if(!file) return toast("Select file",true);
  $("#zeppStatus").textContent="Parsing Zepp...";
  try{
    const weights=await Integrations.importZepp(file);
    for(let w of weights){ await db.from('body_logs').insert({user_id:user.id, weight_kg:w.weight_kg, body_fat_percent:w.body_fat_percent, source:'Zepp', logged_at: new Date(w.logged_at).toISOString()}); }
    await db.from('integration_imports').insert({user_id:user.id, provider:'zepp', file_name:file.name, records_count:weights.length});
    $("#zeppStatus").textContent=`✅ Imported ${weights.length} weight records`;
    await loadRecords(); render(); toast("Zepp imported");
  }catch(e){ $("#zeppStatus").textContent="❌ "+e.message; toast(e.message,true); }
};

window.handleFitImport = async(fileOverride)=>{
  const file = fileOverride || document.getElementById("fitFile")?.files[0] || document.getElementById("quickImportFile")?.files[0];
  if(!file) return toast("Select.fit file",true);
  const statusEl = document.getElementById("fitStatus") || document.getElementById("quickImportStatus") || document.getElementById("garminStatus");
  if(statusEl) statusEl.textContent = "Parsing FIT...";
  try{
    const activities = await Integrations.importFit(file);
    if(!activities.length) throw new Error("No sessions found in FIT");
    let inserted=0;
    for(let a of activities){
      const {error: actErr} = await db.from('activity_logs').insert({user_id:user.id, activity_name:a.activity_name, duration_minutes:a.duration_minutes, distance_km:a.distance_km, calories_burned:a.calories_burned||0, source:'FIT', logged_at: new Date(a.logged_at).toISOString()});
      if(actErr) throw actErr;
      if(a.avg_hr){
        await db.from('heart_rate_logs').insert({user_id:user.id, bpm:a.avg_hr, avg_bpm:a.avg_hr, max_bpm:a.max_hr||null, source:'FIT', logged_at: new Date(a.logged_at).toISOString()});
      }
      inserted++;
    }
    await db.from('integration_imports').insert({user_id:user.id, provider:'fit', file_name:file.name, records_count:inserted});
    if(statusEl) statusEl.textContent = `✅ Imported ${inserted} FIT: ${activities.map(a=>`${a.activity_name} ${a.distance_km}km ${a.duration_minutes}min`).join(' | ')}`;
    await loadRecords(); render(); toast(`FIT imported ${inserted}`);
  }catch(e){
    console.error(e);
    if(statusEl) statusEl.textContent = "❌ "+e.message;
    toast(e.message,true);
  }
};

window.handleQuickImport = async()=>{
  const file=document.getElementById("quickImportFile").files[0]; const type=document.getElementById("quickImportType").value; if(!file) return toast("Select file",true);
  document.getElementById("quickImportStatus").textContent="Importing...";
  try{
    if(type==='fit' || file.name.toLowerCase().endsWith('.fit')) return handleFitImport(file);
    if(type==='zepp') return handleZeppImport(file);
    if(type==='strava') return handleStravaImport(file);
    if(type==='garmin') return handleGarminImport(file);
  }catch(e){ document.getElementById("quickImportStatus").textContent="❌ "+e.message; }
};