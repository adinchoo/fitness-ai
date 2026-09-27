
// Free AI Engine - v3 with Food Photo Vision
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

  async analyzeFoodPhoto(file){
    const cfg = this.getConfig();
    if(!cfg.groqKey) return {error: "Add free Groq key in Profile > Settings to enable photo AI. Get free at console.groq.com (14k req/day free)"};
    const base64 = await new Promise(res=>{
      const r = new FileReader();
      r.onload = ()=> res(r.result.split(',')[1]);
      r.readAsDataURL(file);
    });
    const prompt = `You are a nutrition expert. Look at this food photo. Estimate dish name (Malaysian if possible like Nasi Kerabu etc), calories, protein_g, carbs_g, fat_g. Return ONLY valid JSON: {"name":"...","calories":123,"protein_g":12,"carbs_g":20,"fat_g":10}. No other text.`;
    try{
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions",{
        method:"POST",
        headers:{"Authorization":"Bearer "+cfg.groqKey,"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"meta-llama/llama-4-scout-17b-16e-instruct",
          messages:[{role:"user", content:[{type:"text", text:prompt},{type:"image_url", image_url:{url:`data:image/jpeg;base64,${base64}`}}]}],
          max_tokens:300
        })
      });
      const data = await response.json();
      let text = data.choices?.[0]?.message?.content || "";
      // extract json
      const match = text.match(/\{[\s\S]*\}/);
      if(!match) throw new Error("No JSON: "+text);
      const json = JSON.parse(match[0]);
      return json;
    }catch(e){
      // fallback try smaller vision model
      try{
        const response2 = await fetch("https://api.groq.com/openai/v1/chat/completions",{
          method:"POST",
          headers:{"Authorization":"Bearer "+cfg.groqKey,"Content-Type":"application/json"},
          body: JSON.stringify({
            model:"llama-3.2-11b-vision-preview",
            messages:[{role:"user", content:[{type:"text", text:prompt},{type:"image_url", image_url:{url:`data:image/jpeg;base64,${base64}`}}]}],
            max_tokens:300
          })
        });
        const data2 = await response2.json();
        let text2 = data2.choices?.[0]?.message?.content || "";
        const match2 = text2.match(/\{[\s\S]*\}/);
        if(match2) return JSON.parse(match2[0]);
        throw new Error(text2);
      }catch(e2){
        return {error: "AI parse failed: "+e2.message};
      }
    }
  }
};
