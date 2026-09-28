
-- Fitness AI Hub v4 - Premium Zero Cost - Supabase Schema
-- Run in Supabase SQL Editor. Safe to run on existing v3 DB (IF NOT EXISTS)

create extension if not exists pgcrypto;

-- PROFILES (keep existing, add columns if missing)
alter table public.profiles add column if not exists target_steps integer default 10000 check (target_steps between 1000 and 50000);
alter table public.profiles add column if not exists target_sleep_hours numeric(3,1) default 7.5;
alter table public.profiles add column if not exists resting_hr integer default 60;
alter table public.profiles add column if not exists garmin_connected boolean default false;
alter table public.profiles add column if not exists strava_connected boolean default false;

-- Keep existing tables from v3
-- NEW: Heart Rate Logs (from Garmin, manual, or Zepp)
create table if not exists public.heart_rate_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bpm integer not null check (bpm between 20 and 250),
  resting_bpm integer,
  max_bpm integer,
  avg_bpm integer,
  source text not null default 'Manual', -- Garmin, Strava, Zepp, Manual
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists hr_user_date_idx on public.heart_rate_logs(user_id, logged_at desc);

-- NEW: Steps & Distance
create table if not exists public.steps_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  steps integer not null check (steps >=0),
  distance_km numeric(6,2) not null default 0,
  calories_burned integer default 0,
  source text not null default 'Manual', -- Garmin, Strava, Phone, Manual
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists steps_user_date_idx on public.steps_logs(user_id, logged_at desc);

-- NEW: Sleep enhanced (keep existing sleep_logs, add details)
alter table public.sleep_logs add column if not exists deep_minutes integer default 0;
alter table public.sleep_logs add column if not exists rem_minutes integer default 0;
alter table public.sleep_logs add column if not exists light_minutes integer default 0;
alter table public.sleep_logs add column if not exists awake_minutes integer default 0;
alter table public.sleep_logs add column if not exists score integer default 0 check (score between 0 and 100);

-- NEW: Generic Integrations import log
create table if not exists public.integration_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null, -- strava, garmin, zepp, mi_scale
  file_name text,
  records_count integer default 0,
  raw_summary jsonb,
  logged_at timestamptz not null default now()
);

-- NEW: Daily Summary materialized view helper table (for fast AI report)
create table if not exists public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  total_calories integer default 0,
  total_protein numeric default 0,
  total_steps integer default 0,
  total_distance_km numeric default 0,
  avg_hr integer,
  sleep_hours numeric,
  weight_kg numeric,
  workout_count integer default 0,
  created_at timestamptz default now(),
  unique(user_id, day)
);

-- RLS for new tables
alter table public.heart_rate_logs enable row level security;
alter table public.steps_logs enable row level security;
alter table public.integration_imports enable row level security;
alter table public.daily_summaries enable row level security;

do $$ declare t text; begin
  foreach t in array array['heart_rate_logs','steps_logs','integration_imports','daily_summaries'] loop
    execute format('drop policy if exists %I on public.%I', t||'_own_all', t);
    execute format('create policy %I on public.%I for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)', t||'_own_all', t);
  end loop;
end $$;

grant all on public.heart_rate_logs, public.steps_logs, public.integration_imports, public.daily_summaries to authenticated;
