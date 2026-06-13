-- 041 — Capacité booking (1:1 → 1:N) + taille du groupe
-- capacity : nb max de réservations simultanées par créneau (1 = comportement actuel)
-- party_size : nb de personnes dans la réservation (restaurant: table de 4, atelier: groupe)

ALTER TABLE availability_slot
  ADD COLUMN IF NOT EXISTS capacity int NOT NULL DEFAULT 1 CHECK (capacity >= 1);

ALTER TABLE appointment
  ADD COLUMN IF NOT EXISTS party_size int NOT NULL DEFAULT 1 CHECK (party_size >= 1);
