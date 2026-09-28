
// Supabase Edge Function: health-auto-export
// Your final URL: https://edybozhpdaexeapywbeh.supabase.co/functions/v1/health-auto-export?user_id=e0c24919-3cec-466e-93e6-b9834e4d2011
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET'
}
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const url = new URL(req.url)
    const userId = url.searchParams.get('user_id') || req.headers.get('x-user-id')
    if (!userId) return new Response(JSON.stringify({error: 'user_id required'}), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
    const body = await req.json().catch(()=>({}))
    let inserted = { steps: 0, heart: 0, sleep: 0, weight: 0, workouts: 0 }
    const metrics = body.data?.metrics || body.metrics || []
    for (let metric of metrics) {
      const name = (metric.name || '').toLowerCase()
      const data = metric.data || []
      if (name.includes('step_count')) {
        const rows = data.map(d => ({ user_id: userId, steps: parseInt(d.qty||d.value||0), distance_km: 0, source: 'Apple Health Auto REST' })).filter(r=>r.steps>0)
        if(rows.length){ await supabase.from('steps_logs').insert(rows); inserted.steps+=rows.length }
      }
      if (name.includes('heart_rate') && !name.includes('resting')) {
        const rows = data.map(d => ({ user_id: userId, bpm: parseInt(d.qty||d.value||0), source: 'Apple Health Auto REST', logged_at: d.date||new Date().toISOString() })).filter(r=>r.bpm>20)
        if(rows.length){ await supabase.from('heart_rate_logs').insert(rows); inserted.heart+=rows.length }
      }
      if (name.includes('sleep')) {
        const rows = data.map(d => ({ user_id: userId, duration_hours: parseFloat(d.qty||0)/60||0, quality: 3, source: 'Apple Health Auto REST', logged_at: d.date||new Date().toISOString() })).filter(r=>r.duration_hours>0)
        if(rows.length){ await supabase.from('sleep_logs').insert(rows); inserted.sleep+=rows.length }
      }
      if (name.includes('body_mass')) {
        const rows = data.map(d => ({ user_id: userId, weight_kg: parseFloat(d.qty||d.value||0), source: 'Apple Health Auto REST', logged_at: d.date||new Date().toISOString() })).filter(r=>r.weight_kg>20)
        if(rows.length){ await supabase.from('body_logs').insert(rows); inserted.weight+=rows.length }
      }
    }
    const workouts = body.data?.workouts || body.workouts || []
    if(workouts.length){
      const rows = workouts.map(w=>({ user_id: userId, activity_name: w.name||w.workoutType||'Workout', duration_minutes: Math.round((w.duration||0)/60), source: 'Apple Health Auto REST', logged_at: w.start||new Date().toISOString() }))
      await supabase.from('activity_logs').insert(rows); inserted.workouts+=rows.length
    }
    await supabase.from('integration_imports').insert({ user_id: userId, provider: 'apple_health_auto_rest', file_name: 'REST API', records_count: Object.values(inserted).reduce((a,b)=>a+b,0) })
    return new Response(JSON.stringify({success:true, user_id: userId, inserted}), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch(e){
    return new Response(JSON.stringify({error:e.message}), { status:500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
