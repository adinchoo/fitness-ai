const Integrations = {
  parseCSV(text){
    const lines = text.trim().split(/\r?\n/);
    if(lines.length<2) return [];
    const headers = lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/"/g,'').replace(/\s+/g,'_'));
    return lines.slice(1).map(l=>{
      const vals = l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(v=>v.replace(/^"|"$/g,'').trim());
      const obj={}; headers.forEach((h,i)=>{ obj[h]=vals[i]||''; }); return obj;
    });
  },

  // ---- FIT PARSER (【entity-Garmin¦canonical_name=Garmin】/Wahoo/【entity-Zwift¦canonical_name=Zwift】) ----
  parseFit(buffer){
    const view = new DataView(buffer);
    const headerSize = view.getUint8(0);
    if(headerSize < 12) throw new Error("Invalid FIT file");
    const dataSize = view.getUint32(4, true);
    const magic = String.fromCharCode(view.getUint8(8),view.getUint8(9),view.getUint8(10),view.getUint8(11));
    if(magic!== ".FIT") throw new Error("Not a FIT file");
    let offset = headerSize;
    const end = headerSize + dataSize;
    const definitions = {};
    const sessions = [];
    const laps = [];
    const records = [];
    const baseSizes = {0:1,1:1,2:1,3:2,4:2,5:4,6:4,7:1,8:4,9:8,10:1,11:2,12:4,13:1,14:8,15:8,16:8};

    const getVal = (baseType, little, off)=>{
      switch(baseType){
        case 0: case 2: case 10: case 13: return view.getUint8(off);
        case 1: return view.getInt8(off);
        case 3: return view.getInt16(off, little);
        case 4: case 11: return view.getUint16(off, little);
        case 5: return view.getInt32(off, little);
        case 6: case 12: return view.getUint32(off, little);
        case 8: return view.getFloat32(off, little);
        case 9: return view.getFloat64(off, little);
        case 14: try{ return Number(view.getBigInt64(off, little)); }catch{return 0;}
        case 15: case 16: try{ return Number(view.getBigUint64(off, little)); }catch{return 0;}
        default: return view.getUint8(off);
      }
    };

    const sportMap = {0:"Generic",1:"Running",2:"Cycling",3:"Transition",4:"Fitness Equipment",5:"Swimming",6:"Basketball",7:"Cross Training",9:"Climbing",10:"Golf",11:"Hiking",15:"Skiing",16:"Snowboarding",17:"Rowing",18:"Mountaineering",21:"Canyoning",22:"Elliptical",25:"Flying",26:"Sailing",37:"Stand Up Paddleboarding",41:"Surfing"};

    while(offset < end){
      const header = view.getUint8(offset++);
      const isCompressed = (header & 0x80)!== 0;
      if(isCompressed){
        const localType = (header >> 5) & 0x03;
        const def = definitions[localType];
        if(!def) break;
        const msg={};
        for(const f of def.fields){
          const bt = f.baseType & 0x1F;
          const sz = baseSizes[bt]||1;
          if(bt===7){
            let s=""; for(let i=0;i<f.size;i++){ const c=view.getUint8(offset++); if(c&&c!==255) s+=String.fromCharCode(c); } msg[f.fieldDefNum]=s;
          }else{
            const cnt = Math.floor(f.size/sz);
            const arr=[]; for(let i=0;i<cnt;i++){ let v=getVal(bt, def.littleEndian, offset); offset+=sz;
              if((bt===2&&v===255)||(bt===4&&v===65535)||(bt===6&&v===4294967295)) v=null; arr.push(v);
            } msg[f.fieldDefNum]=cnt===1?arr[0]:arr;
          }
        }
        if(def.globalMessageNumber===18) sessions.push(msg);
        else if(def.globalMessageNumber===19) laps.push(msg);
        else if(def.globalMessageNumber===20) records.push(msg);
        continue;
      }
      const isDef = (header & 0x40)!== 0;
      const localType = header & 0x0F;
      if(isDef){
        const arch = view.getUint8(offset+1);
        const little = arch===0;
        const globalNum = view.getUint16(offset+2, little);
        const numFields = view.getUint8(offset+4);
        offset+=5;
        const fields=[];
        for(let i=0;i<numFields;i++){ fields.push({fieldDefNum:view.getUint8(offset++), size:view.getUint8(offset++), baseType:view.getUint8(offset++)}); }
        const devCount = view.getUint8(offset++); offset+=devCount*3;
        definitions[localType]={globalMessageNumber:globalNum, fields, littleEndian:little};
      }else{
        const def = definitions[localType];
        if(!def) break;
        const msg={};
        for(const f of def.fields){
          const bt = f.baseType & 0x1F;
          const sz = baseSizes[bt]||1;
          if(bt===7){
            let s=""; for(let i=0;i<f.size;i++){ const c=view.getUint8(offset++); if(c&&c!==255) s+=String.fromCharCode(c); } msg[f.fieldDefNum]=s;
          }else{
            const cnt = Math.floor(f.size/sz);
            const arr=[]; for(let i=0;i<cnt;i++){ let v=getVal(bt, def.littleEndian, offset); offset+=sz;
              if((bt===2&&v===255)||(bt===4&&v===65535)||(bt===6&&v===4294967295)) v=null; arr.push(v);
            } msg[f.fieldDefNum]=cnt===1?arr[0]:arr;
          }
        }
        if(def.globalMessageNumber===18) sessions.push(msg);
        else if(def.globalMessageNumber===19) laps.push(msg);
        else if(def.globalMessageNumber===20) records.push(msg);
      }
    }

    const GARMIN_EPOCH = 631065600;
    const toDate = (g)=>{ if(!g) return new Date(); return new Date((g+GARMIN_EPOCH)*1000); };

    const parsed = sessions.map(s=>{
      const sportId = s[5];
      const start = toDate(s[2] || s[253] || s[14] || null);
      const elapsed = s[7] || s[8] || 0; // ms
      const dist = s[9] || 0; // scale 100
      const cals = s[11] || 0;
      const avgHr = s[16] || null;
      const maxHr = s[17] || null;
      const avgSpeed = s[14] || 0;
      return {
        sport: sportMap[sportId] || "Workout",
        sportId, start, elapsedSec: elapsed/1000, distanceM: dist/100, distanceKm: (dist/100)/1000,
        calories: cals, avgHr, maxHr, avgSpeedMps: avgSpeed/1000
      };
    });
    return {sessions: parsed, laps, records};
  },

  async importStrava(file){
    const text = await file.text();
    const rows = this.parseCSV(text);
    return rows.map(r=>({
      activity_name: r.name || r.activity || 'Strava Activity',
      duration_minutes: Math.round((parseFloat(r.elapsed_time||r.moving_time||r.duration||0)/60)) || 0,
      distance_km: parseFloat(r.distance||0)/1000 || parseFloat(r.distance_km||0),
      calories_burned: parseInt(r.calories||0) || 0,
      avg_hr: parseInt(r.average_heartrate||r.avg_hr||0) || null,
      max_hr: parseInt(r.max_heartrate||0) || null,
      logged_at: r.start_date || r.start_date_local || r.date || new Date().toISOString(),
      source: 'Strava'
    }));
  },

  async importGarmin(file){
    if(file.name.toLowerCase().endsWith('.fit')) return this.importFit(file);
    const text = await file.text();
    const rows = this.parseCSV(text);
    const headerStr = Object.keys(rows[0]||{}).join(' ');
    const out = {activities:[], steps:[], sleep:[], weight:[]};
    if(headerStr.includes('activity') || headerStr.includes('distance')){
      out.activities = rows.map(r=>({ activity_name: r['activity_type']||r.activity||'【entity-Garmin¦canonical_name=Garmin】', duration_minutes: Math.round(parseFloat(r.duration||0)), distance_km: parseFloat(r.distance||0), calories_burned: parseInt(r.calories||0), logged_at: r.date||new Date().toISOString(), source:'【entity-Garmin¦canonical_name=Garmin】'}));
    }
    if(headerStr.includes('steps')) out.steps = rows.map(r=>({ steps: parseInt(r.steps||0), distance_km: parseFloat(r.distance||0), logged_at: r.date||new Date().toISOString(), source:'【entity-Garmin¦canonical_name=Garmin】'}));
    return out;
  },

  async importZepp(file){
    const text = await file.text();
    const rows = this.parseCSV(text);
    return rows.map(r=>({ weight_kg: parseFloat(r.weight||0), body_fat_percent: parseFloat(r.fat||0)||null, logged_at: r.date||new Date().toISOString(), source:'Zepp'})).filter(x=>x.weight_kg>20);
  },

  async importFit(file){
    const buffer = await file.arrayBuffer();
    const parsed = this.parseFit(buffer);
    let sessions = parsed.sessions;
    if(!sessions.length && parsed.laps.length){
      // fallback from laps
      const totalDist = parsed.laps.reduce((a,l)=>a+((l[9]||0)/100),0);
      const totalTime = parsed.laps.reduce((a,l)=>a+((l[7]||0)/1000),0);
      const totalCal = parsed.laps.reduce((a,l)=>a+(l[11]||0),0);
      sessions = [{sport:"Workout", start:new Date(), elapsedSec:totalTime, distanceM:totalDist, distanceKm:totalDist/1000, calories:totalCal, avgHr:null, maxHr:null}];
    }
    return sessions.map(s=>({
      activity_name: s.sport === "Generic"? "Workout" : s.sport,
      duration_minutes: Math.round(s.elapsedSec/60) || 0,
      distance_km: Number(s.distanceKm.toFixed(3)),
      calories_burned: s.calories || 0,
      avg_hr: s.avgHr || null,
      max_hr: s.maxHr || null,
      avg_speed: s.avgSpeedMps || 0,
      logged_at: s.start.toISOString(),
      source: 'FIT'
    }));
  },

  async saveBatch(db, userId, type, items){
    if(!items.length) return 0;
    let table = {activity:'activity_logs', steps:'steps_logs', heart:'heart_rate_logs', sleep:'sleep_logs', weight:'body_logs'}[type];
    const payload = items.map(i=>({user_id:userId,...i}));
    const {error} = await db.from(table).insert(payload);
    if(error) throw error;
    return items.length;
  }
};