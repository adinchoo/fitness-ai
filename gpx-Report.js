// GPX / FIT Deep Report v7.5 - Full Data Show + AI + Map + Charts + Loading
const GpxReport = {
  data:null, map:null, poly:null,
  async loadFile(file){
    const container = document.getElementById('gpxReportContainer');
    if(container){
      container.innerHTML = `<div class="ai-loading"><div class="spinner"></div><div><strong>Loading ${file.name}...</strong><br><small class="muted">Parsing ${file.name.endsWith('.fit')?'FIT binary':'GPX XML'} • ${(file.size/1024).toFixed(0)} KB</small></div></div>`;
    }
    const ext=file.name.toLowerCase().split('.').pop();
    let parsed, type;
    if(ext==='gpx'){ const text=await file.text(); parsed=Integrations.parseGpx(text); type='GPX'; }
    else if(ext==='fit'){ const buf=await file.arrayBuffer(); parsed=Integrations.parseFit(buf); type='FIT'; }
    else throw new Error('Only .gpx and .fit supported, got .'+ext);
    this.buildData(file.name,type,parsed);
    this.render();
    window._lastGpxReport=this.data;
  },
  buildData(fileName,type,parsed){
    let points=[], laps=parsed.lapsRaw||[], sessions=parsed.sessions||[];
    if(type==='GPX'){ points=parsed.tracks.flatMap(t=>t.points.map(p=>({...p, sport:t.sport}))); }
    else { points=parsed.recordsDetailed.map(r=>({lat:r.lat, lon:r.lon, ele:r.altitude, altitude:r.altitude, time:r.timestamp, timestamp:r.timestamp, hr:r.hr, cadence:r.cadence, speed:r.speed_kmh|| (r.speed? r.speed*3.6: null), speed_ms:r.speed, power:r.power, temp:r.temperature, distance:r.distance, cumDist:r.distance||0, raw:r.raw})); }
    if(type==='FIT'){
      let lastValidDist=0;
      for(let i=0;i<points.length;i++){
        if(points[i].distance!=null) { lastValidDist=points[i].distance; points[i].cumDist=lastValidDist; }
        else { points[i].cumDist=lastValidDist; }
      }
    } else {
      for(let p of points){ p.distance=p.cumDist; }
    }
    let totalDist=0, elevGain=0, elevLoss=0, minEle=Infinity, maxEle=-Infinity, speeds=[], hrs=[], cads=[], powers=[], temps=[];
    for(let i=0;i<points.length;i++){
      const p=points[i];
      const eleVal = p.ele!=null? p.ele : p.altitude;
      if(eleVal!=null && !isNaN(eleVal)){ minEle=Math.min(minEle,eleVal); maxEle=Math.max(maxEle,eleVal); if(i>0){ const prevEle = points[i-1].ele!=null? points[i-1].ele : points[i-1].altitude; if(prevEle!=null){ const d=eleVal-prevEle; if(d>0) elevGain+=d; else elevLoss+=Math.abs(d); } } }
      if(p.speed!=null && !isNaN(p.speed)) speeds.push(p.speed);
      if(p.hr!=null) hrs.push(p.hr);
      if(p.cadence!=null) cads.push(p.cadence);
      if(p.power!=null) powers.push(p.power);
      if(p.temp!=null) temps.push(p.temp);
    }
    if(points.length){
      if(type==='GPX') totalDist=points[points.length-1].cumDist||0;
      else totalDist=points.filter(p=>p.distance!=null).pop()?.distance||sessions[0]?.distanceM||0;
      if(totalDist<1 && sessions[0]?.distanceM) totalDist=sessions[0].distanceM;
    }
    const firstTime=points.find(p=>p.time)?.time||points.find(p=>p.timestamp)?.timestamp||sessions[0]?.start||new Date();
    const lastPointTime = [...points].reverse().find(p=>p.time||p.timestamp);
    const lastTime = (lastPointTime?.time||lastPointTime?.timestamp)||new Date(firstTime.getTime()+(sessions[0]?.elapsedSec||0)*1000);
    const totalTimeSec = Math.max(1, (lastTime-firstTime)/1000||sessions[0]?.elapsedSec||0);
    const avgSpeedKmh = totalTimeSec>0? (totalDist/1000)/(totalTimeSec/3600) : 0;
    const maxSpeedKmh = speeds.length?Math.max(...speeds):0;
    const splits=[]; let lastSplitDist=0, lastSplitTime=firstTime, splitHr=[], splitEleGain=0, lastEleForSplit=points[0]?.ele!=null? points[0].ele : points[0]?.altitude;
    for(let i=1;i<points.length;i++){
      const curDist=points[i].cumDist||points[i].distance||0;
      const curTime=points[i].time||points[i].timestamp||lastTime;
      if(points[i].hr) splitHr.push(points[i].hr);
      const curEle = points[i].ele!=null? points[i].ele : points[i].altitude;
      if(curEle!=null && lastEleForSplit!=null && curEle>lastEleForSplit) splitEleGain+=curEle-lastEleForSplit;
      lastEleForSplit=curEle!=null?curEle:lastEleForSplit;
      if(curDist-lastSplitDist>=1000 || i===points.length-1){
        const segTime=(curTime-lastSplitTime)/1000;
        splits.push({km:splits.length+1, dist:(curDist-lastSplitDist)/1000, durationSec:segTime>0?segTime:0, avgHr:splitHr.length?Math.round(splitHr.reduce((a,b)=>a+b,0)/splitHr.length):null, elevGain:splitEleGain});
        lastSplitDist=curDist; lastSplitTime=curTime; splitHr=[]; splitEleGain=0;
      }
    }
    this.data={fileName, type, sport:sessions[0]?.sport||points[0]?.sport||'Workout', points, laps, sessions, splits, stats:{totalDistKm:totalDist/1000, totalDistM:totalDist, totalTimeSec, movingTimeSec:totalTimeSec, elevGain, elevLoss, minEle:isFinite(minEle)?minEle:0, maxEle:isFinite(maxEle)?maxEle:0, avgSpeedKmh, maxSpeedKmh, avgHr:hrs.length?Math.round(hrs.reduce((a,b)=>a+b,0)/hrs.length):null, maxHr:hrs.length?Math.max(...hrs):null, avgCad:cads.length?Math.round(cads.reduce((a,b)=>a+b,0)/cads.length):null, maxCad:cads.length?Math.max(...cads):null, avgPower:powers.length?Math.round(powers.reduce((a,b)=>a+b,0)/powers.length):null, maxPower:powers.length?Math.max(...powers):null, avgTemp:temps.length? (temps.reduce((a,b)=>a+b,0)/temps.length).toFixed(1):null, pointCount:points.length, lapCount:laps.length}};
  },
  render(){
    const c=document.getElementById('gpxReportContainer'); if(!c||!this.data) return;
    const s=this.data.stats, d=this.data;
    c.innerHTML=`
      <div class="panel" style="border:2px solid #c6ff00">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <h3 style="margin:0">📂 ${d.fileName} • ${d.type} • ${d.sport}</h3>
          <small class="muted">${s.pointCount} points • ${s.lapCount} laps • ${s.totalDistKm.toFixed(3)} km</small>
        </div>
        <div class="stats-grid" style="margin-top:14px">
          <div class="stat dark small"><span>DISTANCE</span><strong>${s.totalDistKm.toFixed(2)}</strong><small>km / ${s.totalDistM.toFixed(0)} m</small></div>
          <div class="stat dark small"><span>DURATION</span><strong>${Math.floor(s.totalTimeSec/60)}:${String(Math.round(s.totalTimeSec%60)).padStart(2,'0')}</strong><small>${s.totalTimeSec.toFixed(0)}s total</small></div>
          <div class="stat small"><span>ELEV GAIN / LOSS</span><strong>+${Math.round(s.elevGain)}</strong><small>-${Math.round(s.elevLoss)}m (min ${Math.round(s.minEle)} max ${Math.round(s.maxEle)})</small></div>
          <div class="stat small"><span>SPEED AVG / MAX</span><strong>${s.avgSpeedKmh.toFixed(1)}</strong><small>km/h / max ${s.maxSpeedKmh.toFixed(1)}</small></div>
          <div class="stat small"><span>HR AVG / MAX</span><strong>${s.avgHr||'--'}</strong><small>bpm / max ${s.maxHr||'--'}</small></div>
          <div class="stat small"><span>POWER / CADENCE</span><strong>${s.avgPower||'--'}W</strong><small>max ${s.maxPower||'--'}W • cad ${s.avgCad||'--'}</small></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px">
          <button class="btn primary" id="gpxAiBtn">🤖 AI Analyze ALL Data</button>
          <button class="btn ghost" id="gpxExportBtn">⬇️ Export Full JSON</button>
        </div>
        <div id="gpxAiResult" class="ai-text" style="margin-top:12px;background:#0a1a2a;padding:14px;border-radius:10px;border:1px solid #1e324a;white-space:pre-wrap;min-height:60px">Tap AI Analyze to get coaching from Gemini...</div>
      </div>
      <div class="panel"><h3>🗺 Map - GPS Track</h3><div id="gpxMap" style="height:360px;border-radius:12px;background:#0a1a2a;border:1px solid #1e324a"></div><small class="muted">Green start, red finish. All ${s.pointCount} GPS points plotted.</small></div>
      <div class="panel"><h3>⛰ Elevation Profile vs Distance</h3><canvas id="eleChart" height="200"></canvas></div>
      <div class="panel"><h3>❤ Heart Rate & Speed vs Distance</h3><canvas id="hrSpeedChart" height="200"></canvas><div style="display:flex;gap:12px;margin-top:8px"><span style="color:#ff7a86">● HR bpm</span><span style="color:#58a9ff">● Speed km/h</span><span style="color:#c6ff00">● Power W</span></div></div>
      <div class="panel"><h3>🏁 Splits per 1KM - Auto</h3><div id="splitsTable"></div></div>
      <div class="panel"><h3>📋 All Data Points (first 500 of ${d.points.length})</h3><div style="max-height:400px;overflow:auto;border:1px solid #1e324a;border-radius:8px"><table id="pointsTable" style="width:100%;border-collapse:collapse;font-size:11px;font-family:monospace"></table></div><small class="muted">Export JSON for full ${d.points.length} points with lat/lon/ele/hr/cad/power/temp/time.</small></div>
    `;
    document.getElementById('gpxAiBtn').onclick=()=>this.runAi();
    document.getElementById('gpxExportBtn').onclick=()=>this.exportJson();
    setTimeout(()=>{ this.drawMap(); this.drawCharts(); this.drawTables(); }, 100);
  },
  drawMap(){
    const el=document.getElementById('gpxMap'); if(!el||!this.data) return;
    const pts=this.data.points.filter(p=>p.lat!=null&&p.lon!=null&&!isNaN(p.lat));
    if(!pts.length){ el.innerHTML='<div class="empty">No GPS coordinates in file (indoor trainer?)</div>'; return; }
    if(typeof L==='undefined'){ el.innerHTML='<div class="empty">Leaflet not loaded - offline map placeholder. Points: '+pts.length+'</div>'; return; }
    if(this.map){ this.map.remove(); this.map=null; }
    this.map=L.map(el).setView([pts[0].lat,pts[0].lon],13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM'}).addTo(this.map);
    const latlngs=pts.map(p=>[p.lat,p.lon]);
    this.poly=L.polyline(latlngs,{color:'#c6ff00',weight:4,opacity:0.9}).addTo(this.map);
    L.circleMarker(latlngs[0],{radius:8,color:'#5de8b6',fillColor:'#5de8b6',fillOpacity:1}).addTo(this.map).bindPopup('START<br>'+pts[0].lat.toFixed(5)+','+pts[0].lon.toFixed(5));
    L.circleMarker(latlngs[latlngs.length-1],{radius:8,color:'#ff7a86',fillColor:'#ff7a86',fillOpacity:1}).addTo(this.map).bindPopup('FINISH<br>'+pts[pts.length-1].lat.toFixed(5)+','+pts[pts.length-1].lon.toFixed(5));
    this.map.fitBounds(this.poly.getBounds(),{padding:[30,30]});
  },
  drawCharts(){
    const pts=this.data.points; if(!pts.length) return;
    const eleCanvas=document.getElementById('eleChart'), hrCanvas=document.getElementById('hrSpeedChart');
    if(!eleCanvas||!hrCanvas) return;
    const drawLine=(canvas, datasets)=>{
      const ctx=canvas.getContext('2d'); const dpr=window.devicePixelRatio||1; const rect=canvas.getBoundingClientRect(); canvas.width=rect.width*dpr; canvas.height=200*dpr; ctx.scale(dpr,dpr); const W=rect.width,H=200; ctx.clearRect(0,0,W,H);
      const allY=datasets.flatMap(ds=>ds.data.map(p=>p.y).filter(v=>v!=null&&!isNaN(v))); if(!allY.length){ ctx.fillStyle='#99aabd'; ctx.fillText('No data',20,30); return; }
      let minY=Math.min(...allY), maxY=Math.max(...allY), range=Math.max(maxY-minY,1);
      const allX=datasets.flatMap(ds=>ds.data.map(p=>p.x)); const maxX=Math.max(...allX,1);
      ctx.strokeStyle='#1e324a'; ctx.setLineDash([4,6]); for(let i=0;i<4;i++){ const y=20+(H-40)*(i/3); ctx.beginPath(); ctx.moveTo(20,y); ctx.lineTo(W-20,y); ctx.stroke(); } ctx.setLineDash([]);
      datasets.forEach(ds=>{
        ctx.strokeStyle=ds.color; ctx.lineWidth=2.2; ctx.beginPath();
        ds.data.forEach((pt,i)=>{ const x=20+(pt.x/maxX)*(W-40); const y=H-20-((pt.y-minY)/range)*(H-40); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); });
        ctx.stroke();
      });
      ctx.fillStyle='#99aabd'; ctx.font='10px monospace'; ctx.fillText(`min ${minY.toFixed(0)} max ${maxY.toFixed(0)}`, 24, 14);
    };
    const eleData=pts.map(p=>({x:p.cumDist||p.distance||0, y:p.ele!=null? p.ele : p.altitude})).filter(p=>p.y!=null);
    drawLine(eleCanvas,[{color:'#5de8b6', data:eleData}]);
    const hrData=pts.filter(p=>p.hr!=null).map(p=>({x:p.cumDist||0, y:p.hr}));
    const speedData=pts.filter(p=>p.speed!=null).map(p=>({x:p.cumDist||0, y:p.speed}));
    const powerData=pts.filter(p=>p.power!=null).map(p=>({x:p.cumDist||0, y:p.power}));
    drawLine(hrCanvas,[{color:'#ff7a86', data:hrData},{color:'#58a9ff', data:speedData},{color:'#c6ff00', data:powerData}]);
  },
  drawTables(){
    const splitsEl=document.getElementById('splitsTable'); if(splitsEl){
      splitsEl.innerHTML=`<div class="row" style="font-weight:800"><div>KM</div><span>Time</span><span>Avg HR</span><span>Elev</span><span>Pace</span></div>`+this.data.splits.map(s=>{
        const paceSec = s.dist>0? s.durationSec / s.dist : 0;
        const pace = `${Math.floor(paceSec/60)}:${String(Math.round(paceSec%60)).padStart(2,'0')}/km`;
        return `<div class="row"><div><strong>${s.km}</strong> (${s.dist.toFixed(2)}km)</div><span>${Math.floor(s.durationSec/60)}:${String(Math.round(s.durationSec%60)).padStart(2,'0')}</span><span>${s.avgHr||'--'}</span><span>+${Math.round(s.elevGain)}m</span><span>${pace}</span></div>`;
      }).join('') || '<div class="empty">No splits - file too short</div>';
    }
    const ptTable=document.getElementById('pointsTable'); if(ptTable){
      ptTable.innerHTML=`<tr style="position:sticky;top:0;background:#0a1a2a"><th>#</th><th>Dist km</th><th>Ele m</th><th>HR</th><th>Spd km/h</th><th>Pow W</th><th>Cad</th><th>Temp</th><th>Lat</th><th>Lon</th><th>Time</th></tr>`+this.data.points.slice(0,500).map((p,i)=>`<tr style="border-bottom:1px solid #1e324a"><td>${i}</td><td>${((p.cumDist||p.distance||0)/1000).toFixed(3)}</td><td>${p.ele!=null? Math.round(p.ele) : (p.altitude!=null? Math.round(p.altitude):'')}</td><td>${p.hr||''}</td><td>${p.speed!=null? p.speed.toFixed(1):''}</td><td>${p.power||''}</td><td>${p.cadence||''}</td><td>${p.temp||''}</td><td>${p.lat? p.lat.toFixed(5):''}</td><td>${p.lon? p.lon.toFixed(5):''}</td><td>${p.time? new Date(p.time).toLocaleTimeString():''}</td></tr>`).join('')+ (this.data.points.length>500?`<tr><td colspan=11 style="text-align:center;padding:8px">... ${this.data.points.length-500} more points hidden, export JSON for full data</td></tr>`:'');
    }
  },
  async runAi(){
    const el=document.getElementById('gpxAiResult'); if(!el) return;
    const btn=document.getElementById('gpxAiBtn');
    if(btn){ btn.disabled=true; btn.innerHTML='<div class="spinner" style="display:inline-block;width:14px;height:14px;border-width:2px;vertical-align:middle;margin-right:6px"></div> Analyzing...'; }
    el.innerHTML=`<div class="ai-loading"><div class="spinner"></div><div><strong>🤖 AI Analyzing ${this.data.stats.pointCount} points...</strong><br><small class="muted">Splits: ${this.data.splits.length} • Elev gain ${Math.round(this.data.stats.elevGain)}m • Using Puter Gemini • 5-10 sec</small></div></div>`;
    try{
      const txt=await AI.analyzeGpxFitReport(typeof profile!=='undefined'?profile:{full_name:'Athlete', primary_goal:'improve_fitness'}, this.data);
      el.textContent=txt;
    }catch(e){ el.innerHTML=`<span style="color:#ff7a86">❌ ${e.message}</span>`; console.error(e); }
    finally{
      if(btn){ btn.disabled=false; btn.innerHTML='🤖 AI Analyze ALL Data'; }
    }
  },
  exportJson(){
    const blob=new Blob([JSON.stringify(this.data,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`${this.data.fileName}-FULL-REPORT-${new Date().toISOString().slice(0,10)}.json`; a.click();
  }
};
