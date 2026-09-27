
// Free AI Engine - works offline, no API key needed
// Provides Yesterday's Check-in and Weekly Report like in video
// If Groq key present, upgrades to LLM

const AI = {
  getConfig(){ try{return JSON.parse(localStorage.getItem('fitness-ai-supabase-config')||'{}')}catch{return{}} },

  async generateCheckin(profile, yesterday, todaySession){
    // yesterday = {meals, activities, workoutSessions, body, calories, protein, targetCal, targetPro}
    const cfg = this.getConfig();
    if(cfg.groqKey){
      try{ return await this.groqCheckin(profile, yesterday, todaySession); }catch(e){ console.warn("groq fail",e) }
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

    if(proDiff>20){
      msg += `Hari ni tambah another chicken breast or protein shake to close that gap, jangan ulang semalam punya mistake!`;
    } else if(!hasWorkout){
      msg += `Hari ni buat workout ringan pun okay, janji gerak.`;
    } else {
      msg += `Keep the momentum hari ni!`;
    }
    return msg;
  },

  async groqCheckin(profile, y, session){
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
    // last7 = {meals:[], activities, bodyLogs, workoutSessions, totalCal, totalPro, avgWeight, weightChange, workoutCount, daysLogged}
    const startW = last7.bodyLogs.length>=2 ? last7.bodyLogs[last7.bodyLogs.length-1].weight_kg : profile.starting_weight_kg || 0;
    const nowW = last7.bodyLogs.length ? last7.bodyLogs[0].weight_kg : startW;
    const change = startW ? (nowW - startW).toFixed(1) : "0";
    const avgCal = last7.meals.length ? Math.round(last7.totalCal / 7) : 0;
    const avgPro = last7.meals.length ? Math.round(last7.totalPro / 7) : 0;
    const loggedDays = last7.daysLogged;
    
    let report = `WEEKLY PROGRESS REPORT - ${new Date().toLocaleDateString('en-GB', {day:'numeric', month:'short'})}\n\n`;
    report += `1. Weight This Week\n`;
    if(parseFloat(change) < 0) report += `Bro, you dropped ${Math.abs(change)}kg - from ${startW}kg to ${nowW}kg. Nice! ${profile.primary_goal==='lose_weight'?'Trend is going down, keep it up!':'Monitor okay.'}\n\n`;
    else if(parseFloat(change) > 0) report += `Weight up ${change}kg this week. Check calories, maybe water retention. Adjust next week.\n\n`;
    else report += `Weight stable at ${nowW}kg. Keep consistent.\n\n`;

    report += `2. Food\n`;
    if(loggedDays<3) report += `Only ${loggedDays} day(s) logged out of 7. Cannot trust data. Log daily even if small - your coach can't help without data. Aim 7/7 next week.\n\n`;
    else report += `Average came in at ${avgCal} kcal and ${avgPro}g protein - ${avgCal<profile.target_calories?'below':'around'} your ${profile.target_calories} kcal / ${profile.target_protein_g}g target. ${avgPro<profile.target_protein_g*0.8?'Protein low, add chicken breast, eggs, Greek yogurt.': 'Protein solid!'}\n\n`;

    report += `3. Workout Consistency\n`;
    report += `${last7.workoutCount} out of 7 sessions. ${last7.workoutCount>=3?'Good consistency!':'Bro, need more - aim 3-4x week. One week skip = one week wasted.'} You trained on ${last7.workoutDays || 'few days'}.\n\n`;

    report += `4. Pull / Push Balance\n`;
    const push = last7.sessions?.filter(s=>s.session_name.includes('Push')).length||0;
    const pull = last7.sessions?.filter(s=>s.session_name.includes('Pull')).length||0;
    const leg = last7.sessions?.filter(s=>s.session_name.includes('Leg')).length||0;
    if(push>0||pull>0) report += `Push: ${push}, Pull: ${pull}, Leg: ${leg}. ${pull>=push?'Good back work.':'Add more pull - Lat pulldown, rows.'} Keep balanced.\n\n`;
    else report += `No structured sessions logged. Start with Push/Pull/Leg template.\n\n`;

    report += `5. What to Improve\n`;
    if(avgPro < profile.target_protein_g) report += `- Protein: add 1 extra serving chicken/salmon/eggs daily\n`;
    if(last7.workoutCount<3) report += `- Workout: schedule 3 fixed days, 6:30pm like in template\n`;
    if(loggedDays<5) report += `- Logging: log every meal, even konjac jelly & air kosong - consistency > perfection\n`;
    if(report.split('\n').length<15) report += `- Hydration: you logged ${last7.water||0}ml, aim ${profile.target_water_ml}ml\n`;
    report += `\nKeep going bro! Focus on one thing at a time.`;

    return report;
  },

  async groqWeekly(profile, last7){
    const cfg = this.getConfig();
    const prompt = `You are fitness coach. Profile: ${JSON.stringify(profile)}. Last 7 days: ${JSON.stringify({totalCal:last7.totalCal, totalPro:last7.totalPro, workoutCount:last7.workoutCount, weightChange:last7.weightChange, daysLogged:last7.daysLogged})}. Write weekly report in 4 sections: Weight, Food, Workout Consistency, What to Improve. Casual Malay-English mix, like example: "Bro, you dropped 0.8kg..." Keep encouraging, no wedding talk. Max 200 words.`;
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions",{
      method:"POST",
      headers:{"Authorization":"Bearer "+cfg.groqKey,"Content-Type":"application/json"},
      body: JSON.stringify({model:"llama-3.1-8b-instant", messages:[{role:"user", content:prompt}], max_tokens:350})
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || this.localWeekly(profile, last7);
  }
};
