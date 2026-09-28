const Integrations = {
  parseCSV(text){
    const lines=text.trim().split(/\r?\n/); if(lines.length<2) return [];
    const headers=lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/"/g,'').replace(/\s+/g,'_'));
    return lines.slice(1).map(l=>{ const vals=l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(v=>v.replace(/^"|"$/g,'').trim()); const o={}; headers.forEach((h,i)=>o[h]=vals[i]||''); return o; });
  },
  semicirclesToDeg(s){ return s * (180 / Math.pow(2,31)); },
  haversine(lat1,lon1,lat2,lon2){
    const R=6371000, toRad=d=>d*Math.PI/180;
    const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
    const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
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
  parseFit(buffer){
    const view=new DataView(buffer);
    if(buffer.byteLength<14) throw new Error("FIT too small");
    const headerSize=view.getUint8(0); const dataSize=view.getUint32(4,true);
    const magic=String.fromCharCode(view.getUint8(8),view.getUint8(9),view.getUint8(10),view.getUint8(11));
    if(magic!==".FIT") throw new Error("Not FIT - magic mismatch");
    let offset=headerSize, end=headerSize+dataSize;
    const definitions={}, sessionsRaw=[], lapsRaw=[], recordsRaw=[], fileIdRaw=[];
    const baseSizes={0:1,1:1,2:1,3:2,4:2,5:4,6:4,7:1,8:4,9:8,10:1,11:2,12:4,13:1,14:8,15:8,16:8};
    const getVal=(bt,little,off)=>{ try{
      switch(bt){case 0:case 2:case 10:case 13:return view.getUint8(off); case 1:return view.getInt8(off);
      case 3:return view.getInt16(off,little); case 4:case 11:return view.getUint16(off,little);
      case 5:return view.getInt32(off,little); case 6:case 12:return view.getUint32(off,little);
      case 8:return view.getFloat32(off,little); case 9:return view.getFloat64(off,little);
      case 14:return Number(view.getBigInt64(off,little)); case 15:case 16:return Number(view.getBigUint64(off,little));
      default:return view.getUint8(off);} }catch{return null} };
    const sportMap={0:"Generic",1:"Running",2:"Cycling",3:"Transition",4:"Fitness Eq",5:"Swimming",6:"Basketball",7:"Cross Training",9:"Climbing",10:"Golf",11:"Hiking",15:"Skiing",16:"Snowboard",17:"Rowing",18:"Mountaineering",22:"Elliptical",37:"SUP",41:"Surfing"};
    const GARMIN_EPOCH=631065600, toDate=g=>{ if(!g||g>0xFFFFFFFF) return null; return new Date((g+GARMIN_EPOCH)*1000); };
    let msgCount=0;
    while(offset<end && msgCount<800000){ msgCount++; const header=view.getUint8(offset++); const isCompressed=(header&0x80)!==0;
      if(isCompressed){ const lt=(header>>5)&0x03, def=definitions[lt]; if(!def) continue; const msg={};
        for(const f of def.fields){ const bt=f.baseType&0x1F, sz=baseSizes[bt]||1; if(offset+f.size>end) break;
          if(bt===7){ let s=""; for(let i=0;i<f.size;i++){ const c=view.getUint8(offset++); if(c&&c!==0xFF&&c!==0) s+=String.fromCharCode(c);} msg[f.fieldDefNum]=s; }
          else{ const cnt=Math.max(1,Math.floor(f.size/sz)); const arr=[]; for(let i=0;i<cnt;i++){ let v=getVal(bt,def.littleEndian,offset); offset+=sz; if((bt===2&&v===0xFF)||(bt===4&&v===0xFFFF)||(bt===6&&v===0xFFFFFFFF)) v=null; arr.push(v);} msg[f.fieldDefNum]=cnt===1?arr[0]:arr; } }
        for(const df of def.devFields||[]) offset+=df.size;
        if(def.globalMessageNumber===18) sessionsRaw.push(msg); else if(def.globalMessageNumber===19) lapsRaw.push(msg); else if(def.globalMessageNumber===20) recordsRaw.push(msg); else if(def.globalMessageNumber===0) fileIdRaw.push(msg);
        continue;
      }
      const isDef=(header&0x40)!==0, lt=header&0x0F;
      if(isDef){ if(offset+5>end) break; const arch=view.getUint8(offset+1), little=arch===0, globalNum=view.getUint16(offset+2,little), numFields=view.getUint8(offset+4); offset+=5;
        if(offset+numFields*3>end) break; const fields=[]; for(let i=0;i<numFields;i++) fields.push({fieldDefNum:view.getUint8(offset++), size:view.getUint8(offset++), baseType:view.getUint8(offset++)});
        if(offset>=end) break; const devCount=view.getUint8(offset++); const devFields=[]; if(offset+devCount*3>end) break; for(let i=0;i<devCount;i++){ devFields.push({num:view.getUint8(offset++), size:view.getUint8(offset++), devIdx:view.getUint8(offset++)}); }
        definitions[lt]={globalMessageNumber:globalNum, fields, devFields, littleEndian:little};
      }else{ const def=definitions[lt]; if(!def) break; const msg={};
        for(const f of def.fields){ const bt=f.baseType&0x1F; if(offset+f.size>end) break; const sz=baseSizes[bt]||1;
          if(bt===7){ let s=""; for(let i=0;i<f.size;i++){ const c=view.getUint8(offset++); if(c&&c!==0xFF&&c!==0) s+=String.fromCharCode(c);} msg[f.fieldDefNum]=s; }
          else{ const cnt=Math.max(1,Math.floor(f.size/sz)); const arr=[]; for(let i=0;i<cnt;i++){ let v=getVal(bt,def.littleEndian,offset); offset+=sz; if((bt===2&&v===0xFF)||(bt===4&&v===0xFFFF)||(bt===6&&v===0xFFFFFFFF)) v=null; arr.push(v);} msg[f.fieldDefNum]=cnt===1?arr[0]:arr; } }
        for(const df of def.devFields||[]) { if(offset+df.size>end) break; offset+=df.size; }
        if(def.globalMessageNumber===18) sessionsRaw.push(msg); else if(def.globalMessageNumber===19) lapsRaw.push(msg); else if(def.globalMessageNumber===20) recordsRaw.push(msg); else if(def.globalMessageNumber===0) fileIdRaw.push(msg);
      }
    }
    const recordsDetailed = recordsRaw.map(r=>{
      const ts = r[253]!=null? toDate(r[253]) : null;
      const latRaw = r[0], lonRaw = r[1];
      return {
        timestamp: ts, raw: r,
        lat: latRaw!=null? this.semicirclesToDeg(latRaw) : null,
        lon: lonRaw!=null? this.semicirclesToDeg(lonRaw) : null,
        altitude: r[2]!=null? r[2]/5-500 : (r[78]!=null? r[78]/5-500 : null),
        hr: r[3]?? null,
        cadence: r[4]?? null,
        distance: r[5]!=null? r[5]/100 : null,
        speed: r[6]!=null? r[6]/1000 : (r[73]!=null? r[73]/1000 : null),
        speed_kmh: r[6]!=null? (r[6]/1000)*3.6 : (r[73]!=null? (r[73]/1000)*3.6 : null),
        power: r[7]?? null,
        temperature: r[13]?? r[8]?? null,
        enhanced_speed: r[73]!=null? r[73]/1000 : null,
        enhanced_alt: r[78]!=null? r[78]/5-500 : null,
        calories: r[11]?? null,
        grade: r[9]!=null? r[9]/100 : null,
        resistance: r[10]?? null
      };
    }).filter(p=>p.timestamp||p.lat!=null).sort((a,b)=> (a.timestamp?.getTime()||0)-(b.timestamp?.getTime()||0));

    let sessions = sessionsRaw.map(s=>{
      const sportId=s[5], start=toDate(s[2]||s[253]||null), elapsed=s[7]||s[8]||0, dist=s[9]||0, cals=s[11]||0, avgHr=s[16]??s[20]??null, maxHr=s[17]??s[21]??null, avgSpeed=s[14]||0;
      return {sport:sportMap[sportId]||"Workout", sportId, start:start||new Date(), elapsedSec:elapsed/1000, distanceM:dist/100, distanceKm:(dist/100)/1000, calories:cals, avgHr, maxHr, avgSpeedMps:avgSpeed/1000, raw:s};
    }).filter(s=>s.elapsedSec>0||s.distanceKm>0||s.calories>0);

    if(sessions.length===0 && lapsRaw.length>0){
      const totalDist=lapsRaw.reduce((a,l)=>a+((l[9]||0)/100),0), totalTime=lapsRaw.reduce((a,l)=>a+((l[7]||l[8]||0)/1000),0), totalCal=lapsRaw.reduce((a,l)=>a+(l[11]||0),0);
      const hrs=lapsRaw.map(l=>l[16]).filter(v=>v!=null&&v>0), avgHr=hrs.length?Math.round(hrs.reduce((a,b)=>a+b,0)/hrs.length):null, maxHr=lapsRaw.reduce((m,l)=>Math.max(m,l[17]||0),0)||null;
      const start=toDate(lapsRaw[0][2]||lapsRaw[0][253]||null)||new Date();
      sessions=[{sport:"Workout", start, elapsedSec:totalTime, distanceM:totalDist, distanceKm:totalDist/1000, calories:totalCal, avgHr, maxHr}];
    }
    if(sessions.length===0 && recordsRaw.length>0){
      const recs=recordsRaw.filter(r=>r[253]!=null).sort((a,b)=>(a[253]||0)-(b[253]||0)); const use=recs.length?recs:recordsRaw;
      const first=use[0][253]?toDate(use[0][253]):new Date(), last=use[use.length-1][253]?toDate(use[use.length-1][253]):null;
      const elapsedSec=first&&last?(last-first)/1000:use.length; let lastDist=0; for(let i=use.length-1;i>=0;i--) if(use[i][5]!=null){ lastDist=use[i][5]; break; }
      const hrs=use.map(r=>r[3]).filter(v=>v>0&&v<250), avgHr=hrs.length?Math.round(hrs.reduce((a,b)=>a+b,0)/hrs.length):null;
      sessions=[{sport:"Workout", start:first||new Date(), elapsedSec:elapsedSec>0?elapsedSec:use.length, distanceM:lastDist/100, distanceKm:(lastDist/100)/1000, calories:0, avgHr, maxHr:hrs.length?Math.max(...hrs):null, isEstimated:true}];
    }
    return {sessions, recordsDetailed, lapsRaw, recordsRaw, fileIdRaw, debug:{defs:Object.keys(definitions).length, sessionsRaw:sessionsRaw.length, lapsRaw:lapsRaw.length, recordsRaw:recordsRaw.length}};
  },
  parseGpx(text){
    const parser=new DOMParser(), xml=parser.parseFromString(text,"application/xml");
    if(xml.getElementsByTagName("parsererror").length) throw new Error("Invalid GPX XML");
    const trks=xml.getElementsByTagName("trk"); const tracks=[];
    const getExt = (pt, keys)=>{
      const ext=pt.getElementsByTagName("extensions")[0]; if(!ext) return null;
      for(let k of keys){ let el=ext.getElementsByTagName(k)[0]; if(el) return el.textContent; }
      const all=ext.getElementsByTagName("*");
      for(let i=0;i<all.length;i++){ const tag=all[i].tagName.toLowerCase(); for(let k of keys) if(tag.includes(k.toLowerCase())) return all[i].textContent; }
      return null;
    };
    for(let ti=0; ti<trks.length; ti++){
      const trk=trks[ti], name=trk.getElementsByTagName("name")[0]?.textContent||"Track "+(ti+1), typeTxt=trk.getElementsByTagName("type")[0]?.textContent||name;
      const sport=this.inferSportFromText(typeTxt+" "+name);
      const segs=trk.getElementsByTagName("trkseg"); const points=[];
      for(let si=0; si<segs.length; si++){
        const pts=segs[si].getElementsByTagName("trkpt");
        for(let pi=0; pi<pts.length; pi++){
          const pt=pts[pi], lat=parseFloat(pt.getAttribute("lat")), lon=parseFloat(pt.getAttribute("lon"));
          const ele=parseFloat(pt.getElementsByTagName("ele")[0]?.textContent)||null;
          const timeStr=pt.getElementsByTagName("time")[0]?.textContent, time=timeStr?new Date(timeStr):null;
          const hrRaw=getExt(pt,["gpxtpx:hr","hr","ns3:hr"]); const cadRaw=getExt(pt,["gpxtpx:cad","cad"]); const powerRaw=getExt(pt,["power","watts","gpxtpx:power"]); const tempRaw=getExt(pt,["gpxtpx:atemp","atemp","ns3:atemp"]);
          const speedRaw=getExt(pt,["speed","gpxtpx:speed"]);
          points.push({lat,lon,ele,time,hr:hrRaw?parseInt(hrRaw):null,cadence:cadRaw?parseInt(cadRaw):null,power:powerRaw?parseInt(powerRaw):null,temp:tempRaw?parseFloat(tempRaw):null,speed:speedRaw?parseFloat(speedRaw)*3.6:null});
        }
      }
      if(points.length){ let cum=0; for(let i=0;i<points.length;i++){ if(i>0) cum+=this.haversine(points[i-1].lat,points[i-1].lon,points[i].lat,points[i].lon); points[i].cumDist=cum; points[i].distance=cum; }
        tracks.push({name, sport, points, type:typeTxt});
      }
    }
    // also try rte
    if(tracks.length===0){
      const rtes=xml.getElementsByTagName("rte");
      for(let ri=0;ri<rtes.length;ri++){
        const pts=rtes[ri].getElementsByTagName("rtept"); const points=[];
        for(let i=0;i<pts.length;i++){ const lat=parseFloat(pts[i].getAttribute("lat")), lon=parseFloat(pts[i].getAttribute("lon")); const ele=parseFloat(pts[i].getElementsByTagName("ele")[0]?.textContent)||null; points.push({lat,lon,ele,time:null,hr:null}); }
        if(points.length){ let cum=0; for(let i=0;i<points.length;i++){ if(i>0) cum+=this.haversine(points[i-1].lat,points[i-1].lon,points[i].lat,points[i].lon); points[i].cumDist=cum; points[i].distance=cum; } tracks.push({name:"Route", sport:"Workout", points, type:"Route"}); }
      }
    }
    const sessions=tracks.map(t=>{
      const first=t.points[0]?.time||new Date(), last=t.points[t.points.length-1]?.time||first;
      const elapsedSec=(last-first)/1000||t.points.length, totalDist=t.points[t.points.length-1]?.cumDist||0;
      const hrs=t.points.map(p=>p.hr).filter(Boolean), avgHr=hrs.length?Math.round(hrs.reduce((a,b)=>a+b,0)/hrs.length):null;
      let gain=0, loss=0; for(let i=1;i<t.points.length;i++){ const d=(t.points[i].ele||0)-(t.points[i-1].ele||0); if(d>0) gain+=d; else loss+=Math.abs(d); }
      return {sport:t.sport, name:t.name, start:first, elapsedSec, distanceM:totalDist, distanceKm:totalDist/1000, avgHr, maxHr:hrs.length?Math.max(...hrs):null, elevGain:gain, elevLoss:loss, pointCount:t.points.length};
    });
    return {sessions, tracks, debug:{trks:trks.length, points:tracks.reduce((a,t)=>a+t.points.length,0)}};
  },
  async importGpx(file){ const text=await file.text(); const parsed=this.parseGpx(text); if(!parsed.sessions.length) throw new Error(`No tracks GPX debug ${JSON.stringify(parsed.debug)}`); return parsed.sessions.map(s=>({activity_name:s.sport, duration_minutes:Math.round(s.elapsedSec/60)||0, distance_km:Number(s.distanceKm.toFixed(3)), calories_burned:Math.round(s.elapsedSec/60*9), avg_hr:s.avgHr||null, max_hr:s.maxHr||null, elev_gain:s.elevGain||0, logged_at:(s.start||new Date()).toISOString(), source:'GPX'})); },
  async importFit(file){ const buffer=await file.arrayBuffer(); const parsed=this.parseFit(buffer); if(!parsed.sessions.length) throw new Error(`No sessions FIT debug ${JSON.stringify(parsed.debug)}`); return parsed.sessions.map(s=>({activity_name:s.sport==="Generic"?"Workout":s.sport, duration_minutes:Math.round(s.elapsedSec/60)||0, distance_km:Number(s.distanceKm.toFixed(3)), calories_burned:s.calories||0, avg_hr:s.avgHr||null, max_hr:s.maxHr||null, logged_at:(s.start||new Date()).toISOString(), source:'FIT', isEstimated:!!s.isEstimated})); },
  async importStrava(file){ const text=await file.text(); const rows=this.parseCSV(text); return rows.map(r=>({activity_name:r.name||r.activity||'Strava', duration_minutes:Math.round((parseFloat(r.elapsed_time||r.moving_time||r.duration||0)/60))||0, distance_km:parseFloat(r.distance||0)/1000||parseFloat(r.distance_km||0)||0, calories_burned:parseInt(r.calories||0)||0, avg_hr:parseInt(r.average_heartrate||0)||null, max_hr:parseInt(r.max_heartrate||0)||null, logged_at:r.start_date||r.start_date_local||new Date().toISOString(), source:'Strava'})); },
  async importGarmin(file){ const n=file.name.toLowerCase(); if(n.endsWith('.fit')) return {activities:await this.importFit(file)}; if(n.endsWith('.gpx')) return {activities:await this.importGpx(file)}; const text=await file.text(); const rows=this.parseCSV(text); return {activities:rows.map(r=>({activity_name:r['activity_type']||r.activity||'Garmin', duration_minutes:Math.round(parseFloat(r.duration||0)), distance_km:parseFloat(r.distance||0), calories_burned:parseInt(r.calories||0), logged_at:r.date||new Date().toISOString(), source:'Garmin'}))}; },
  async importZepp(file){ const text=await file.text(); const rows=this.parseCSV(text); return rows.map(r=>({weight_kg:parseFloat(r.weight||0), body_fat_percent:parseFloat(r.fat||0)||null, logged_at:r.date||new Date().toISOString(), source:'Zepp'})).filter(x=>x.weight_kg>20); }
};
