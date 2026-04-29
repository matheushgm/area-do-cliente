-- Migration 030: Add churn_date column to projects_v2
-- Stores the date when a client's contract ended (set when momento → 'churn')

ALTER TABLE projects_v2 ADD COLUMN IF NOT EXISTS churn_date DATE;
