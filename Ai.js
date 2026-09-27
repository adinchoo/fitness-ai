
// Free AI Engine - v3.1 FIXED with Groq + Gemini + robust parser
const AI = {
  getConfig(){ try{return JSON.parse(localStorage.getItem('fitness-ai-supabase-config')||'{}')}catch{return{}} },

  async generateCheckin(profile, yesterday){
    const cfg = this.getConfig();
    if(cfg.groqKey){
      try{ return await this.groqCheckin(profile, yesterday); }catch(e){ console.warn("groq fail",e) }
    }
    if(cfg.geminiKey){
      try{ return await this.geminiCheckin(profile, yesterday); }catch(e){ console.warn("gemini fail",e) }
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
    if(calDiff>0 && proDiff>0) msg += `Tapi calories and protein both short lagi, ${calDiff} kcal and ${proDiff}g protein below target. `;
    else if(calDiff>0) msg += `Calories short ${calDiff} kcal lagi. `;
    else if(proDiff>0) msg += `Protein short ${proDiff}g lagi. `;
    else msg += `Calories and protein cukup, nice! `;
    if(proDiff>20) msg += `Hari ni tambah another chicken breast or protein shake, jangan ulang mistake semalam!`;
    else if(!hasWorkout) msg += `Hari ni buat workout ringan pun okay, janji gerak.`;
    else msg += `Keep momentum hari ni!`;
    return msg;
  },

  async groqCheckin(profile, y){
    const cfg = this.getConfig();
    const prompt = `You are a fitness coach for ${profile.full_name}. Height ${profile.height_cm}cm, goal ${profile.primary_goal}. Yesterday: ${y.calories}/${y.targetCal} kcal, ${y.protein}/${y.targetPro}g protein, workout: ${y.workoutCount>0?'yes':'no'}. Give short check-in in mix Malay-English like "Eh Aiman, semalam okay lah..." Keep under 50 words, casual, encouraging.`;
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions",{
      method:"POST",
      headers:{"Authorization":"Bearer "+cfg.groqKey,"Content-Type":"application/json"},
      body: JSON.stringify({model:"llama-3.1-8b-instant", messages:[{role:"user", content:prompt}], max_tokens:120})
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || this.localCheckin(profile,y);
  },
  async geminiCheckin(profile, y){
    const cfg = this.getConfig();
    const prompt = `You are a fitness coach for ${profile.full_name}. Yesterday: ${y.calories}/${y.targetCal} kcal, ${y.protein}/${y.targetPro}g protein. Give short check-in Malay-English under 50 words.`;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${cfg.geminiKey}`,{
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({contents:[{parts:[{text:prompt}]}]})
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || this.localCheckin(profile,y);
  },

  async generateWeeklyReport(profile, last7){
    const cfg = this.getConfig();
    if(cfg.groqKey){ try{ return await this.groqWeekly(profile, last7); }catch(e){} }
    if(cfg.geminiKey){ try{ return await this.geminiWeekly(profile, last7); }catch(e){} }
    return this.localWeekly(profile, last7);
  },
  localWeekly(profile, last7){
    const startW = last7.bodyLogs.length>=2? last7.bodyLogs[last7.bodyLogs.length-1].weight_kg : profile.starting_weight_kg || 0;
    const nowW = last7.bodyLogs.length? last7.bodyLogs[0].weight_kg : startW;
    const change = startW? (nowW - startW).toFixed(1) : "0";
    const avgCal = last7.meals.length? Math.round(last7.totalCal / 7) : 0;
    const avgPro = last7.meals.length? Math.round(last7.totalPro / 7) : 0;
    let report = `WEEKLY REPORT - ${new Date().toLocaleDateString('en-GB', {day:'numeric', month:'short'})}\n\nWeight: ${change}kg change (${startW}kg to ${nowW}kg)\nAvg ${avgCal} kcal / ${avgPro}g protein vs target ${profile.target_calories}/${profile.target_protein_g}g\nWorkouts: ${last7.workoutCount}\n\nKeep going bro!`;
    return report;
  },
  async groqWeekly(profile, last7){
    const cfg = this.getConfig();
    const prompt = `Fitness coach. Profile: ${JSON.stringify(profile)}. Last 7 days: ${JSON.stringify({totalCal:last7.totalCal, totalPro:last7.totalPro, workoutCount:last7.workoutCount})}. Write weekly report 4 sections: Weight, Food, Workout, What to Improve. Casual Malay-English. Max 200 words.`;
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions",{
      method:"POST",
      headers:{"Authorization":"Bearer "+cfg.groqKey,"Content-Type":"application/json"},
      body: JSON.stringify({model:"llama-3.1-8b-instant", messages:[{role:"user", content:prompt}], max_tokens:350})
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || this.localWeekly(profile, last7);
  },
  async geminiWeekly(profile, last7){
    const cfg = this.getConfig();
    const prompt = `Fitness coach weekly report. Profile: ${JSON.stringify(profile)}. Data: ${JSON.stringify({totalCal:last7.totalCal, totalPro:last7.totalPro, workoutCount:last7.workoutCount})}. Write 4 sections. Malay-English. Max 200 words.`;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${cfg.geminiKey}`,{
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({contents:[{parts:[{text:prompt}]}]})
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || this.localWeekly(profile, last7);
  },

  // Robust JSON extractor
  extractJson(text){
    if(!text) return null;
    // Try direct parse
    try{ return JSON.parse(text); }catch{}
    // Remove markdown fences
    let clean = text.replace(/```json/gi,'').replace(/```/g,'').trim();
    // Find { ... } biggest
    const matches = clean.match(/\{[\s\S]*\}/g);
    if(matches){
      for(let m of matches.reverse()){
        try{ return JSON.parse(m); }catch{
          // try fix single quotes
          try{ return JSON.parse(m.replace(/'/g,'"')); }catch{}
        }
      }
    }
    return null;
  },

  async analyzeFoodPhoto(file){
    const cfg = this.getConfig();
    const hasGroq = !!cfg.groqKey;
    const hasGemini = !!cfg.geminiKey;
    if(!hasGroq && !hasGemini) return {error: "Add Groq key (gsk_...) OR Gemini key (AIza...) in Profile > Settings. Get free: console.groq.com or aistudio.google.com/app/apikey"};

    const base64 = await new Promise(res=>{
      const r = new FileReader();
      r.onload = ()=> res(r.result.split(',')[1]);
      r.readAsDataURL(file);
    });
    const mime = file.type || 'image/jpeg';

    const prompt = `You are a nutrition expert. Look at this food photo. Estimate dish name (Malaysian if possible like Nasi Kerabu, Nasi Lemak, etc), calories, protein_g, carbs_g, fat_g. Return ONLY JSON with no extra text: {"name":"Dish Name","calories":123,"protein_g":12,"carbs_g":20,"fat_g":10}`;

    // Try Gemini first - more reliable for vision
    if(hasGemini){
      try{
        const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${cfg.geminiKey}`,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
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
        throw new Error("Gemini no JSON: "+text);
      }catch(e){
        console.warn("Gemini vision failed", e.message);
        if(!hasGroq) return {error: "Gemini failed: "+e.message+" - Try clearer photo"};
      }
    }

    // Try Groq vision models (fallback, some deprecated)
    if(hasGroq){
      const models = ["meta-llama/llama-4-scout-17b-16e-instruct","meta-llama/llama-4-maverick-17b-128e-instruct","llama-3.2-90b-vision-preview","llama-3.2-11b-vision-preview"];
      for(let model of models){
        try{
          const response = await fetch("https://api.groq.com/openai/v1/chat/completions",{
            method:"POST",
            headers:{"Authorization":"Bearer "+cfg.groqKey,"Content-Type":"application/json"},
            body: JSON.stringify({
              model:model,
              messages:[{role:"user", content:[{type:"text", text:prompt},{type:"image_url", image_url:{url:`data:${mime};base64,${base64}`}}]}],
              max_tokens:400, temperature:0.2
            })
          });
          const data = await response.json();
          if(data.error) throw new Error(data.error.message || JSON.stringify(data.error));
          const text = data.choices?.[0]?.message?.content || "";
          const json = this.extractJson(text);
          if(json && json.calories) return json;
        }catch(e){
          console.warn(`Groq model ${model} failed:`, e.message);
          continue;
        }
      }
      return {error: "All Groq vision models failed. Groq deprecated vision. Try Gemini key instead (more reliable for photos) - get free at aistudio.google.com/app/apikey"};
    }
  }
};
