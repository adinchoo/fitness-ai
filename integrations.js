
// integrations.js - Zero-cost Garmin / Strava / Zepp parser - no API keys needed
// Supports: Strava CSV export, Garmin Connect CSV/FIT JSON, Zepp Life weight CSV, Xiaomi Scale CSV
const Integrations = {
  parseCSV(text){
    const lines = text.trim().split(/\r?\n/);
    const headers = lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/"/g,''));
    return lines.slice(1).map(l=>{
      // handle quoted commas simple
      const vals = l.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || l.split(',');
      const obj={};
      headers.forEach((h,i)=>{ obj[h]= (vals[i]||'').replace(/^"|"$/g,'').trim(); });
      return obj;
    });
  },

  // STRAVA: expects export from https://www.strava.com/account/export or activities.csv
  async importStrava(file, userId){
    const text = await file.text();
    let activities=[];
    if(file.name.endsWith('.csv')){
      const rows = this.parseCSV(text);
      activities = rows.map(r=>({
        activity_name: r.name || r.activity || 'Strava Activity',
        duration_minutes: Math.round((parseFloat(r.elapsed_time||r.duration||0)/60)) || parseInt(r.moving_time||0)/60,
        distance_km: parseFloat(r.distance||0)/1000 || parseFloat(r.distance_km||0),
        calories_burned: parseInt(r.calories||0) || 0,
        avg_hr: parseInt(r.average_heartrate||r.avg_hr||0) || null,
        max_hr: parseInt(r.max_heartrate||0) || null,
        steps: parseInt(r.steps||0) || 0,
        logged_at: r.start_date || r.date || new Date().toISOString(),
        source: 'Strava'
      }));
    } else {
      // JSON or gpx not supported, treat as generic
      throw new Error('Use activities.csv from Strava bulk export');
    }
    return activities;
  },

  // GARMIN: CSV export from Garmin Connect (Activities, Daily Summary, Sleep)
  async importGarmin(file){
    const text = await file.text();
    const rows = this.parseCSV(text);
    const out = {activities:[], steps:[], heart:[], sleep:[], weight:[]};
    // auto-detect type by headers
    const headerStr = Object.keys(rows[0]||{}).join(' ');
    if(headerStr.includes('activity') || headerStr.includes('distance')){
      out.activities = rows.map(r=>({
        activity_name: r['activity type']||r.activity||r.name||'Garmin Activity',
        duration_minutes: Math.round(parseFloat(r.duration||r['elapsed time']||0)),
        distance_km: parseFloat(r.distance||0),
        calories_burned: parseInt(r.calories||0),
        avg_hr: parseInt(r['avg hr']||r.avg_hr||0)||null,
        logged_at: r.date||r['start time']||new Date().toISOString(),
        source:'Garmin'
      }));
    }
    if(headerStr.includes('steps') || headerStr.includes('step count')){
      out.steps = rows.map(r=>({
        steps: parseInt(r.steps||r['step count']||0),
        distance_km: parseFloat(r.distance||r['distance km']||0),
        calories_burned: parseInt(r.calories||0),
        logged_at: r.date||new Date().toISOString(),
        source:'Garmin'
      }));
    }
    if(headerStr.includes('sleep')){
      out.sleep = rows.map(r=>({
        duration_hours: parseFloat(r['sleep time']||r.duration||r.hours||0)/60 || parseFloat(r.hours||0),
        deep_minutes: parseInt(r.deep||0),
        light_minutes: parseInt(r.light||0),
        rem_minutes: parseInt(r.rem||0),
        awake_minutes: parseInt(r.awake||0),
        score: parseInt(r.score||0)||0,
        quality: Math.round((parseInt(r.score||0)/20))||3,
        logged_at: r.date||new Date().toISOString(),
        source:'Garmin'
      }));
    }
    return out;
  },

  // ZEPP LIFE / Xiaomi Scale: weight export CSV
  async importZepp(file){
    const text = await file.text();
    const rows = this.parseCSV(text);
    // Zepp format: Date, Weight, BMI, Body Fat, etc
    const weights = rows.map(r=>({
      weight_kg: parseFloat(r.weight||r['weight(kg)']||r['weight kg']||0),
      body_fat_percent: parseFloat(r['body fat']||r.fat||r['fat%']||0)||null,
      muscle_mass_kg: parseFloat(r.muscle||0)||null,
      bmi: parseFloat(r.bmi||0)||null,
      logged_at: r.date||r.time||r.datetime||new Date().toISOString(),
      source:'Zepp'
    })).filter(x=>x.weight_kg>20);
    return weights;
  },

  // Generic FIT file placeholder - we parse as JSON if user converted via https://www.fitfileviewer.com
  async importFitJson(file){
    const text = await file.text();
    const data = JSON.parse(text);
    // simplified
    return data;
  },

  // Save to Supabase
  async saveBatch(db, userId, type, items){
    if(!items.length) return 0;
    let table = {activity:'activity_logs', steps:'steps_logs', heart:'heart_rate_logs', sleep:'sleep_logs', weight:'body_logs'}[type];
    const payload = items.map(i=>({user_id:userId, ...i}));
    const {error, count} = await db.from(table).insert(payload);
    if(error) throw error;
    return items.length;
  }
};
