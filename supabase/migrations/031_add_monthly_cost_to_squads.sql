-- Migration 031: Add monthly_cost column to squads
-- Stores the operational cost (R$/month) the company pays for the squad,
-- used in the SquadsReport page to compute operational margin.

ALTER TABLE squads ADD COLUMN IF NOT EXISTS monthly_cost NUMERIC(12,2);
