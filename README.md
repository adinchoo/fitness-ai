# Fitness AI Hub v3 Final - v1 Theme + Food Photo AI
- Theme: v1 colors #09131f + mint #5de8b6 (like original)
- Features: Home (Weight, Lost, Calories, Protein, Yesterday Check-in AI), Today's Session, Quick Log
- Meal logging with Malaysian foods S/M/L + 📸 Analyze Food Photo (AI auto calorie) using free Groq Vision
- Workout templates Push/Pull/Leg
- History: Weight Journey chart + projection + last 14 days
- Photos: Front/Back/Side
- Report: Weekly AI Report free local AI, upgrade with Groq key
- Free AI: no key needed for check-in/report, add free Groq key (gsk_... from console.groq.com) for LLM + vision photo scan

Setup:
1. Run supabase-schema.sql in Supabase SQL Editor (creates new tables + storage bucket)
2. Set Site URL + Redirects in Auth > URL Config
3. python -m http.server 8080 and open localhost
4. Add Groq key in Profile > Settings for photo AI

Photo AI: Take photo of Nasi Kerabu -> app auto fills 775 kcal, 50g protein etc.
