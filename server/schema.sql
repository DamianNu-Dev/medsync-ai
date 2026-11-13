-- ============================================================================
-- MedSync AI · Esquema de base de datos para Supabase
-- ============================================================================
-- Ejecutar este SQL en el Editor SQL de Supabase (https://app.supabase.com)
-- ============================================================================

-- Habilitar extensiones necesarias
create extension if not exists "pgcrypto";

-- Tabla de usuarios (pacientes y cuidadores)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  role text not null check (role in ('patient', 'caregiver')),
  patient_code text unique,           -- solo para pacientes: MED-XXXX
  linked_patient_id uuid references users(id), -- solo para cuidadores: a qué paciente están vinculados
  password_salt text not null,
  password_hash text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Índices para búsquedas rápidas
create index if not exists idx_users_email on users(email);
create index if not exists idx_users_patient_code on users(patient_code);
create index if not exists idx_users_role on users(role);
create index if not exists idx_users_linked_patient on users(linked_patient_id);

-- Tabla de sesiones activas (máximo 5 por usuario)
create table if not exists sessions (
  token text primary key,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz default now()
);

create index if not exists idx_sessions_user_id on sessions(user_id);
create index if not exists idx_sessions_created_at on sessions(created_at);

-- Tabla de estados de pacientes (tratamientos, dosis, etc. en JSON)
create table if not exists patient_states (
  user_id uuid primary key references users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

create index if not exists idx_patient_states_updated_at on patient_states(updated_at);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Usuarios: cada uno solo puede ver su propio perfil
alter table users enable row level security;
create policy "users_select_own" on users
  for select using (auth.uid()::text = id::text or email = auth.email());
create policy "users_insert_own" on users
  for insert with check (true); -- registro público permitido
create policy "users_update_own" on users
  for update using (auth.uid()::text = id::text);

-- Sesiones: solo el dueño puede ver/crear/borrar sus sesiones
alter table sessions enable row level security;
create policy "sessions_select_own" on sessions
  for select using (auth.uid()::text = user_id::text);
create policy "sessions_insert_own" on sessions
  for insert with check (true);
create policy "sessions_delete_own" on sessions
  for delete using (auth.uid()::text = user_id::text);

-- Estados de pacientes: solo el paciente dueño puede leer/escribir
-- Los cuidadores vinculados pueden leer el estado del paciente al que están vinculados
alter table patient_states enable row level security;
create policy "patient_states_select_owner" on patient_states
  for select using (
    auth.uid()::text = user_id::text
    or exists (
      select 1 from users
      where users.id = patient_states.user_id
        and users.linked_patient_id = auth.uid()
        and users.role = 'caregiver'
    )
  );
create policy "patient_states_insert_owner" on patient_states
  for insert with check (auth.uid()::text = user_id::text);
create policy "patient_states_update_owner" on patient_states
  for update using (auth.uid()::text = user_id::text);

-- ============================================================================
-- Función para limpiar sesiones expiradas (opcional, ejecutar periódicamente)
-- ============================================================================
-- create or replace function cleanup_expired_sessions()
-- returns void as $$
-- begin
--   delete from sessions where created_at < now() - interval '30 days';
-- end;
-- $$ language plpgsql;
