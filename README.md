# Fitness AI Hub v4 Premium - English Edition - Zero Cost

All text is now 100% English.

New in v4:
- Sleep Tracker: deep / light / REM / awake minutes, sleep score 0-100, quality 1-5 (Garmin import supported)
- Heart Rate Tracker: current BPM, resting HR, average HR, max HR, VO2max estimation, recovery score
- Steps & Distance: daily steps, kilometers, calories burned from walking (MET formula), 14-day chart
- Readiness & Recovery: Low / Moderate / High based on sleep + HR + steps (like Whoop/Oura)
- Activity Rings: Apple Watch-style rings for Calories / Steps / Workouts
- Integrations (No paid APIs, CSV only):
  - Garmin Watch: Export CSV from Garmin Connect
  - Strava: activities.csv from bulk export
  - Xiaomi Scale / Zepp Life: weight CSV

How to use:
1. Run supabase-schema-v4.sql in Supabase SQL Editor
2. Replace your old files with files from this zip
3. python -m http.server 8080
4. Set targets in Profile: 10,000 steps, 7.5h sleep, resting HR 60
5. Go to Sync tab and import your CSV files

All AI prompts, check-ins, reports, buttons, labels are now fully in English.
