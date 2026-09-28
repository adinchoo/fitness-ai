// v7.1.2 - Fixed + Backward compatible + Logs errors
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id, x-secret-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  
  if (req.method === 'GET') {
    const url = new URL(req.url)
    return new Response(JSON.stringify({ 
      ok: true, 
      message: "Edge function alive. Use POST with Authorization: Bearer <jwt>",
      user_id_query: url.searchParams.get('user_id'),
      has_auth: !!req.headers.get('Authorization')
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    const url = new URL(req.url)
    const userIdFromQuery = url.searchParams.get('user_id') || req.headers.get('x-user-id')
    const authHeader = req.headers.get('Authorization')

    let effectiveUserId = null

    if (authHeader?.startsWith('Bearer ')) {
      const jwt = authHeader.replace('Bearer ', '').trim()
      const supabaseAnon = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!
      )
      const { data: { user }, error } = await supabaseAnon.auth.getUser(jwt)
      if (error || !user) {
        return new Response(JSON.stringify({ error: 'Invalid JWT: ' + (error?.message || 'no user') }), 
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (userIdFromQuery && userIdFromQuery !== user.id) {
        return new Response(JSON.stringify({ error: 'user_id mismatch' }), 
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      effectiveUserId = user.id
    } else {
      const secretEnv = Deno.env.get('HEALTH_SYNC_SECRET')
      const secretHeader = req.headers.get('x-secret-token')
      if (secretEnv && secretHeader === secretEnv && userIdFromQuery) {
        effectiveUserId = userIdFromQuery
      } else {
        return new Response(JSON.stringify({ 
          error: 'Missing auth. Add header Authorization: Bearer <supabase_access_token> OR x-secret-token',
          hint: 'Get token: in app console -> localStorage.getItem("sb-...-auth-token") -> access_token',
        }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    if (!effectiveUserId) {
      return new Response(JSON.stringify({ error: 'user_id required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json().catch(() => ({}))
    const metrics = body.data?.metrics || body.metrics || []
    const workouts = body.data?.workouts || body.workouts || []
    
    let inserted = { steps: 0, heart: 0, sleep: 0, weight: 0, workouts: 0, errors: [] }

    for (const metric of metrics) {
      const name = (metric.name || '').toLowerCase()
      const data = metric.data || []
      if (name.includes('step_count')) {
        const rows = data.map((d) => ({
          user_id: effectiveUserId,
          steps: parseInt(d.qty || d.value || 0),
          distance_km: parseFloat(d.distance || 0) || 0,
          source: 'Apple Health Auto',
          logged_at: d.date || new Date().toISOString()
        })).filter((r) => r.steps > 0)
        if (rows.length) {
          const { error } = await supabase.from('steps_logs').insert(rows)
          if (error) inserted.errors.push('steps: ' + error.message)
          else inserted.steps += rows.length
        }
      }
      if (name.includes('heart_rate') && !name.includes('resting') && !name.includes('variability')) {
        const rows = data.map((d) => ({
          user_id: effectiveUserId,
          bpm: parseInt(d.qty || d.value || 0),
          source: 'Apple Health Auto',
          logged_at: d.date || new Date().toISOString()
        })).filter((r) => r.bpm > 20 && r.bpm < 250)
        if (rows.length) {
          const { error } = await supabase.from('heart_rate_logs').insert(rows)
          if (error) inserted.errors.push('hr: ' + error.message)
          else inserted.heart += rows.length
        }
      }
      if (name.includes('sleep')) {
        const rows = data.map((d) => {
          let hours = parseFloat(d.qty || d.value || 0)
          if (hours > 24) hours = hours / 60
          return {
            user_id: effectiveUserId,
            duration_hours: hours,
            quality: 3,
            source: 'Apple Health Auto',
            logged_at: d.date || new Date().toISOString()
          }
        }).filter((r) => r.duration_hours > 0 && r.duration_hours < 24)
        if (rows.length) {
          const { error } = await supabase.from('sleep_logs').insert(rows)
          if (error) inserted.errors.push('sleep: ' + error.message)
          else inserted.sleep += rows.length
        }
      }
      if (name.includes('body_mass') || name.includes('weight')) {
        const rows = data.map((d) => ({
          user_id: effectiveUserId,
          weight_kg: parseFloat(d.qty || d.value || 0),
          source: 'Apple Health Auto',
          logged_at: d.date || new Date().toISOString()
        })).filter((r) => r.weight_kg > 20 && r.weight_kg < 400)
        if (rows.length) {
          const { error } = await supabase.from('body_logs').insert(rows)
          if (error) inserted.errors.push('weight: ' + error.message)
          else inserted.weight += rows.length
        }
      }
    }

    if (workouts.length) {
      const rows = workouts.map((w) => ({
        user_id: effectiveUserId,
        activity_name: w.name || w.workoutType || 'Workout',
        duration_minutes: Math.round((w.duration || 0) / 60),
        distance_km: parseFloat(w.distance || 0) / 1000 || 0,
        calories_burned: parseInt(w.activeEnergy || w.calories || 0) || 0,
        source: 'Apple Health Auto',
        logged_at: w.start || new Date().toISOString()
      }))
      const { error } = await supabase.from('activity_logs').insert(rows)
      if (error) inserted.errors.push('workouts: ' + error.message)
      else inserted.workouts += rows.length
    }

    const total = inserted.steps + inserted.heart + inserted.sleep + inserted.weight + inserted.workouts
    if (total > 0) {
      await supabase.from('integration_imports').insert({
        user_id: effectiveUserId,
        provider: 'apple_health_auto_rest_secure',
        file_name: 'REST API v7.1.2',
        records_count: total
      })
    }

    return new Response(JSON.stringify({ success: true, user_id: effectiveUserId, inserted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
