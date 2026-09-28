
// health.js - Premium calculations at 0 cost
const Health = {
  // Walking calories: MET formula
  calcWalkingCalories(weightKg, distanceKm, durationMin){
    const speed = distanceKm / (durationMin/60);
    let met = 3.5;
    if(speed < 3) met=2.8; else if(speed <4.5) met=3.5; else if(speed <6) met=4.3; else met=6;
    return Math.round(met * weightKg * (durationMin/60));
  },
  // VO2max estimate from resting HR (Uth formula) - zero cost estimate
  estimateVO2Max(restingHR, age, sex){
    const maxHR = sex==='Male' ? 220 - age : 226 - age;
    return Math.round(15.3 * (maxHR / restingHR));
  },
  // Recovery score 0-100
  recoveryScore({sleepHours, restingHR, avgHR, stepsYesterday, workoutCount}){
    let s=50;
    if(sleepHours>=7 && sleepHours<=9) s+=20; else if(sleepHours>=6) s+=10; else s-=15;
    if(restingHR && avgHR) s += restingHR < avgHR-5 ? 10 : 0;
    if(stepsYesterday>=8000) s+=10;
    if(workoutCount===0) s+=5; else if(workoutCount>1) s-=10;
    return Math.max(0, Math.min(100, s));
  },
  // Daily readiness
  readiness({weightChange, sleepHours, sleepScore, recovery}){
    if(sleepHours<5 || recovery<30) return {label:'Low - Rest Day', color:'#ff7a86', tip:'Prioritize sleep, light walk only'};
    if(recovery>75 && sleepScore>80) return {label:'High - Push Hard', color:'#5de8b6', tip:'Great day for PR, increase volume'};
    return {label:'Moderate - Steady', color:'#c6ff00', tip:'Keep routine, focus on protein'};
  },
  // Weekly trend
  weeklyTrend(values){
    if(values.length<3) return 0;
    const n=values.length;
    const sumX = (n*(n-1))/2;
    const sumY = values.reduce((a,b)=>a+b,0);
    const sumXY = values.reduce((acc,y,i)=>acc + i*y,0);
    const sumX2 = values.reduce((acc,_,i)=>acc + i*i,0);
    const slope = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX);
    return slope;
  }
};
