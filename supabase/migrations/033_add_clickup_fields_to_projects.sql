-- Migration 033: ClickUp integration fields
-- Stores ClickUp folder/list refs created automatically when a new client
-- is registered. Used to build deep-links from the client profile and to
-- skip duplicate creation if the integration is retried.

ALTER TABLE projects_v2 ADD COLUMN IF NOT EXISTS clickup_folder_id TEXT;
ALTER TABLE projects_v2 ADD COLUMN IF NOT EXISTS clickup_list_id   TEXT;
ALTER TABLE projects_v2 ADD COLUMN IF NOT EXISTS clickup_list_url  TEXT;
