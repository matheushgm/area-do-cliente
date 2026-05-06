-- Migration 034: ClickUp user mapping on profiles
-- Each Supabase profile maps optionally to a ClickUp user (numeric id).
-- Used by the ClickUp integration to assign squad members to tasks
-- when a new client folder is created.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS clickup_user_id BIGINT;
