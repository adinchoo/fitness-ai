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
  parseFit(buffer){
    const view = new DataView(buffer);
    if(buffer.byteLength < 14) throw new Error("File too small for FIT");
    const headerSize = view.getUint8(0);
    const dataSize = view.getUint32(4, true);
    const magic = String.fromCharCode(view.getUint8(8),view.getUint8(9),view.getUint8(10),view.getUint8(11));
    if(magic !== ".FIT") throw new Error("Not a FIT file");
    let offset = headerSize;
    const end = headerSize + dataSize;
    if(end > buffer.byteLength) throw new Error("FIT dataSize exceeds file");
    const definitions = {};
    const sessionsRaw = [];
    const lapsRaw = [];
    const recordsRaw = [];
    const fileIdRaw = [];
    const baseSizes = {0:1,1:1,2:1,3:2,4:2,5:4,6:4,7:1,8:4,9:8,10:1,11:2,12:4,13:1,14:8,15:8,16:8};
    const getVal = (bt, little, off)=>{
      try{
        switch(bt){
          case 0: case 2: case 10: case 13: return view.getUint8(off);
          case 1: return view.getInt8(off);
          case 3: return view.getInt16(off, little);
          case 4: case 11: return view.getUint16(off, little);
          case 5: return view.getInt32(off, little);
          case 6: case 12: return view.getUint32(off, little);
          case 8: return view.getFloat32(off, little);
          case 9: return view.getFloat64(off, little);
          case 14: return Number(view.getBigInt64(off, little));
          case 15: case 16: return Number(view.getBigUint64(off, little));
          default: return view.getUint8(off);
        }
      }catch{ return null; }
    };
    const sportMap = {0:"Generic",1:"Running",2:"Cycling",3:"Transition",4:"Fitness Equipment",5:"Swimming",6:"Basketball",7:"Cross Training",9:"Climbing",10:"Golf",11:"Hiking",15:"Skiing",16:"Snowboarding",17:"Rowing",18:"Mountaineering",22:"Elliptical",25:"Flying",37:"SUP",41:"Surfing"};
    let msgCount=0;
    while(offset < end && msgCount < 500000){
      msgCount++;
      const header = view.getUint8(offset++);
      const isCompressed = (header & 0x80) !== 0;
      if(isCompressed){
        const localType = (header >> 5) & 0x03;
        const def = definitions[localType];
        if(!def) continue;
        const msg={};
        for(const f of def.fields){
          const bt = f.baseType & 0x1F;
          const sz = baseSizes[bt]||1;
          if(offset+ f.size > end) break;
          if(bt===7){ let s=""; for(let i=0;i<f.size;i++){ const c=view.getUint8(offset++); if(c && c!==0xFF && c!==0) s+=String.fromCharCode(c); } msg[f.fieldDefNum]=s; }
          else{ const cnt=Math.max(1,Math.floor(f.size/sz)); const arr=[]; for(let i=0;i<cnt;i++){ let v=getVal(bt, def.littleEndian, offset); offset+=sz; if((bt===2&&v===0xFF)||(bt===4&&v===0xFFFF)||(bt===6&&v===0xFFFFFFFF)) v=null; arr.push(v);} msg[f.fieldDefNum]=cnt===1?arr[0]:arr; }
        }
        for(const df of (def.devFields||[])){ offset+=df.size; }
        if(def.globalMessageNumber===18) sessionsRaw.push(msg);
        else if(def.globalMessageNumber===19) lapsRaw.push(msg);
        else if(def.globalMessageNumber===20) recordsRaw.push(msg);
        else if(def.globalMessageNumber===0) fileIdRaw.push(msg);
        continue;
      }
      const isDef = (header & 0x40) !== 0;
      const localType = header & 0x0F;
      if(isDef){
        if(offset+5 > end) break;
        const arch = view.getUint8(offset+1);
        const little = arch===0;
        const globalNum = view.getUint16(offset+2, little);
        const numFields = view.getUint8(offset+4);
        offset+=5;
        if(offset + numFields*3 > end) break;
        const fields=[];
        for(let i=0;i<numFields;i++){ fields.push({fieldDefNum:view.getUint8(offset++), size:view.getUint8(offset++), baseType:view.getUint8(offset++)}); }
        if(offset >= end) break;
        const devCount = view.getUint8(offset++);
        const devFields=[];
        if(offset + devCount*3 > end) break;
        for(let i=0;i<devCount;i++){ const dNum=view.getUint8(offset++); const dSize=view.getUint8(offset++); const dIdx=view.getUint8(offset++); devFields.push({num:dNum, size:dSize, devIdx:dIdx}); }
        definitions[localType]={globalMessageNumber:globalNum, fields, devFields, littleEndian:little};
      }else{
        const def = definitions[localType];
        if(!def){ console.warn("FIT unknown local", localType); break; }
        const msg={};
        for(const f of def.fields){
          const bt = f.baseType & 0x1F;
          if(offset+ f.size > end) break;
          const sz = baseSizes[bt]||1;
          if(bt===7){ let s=""; for(let i=0;i<f.size;i++){ const c=view.getUint8(offset++); if(c && c!==0xFF && c!==0) s+=String.fromCharCode(c); } msg[f.fieldDefNum]=s; }
          else{ const cnt=Math.max(1,Math.floor(f.size/sz)); const arr=[]; for(let i=0;i<cnt;i++){ let v=getVal(bt, def.littleEndian, offset); offset+=sz; if((bt===2&&v===0xFF)||(bt===4&&v===0xFFFF)||(bt===6&&v===0xFFFFFFFF)) v=null; arr.push(v);} msg[f.fieldDefNum]=cnt===1?arr[0]:arr; }
        }
        for(const df of (def.devFields||[])){ if(offset+df.size > end) break; offset+=df.size; }
        if(def.globalMessageNumber===18) sessionsRaw.push(msg);
        else if(def.globalMessageNumber===19) lapsRaw.push(msg);
        else if(def.globalMessageNumber===20) recordsRaw.push(msg);
        else if(def.globalMessageNumber===0) fileIdRaw.push(msg);
      }
    }
    const GARMIN_EPOCH = 631065600;
    const toDate = (g)=>{ if(!g || g> 0xFFFFFFFF) return null; try{ return new Date((g+GARMIN_EPOCH)*1000); }catch{ return null; } };
    let sessions = sessionsRaw.map(s=>{
      const sportId = s[5];
      const start = toDate(s[2] || s[253] || null);
      const elapsed = s[7] || s[8] || 0;
      const dist = s[9] || 0;
      const cals = s[11] || 0;
      const avgHr = s[16] ?? s[20] ?? null;
      const maxHr = s[17] ?? s[21] ?? null;
      const avgSpeed = s[14] || 0;
      return { sport: sportMap[sportId] || "Workout", sportId, start: start || new Date(), elapsedSec: elapsed/1000, distanceM: dist/100, distanceKm: (dist/100)/1000, calories: cals, avgHr, maxHr, avgSpeedMps: avgSpeed/1000, raw:s };
    }).filter(s=> s.elapsedSec>0 || s.distanceKm>0 || s.calories>0);
    if(sessions.length===0 && lapsRaw.length>0){
      const totalDist = lapsRaw.reduce((a,l)=>a+((l[9]||0)/100),0);
      const totalTime = lapsRaw.reduce((a,l)=>a+((l[7]||l[8]||0)/1000),0);
      const totalCal = lapsRaw.reduce((a,l)=>a+(l[11]||0),0);
      const hrs = lapsRaw.map(l=>l[16]).filter(v=>v!=null&&v>0);
      const avgHr = hrs.length? Math.round(hrs.reduce((a,b)=>a+b,0)/hrs.length) : null;
      const maxHr = lapsRaw.reduce((m,l)=>Math.max(m, l[17]||0),0) || null;
      const start = toDate(lapsRaw[0][2] || lapsRaw[0][253] || null) || new Date();
      sessions = [{sport:"Workout", start, elapsedSec:totalTime, distanceM:totalDist, distanceKm:totalDist/1000, calories:totalCal, avgHr, maxHr}];
    }
    if(sessions.length===0 && recordsRaw.length>0){
      const recs = recordsRaw.filter(r=>r[253]!=null).sort((a,b)=>(a[253]||0)-(b[253]||0));
      const useRecs = recs.length>0? recs : recordsRaw;
      const firstTs = useRecs[0][253] ? toDate(useRecs[0][253]) : new Date();
      const lastTs = useRecs[useRecs.length-1][253] ? toDate(useRecs[useRecs.length-1][253]) : null;
      const elapsedSec = (firstTs && lastTs) ? (lastTs-firstTs)/1000 : useRecs.length;
      let lastDist = 0; for(let i=useRecs.length-1;i>=0;i--){ if(useRecs[i][5]!=null){ lastDist = useRecs[i][5]; break; } }
      const distM = lastDist/100;
      const hrs = useRecs.map(r=>r[3]).filter(v=>v!=null&&v>0&&v<250);
      const avgHr = hrs.length? Math.round(hrs.reduce((a,b)=>a+b,0)/hrs.length) : null;
      const maxHr = hrs.length? Math.max(...hrs) : null;
      sessions = [{sport:"Workout", start:firstTs||new Date(), elapsedSec: elapsedSec>0?elapsedSec:useRecs.length, distanceM:distM, distanceKm:distM/1000, calories:0, avgHr, maxHr, isEstimated:true}];
    }
    return {sessions, lapsRaw, recordsRaw, fileIdRaw, debug:{defs:Object.keys(definitions).length, sessionsRaw:sessionsRaw.length, lapsRaw:lapsRaw.length, recordsRaw:recordsRaw.length}};
  },
  haversine(lat1,lon1,lat2,lon2){
    const R=6371000;
    const toRad = d=>d*Math.PI/180;
    const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  },
  inferSportFromText(txt){
    const t=(txt||"").toLowerCase();
    if(t.includes("cycl")||t.includes("bike")||t.includes("bici")) return "Cycling";
    if(t.includes("run")||t.includes("jog")) return "Running";
    if(t.includes("hike")||t.includes("walk")) return "Hiking";
    if(t.includes("swim")) return "Swimming";
    if(t.includes("row")) return "Rowing";
    return "Workout";
  },
  parseGpx(text){
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "application/xml");
    if(xml.getElementsByTagName("parsererror").length>0) throw new Error("Invalid GPX XML");
    const trks = xml.getElementsByTagName("trk");
    const sessions=[];
    const getHrFromPt = (pt)=>{
      const ext = pt.getElementsByTagName("extensions")[0];
      if(!ext) return null;
      let el = ext.getElementsByTagName("gpxtpx:hr")[0] || ext.getElementsByTagName("hr")[0] || ext.getElementsByTagName("ns3:hr")[0];
      if(!el){
        const all = ext.getElementsByTagName("*");
        for(let i=0;i<all.length;i++){ if(all[i].tagName.toLowerCase().includes("hr")){ el=all[i]; break; } }
      }
      return el? parseInt(el.textContent) : null;
    };
    for(let ti=0; ti<trks.length; ti++){
      const trk = trks[ti];
      const name = trk.getElementsByTagName("name")[0]?.textContent || "GPX Track";
      const typeTxt = trk.getElementsByTagName("type")[0]?.textContent || name;
      const sport = this.inferSportFromText(typeTxt + " " + name);
      const segs = trk.getElementsByTagName("trkseg");
      let allPoints=[];
      for(let si=0; si<segs.length; si++){
        const pts = segs[si].getElementsByTagName("trkpt");
        for(let pi=0; pi<pts.length; pi++) allPoints.push(pts[pi]);
      }
      if(allPoints.length===0) continue;
      let totalDist=0, elevGain=0, hrs=[], maxHr=0, times=[];
      for(let i=0;i<allPoints.length;i++){
        const pt = allPoints[i];
        const lat = parseFloat(pt.getAttribute("lat"));
        const lon = parseFloat(pt.getAttribute("lon"));
        const timeStr = pt.getElementsByTagName("time")[0]?.textContent;
        const time = timeStr? new Date(timeStr) : null;
        const ele = parseFloat(pt.getElementsByTagName("ele")[0]?.textContent) || 0;
        const hr = getHrFromPt(pt);
        if(hr){ hrs.push(hr); if(hr>maxHr) maxHr=hr; }
        if(time) times.push(time);
        if(i>0){
          const prev = allPoints[i-1];
          const pLat = parseFloat(prev.getAttribute("lat"));
          const pLon = parseFloat(prev.getAttribute("lon"));
          if(!isNaN(lat)&&!isNaN(lon)&&!isNaN(pLat)&&!isNaN(pLon)){
            totalDist += this.haversine(pLat,pLon,lat,lon);
          }
          const pEle = parseFloat(prev.getElementsByTagName("ele")[0]?.textContent) || 0;
          if(ele>pEle) elevGain += (ele-pEle);
        }
      }
      const firstTime = times[0] || new Date();
      const lastTime = times[times.length-1] || new Date(firstTime.getTime()+ allPoints.length*1000);
      const elapsedSec = (lastTime-firstTime)/1000;
      const avgHr = hrs.length? Math.round(hrs.reduce((a,b)=>a+b,0)/hrs.length) : null;
      sessions.push({ sport, name, start:firstTime, elapsedSec: elapsedSec>0? elapsedSec : allPoints.length, distanceM: totalDist, distanceKm: totalDist/1000, calories: 0, avgHr, maxHr: maxHr||null, elevGain, pointCount: allPoints.length });
    }
    if(sessions.length===0){
      const rtes = xml.getElementsByTagName("rte");
      for(let ri=0; ri<rtes.length; ri++){
        const pts = rtes[ri].getElementsByTagName("rtept");
        if(pts.length===0) continue;
        let totalDist=0;
        for(let i=1;i<pts.length;i++){
          const lat1=parseFloat(pts[i-1].getAttribute("lat")), lon1=parseFloat(pts[i-1].getAttribute("lon"));
          const lat2=parseFloat(pts[i].getAttribute("lat")), lon2=parseFloat(pts[i].getAttribute("lon"));
          totalDist+= this.haversine(lat1,lon1,lat2,lon2);
        }
        sessions.push({sport:"Workout", name:"Route", start:new Date(), elapsedSec:0, distanceM:totalDist, distanceKm:totalDist/1000, calories:0, avgHr:null, maxHr:null, elevGain:0, pointCount:pts.length});
      }
    }
    return {sessions, debug:{trks:trks.length, points:sessions.reduce((a,s)=>a+(s.pointCount||0),0)}};
  },
  async importGpx(file){
    const text = await file.text();
    const parsed = this.parseGpx(text);
    if(!parsed.sessions.length) throw new Error(`No tracks in GPX - found ${parsed.debug.trks} trk(s). File may be empty.`);
    return parsed.sessions.map(s=>({
      activity_name: s.sport,
      duration_minutes: Math.round(s.elapsedSec/60) || 0,
      distance_km: Number(s.distanceKm.toFixed(3)),
      calories_burned: s.calories || Math.round(s.elapsedSec/60 * 9),
      avg_hr: s.avgHr || null,
      max_hr: s.maxHr || null,
      elev_gain: s.elevGain || 0,
      logged_at: (s.start||new Date()).toISOString(),
      source: 'GPX'
    }));
  },
  async importStrava(file){
    const text = await file.text();
    const rows = this.parseCSV(text);
    return rows.map(r=>({
      activity_name: r.name || r.activity || 'Strava Activity',
      duration_minutes: Math.round((parseFloat(r.elapsed_time||r.moving_time||r.duration||0)/60)) || 0,
      distance_km: parseFloat(r.distance||0)/1000 || parseFloat(r.distance_km||0) || 0,
      calories_burned: parseInt(r.calories||0) || 0,
      avg_hr: parseInt(r.average_heartrate||0) || null,
      max_hr: parseInt(r.max_heartrate||0) || null,
      logged_at: r.start_date || r.start_date_local || new Date().toISOString(),
      source: 'Strava'
    }));
  },
  async importGarmin(file){
    const name=file.name.toLowerCase();
    if(name.endsWith('.fit')) return {activities: await this.importFit(file)};
    if(name.endsWith('.gpx')) return {activities: await this.importGpx(file)};
    const text = await file.text();
    const rows = this.parseCSV(text);
    return {activities: rows.map(r=>({ activity_name: r['activity_type']||r.activity||'Garmin', duration_minutes: Math.round(parseFloat(r.duration||0)), distance_km: parseFloat(r.distance||0), calories_burned: parseInt(r.calories||0), logged_at: r.date||new Date().toISOString(), source:'Garmin'}))};
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
    if(!sessions || sessions.length===0){
      throw new Error(`No sessions in FIT - debug: ${parsed.debug.sessionsRaw} sessionsRaw, ${parsed.debug.lapsRaw} laps, ${parsed.debug.recordsRaw} records, ${parsed.debug.defs} defs. This file may be corrupted or is a settings file, not an activity. Try a different .fit from Garmin/Activities folder. GPX will work for any track.`);
    }
    return sessions.map(s=>({
      activity_name: s.sport === "Generic"? "Workout" : s.sport,
      duration_minutes: Math.round(s.elapsedSec/60) || 0,
      distance_km: Number(s.distanceKm.toFixed(3)),
      calories_burned: s.calories || 0,
      avg_hr: s.avgHr || null,
      max_hr: s.maxHr || null,
      logged_at: (s.start||new Date()).toISOString(),
      source: 'FIT',
      isEstimated: !!s.isEstimated
    }));
  }
};