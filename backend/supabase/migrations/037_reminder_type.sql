-- Migration 037 — Types de relance + envoi automatique + tracking envoi

ALTER TABLE contact_reminder
  ADD COLUMN IF NOT EXISTS reminder_type TEXT NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS auto_send     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sent_at       TIMESTAMPTZ;

-- Index pour le job quotidien auto-send
CREATE INDEX IF NOT EXISTS idx_reminder_autosend
  ON contact_reminder (due_date, auto_send, done)
  WHERE auto_send = true AND done = false AND sent_at IS NULL;
