-- Fitness AI Hub v7.1 - Cleaned Schema
-- Fresh install safe - creates base tables if missing

create extension if not exists pgcrypto;

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  date_of_birth date,
  sex_at_birth text,
  height_cm numeric,
  starting_weight_kg numeric,
  current_weight_kg numeric,
  target_weight_kg numeric default 70,
  primary_goal text default 'lose_weight',
  activity_level text default 'moderate',
  target_calories integer default 2200,
  target_protein_g integer default 180,
  target_steps integer default 10000 check (target_steps between 1000 and 50000),
  target_sleep_hours numeric(3,1) default 7.5,
  resting_hr integer default 60,
  allergies text,
  garmin_connected boolean default false,
  strava_connected boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.profiles add column if not exists target_steps integer default 10000;
alter table public.profiles add column if not exists target_sleep_hours numeric(3,1) default 7.5;
alter table public.profiles add column if not exists resting_hr integer default 60;
alter table public.profiles add column if not exists garmin_connected boolean default false;
alter table public.profiles add column if not exists strava_connected boolean default false;
alter table public.profiles add column if not exists allergies text;

-- Meal logs
create table if not exists public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_name text not null,
  meal_type text,
  category text,
  calories integer not null,
  protein_g numeric default 0,
  carbs_g numeric default 0,
  fat_g numeric default 0,
  source text default 'Manual',
  logged_at timestamptz default now(),
  created_at timestamptz default now()
);
-- Activity logs
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_name text not null,
  duration_minutes integer default 0,
  calories_burned integer default 0,
  distance_km numeric default 0,
  source text default 'Manual',
  logged_at timestamptz default now(),
  created_at timestamptz default now()
);
-- Body logs
create table if not exists public.body_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weight_kg numeric not null,
  body_fat_percent numeric,
  muscle_mass_kg numeric,
  bmi numeric,
  source text default 'Manual',
  logged_at timestamptz default now(),
  created_at timestamptz default now()
);
-- Workout sessions
create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_name text not null,
  logged_at timestamptz default now(),
  created_at timestamptz default now()
);
create table if not exists public.workout_exercise_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.workout_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_name text not null,
  sets integer default 3,
  reps integer default 10,
  weight_kg numeric default 0,
  created_at timestamptz default now()
);
-- Water
create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_ml integer default 250,
  logged_at timestamptz default now(),
  created_at timestamptz default now()
);
-- Sleep
create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  duration_hours numeric not null,
  quality integer default 3,
  deep_minutes integer default 0,
  rem_minutes integer default 0,
  light_minutes integer default 0,
  awake_minutes integer default 0,
  score integer default 0 check (score between 0 and 100),
  source text default 'Manual',
  logged_at timestamptz default now(),
  created_at timestamptz default now()
);
-- Progress photos
create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  photo_url text not null,
  photo_type text default 'Front',
  logged_at timestamptz default now(),
  created_at timestamptz default now()
);
-- Heart rate
create table if not exists public.heart_rate_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bpm integer not null check (bpm between 20 and 250),
  resting_bpm integer,
  max_bpm integer,
  avg_bpm integer,
  source text default 'Manual',
  logged_at timestamptz default now(),
  created_at timestamptz default now()
);
create index if not exists hr_user_date_idx on public.heart_rate_logs(user_id, logged_at desc);

-- Steps
create table if not exists public.steps_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  steps integer not null check (steps >=0),
  distance_km numeric(6,2) default 0,
  calories_burned integer default 0,
  source text default 'Manual',
  logged_at timestamptz default now(),
  created_at timestamptz default now()
);
create index if not exists steps_user_date_idx on public.steps_logs(user_id, logged_at desc);

-- Imports
create table if not exists public.integration_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  file_name text,
  records_count integer default 0,
  raw_summary jsonb,
  logged_at timestamptz default now()
);

-- Storage bucket for photos
insert into storage.buckets (id, name, public) values ('progress-photos', 'progress-photos', false) on conflict (id) do nothing;

-- RLS
alter table public.profiles enable row level security;
alter table public.meal_logs enable row level security;
alter table public.activity_logs enable row level security;
alter table public.body_logs enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_exercise_logs enable row level security;
alter table public.water_logs enable row level security;
alter table public.sleep_logs enable row level security;
alter table public.progress_photos enable row level security;
alter table public.heart_rate_logs enable row level security;
alter table public.steps_logs enable row level security;
alter table public.integration_imports enable row level security;

do $$ declare t text; begin
  foreach t in array array['profiles','meal_logs','activity_logs','body_logs','workout_sessions','workout_exercise_logs','water_logs','sleep_logs','progress_photos','heart_rate_logs','steps_logs','integration_imports'] loop
    execute format('drop policy if exists %I on public.%I', t||'_own_all', t);
    execute format('create policy %I on public.%I for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)', t||'_own_all', t);
  end loop;
end $$;

-- Allow insert for profiles on signup
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid())=id);

grant all on all tables in schema public to authenticated;
grant all on storage.objects to authenticated;
grant all on storage.buckets to authenticated;
