-- Add country field to tenant
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'BE';
