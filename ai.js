
// Free AI Engine - v3.1 FIXED - Food Photo Vision with robust parser + Gemini support
const AI = {
  getConfig(){ try{return JSON.parse(localStorage.getItem('fitness-ai-supabase-config')||'{}')}catch{return{}} },

  async generateCheckin(profile, yesterday){
    const cfg = this.getConfig();
    if(cfg.groqKey){
      try{ return await this.groqCheckin(profile, yesterday); }catch(e){ console.warn("groq fail",e) }
    }
    return this.localCheckin(profile, yesterday);
  },

  localCheckin(profile, y){
    const name = profile.full_name?.split(' ')[0] || 'bro';
    const calDiff = y.targetCal - y.calories;
    const proDiff = y.targetPro - y.protein;
    const hasWorkout = y.workoutCount > 0 || y.activities.length>0;
    let msg = `Eh ${name}, semalam okay lah — `;
    if(hasWorkout) msg += `workout siap, bagus tu! `;
    else msg += `tak workout semalam. `;
    if(calDiff>0 && proDiff>0){
      msg += `Tapi calories and protein both short lagi, ${calDiff} kcal and ${proDiff}g protein below target. `;
    } else if(calDiff>0){
      msg += `Calories short ${calDiff} kcal lagi. `;
    } else if(proDiff>0){
      msg += `Protein short ${proDiff}g lagi. `;
    } else {
      msg += `Calories and protein cukup, nice! `;
    }
    if(proDiff>20) msg += `Hari ni tambah another chicken breast or protein shake, jangan ulang mistake semalam!`;
    else if(!hasWorkout) msg += `Hari ni buat workout ringan pun okay, janji gerak.`;
    else msg += `Keep momentum hari ni!`;
    return msg;
  },

  async groqCheckin(profile, y){
    const cfg = this.getConfig();
    const prompt = `You are a fitness coach for ${profile.full_name}. Height ${profile.height_cm}cm, goal ${profile.primary_goal}. Yesterday: ${y.calories}/${y.targetCal} kcal, ${y.protein}/${y.targetPro}g protein, workout: ${y.workoutCount>0?'yes':'no'}. Give short check-in in mix Malay-English like "Eh Aiman, semalam okay lah..." Keep under 50 words, casual, encouraging. No wedding talk.`;
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions",{
      method:"POST",
      headers:{"Authorization":"Bearer "+cfg.groqKey,"Content-Type":"application/json"},
      body: JSON.stringify({model:"llama-3.1-8b-instant", messages:[{role:"user", content:prompt}], max_tokens:120})
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || this.localCheckin(profile,y);
  },

  async generateWeeklyReport(profile, last7){
    const cfg = this.getConfig();
    if(cfg.groqKey){
      try{ return await this.groqWeekly(profile, last7); }catch(e){ console.warn(e) }
    }
    return this.localWeekly(profile, last7);
  },

  localWeekly(profile, last7){
    const startW = last7.bodyLogs.length>=2? last7.bodyLogs[last7.bodyLogs.length-1].weight_kg : profile.starting_weight_kg || 0;
    const nowW = last7.bodyLogs.length? last7.bodyLogs[0].weight_kg : startW;
    const change = startW? (nowW - startW).toFixed(1) : "0";
    const avgCal = last7.meals.length? Math.round(last7.totalCal / 7) : 0;
    const avgPro = last7.meals.length? Math.round(last7.totalPro / 7) : 0;
    const loggedDays = last7.daysLogged;
    let report = `WEEKLY PROGRESS REPORT - ${new Date().toLocaleDateString('en-GB', {day:'numeric', month:'short'})}\n\n`;
    report += `1. Weight This Week\n`;
    if(parseFloat(change) < 0) report += `Bro, you dropped ${Math.abs(change)}kg - from ${startW}kg to ${nowW}kg. Nice! Keep it up!\n\n`;
    else if(parseFloat(change) > 0) report += `Weight up ${change}kg this week. Check calories.\n\n`;
    else report += `Weight stable at ${nowW}kg.\n\n`;
    report += `2. Food\n`;
    if(loggedDays<3) report += `Only ${loggedDays} day(s) logged out of 7. Log daily.\n\n`;
    else report += `Average ${avgCal} kcal and ${avgPro}g protein vs target ${profile.target_calories} kcal / ${profile.target_protein_g}g. ${avgPro<profile.target_protein_g*0.8?'Protein low, add chicken, eggs.':'Protein solid!'}\n\n`;
    report += `3. Workout: ${last7.workoutCount} sessions. ${last7.workoutCount>=3?'Good!':'Aim 3-4x week.'}\n\n`;
    report += `4. What to Improve\n`;
    if(avgPro < profile.target_protein_g) report += `- Protein: add 1 extra serving daily\n`;
    if(last7.workoutCount<3) report += `- Workout: schedule 3 fixed days\n`;
    if(loggedDays<5) report += `- Logging: log every meal\n`;
    report += `\nKeep going bro!`;
    return report;
  },

  async groqWeekly(profile, last7){
    const cfg = this.getConfig();
    const prompt = `Fitness coach. Profile: ${JSON.stringify(profile)}. Last 7 days: ${JSON.stringify({totalCal:last7.totalCal, totalPro:last7.totalPro, workoutCount:last7.workoutCount, daysLogged:last7.daysLogged})}. Write weekly report 4 sections: Weight, Food, Workout, What to Improve. Casual Malay-English. Max 200 words.`;
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions",{
      method:"POST",
      headers:{"Authorization":"Bearer "+cfg.groqKey,"Content-Type":"application/json"},
      body: JSON.stringify({model:"llama-3.1-8b-instant", messages:[{role:"user", content:prompt}], max_tokens:350})
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || this.localWeekly(profile, last7);
  },

  // FIXED PHOTO ANALYZER - supports Groq (Meta Llama) AND Gemini
  async analyzeFoodPhoto(file){
    const cfg = this.getConfig();
    const hasGroq = !!cfg.groqKey;
    const hasGemini = !!cfg.geminiKey;

    if(!hasGroq && !hasGemini){
      return {error: "Add Groq key (gsk_...) OR Gemini key (AIza...) in Profile > Settings. Get Groq free at console.groq.com, Gemini at aistudio.google.com/app/apikey"};
    }

    // Convert image to base64
    const base64 = await new Promise(res=>{
      const r = new FileReader();
      r.onload = ()=> res(r.result.split(',')[1]);
      r.readAsDataURL(file);
    });

    // Try Gemini first if available (best for food vision)
    if(hasGemini){
      try{
        const gemResult = await this.geminiVision(base64, file.type);
        if(!gemResult.error) return gemResult;
        console.warn("gemini failed, trying groq", gemResult.error);
      }catch(e){ console.warn(e) }
    }

    // Try Groq Meta Llama Vision
    if(hasGroq){
      try{
        const groqResult = await this.groqVision(base64);
        if(!groqResult.error) return groqResult;
        return groqResult; // return error if both fail
      }catch(e){
        return {error: "Groq vision error: "+e.message};
      }
    }

    return {error: "No working AI key found"};
  },

  async groqVision(base64){
    const cfg = this.getConfig();
    const prompt = `Analyze this food photo. You are a nutrition expert for Malaysian food.
Return ONLY a JSON object with no markdown, no explanation, no extra text.
Format exactly: {"name":"Dish Name","calories":500,"protein_g":30,"carbs_g":45,"fat_g":20}
Estimate realistic calories and macros. For Malaysian foods like Nasi Kerabu, Nasi Lemak, Nasi Goreng, etc, use your knowledge.
If not food, return {"name":"Not Food","calories":0,"protein_g":0,"carbs_g":0,"fat_g":0}
JSON ONLY.`;

    const modelsToTry = ["meta-llama/llama-4-scout-17b-16e-instruct", "llama-3.2-11b-vision-preview", "llama-3.2-90b-vision-preview"];

    for(const model of modelsToTry){
      try{
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions",{
          method:"POST",
          headers:{"Authorization":"Bearer "+cfg.groqKey,"Content-Type":"application/json"},
          body: JSON.stringify({
            model: model,
            messages:[{role:"user", content:[{type:"text", text:prompt},{type:"image_url", image_url:{url:`data:image/jpeg;base64,${base64}`}}]}],
            max_tokens:500,
            temperature:0.1
          })
        });
        const data = await response.json();
        if(data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        let text = data.choices?.[0]?.message?.content || "";
        console.log("Groq raw:", text);
        const json = this.extractJson(text);
        if(json && json.calories) return json;
        throw new Error("No valid JSON in: "+text.slice(0,200));
      }catch(e){
        console.warn(`Model ${model} failed:`, e.message);
        continue;
      }
    }
    return {error: "All Groq vision models failed. Try Gemini key instead (more reliable for photos)."};
  },

  async geminiVision(base64, mimeType){
    const cfg = this.getConfig();
    const mime = mimeType || "image/jpeg";
    const prompt = `Analyze this food photo. Return ONLY JSON: {"name":"Dish Name","calories":500,"protein_g":30,"carbs_g":45,"fat_g":20}. Malaysian food expertise. No markdown.`;

    try{
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${cfg.geminiKey}`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          contents:[{parts:[{text:prompt},{inline_data:{mime_type:mime, data:base64}}]}],
          generationConfig:{temperature:0.2, maxOutputTokens:500}
        })
      });
      const data = await response.json();
      if(data.error) throw new Error(data.error.message);
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      console.log("Gemini raw:", text);
      const json = this.extractJson(text);
      if(json && json.calories !== undefined) return json;
      throw new Error("No JSON: "+text.slice(0,200));
    }catch(e){
      return {error: "Gemini error: "+e.message};
    }
  },

  extractJson(text){
    // Remove markdown fences
    let clean = text.replace(/```json/gi,'').replace(/```/g,'').trim();
    // Find JSON object
    const match = clean.match(/\{[\s\S]*?\}/);
    if(!match) return null;
    try{
      let obj = JSON.parse(match[0]);
      // Normalize keys
      return {
        name: obj.name || obj.dish || obj.food || "Meal",
        calories: Math.round(obj.calories || obj.kcal || 0),
        protein_g: Math.round(obj.protein_g || obj.protein || 0),
        carbs_g: Math.round(obj.carbs_g || obj.carbs || 0),
        fat_g: Math.round(obj.fat_g || obj.fat || 0)
      };
    }catch{
      return null;
    }
  }
};
