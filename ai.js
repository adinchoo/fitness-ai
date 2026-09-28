
// AI Engine v7 - PUTER ONLY - No Gemini API, No Groq API - 100% Free Hardcoded
// Uses ONLY puter.ai.chat via https://js.puter.com/v2/
// Models: google/gemini-2.5-flash-lite (text), google/gemini-2.5-flash (vision)
// Your example: puter.ai.chat("Classify...", {model: 'gemini-3.5-flash-lite'})

const AI = {
  isPuterReady(){ return typeof puter !== 'undefined' && puter.ai && puter.ai.chat; },

  async generateCheckin(profile, yesterday){
    if(this.isPuterReady()){
      try{ return await this.puterCheckin(profile, yesterday); }catch(e){ console.warn("Puter failed, using local", e); }
    }
    return this.localCheckin(profile, yesterday);
  },

  localCheckin(profile, y){
    const name = profile.full_name?.split(' ')[0] || 'there';
    const parts=[];
    parts.push(`Hey ${name}, here's yesterday:`);
    if(y.workoutCount>0) parts.push(`💪 Completed ${y.workoutCount} workout${y.workoutCount>1?'s':''}`);
    else parts.push(`No workout logged`);
    if(y.steps) parts.push(`🚶 ${y.steps.toLocaleString()} steps (${y.distance?.toFixed(1)} km)`);
    if(y.sleepHours) parts.push(`😴 ${y.sleepHours.toFixed(1)}h sleep${y.sleepScore?` (Score ${y.sleepScore})`:''}`);
    if(y.avgHR) parts.push(`❤️ Avg ${y.avgHR} bpm`);
    if(y.calories < y.targetCal - 150) parts.push(`You were ${y.targetCal - y.calories} kcal under target`);
    if(y.protein < y.targetPro - 15) parts.push(`Protein short by ${y.targetPro - y.protein}g`);
    if(y.recovery) parts.push(`Recovery ${y.recovery}% - ${y.readiness?.label}`);
    return parts.join(' • ') + '. Keep the momentum going!';
  },

  // PUTER ONLY - Hardcoded model from your example
  async puterCheckin(profile, y){
    const prompt = `You are an English fitness coach for ${profile.full_name}, goal ${profile.primary_goal}. Yesterday: calories ${y.calories}/${y.targetCal}, protein ${y.protein}/${y.targetPro}g, steps ${y.steps||0}/${profile.target_steps||10000}, sleep ${y.sleepHours||0}h score ${y.sleepScore||0}, avg HR ${y.avgHR||0}, workouts ${y.workoutCount}, recovery ${y.recovery||50}%. Write a short check-in under 60 words in 100% English with emoji. Encouraging.`;

    // YOUR EXAMPLE ADAPTED - hardcoded Puter, no API key
    const response = await puter.ai.chat(prompt, {
      model: 'google/gemini-2.5-flash-lite'
    });
    
    if(typeof response === 'string') return response;
    if(response.message?.content) return response.message.content;
    return response.toString();
  },

  async generateWeeklyReport(profile, last7){
    if(this.isPuterReady()){
      try{ return await this.puterWeekly(profile, last7); }catch(e){ console.warn(e); }
    }
    return this.localWeekly(profile, last7);
  },

  localWeekly(profile, last7){
    const startW = last7.bodyLogs.length>=2? last7.bodyLogs[last7.bodyLogs.length-1].weight_kg : profile.starting_weight_kg || 0;
    const nowW = last7.bodyLogs.length? last7.bodyLogs[0].weight_kg : startW;
    const change = startW? (nowW - startW).toFixed(1) : "0";
    const avgCal = last7.meals.length? Math.round(last7.totalCal / 7) : 0;
    const avgSteps = last7.steps.length? Math.round(last7.steps.reduce((s,x)=>s+x.steps,0)/7):0;
    return `WEEKLY REPORT - Weight ${change}kg, Avg ${avgCal} kcal, ${avgSteps.toLocaleString()} steps/day, ${last7.workoutCount} workouts`;
  },

  async puterWeekly(profile, last7){
    const prompt = `Premium English fitness coach. Profile: ${profile.full_name}, goal ${profile.primary_goal}, target ${profile.target_weight_kg}kg. Last 7 days: cal ${last7.totalCal}, protein ${last7.totalPro}g, workouts ${last7.workoutCount}, steps ${last7.steps.reduce((s,x)=>s+x.steps,0)}, sleep ${last7.sleep.length}, weight change ${last7.weightChange}kg. Write 5 sections: Weight, Nutrition, Activity & Steps, Sleep & Recovery, Heart Rate & VO2max, What to Improve. English only, max 250 words with emoji.`;
    const response = await puter.ai.chat(prompt, {
      model: 'google/gemini-2.5-flash'
    });
    if(typeof response === 'string') return response;
    if(response.message?.content) return response.message.content;
    return response.toString();
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

  // PUTER ONLY VISION - Food Photo
  async analyzeFoodPhoto(file){
    if(!this.isPuterReady()){
      return {error: "Puter AI not loaded. Check internet and https://js.puter.com/v2/ script"};
    }
    const dataUrl = await new Promise(res=>{
      const r = new FileReader();
      r.onload = ()=> res(r.result);
      r.readAsDataURL(file);
    });
    const prompt = `Nutrition expert. Look at this food photo. Estimate dish name (English), calories, protein_g, carbs_g, fat_g. Return ONLY valid JSON no extra text: {"name":"Dish Name","calories":123,"protein_g":12,"carbs_g":20,"fat_g":10} If not food, return {"error":"not_food"}`;

    try{
      const response = await puter.ai.chat(
        prompt,
        dataUrl,
        { model: 'google/gemini-2.5-flash' }
      );
      let text = "";
      if(typeof response === 'string') text = response;
      else if(response.message?.content) text = response.message.content;
      else text = JSON.stringify(response);
      const json = this.extractJson(text);
      if(json && json.calories) return json;
      if(json && json.error) return json;
      return {error: "Could not parse: " + text.slice(0,200)};
    }catch(e){
      return {error: "Food photo failed: " + e.message};
    }
  },

  // Test your exact example
  async testPuter(){
    if(!this.isPuterReady()) throw new Error("Puter not ready - check https://js.puter.com/v2/ loaded");
    const response = await puter.ai.chat("Classify the following text as positive, negative, or neutral: 'The product works well but the delivery was late.'", {
      model: 'google/gemini-2.5-flash-lite'
    });
    if(typeof response === 'string') return response;
    if(response.message?.content) return response.message.content;
    return JSON.stringify(response);
  }
};
