-- Migration 058 — Lien entre design_request et support_ticket
ALTER TABLE design_request
  ADD COLUMN IF NOT EXISTS support_ticket_id uuid REFERENCES support_ticket(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_design_request_ticket
  ON design_request(support_ticket_id)
  WHERE support_ticket_id IS NOT NULL;

COMMENT ON COLUMN design_request.support_ticket_id IS 'Ticket support associé pour le thread de conversation';
