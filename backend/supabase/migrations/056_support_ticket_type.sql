-- Migration 056 — ticket_type sur support_ticket
-- Permet de distinguer les tickets génériques des demandes de design

ALTER TABLE support_ticket
  ADD COLUMN IF NOT EXISTS ticket_type text NOT NULL DEFAULT 'general';

-- Valeurs : 'general' | 'design_request'
COMMENT ON COLUMN support_ticket.ticket_type IS 'Type de ticket : general ou design_request';
