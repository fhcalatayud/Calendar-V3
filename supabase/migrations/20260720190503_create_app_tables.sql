/*
# Create core app tables (perfiles_usuario, turnos_trabajo, quehaceres_diarios, etiquetas)

1. Context
The frontend already references these four tables but they were missing from the schema,
causing "Could not find the table 'public.perfiles_usuario' in the schema cache" errors.
This migration creates all four with owner-scoped RLS (the app has a sign-in screen).

2. New Tables
- `perfiles_usuario`: one row per user, stores their work-shift hour defaults.
  - `id` (uuid, PK, references auth.users) — the user's own id.
  - `esta_trabajando` (boolean, default true).
  - `h_inicio_manana`, `h_fin_manana`, `h_inicio_tarde`, `h_fin_tarde`,
    `h_inicio_noche`, `h_fin_noche`, `h_inicio_partido`, `h_fin_partido` (text, HH:MM:SS).
- `turnos_trabajo`: one shift per user per day.
  - `id` (uuid, PK).
  - `usuario_id` (uuid, NOT NULL, DEFAULT auth.uid()).
  - `fecha` (date, NOT NULL).
  - `tipo` (text, NOT NULL): mañana | tarde | noche | partido | libre | vacaciones.
  - `hora_inicio`, `hora_fin` (text, HH:MM).
  - Unique constraint on (usuario_id, fecha) for upsert.
- `quehaceres_diarios`: scheduled activities/events.
  - `id` (uuid, PK).
  - `usuario_id` (uuid, NOT NULL, DEFAULT auth.uid()).
  - `tarea` (text, NOT NULL).
  - `fecha` (date).
  - `fecha_inicio`, `fecha_fin` (timestamptz).
  - `completado` (boolean, default false).
  - `etiqueta_id` (uuid, FK to etiquetas, nullable, ON DELETE SET NULL).
- `etiquetas`: user-defined tags for activities.
  - `id` (uuid, PK).
  - `usuario_id` (uuid, NOT NULL, DEFAULT auth.uid()).
  - `nombre` (text, NOT NULL).
  - `motivo` (text, nullable).
  - `color` (text, NOT NULL).
  - `created_at` (timestamptz, default now()).

3. Security
- RLS enabled on every table.
- 4 owner-scoped policies (SELECT/INSERT/UPDATE/DELETE) per table, TO authenticated,
  using auth.uid() = usuario_id (or auth.uid() = id for perfiles_usuario).
- perfiles_usuario.id defaults to auth.uid() so the profile row is owned by its user.

4. Notes
- All owner columns default to auth.uid() so frontend inserts that omit usuario_id succeed.
- Idempotent: uses IF NOT EXISTS and drops policies before recreating.
*/

CREATE TABLE IF NOT EXISTS perfiles_usuario (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  esta_trabajando boolean NOT NULL DEFAULT true,
  h_inicio_manana text,
  h_fin_manana text,
  h_inicio_tarde text,
  h_fin_tarde text,
  h_inicio_noche text,
  h_fin_noche text,
  h_inicio_partido text,
  h_fin_partido text
);

CREATE TABLE IF NOT EXISTS etiquetas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  motivo text,
  color text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS turnos_trabajo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  tipo text NOT NULL,
  hora_inicio text,
  hora_fin text,
  UNIQUE (usuario_id, fecha)
);

CREATE TABLE IF NOT EXISTS quehaceres_diarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  tarea text NOT NULL,
  fecha date,
  fecha_inicio timestamptz,
  fecha_fin timestamptz,
  completado boolean NOT NULL DEFAULT false,
  etiqueta_id uuid REFERENCES etiquetas(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE perfiles_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE etiquetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos_trabajo ENABLE ROW LEVEL SECURITY;
ALTER TABLE quehaceres_diarios ENABLE ROW LEVEL SECURITY;

-- perfiles_usuario policies
DROP POLICY IF EXISTS "select_own_perfil" ON perfiles_usuario;
CREATE POLICY "select_own_perfil" ON perfiles_usuario FOR SELECT
  TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "insert_own_perfil" ON perfiles_usuario;
CREATE POLICY "insert_own_perfil" ON perfiles_usuario FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "update_own_perfil" ON perfiles_usuario;
CREATE POLICY "update_own_perfil" ON perfiles_usuario FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "delete_own_perfil" ON perfiles_usuario;
CREATE POLICY "delete_own_perfil" ON perfiles_usuario FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- etiquetas policies
DROP POLICY IF EXISTS "select_own_etiquetas" ON etiquetas;
CREATE POLICY "select_own_etiquetas" ON etiquetas FOR SELECT
  TO authenticated USING (auth.uid() = usuario_id);
DROP POLICY IF EXISTS "insert_own_etiquetas" ON etiquetas;
CREATE POLICY "insert_own_etiquetas" ON etiquetas FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = usuario_id);
DROP POLICY IF EXISTS "update_own_etiquetas" ON etiquetas;
CREATE POLICY "update_own_etiquetas" ON etiquetas FOR UPDATE
  TO authenticated USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);
DROP POLICY IF EXISTS "delete_own_etiquetas" ON etiquetas;
CREATE POLICY "delete_own_etiquetas" ON etiquetas FOR DELETE
  TO authenticated USING (auth.uid() = usuario_id);

-- turnos_trabajo policies
DROP POLICY IF EXISTS "select_own_turnos" ON turnos_trabajo;
CREATE POLICY "select_own_turnos" ON turnos_trabajo FOR SELECT
  TO authenticated USING (auth.uid() = usuario_id);
DROP POLICY IF EXISTS "insert_own_turnos" ON turnos_trabajo;
CREATE POLICY "insert_own_turnos" ON turnos_trabajo FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = usuario_id);
DROP POLICY IF EXISTS "update_own_turnos" ON turnos_trabajo;
CREATE POLICY "update_own_turnos" ON turnos_trabajo FOR UPDATE
  TO authenticated USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);
DROP POLICY IF EXISTS "delete_own_turnos" ON turnos_trabajo;
CREATE POLICY "delete_own_turnos" ON turnos_trabajo FOR DELETE
  TO authenticated USING (auth.uid() = usuario_id);

-- quehaceres_diarios policies
DROP POLICY IF EXISTS "select_own_quehaceres" ON quehaceres_diarios;
CREATE POLICY "select_own_quehaceres" ON quehaceres_diarios FOR SELECT
  TO authenticated USING (auth.uid() = usuario_id);
DROP POLICY IF EXISTS "insert_own_quehaceres" ON quehaceres_diarios;
CREATE POLICY "insert_own_quehaceres" ON quehaceres_diarios FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = usuario_id);
DROP POLICY IF EXISTS "update_own_quehaceres" ON quehaceres_diarios;
CREATE POLICY "update_own_quehaceres" ON quehaceres_diarios FOR UPDATE
  TO authenticated USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);
DROP POLICY IF EXISTS "delete_own_quehaceres" ON quehaceres_diarios;
CREATE POLICY "delete_own_quehaceres" ON quehaceres_diarios FOR DELETE
  TO authenticated USING (auth.uid() = usuario_id);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_turnos_usuario_fecha ON turnos_trabajo (usuario_id, fecha);
CREATE INDEX IF NOT EXISTS idx_quehaceres_usuario_fecha ON quehaceres_diarios (usuario_id, fecha);
CREATE INDEX IF NOT EXISTS idx_quehaceres_usuario_rango ON quehaceres_diarios (usuario_id, fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_etiquetas_usuario ON etiquetas (usuario_id);
