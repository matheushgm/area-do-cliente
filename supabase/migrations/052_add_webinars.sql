-- Migration 052: add webinars JSONB column to projects_v2
--
-- Lista de webinars construídos pela ferramenta de Webinar. Cada webinar tem
-- as etapas (abertura, história, conteúdo, oferta para agendamento, oferta
-- direta) com seus blocos preenchíveis. Shape:
-- [{ id, nome, etapas: { abertura: {...}, ... }, createdAt, updatedAt }]
ALTER TABLE projects_v2 ADD COLUMN IF NOT EXISTS webinars JSONB;
