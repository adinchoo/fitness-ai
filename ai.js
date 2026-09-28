
// AI Engine v4 - Premium insights with Sleep/HR/Steps + Garmin/Strava context
const AI = {
  getConfig(){ try{return JSON.parse(localStorage.getItem('fitness-ai-supabase-config')||'{}')}catch{return{}} },

  async generateCheckin(profile, yesterday){
    const cfg = this.getConfig();
    if(cfg.groqKey){ try{ return await this.groqCheckin(profile, yesterday); }catch(e){ console.warn(e) } }
    if(cfg.geminiKey){ try{ return await this.geminiCheckin(profile, yesterday); }catch(e){ console.warn(e) } }
    return this.localCheckin(profile, yesterday);
  },

  localCheckin(profile, y){
    const name = profile.full_name?.split(' ')[0] || 'bro';
    const parts=[];
    parts.push(`Eh ${name}, semalam:`);
    if(y.workoutCount>0) parts.push(`💪 ${y.workoutCount} workout siap`);
    else parts.push(`😴 no workout`);
    if(y.steps) parts.push(`🚶 ${y.steps.toLocaleString()} steps (${y.distance?.toFixed(1)}km)`);
    if(y.sleepHours) parts.push(`😴 ${y.sleepHours.toFixed(1)}h sleep${y.sleepScore?` score ${y.sleepScore}`:''}`);
    if(y.avgHR) parts.push(`❤️ avg ${y.avgHR}bpm`);
    const calDiff = y.targetCal - y.calories;
    const proDiff = y.targetPro - y.protein;
    if(calDiff>150) parts.push(`calories short ${calDiff}kcal`);
    if(proDiff>15) parts.push(`protein short ${proDiff}g - tambah chicken breast`);
    if(y.calories>=y.targetCal*0.9 && y.protein>=y.targetPro*0.9) parts.push(`macros cukup, nice!`);
    if(!y.sleepHours || y.sleepHours<6) parts.push(`Tidur kena cukup malam ni, aim 7.5h`);
    if(y.recovery) parts.push(`Recovery ${y.recovery}% - ${y.readiness?.label}`);
    return parts.join(' • ') + '. Keep momentum hari ni!';
  },

  async groqCheckin(profile, y){
    const cfg = this.getConfig();
    const prompt = `You are a Malaysian fitness coach for ${profile.full_name}, goal ${profile.primary_goal}. Yesterday data: calories ${y.calories}/${y.targetCal}, protein ${y.protein}/${y.targetPro}g, steps ${y.steps||0}/${profile.target_steps||10000}, sleep ${y.sleepHours||0}h score ${y.sleepScore||0}, avg HR ${y.avgHR||0}, workouts ${y.workoutCount}, recovery ${y.recovery||50}%. Give short casual Malay-English check-in under 60 words with emoji. Like "Eh Aiman...". Encouraging.`;
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions",{
      method:"POST",
      headers:{"Authorization":"Bearer "+cfg.groqKey,"Content-Type":"application/json"},
      body: JSON.stringify({model:"llama-3.1-8b-instant", messages:[{role:"user", content:prompt}], max_tokens:150})
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || this.localCheckin(profile,y);
  },
  async geminiCheckin(profile, y){
    const cfg = this.getConfig();
    const prompt = `Malay-English fitness coach. ${profile.full_name} yesterday: ${y.calories}/${y.targetCal} kcal, ${y.protein}/${y.targetPro}g, steps ${y.steps||0}, sleep ${y.sleepHours||0}h, HR ${y.avgHR||0}. Under 60 words casual.`;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${cfg.geminiKey}`,{
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({contents:[{parts:[{text:prompt}]}]})
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || this.localCheckin(profile,y);
  },

  async generateWeeklyReport(profile, last7){
    const cfg = this.getConfig();
    if(cfg.groqKey){ try{ return await this.groqWeekly(profile, last7); }catch{} }
    if(cfg.geminiKey){ try{ return await this.geminiWeekly(profile, last7); }catch{} }
    return this.localWeekly(profile, last7);
  },
  localWeekly(profile, last7){
    const startW = last7.bodyLogs.length>=2? last7.bodyLogs[last7.bodyLogs.length-1].weight_kg : profile.starting_weight_kg || 0;
    const nowW = last7.bodyLogs.length? last7.bodyLogs[0].weight_kg : startW;
    const change = startW? (nowW - startW).toFixed(1) : "0";
    const avgCal = last7.meals.length? Math.round(last7.totalCal / 7) : 0;
    const avgPro = last7.meals.length? Math.round(last7.totalPro / 7) : 0;
    const avgSteps = last7.steps.length? Math.round(last7.steps.reduce((s,x)=>s+x.steps,0)/7):0;
    const avgSleep = last7.sleep.length? (last7.sleep.reduce((s,x)=>s+Number(x.duration_hours),0)/7).toFixed(1):0;
    const avgHR = last7.hr.length? Math.round(last7.hr.reduce((s,x)=>s+x.bpm,0)/last7.hr.length):0;
    return `WEEKLY REPORT - ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short'})}

Weight: ${change}kg change (${startW}kg → ${nowW}kg) | Trend ${last7.weightTrend?.toFixed(3)}/day
Food: Avg ${avgCal} kcal / ${avgPro}g protein vs target ${profile.target_calories}/${profile.target_protein_g}g
Activity: ${avgSteps.toLocaleString()} steps/day, ${last7.workoutCount} workouts, ${last7.totalDistance?.toFixed(1)||0}km
Sleep: ${avgSleep}h avg, Recovery ${last7.avgRecovery||50}%
Heart: ${avgHR? avgHR+'bpm avg, est VO2max '+Health.estimateVO2Max(profile.resting_hr||60, 30, profile.sex_at_birth):'no HR data'}

Focus next week: ${avgSleep<7?'Prioritize 7.5h sleep':''} ${avgPro<profile.target_protein_g*0.8?'Increase protein':''} ${avgSteps<8000?'Walk 10k daily':''}`;
  },
  async groqWeekly(profile, last7){
    const cfg = this.getConfig();
    const prompt = `Premium fitness coach. Profile ${JSON.stringify({name:profile.full_name, goal:profile.primary_goal, target:profile.target_weight_kg})}. Last7: ${JSON.stringify({cal:last7.totalCal, pro:last7.totalPro, workouts:last7.workoutCount, steps:last7.steps.reduce((s,x)=>s+x.steps,0), sleep:last7.sleep.length, avgHR:last7.hr[0]?.bpm, weightChange:last7.weightChange})}. Write report 5 sections: Weight, Nutrition, Activity & Steps, Sleep & Recovery, Heart & VO2max, What to Improve. Casual Malay-English. Max 250 words with emoji.`;
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions",{
      method:"POST",
      headers:{"Authorization":"Bearer "+cfg.groqKey,"Content-Type":"application/json"},
      body: JSON.stringify({model:"llama-3.1-8b-instant", messages:[{role:"user", content:prompt}], max_tokens:500})
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || this.localWeekly(profile, last7);
  },
  async geminiWeekly(profile, last7){
    const cfg = this.getConfig();
    const prompt = `Weekly fitness report Malay-English 5 sections Weight/Nutrition/Activity/Sleep/Heart. Data ${JSON.stringify({totalCal:last7.totalCal, workoutCount:last7.workoutCount, steps:last7.steps.length})}. Max 250 words.`;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${cfg.geminiKey}`,{
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({contents:[{parts:[{text:prompt}]}]})
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || this.localWeekly(profile, last7);
  },

  extractJson(text){
    if(!text) return null;
    try{ return JSON.parse(text); }catch{}
    let clean = text.replace(/```json/gi,'').replace(/```/g,'').trim();
    const matches = clean.match(/\{[\s\S]*\}/g);
    if(matches){
      for(let m of matches.reverse()){
        try{ return JSON.parse(m); }catch{ try{ return JSON.parse(m.replace(/'/g,'"')); }catch{} }
      }
    }
    return null;
  },

  async analyzeFoodPhoto(file){
    const cfg = this.getConfig();
    const hasGemini = !!cfg.geminiKey;
    if(!hasGemini && !cfg.groqKey) return {error: "Add Gemini key (AIza...) in Profile > Settings. Free at aistudio.google.com/app/apikey"};
    const base64 = await new Promise(res=>{
      const r = new FileReader();
      r.onload = ()=> res(r.result.split(',')[1]);
      r.readAsDataURL(file);
    });
    const mime = file.type || 'image/jpeg';
    const prompt = `Nutrition expert. Estimate dish name (Malaysian if possible), calories, protein_g, carbs_g, fat_g. Return ONLY JSON: {"name":"Dish Name","calories":123,"protein_g":12,"carbs_g":20,"fat_g":10}`;
    if(hasGemini){
      try{
        const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${cfg.geminiKey}`,{
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({
            contents:[{parts:[{text:prompt},{inline_data:{mime_type:mime, data:base64}}]}],
            generationConfig:{temperature:0.2, maxOutputTokens:300}
          })
        });
        const gemData = await gemRes.json();
        if(gemData.error) throw new Error(gemData.error.message);
        const text = gemData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const json = this.extractJson(text);
        if(json && json.calories) return json;
        throw new Error("No JSON: "+text);
      }catch(e){
        return {error: "Gemini failed: "+e.message+" - Try clearer photo"};
      }
    }
    return {error: "Use Gemini for photos - Groq vision deprecated"};
  }
};
