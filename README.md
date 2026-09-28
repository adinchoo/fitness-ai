# Fitness AI Hub v4 Premium - Zero Cost Edition

New in v4:
- 😴 Sleep Tracker with deep/light/REM, score (Garmin import)
- ❤️ Heart Rate logs, resting HR, VO2max estimate, recovery score
- 🚶 Steps & Walking Distance daily, weekly chart
- ⌚ Garmin Connect CSV import (activities, steps, sleep)
- 🏃 Strava activities.csv import (distance, calories, HR)
- ⚖️ Zepp Life / Xiaomi Scale weight CSV import
- 📊 Activity View with premium charts
- 🔋 Readiness & Recovery score (free calc)
- Rings UI like Apple Watch

0 Cost Stack:
- No paid APIs. All CSV import client-side.
- Free AI: local + Groq (gsk_...) + Gemini (AIza...) for photo
- Charts: Canvas native (no library needed) + optional Chart.js CDN
- Garmin auto-sync to Strava free, then export once

Setup:
1. Run supabase-schema-v4.sql in Supabase SQL Editor (adds new tables, safe on v3)
2. Copy all files from this folder over your v3 folder (patch)
3. python -m http.server 8080
4. Profile > set target steps 10k, sleep 7.5h
5. Sync tab > Import your Garmin/Strava/Zepp CSVs

Import Guides:
- Garmin: connect.garmin.com > Activities > Export CSV, Health > Steps > Export CSV
- Strava: strava.com/settings > Download/Delete > Request Export -> activities.csv
- Zepp: Zepp Life > Profile > Settings > Export Data or weight CSV

Patch notes from v3:
- Keep your old foods.js and ai.js? Replace with v4 versions (backwards compatible)
- app.js completely rewritten to include missing render() + new trackers
- index.html adds new views: activityView, integrationsView + dialogs for sleep/steps/hr
