-- Migration 036 — Contrainte unicité email par tenant sur contact
-- Évite les doublons quand le même email soumet plusieurs fois le formulaire public.

-- 1. Identifier les doublons : pour chaque groupe (tenant_id, lower(email)),
--    garder le plus ancien (keeper) et lister les autres (dupes).
-- 2. Réassigner toutes les FK pointant vers un dupe vers le keeper.
-- 3. Supprimer les dupes devenus orphelins.
-- 4. Ajouter la contrainte unique.

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Boucle sur chaque contact dupliqué à supprimer
    FOR r IN
        SELECT
            dupe.id   AS dupe_id,
            keeper.id AS keeper_id
        FROM contact dupe
        JOIN (
            -- Le "keeper" = le plus ancien par groupe
            SELECT DISTINCT ON (tenant_id, lower(email)) id, tenant_id, email
            FROM contact
            WHERE email IS NOT NULL AND deleted_at IS NULL
            ORDER BY tenant_id, lower(email), created_at
        ) keeper
          ON keeper.tenant_id = dupe.tenant_id
         AND lower(keeper.email) = lower(dupe.email)
         AND keeper.id <> dupe.id
        WHERE dupe.email IS NOT NULL AND dupe.deleted_at IS NULL
    LOOP
        -- Réassigner les leads
        UPDATE lead        SET contact_id = r.keeper_id WHERE contact_id = r.dupe_id;
        -- Réassigner les RDV (appointment référence contact via contact_id)
        UPDATE appointment SET contact_id = r.keeper_id WHERE contact_id = r.dupe_id;
        -- Réassigner les conversations
        UPDATE conversation SET contact_id = r.keeper_id WHERE contact_id = r.dupe_id;
        -- Réassigner les relances (si migration 034 déjà appliquée)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contact_reminder') THEN
            UPDATE contact_reminder SET contact_id = r.keeper_id WHERE contact_id = r.dupe_id;
        END IF;
        -- Supprimer le contact dupliqué
        DELETE FROM contact WHERE id = r.dupe_id;
    END LOOP;
END $$;

-- 2. Ajouter la contrainte unique (insensible à la casse via index partiel)
CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_tenant_email_unique
    ON contact (tenant_id, lower(email))
    WHERE email IS NOT NULL AND deleted_at IS NULL;
