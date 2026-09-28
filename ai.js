// AI Engine v7.1.4 - PUTER ONLY - Using user's requested models
// Food: gemini-3.8-flash with image as 2nd param (Example 6)
// Text: gemini-3.5-flash-lite (Example 3)

const AI = {
  MODELS: {
    text: 'gemini-3.5-flash-lite',
    text_backup: 'gemini-3.1-flash-lite',
    vision: 'gemini-3.8-flash',
    vision_backup: 'gemini-3.5-flash',
    report: 'gemini-3.5-flash-lite'
  },

  isPuterReady(){ return typeof puter !== 'undefined' && puter.ai && puter.ai.chat; },

  extractText(response){
    if(typeof response === 'string') return response;
    if(response?.message?.content){
      if(typeof response.message.content === 'string') return response.message.content;
      if(Array.isArray(response.message.content)) return response.message.content.map(c=>c.text||c.content||'').join('');
    }
    if(response?.text) return response.text;
    if(response?.content) return response.content;
    return String(response);
  },

  async generateCheckin(profile, yesterday){
    if(this.isPuterReady()){
      try{ return await this.puterCheckin(profile, yesterday); }catch(e){ console.warn("Puter checkin failed", e); }
    }
    return this.localCheckin(profile, yesterday);
  },

  localCheckin(profile, y){
    const name = profile.full_name?.split(' ')[0] || 'there';
    const parts=[];
    parts.push(`Hey ${name}, here's yesterday:`);
    if(y.workoutCount>0) parts.push(`💪 ${y.workoutCount} workout${y.workoutCount>1?'s':''}`);
    else parts.push(`No workout logged`);
    if(y.steps) parts.push(`🚶 ${y.steps.toLocaleString()} steps`);
    if(y.sleepHours) parts.push(`😴 ${y.sleepHours.toFixed(1)}h sleep`);
    if(y.avgHR) parts.push(`❤️ ${y.avgHR} bpm`);
    return parts.join(' • ') + '. Keep going!';
  },

  // === REPORT - Uses Example 3: gemini-3.5-flash-lite ===
  async puterCheckin(profile, y){
    const prompt = `You are an English fitness coach for ${profile.full_name}, goal ${profile.primary_goal}. Yesterday: calories ${y.calories}/${y.targetCal}, protein ${y.protein}/${y.targetPro}g, steps ${y.steps||0}/${profile.target_steps||10000}, sleep ${y.sleepHours||0}h score ${y.sleepScore||0}, avg HR ${y.avgHR||0}, workouts ${y.workoutCount}, recovery ${y.recovery||50}%. Write a short check-in under 60 words in 100% English with emoji. Encouraging.`;
    try{
      const response = await puter.ai.chat(prompt, { model: this.MODELS.text });
      return this.extractText(response);
    }catch(e){
      console.warn("text model failed, backup", e.message);
      const response = await puter.ai.chat(prompt, { model: this.MODELS.text_backup });
      return this.extractText(response);
    }
  },

  async generateWeeklyReport(profile, last7){
    if(this.isPuterReady()){
      try{ return await this.puterWeekly(profile, last7); }catch(e){ console.warn(e); }
    }
    return this.localWeekly(profile, last7);
  },

  localWeekly(profile, last7){
    const avgCal = last7.meals.length? Math.round(last7.totalCal / 7) : 0;
    const avgSteps = last7.steps.length? Math.round(last7.steps.reduce((s,x)=>s+x.steps,0)/7):0;
    return `WEEKLY - Avg ${avgCal} kcal, ${avgSteps.toLocaleString()} steps/day, ${last7.workoutCount} workouts`;
  },

  async puterWeekly(profile, last7){
    const prompt = `Premium English fitness coach. Profile: ${profile.full_name}, goal ${profile.primary_goal}, target ${profile.target_weight_kg}kg. Last 7 days: cal ${last7.totalCal}, protein ${last7.totalPro}g, workouts ${last7.workoutCount}, steps ${last7.steps.reduce((s,x)=>s+x.steps,0)}, sleep ${last7.sleep.length}, weight change ${last7.weightChange}kg. Write 5 sections: Weight, Nutrition, Activity & Steps, Sleep & Recovery, Heart Rate & VO2max, What to Improve. English only, max 250 words with emoji.`;
    // Example 3 pattern - text only with model gemini-3.5-flash-lite
    try{
      const response = await puter.ai.chat(prompt, { model: this.MODELS.report });
      return this.extractText(response);
    }catch(e){
      console.warn("report model failed", e.message);
      const response = await puter.ai.chat(prompt, { model: this.MODELS.text_backup });
      return this.extractText(response);
    }
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

  // === FOOD IMAGE - Uses Example 6: image as 2nd param, model gemini-3.8-flash ===
  async analyzeFoodPhoto(file){
    if(!this.isPuterReady()){
      return {error: "Puter AI not loaded. Check https://js.puter.com/v2/"};
    }
    // Convert file to data URL - Puter accepts data URL as 2nd arg like https URL
    const dataUrl = await new Promise((res, rej)=>{
      const r = new FileReader();
      r.onload = ()=> res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });

    const prompt = `Nutrition expert. Analyze this food photo. Estimate dish name (English), calories, protein_g, carbs_g, fat_g. Return ONLY valid JSON no extra text: {"name":"Dish Name","calories":123,"protein_g":12,"carbs_g":20,"fat_g":10} If not food, return {"error":"not_food"}`;

    // Example 6 pattern: puter.ai.chat(prompt, imageUrl, {model})
    try{
      const response = await puter.ai.chat(
        prompt,
        dataUrl,
        { model: this.MODELS.vision }
      );
      let text = this.extractText(response);
      console.log("Food vision raw:", text);
      const json = this.extractJson(text);
      if(json && json.calories) return json;
      if(json && json.error) return json;
      return {error: "Could not parse: " + text.slice(0,200)};
    }catch(e){
      console.warn("vision model failed, trying backup", e.message);
      try{
        const response = await puter.ai.chat(
          prompt,
          dataUrl,
          { model: this.MODELS.vision_backup }
        );
        let text = this.extractText(response);
        const json = this.extractJson(text);
        if(json) return json;
        return {error: "Backup failed: " + text.slice(0,200)};
      }catch(e2){
        return {error: "Food photo failed: " + e.message + " | backup: " + e2.message};
      }
    }
  },

  async testPuter(){
    if(!this.isPuterReady()) throw new Error("Puter not ready - typeof puter=" + typeof puter + ". Check https://js.puter.com/v2/ loaded");
    
    // Test exactly as Example 3
    try{
      const response = await puter.ai.chat("Classify the following text as positive, negative, or neutral: 'The product works well but the delivery was late.'", {
        model: 'gemini-3.5-flash-lite'
      });
      const text = this.extractText(response);
      return `✅ ${this.MODELS.text} works:\n${text}`;
    }catch(e){
      // Try Example 6 model
      try{
        const response = await puter.ai.chat("What do you see?", "https://assets.puter.site/doge.jpeg", { model: 'gemini-3.8-flash' });
        return `✅ gemini-3.8-flash works (vision):\n${this.extractText(response)} | text model error was: ${e.message}`;
      }catch(e2){
        throw new Error(`Both models failed.\nText ${this.MODELS.text}: ${e.message}\nVision ${this.MODELS.vision}: ${e2.message}\n\nCheck Puter console and try models: gemini-3.5-flash, gemini-3.5-flash-lite, gemini-3.1-flash-lite`);
      }
    }
  }
};
