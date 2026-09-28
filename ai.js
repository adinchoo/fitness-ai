
// AI Engine v5 - Hardcoded with Puter.js - 100% Free, No API Keys, Fully English
// Uses puter.ai.chat with Gemini models via https://js.puter.com/v2/
// Models: google/gemini-2.5-flash-lite for text, google/gemini-2.5-flash for vision

const AI = {
  // Check if Puter is loaded
  isPuterReady(){ return typeof puter !== 'undefined' && puter.ai && puter.ai.chat; },

  // --- Main entry: Yesterday check-in ---
  async generateCheckin(profile, yesterday){
    if(this.isPuterReady()){
      try{ return await this.puterCheckin(profile, yesterday); }catch(e){ console.warn("Puter checkin failed, fallback to local", e); }
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
    const calDiff = y.targetCal - y.calories;
    const proDiff = y.targetPro - y.protein;
    if(calDiff>150) parts.push(`You were ${calDiff} kcal under target`);
    if(proDiff>15) parts.push(`Protein short by ${proDiff}g - add chicken or shake today`);
    if(y.calories>=y.targetCal*0.9 && y.protein>=y.targetPro*0.9) parts.push(`Nutrition was on point!`);
    if(!y.sleepHours || y.sleepHours<6) parts.push(`Aim for 7.5h sleep tonight`);
    if(y.recovery) parts.push(`Recovery ${y.recovery}% - ${y.readiness?.label}`);
    return parts.join(' • ') + '. Keep the momentum going!';
  },

  // Hardcoded Puter text generation - model from your example adapted
  async puterCheckin(profile, y){
    const prompt = `You are an English fitness coach for ${profile.full_name}, goal ${profile.primary_goal}. 
Yesterday: calories ${y.calories}/${y.targetCal}, protein ${y.protein}/${y.targetPro}g, steps ${y.steps||0}/${profile.target_steps||10000}, sleep ${y.sleepHours||0}h score ${y.sleepScore||0}, avg HR ${y.avgHR||0}, workouts ${y.workoutCount}, recovery ${y.recovery||50}%.
Write a short check-in under 60 words in 100% English with emoji. Encouraging and friendly. No Malay.`;

    // Using model from your snippet - gemini-3.5-flash-lite via Puter
    // Puter supports both short name and full: 'gemini-3.5-flash-lite' or 'google/gemini-2.5-flash-lite'
    // We use google/gemini-2.5-flash-lite for best free performance
    const response = await puter.ai.chat(prompt, {
      model: 'google/gemini-2.5-flash-lite'
    });
    
    // Puter returns string or object with message
    if(typeof response === 'string') return response;
    if(response.message?.content) return response.message.content;
    if(response.text) return response.text;
    return response.toString();
  },

  // --- Weekly Report ---
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
    const avgPro = last7.meals.length? Math.round(last7.totalPro / 7) : 0;
    const avgSteps = last7.steps.length? Math.round(last7.steps.reduce((s,x)=>s+x.steps,0)/7):0;
    const avgSleep = last7.sleep.length? (last7.sleep.reduce((s,x)=>s+Number(x.duration_hours),0)/7).toFixed(1):0;
    const avgHR = last7.hr.length? Math.round(last7.hr.reduce((s,x)=>s+x.bpm,0)/last7.hr.length):0;
    return `WEEKLY REPORT - ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short'})}

Weight: ${change} kg change (${startW} kg -> ${nowW} kg)
Food: Avg ${avgCal} kcal / ${avgPro}g protein vs target ${profile.target_calories}/${profile.target_protein_g}g
Activity: ${avgSteps.toLocaleString()} steps/day, ${last7.workoutCount} workouts, ${last7.totalDistance?.toFixed(1)||0} km total
Sleep: ${avgSleep}h average, Recovery ${last7.avgRecovery||50}%
Heart: ${avgHR? avgHR+' bpm average, estimated VO2max '+Health.estimateVO2Max(profile.resting_hr||60, 30, profile.sex_at_birth):'No heart rate data'}

Focus next week: ${avgSleep<7?'Prioritize 7.5h sleep. ':''}${avgPro<profile.target_protein_g*0.8?'Increase protein. ':''}${avgSteps<8000?'Walk 10k daily.':''}`.trim();
  },

  async puterWeekly(profile, last7){
    const prompt = `Premium English fitness coach. Profile: ${profile.full_name}, goal ${profile.primary_goal}, target weight ${profile.target_weight_kg}kg.
Last 7 days: calories ${last7.totalCal}, protein ${last7.totalPro}g, workouts ${last7.workoutCount}, steps total ${last7.steps.reduce((s,x)=>s+x.steps,0)}, sleep logs ${last7.sleep.length}, avg HR ${last7.hr[0]?.bpm||'no data'}, weight change ${last7.weightChange}kg.

Write a weekly report with 5 sections: Weight, Nutrition, Activity & Steps, Sleep & Recovery, Heart Rate & VO2max, What to Improve.
Use 100% English, casual friendly, include emoji, max 250 words.`;

    const response = await puter.ai.chat(prompt, {
      model: 'google/gemini-2.5-flash'
    });
    if(typeof response === 'string') return response;
    if(response.message?.content) return response.message.content;
    return response.toString();
  },

  // --- JSON extractor ---
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

  // --- FOOD PHOTO AI - Hardcoded with Puter Vision ---
  // Example you gave: puter.ai.chat("Classify...", {model:'gemini-3.5-flash-lite'})
  // For vision: puter.ai.chat(prompt, imageUrl, {model: 'google/gemini-2.5-flash'})
  async analyzeFoodPhoto(file){
    if(!this.isPuterReady()){
      return {error: "Puter AI not loaded. Check internet connection. Script: https://js.puter.com/v2/"};
    }

    // Convert file to data URL for Puter vision
    const dataUrl = await new Promise(res=>{
      const r = new FileReader();
      r.onload = ()=> res(r.result);
      r.readAsDataURL(file);
    });

    const prompt = `You are a nutrition expert. Look at this food photo. Estimate dish name (keep English), calories, protein_g, carbs_g, fat_g. 
Return ONLY valid JSON with no extra text, no markdown:
{"name":"Dish Name","calories":123,"protein_g":12,"carbs_g":20,"fat_g":10}

If not food, return {"error":"not_food"}`;

    try{
      // Puter vision: prompt + image data URL + model
      // Using gemini-2.5-flash which supports vision
      const response = await puter.ai.chat(
        prompt,
        dataUrl,
        { model: 'google/gemini-2.5-flash' }
      );

      let text = "";
      if(typeof response === 'string') text = response;
      else if(response.message?.content) text = response.message.content;
      else if(response.text) text = response.text;
      else text = JSON.stringify(response);

      const json = this.extractJson(text);
      if(json && json.calories){
        return json;
      }
      // Try to find numbers if JSON fails
      if(json && json.error) return json;
      
      // Fallback: try to parse manually
      console.warn("Puter vision raw:", text);
      return {error: "Could not parse nutrition data. Raw: " + text.slice(0,200)};
      
    }catch(e){
      console.error("Puter vision error", e);
      return {error: "Food photo analysis failed: " + e.message + ". Try a clearer photo with good lighting."};
    }
  },

  // --- Simple test from your example ---
  async testPuter(){
    if(!this.isPuterReady()) throw new Error("Puter not ready");
    const response = await puter.ai.chat("Classify the following text as positive, negative, or neutral: 'The product works well but the delivery was late.'", {
      model: 'google/gemini-2.5-flash-lite'
    });
    return response;
  }
};
