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
-- Seguridad (RLS)
-- ============================================================================
-- Toda la base de datos se usa ÚNICAMENTE desde el backend (Node.js en Render),
-- que guarda sus claves en variables de entorno del servidor y nunca las envía
-- a la app. El teléfono nunca habla directo con Supabase.
--
-- Por eso RLS se desactiva aquí: con RLS activo y sin sesión de Supabase Auth,
-- las políticas basadas en auth.uid() bloqueaban TODAS las consultas del
-- backend y el registro/login fallaban con "Error al buscar usuario".
-- El backend además usa SUPABASE_SERVICE_ROLE_KEY cuando está disponible.
--
-- Si en el futuro expones Supabase directamente al cliente, vuelve a activar
-- RLS y crea políticas basadas en auth.uid().
-- ============================================================================

alter table users disable row level security;
alter table sessions disable row level security;
alter table patient_states disable row level security;

-- Elimina políticas antiguas (por si ya se habían creado)
drop policy if exists "users_select_own" on users;
drop policy if exists "users_insert_own" on users;
drop policy if exists "users_update_own" on users;
drop policy if exists "sessions_select_own" on sessions;
drop policy if exists "sessions_insert_own" on sessions;
drop policy if exists "sessions_delete_own" on sessions;
drop policy if exists "patient_states_select_owner" on patient_states;
drop policy if exists "patient_states_insert_owner" on patient_states;
drop policy if exists "patient_states_update_owner" on patient_states;

-- ============================================================================
-- Función para limpiar sesiones expiradas (opcional, ejecutar periódicamente)
-- ============================================================================
-- create or replace function cleanup_expired_sessions()
-- returns void as $$
-- begin
--   delete from sessions where created_at < now() - interval '30 days';
-- end;
-- $$ language plpgsql;
