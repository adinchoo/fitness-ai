# Fitness AI Hub v2 - Free AI Coach
Built from your video inspiration but without wedding stuff. Focus: stay fit & healthy.

## What's new vs v1
- Home like your video: Weight, Lost so far, Calories, Protein, Yesterday's Check-in (free AI), Today's Session, Quick Log
- Meal logging with Malaysian favourite foods + S/M/L (Chicken Breast etc) - easy like your app
- Workout templates: Push Day, Pull Day, Leg Day, Full Body with sets/reps/kg editable
- History: Weight Journey canvas chart + projection + last 14 days
- Photos: Front/Back/Side progress photos stored in Supabase Storage (private)
- AI Report: Weekly report powered by FREE local AI (no key). Optional Groq key (free 14k req/day at console.groq.com) upgrades to LLM
- Dark theme like video (#0a0a0a + lime #c6ff00)

## Setup
1. In Supabase SQL Editor, paste supabase-schema.sql and Run
2. Storage bucket `progress-photos` is auto-created by SQL (private RLS)
3. Auth > URL Configuration: set Site URL to your GitHub Pages URL, add localhost:8080 to Redirects
4. Get Project URL + anon/publishable key from Project Settings

## Test locally
python -m http.server 8080
open http://localhost:8080
First screen asks for Supabase URL + key + optional Groq key (leave empty for free local AI)

## Free AI
- No key needed: Yesterday's Check-in + Weekly Report use rule-based AI that mimics your video messages in Malay+English
- Optional: paste Groq API key (gsk_...) from console.groq.com for real LLM - free tier

## Foods
Edit foods.js to add your own Kelantan meals. Sizes: S=100g, M=165g, L=225g raw weight as in video.

## Deploy
Push all files to main, enable GitHub Pages from root.
