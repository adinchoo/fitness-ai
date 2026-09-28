// Supabase Edge Function: health-auto-export v7.1 - SECURED
// Requires: Authorization: Bearer <supabase_jwt>
// Validates that user_id == JWT user.id

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
    const userIdFromQuery = url.searchParams.get('user_id') || req.headers.get('x-user-id')
    
    // v7.1 SECURITY: Require JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({error: 'Missing Authorization Bearer token. Use your Supabase access_token.'}), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const jwt = authHeader.replace('Bearer ', '').trim()
    
    // Create client with anon key to verify JWT
    const supabaseAnon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } }
    })
    
    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser(jwt)
    if (userError || !user) {
      return new Response(JSON.stringify({error: 'Invalid JWT: ' + (userError?.message || 'no user')}), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    
    // Validate user_id matches JWT user.id (prevents writing to other users)
    const effectiveUserId = userIdFromQuery || user.id
    if (userIdFromQuery && userIdFromQuery !== user.id) {
      return new Response(JSON.stringify({error: 'user_id mismatch: JWT user.id != query user_id'}), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    
    if (!effectiveUserId) {
      return new Response(JSON.stringify({error: 'user_id required'}), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Service role for inserts (bypasses RLS but we already authenticated)
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    
    const body = await req.json().catch(()=>({}))
    let inserted = { steps: 0, heart: 0, sleep: 0, weight: 0, workouts: 0 }
    const metrics = body.data?.metrics || body.metrics || []
    
    for (let metric of metrics) {
      const name = (metric.name || '').toLowerCase()
      const data = metric.data || []
      if (name.includes('step_count')) {
        const rows = data.map(d => ({ user_id: effectiveUserId, steps: parseInt(d.qty||d.value||0), distance_km: 0, source: 'Apple Health Auto REST', logged_at: d.date || new Date().toISOString() })).filter(r=>r.steps>0)
        if(rows.length){ const {error} = await supabase.from('steps_logs').insert(rows); if(!error) inserted.steps+=rows.length }
      }
      if (name.includes('heart_rate') && !name.includes('resting')) {
        const rows = data.map(d => ({ user_id: effectiveUserId, bpm: parseInt(d.qty||d.value||0), source: 'Apple Health Auto REST', logged_at: d.date||new Date().toISOString() })).filter(r=>r.bpm>20)
        if(rows.length){ const {error} = await supabase.from('heart_rate_logs').insert(rows); if(!error) inserted.heart+=rows.length }
      }
      if (name.includes('sleep')) {
        const rows = data.map(d => ({ user_id: effectiveUserId, duration_hours: parseFloat(d.qty||0)/60||0, quality: 3, source: 'Apple Health Auto REST', logged_at: d.date||new Date().toISOString() })).filter(r=>r.duration_hours>0)
        if(rows.length){ const {error} = await supabase.from('sleep_logs').insert(rows); if(!error) inserted.sleep+=rows.length }
      }
      if (name.includes('body_mass')) {
        const rows = data.map(d => ({ user_id: effectiveUserId, weight_kg: parseFloat(d.qty||d.value||0), source: 'Apple Health Auto REST', logged_at: d.date||new Date().toISOString() })).filter(r=>r.weight_kg>20)
        if(rows.length){ const {error} = await supabase.from('body_logs').insert(rows); if(!error) inserted.weight+=rows.length }
      }
    }
    
    const workouts = body.data?.workouts || body.workouts || []
    if(workouts.length){
      const rows = workouts.map(w=>({ user_id: effectiveUserId, activity_name: w.name||w.workoutType||'Workout', duration_minutes: Math.round((w.duration||0)/60), source: 'Apple Health Auto REST', logged_at: w.start||new Date().toISOString() }))
      const {error} = await supabase.from('activity_logs').insert(rows);
      if(!error) inserted.workouts+=rows.length
    }
    
    if(Object.values(inserted).reduce((a,b)=>a+b,0) > 0){
      await supabase.from('integration_imports').insert({ user_id: effectiveUserId, provider: 'apple_health_auto_rest_secure', file_name: 'REST API v7.1', records_count: Object.values(inserted).reduce((a,b)=>a+b,0) })
    }
    
    return new Response(JSON.stringify({success:true, user_id: effectiveUserId, inserted, secured: true}), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch(e){
    return new Response(JSON.stringify({error:e.message}), { status:500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
