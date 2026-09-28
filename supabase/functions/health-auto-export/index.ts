import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id, x-secret-token', 'Access-Control-Allow-Methods': 'POST, OPTIONS, GET' }
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method === 'GET') return new Response(JSON.stringify({ ok: true }), { headers: {...corsHeaders, 'Content-Type': 'application/json' } })
  try {
    const url = new URL(req.url)
    const userIdFromQuery = url.searchParams.get('user_id') || req.headers.get('x-user-id')
    const authHeader = req.headers.get('Authorization')
    let effectiveUserId: string | null = null
    if (authHeader?.startsWith('Bearer ')) {
      const jwt = authHeader.replace('Bearer ', '').trim()
      const supabaseAnon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
      const { data: { user } } = await supabaseAnon.auth.getUser(jwt)
      if (!user) return new Response(JSON.stringify({ error: 'Invalid JWT' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json' } })
      effectiveUserId = user.id
    } else return new Response(JSON.stringify({ error: 'Missing Bearer token' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json' } })
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const body = await req.json().catch(()=>({}))
    const metrics = body.data?.metrics || body.metrics || []
    let inserted={steps:0,heart:0,sleep:0,weight:0}
    for(const m of metrics){
      const name=(m.name||'').toLowerCase(); const data=m.data||[]
      if(name.includes('step_count')){ const rows=data.map((d:any)=>({user_id:effectiveUserId,steps:parseInt(d.qty||0),source:'Apple Health',logged_at:d.date||new Date().toISOString()})).filter((r:any)=>r.steps>0); if(rows.length){ await supabase.from('steps_logs').insert(rows); inserted.steps+=rows.length } }
      if(name.includes('heart_rate')&&!name.includes('resting')){ const rows=data.map((d:any)=>({user_id:effectiveUserId,bpm:parseInt(d.qty||0),source:'Apple Health',logged_at:d.date||new Date().toISOString()})).filter((r:any)=>r.bpm>20); if(rows.length){ await supabase.from('heart_rate_logs').insert(rows); inserted.heart+=rows.length } }
    }
    return new Response(JSON.stringify({success:true,inserted}), {headers:{...corsHeaders,'Content-Type':'application/json'}})
  } catch(e:any){ return new Response(JSON.stringify({error:e.message}), {status:500, headers:{...corsHeaders,'Content-Type':'application/json'}}) }
})