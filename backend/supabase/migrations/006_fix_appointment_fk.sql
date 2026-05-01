-- Migration 006 — Contrainte FK appointment → service_offer
-- Passe de NO ACTION à SET NULL pour permettre la suppression/remplacement des prestations
-- même si des rendez-vous y font référence.

ALTER TABLE appointment
    DROP CONSTRAINT IF EXISTS appointment_service_offer_id_fkey;

ALTER TABLE appointment
    ADD CONSTRAINT appointment_service_offer_id_fkey
    FOREIGN KEY (service_offer_id)
    REFERENCES service_offer(id)
    ON DELETE SET NULL;
