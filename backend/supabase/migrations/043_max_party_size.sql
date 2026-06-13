-- Migration 043 : taille max de groupe par créneau
-- 1 = solo (défaut), > 1 = réservations groupées autorisées
ALTER TABLE availability_slot
  ADD COLUMN IF NOT EXISTS max_party_size int NOT NULL DEFAULT 1 CHECK (max_party_size >= 1);
