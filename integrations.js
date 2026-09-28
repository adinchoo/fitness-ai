
const Integrations = {
  parseCSV(text){
    const lines = text.trim().split(/\r?\n/);
    const headers = lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/"/g,''));
    return lines.slice(1).map(l=>{
      const vals = l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(v=>v.replace(/^"|"$/g,'').trim());
      const obj={}; headers.forEach((h,i)=>{ obj[h]=vals[i]||''; }); return obj;
    });
  },
  async importStrava(file){
    const text = await file.text();
    const rows = this.parseCSV(text);
    return rows.map(r=>({
      activity_name: r.name || r.activity || 'Strava Activity',
      duration_minutes: Math.round((parseFloat(r.elapsed_time||r.duration||0)/60)) || 0,
      distance_km: parseFloat(r.distance||0)/1000 || parseFloat(r.distance_km||0),
      calories_burned: parseInt(r.calories||0) || 0,
      avg_hr: parseInt(r.average_heartrate||r.avg_hr||0) || null,
      logged_at: r.start_date || r.date || new Date().toISOString(),
      source: 'Strava'
    }));
  },
  async importGarmin(file){
    const text = await file.text();
    const rows = this.parseCSV(text);
    const headerStr = Object.keys(rows[0]||{}).join(' ');
    const out = {activities:[], steps:[], sleep:[], weight:[]};
    if(headerStr.includes('activity') || headerStr.includes('distance')){
      out.activities = rows.map(r=>({ activity_name: r['activity type']||r.activity||'Garmin', duration_minutes: Math.round(parseFloat(r.duration||0)), distance_km: parseFloat(r.distance||0), calories_burned: parseInt(r.calories||0), logged_at: r.date||new Date().toISOString(), source:'Garmin'}));
    }
    if(headerStr.includes('steps')) out.steps = rows.map(r=>({ steps: parseInt(r.steps||0), distance_km: parseFloat(r.distance||0), logged_at: r.date||new Date().toISOString(), source:'Garmin'}));
    return out;
  },
  async importZepp(file){
    const text = await file.text();
    const rows = this.parseCSV(text);
    return rows.map(r=>({ weight_kg: parseFloat(r.weight||0), body_fat_percent: parseFloat(r.fat||0)||null, logged_at: r.date||new Date().toISOString(), source:'Zepp'})).filter(x=>x.weight_kg>20);
  },
  async saveBatch(db, userId, type, items){
    if(!items.length) return 0;
    let table = {activity:'activity_logs', steps:'steps_logs', heart:'heart_rate_logs', sleep:'sleep_logs', weight:'body_logs'}[type];
    const payload = items.map(i=>({user_id:userId, ...i}));
    const {error} = await db.from(table).insert(payload);
    if(error) throw error;
    return items.length;
  }
};
