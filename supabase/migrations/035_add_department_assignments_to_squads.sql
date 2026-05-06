-- Migration 035: ClickUp department-to-profile mapping per squad
-- Stores a JSON object: { departmentName: profile_uuid, ... }
-- Used by the ClickUp integration to assign tasks based on each task's
-- Departamento custom field value.

ALTER TABLE squads ADD COLUMN IF NOT EXISTS department_assignments JSONB NOT NULL DEFAULT '{}'::JSONB;
