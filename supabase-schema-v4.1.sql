-- Fitness AI Hub v7.1.2 - Fixed for Supabase SQL Editor - No DO block
create extension if not exists pgcrypto;

-- 1. PROFILES
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
  target_steps integer default 10000,
  target_sleep_hours numeric default 7.5,
  resting_hr integer default 60,
  allergies text,
  garmin_connected boolean default false,
  strava_connected boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. MEAL
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

-- 3. ACTIVITY
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

-- 4. BODY
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

-- 5. WORKOUT
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

-- 6. WATER
create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_ml integer default 250,
  logged_at timestamptz default now(),
  created_at timestamptz default now()
);

-- 7. SLEEP
create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  duration_hours numeric not null,
  quality integer default 3,
  deep_minutes integer default 0,
  rem_minutes integer default 0,
  light_minutes integer default 0,
  awake_minutes integer default 0,
  score integer default 0,
  source text default 'Manual',
  logged_at timestamptz default now(),
  created_at timestamptz default now()
);

-- 8. PHOTOS
create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  photo_url text not null,
  photo_type text default 'Front',
  logged_at timestamptz default now(),
  created_at timestamptz default now()
);

-- 9. HR
create table if not exists public.heart_rate_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bpm integer not null,
  resting_bpm integer,
  max_bpm integer,
  avg_bpm integer,
  source text default 'Manual',
  logged_at timestamptz default now(),
  created_at timestamptz default now()
);

-- 10. STEPS
create table if not exists public.steps_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  steps integer not null,
  distance_km numeric default 0,
  calories_burned integer default 0,
  source text default 'Manual',
  logged_at timestamptz default now(),
  created_at timestamptz default now()
);

-- 11. IMPORTS
create table if not exists public.integration_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  file_name text,
  records_count integer default 0,
  raw_summary jsonb,
  logged_at timestamptz default now()
);

-- Bucket
insert into storage.buckets (id, name, public) values ('progress-photos', 'progress-photos', false) on conflict (id) do nothing;

-- RLS Enable
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

-- Profiles policies - FIXED (uses id not user_id)
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_delete_own on public.profiles;
drop policy if exists profiles_own_all on public.profiles;

create policy profiles_select_own on public.profiles for select to authenticated using (auth.uid() = id);
create policy profiles_insert_own on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy profiles_update_own on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy profiles_delete_own on public.profiles for delete to authenticated using (auth.uid() = id);

-- Other tables policies (one by one, no loop)
drop policy if exists meal_logs_own_all on public.meal_logs;
create policy meal_logs_own_all on public.meal_logs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists activity_logs_own_all on public.activity_logs;
create policy activity_logs_own_all on public.activity_logs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists body_logs_own_all on public.body_logs;
create policy body_logs_own_all on public.body_logs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists workout_sessions_own_all on public.workout_sessions;
create policy workout_sessions_own_all on public.workout_sessions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists workout_exercise_logs_own_all on public.workout_exercise_logs;
create policy workout_exercise_logs_own_all on public.workout_exercise_logs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists water_logs_own_all on public.water_logs;
create policy water_logs_own_all on public.water_logs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists sleep_logs_own_all on public.sleep_logs;
create policy sleep_logs_own_all on public.sleep_logs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists progress_photos_own_all on public.progress_photos;
create policy progress_photos_own_all on public.progress_photos for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists heart_rate_logs_own_all on public.heart_rate_logs;
create policy heart_rate_logs_own_all on public.heart_rate_logs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists steps_logs_own_all on public.steps_logs;
create policy steps_logs_own_all on public.steps_logs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists integration_imports_own_all on public.integration_imports;
create policy integration_imports_own_all on public.integration_imports for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Storage policy for photos
drop policy if exists "progress-photos own" on storage.objects;
create policy "progress-photos own" on storage.objects for all to authenticated using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Indexes
create index if not exists hr_user_date_idx on public.heart_rate_logs(user_id, logged_at desc);
create index if not exists steps_user_date_idx on public.steps_logs(user_id, logged_at desc);
create index if not exists body_user_date_idx on public.body_logs(user_id, logged_at desc);
create index if not exists meal_user_date_idx on public.meal_logs(user_id, logged_at desc);
