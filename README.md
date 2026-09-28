# Fitness AI Hub v7.1 - Cleaned - Puter Only

100% Puter.js - Zero API Keys. Fixed security and legacy code.

## What changed from v7

1. **SECURITY FIX**: Removed FINAL_URL.txt with hardcoded user_id. URL is now generated dynamically per logged-in user: `{supabaseUrl}/functions/v1/health-auto-export?user_id={auth.users.id}`
2. **Edge Function**: Now requires Authorization: Bearer <supabase_jwt> and verifies user_id matches JWT. No more anonymous writes.
3. **Puter Models Fixed**: Uses stable models `google/gemini-2.0-flash-lite` (text) and `google/gemini-2.0-flash` (vision). Your v7 used `2.5-flash-lite` which doesn't exist on Puter yet.
4. **Removed legacy Groq/Gemini key code** from app.js and index.html
5. **Removed Chart.js** CDN (unused, you draw manually)
6. **.gitignore** added
7. **Manifest icons** fixed - generates inline SVG fallback
8. **Schema v4.1** includes base tables creation for fresh installs

## Setup

1. Run supabase-schema-v4.1.sql in Supabase SQL Editor
2. Deploy Edge Function: `supabase functions deploy health-auto-export`
3. Set env vars in Supabase Dashboard > Edge Functions: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
4. Host files: `python -m http.server 8080` or Vercel/Netlify
5. No API keys needed

## Auto Sync

After login, go to Profile > Your Auto Sync URL > Copy. Paste into Health Auto Export app > Automations > REST API > URL. The app will add Authorization header automatically if you enable Auth.

Or use Shortcuts: POST with header `Authorization: Bearer <your supabase access_token>`

## Test Puter

Profile > Test Puter AI runs:
puter.ai.chat("Classify...", {model: 'google/gemini-2.0-flash-lite'})


## v7.1.2 Fixes
- SQL: Removed DO loop and grants that cause 42601 error
- Edge: Added GET handler for browser test
- Edge: Added fallback secret token mode (HEALTH_SYNC_SECRET env)
- Edge: Fixed sleep parsing (handles hours vs minutes)
- Added detailed error array in response
