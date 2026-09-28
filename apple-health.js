
const AppleHealth = {
  parseAutoExportCSV(text){
    const lines = text.trim().split(/\r?\n/);
    if(lines.length<2) return [];
    const headers = lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/"/g,'').replace(/\s+/g,'_'));
    const rows=[];
    for(let i=1;i<lines.length;i++){
      const line=lines[i]; if(!line.trim()) continue;
      const vals = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(v=>v.replace(/^"|"$/g,'').trim());
      const obj={}; headers.forEach((h,idx)=> obj[h]=vals[idx]||''); rows.push(obj);
    }
    return rows;
  },
  mapSteps(rows){ return rows.map(r=>({ steps: parseInt(r.steps||0), distance_km: parseFloat(r.distance||0), calories_burned: parseInt(r.active_energy||0)||0, logged_at: r.date||new Date().toISOString(), source:'Apple Health Auto'})).filter(x=>x.steps>0); },
  mapHeartRate(rows){ return rows.map(r=>({ bpm: parseInt(r.heartrate||r.value||0), logged_at: r.date||new Date().toISOString(), source:'Apple Health Auto'})).filter(x=>x.bpm>20); },
  mapSleep(rows){
    const perDay={}; rows.forEach(r=>{ const day=(r.startdate||r.date||'').slice(0,10); if(!day) return; if(!perDay[day]) perDay[day]={duration:0}; perDay[day].duration+=parseFloat(r.hours||0); });
    return Object.entries(perDay).map(([day,d])=>({ duration_hours:d.duration, quality: d.duration>=7?4:3, score: d.duration>=7.5?85:70, logged_at:new Date(day).toISOString(), source:'Apple Health Auto'}));
  },
  mapWeight(rows){ return rows.map(r=>({ weight_kg: parseFloat(r.weight||r.value||0), logged_at: r.date||new Date().toISOString(), source:'Apple Health Auto'})).filter(x=>x.weight_kg>20); },
};
