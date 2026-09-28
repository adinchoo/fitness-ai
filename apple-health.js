
// apple-health.js - Parser for iOS Auto Export app + Apple Health export
// Supports Auto Export CSV/JSON formats: Steps.csv, HeartRate.csv, Sleep.csv, Weight.csv, Workouts.csv
// Also supports Apple Health Export.xml converted to CSV
const AppleHealth = {
  // Auto Export CSV format: Date, Steps, etc
  parseAutoExportCSV(text, type){
    const lines = text.trim().split(/\r?\n/);
    if(lines.length<2) return [];
    const headers = lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/"/g,'').replace(/\s+/g,'_'));
    const rows=[];
    for(let i=1;i<lines.length;i++){
      const line=lines[i];
      if(!line.trim()) continue;
      // handle quoted commas
      const vals = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(v=>v.replace(/^"|"$/g,'').trim());
      const obj={};
      headers.forEach((h,idx)=> obj[h]=vals[idx]||'');
      rows.push(obj);
    }
    return rows;
  },

  // Map Auto Export Steps.csv -> steps_logs
  mapSteps(rows){
    return rows.map(r=>({
      steps: parseInt(r.steps || r.count || r.value || 0),
      distance_km: parseFloat(r.distance || r['distance_(km)'] || r['distance_km'] || r['walking+running_distance'] || 0),
      calories_burned: parseInt(r.active_energy || r.calories || 0) || 0,
      logged_at: r.date || r.startdate || r.start_date || r.creationdate || new Date().toISOString(),
      source: 'Apple Health Auto'
    })).filter(x=>x.steps>0 || x.distance_km>0);
  },

  mapHeartRate(rows){
    return rows.map(r=>({
      bpm: parseInt(r.heartrate || r['heart_rate'] || r.value || r.bpm || 0),
      resting_bpm: parseInt(r.resting_heartrate || r.resting || 0) || null,
      avg_bpm: parseInt(r.avg || r.average || r.value || 0),
      max_bpm: parseInt(r.max || 0) || null,
      logged_at: r.date || r.startdate || r.creationdate || new Date().toISOString(),
      source: 'Apple Health Auto'
    })).filter(x=>x.bpm>20);
  },

  mapSleep(rows){
    // Auto Export Sleep.csv: startDate, endDate, duration, type (AsleepCore, AsleepDeep, AsleepREM, InBed etc)
    // We aggregate per day
    const perDay={};
    rows.forEach(r=>{
      const day = (r.startdate || r.date || '').slice(0,10);
      if(!day) return;
      if(!perDay[day]) perDay[day]={duration:0, deep:0, rem:0, core:0, inbed:0, count:0};
      const hrs = parseFloat(r.hours || r.duration || r.value || 0);
      const type = (r.type || r.category || r.value_type || '').toLowerCase();
      perDay[day].duration += hrs;
      perDay[day].count++;
      if(type.includes('deep')) perDay[day].deep += hrs*60;
      else if(type.includes('rem')) perDay[day].rem += hrs*60;
      else if(type.includes('core') || type.includes('light')) perDay[day].core += hrs*60;
    });
    return Object.entries(perDay).map(([day, d])=>({
      duration_hours: d.duration,
      deep_minutes: Math.round(d.deep),
      rem_minutes: Math.round(d.rem),
      light_minutes: Math.round(d.core),
      awake_minutes: 0,
      quality: d.duration>=7 ? 4 : d.duration>=6 ? 3 : 2,
      score: d.duration>=7.5 ? 85 : d.duration>=6.5 ? 70 : 50,
      logged_at: new Date(day).toISOString(),
      source: 'Apple Health Auto'
    }));
  },

  mapWeight(rows){
    return rows.map(r=>({
      weight_kg: parseFloat(r.weight || r.value || 0),
      body_fat_percent: parseFloat(r.bodyfat || r.fat || 0) || null,
      bmi: parseFloat(r.bmi || 0) || null,
      logged_at: r.date || r.startdate || r.creationdate || new Date().toISOString(),
      source: 'Apple Health Auto'
    })).filter(x=>x.weight_kg>20 && x.weight_kg<400);
  },

  mapWorkouts(rows){
    return rows.map(r=>({
      activity_name: r.workouttype || r.type || r.activity || r.name || 'Apple Health Workout',
      duration_minutes: Math.round(parseFloat(r.duration || r.hours || 0)*60) || parseInt(r.duration_minutes || 0) || 0,
      distance_km: parseFloat(r.distance || 0),
      calories_burned: parseInt(r.active_energy || r.calories || 0) || 0,
      logged_at: r.startdate || r.date || new Date().toISOString(),
      source: 'Apple Health Auto'
    }));
  },

  // Main auto import from multiple files
  async importFiles(files, db, userId){
    let total=0;
    const report=[];
    for(let file of files){
      const text = await file.text();
      const name = file.name.toLowerCase();
      try{
        if(name.includes('step')){
          const rows = this.parseAutoExportCSV(text);
          const mapped = this.mapSteps(rows);
          if(mapped.length){ await Integrations.saveBatch(db, userId, 'steps', mapped); total+=mapped.length; report.push(`Steps: ${mapped.length}`); }
        } else if(name.includes('heart') || name.includes('bpm')){
          const rows = this.parseAutoExportCSV(text);
          const mapped = this.mapHeartRate(rows);
          if(mapped.length){ await Integrations.saveBatch(db, userId, 'heart', mapped); total+=mapped.length; report.push(`Heart: ${mapped.length}`); }
        } else if(name.includes('sleep')){
          const rows = this.parseAutoExportCSV(text);
          const mapped = this.mapSleep(rows);
          if(mapped.length){ await Integrations.saveBatch(db, userId, 'sleep', mapped); total+=mapped.length; report.push(`Sleep: ${mapped.length}`); }
        } else if(name.includes('weight') || name.includes('bodymass')){
          const rows = this.parseAutoExportCSV(text);
          const mapped = this.mapWeight(rows);
          if(mapped.length){ await Integrations.saveBatch(db, userId, 'weight', mapped); total+=mapped.length; report.push(`Weight: ${mapped.length}`); }
        } else if(name.includes('workout')){
          const rows = this.parseAutoExportCSV(text);
          const mapped = this.mapWorkouts(rows);
          if(mapped.length){ await Integrations.saveBatch(db, userId, 'activity', mapped); total+=mapped.length; report.push(`Workouts: ${mapped.length}`); }
        }
      }catch(e){ console.warn('Apple Health import failed for', name, e); report.push(`${name}: error ${e.message}`); }
    }
    return {total, report};
  },

  // Direct REST API sync for Shortcuts (uses your Supabase anon key)
  async syncViaRest(table, payload, supabaseUrl, anonKey){
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(payload)
    });
    if(!res.ok) throw new Error(`Supabase ${table} failed: ${res.status} ${await res.text()}`);
    return true;
  }
};
