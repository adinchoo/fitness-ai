# Fitness AI Hub v7.3 FULL - Meal Camera + FIT

Fixed package. All duplicates removed.

Features:
- Log Meal: big TAKE PHOTO button -> capture="environment" -> Puter Vision gemini-2.0-flash auto kcal/protein
- FIT: import .fit from Garmin/Wahoo/Zwift/Coros - parsed locally, no server
- Models fixed to google/gemini-2.0-flash-lite / flash

Deploy:
1. Supabase SQL Editor -> run supabase/schema.sql
2. Edge Functions -> health-auto-export -> paste supabase/functions/health-auto-export/index.ts -> set env SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY -> deploy --no-verify-jwt
3. Host folder

Use:
- Home > Log Meal > TAKE PHOTO
- Sync > FIT File > choose .fit