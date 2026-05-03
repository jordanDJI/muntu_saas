-- Ajoute une colonne note interne (tenant) distincte du message prospect (notes)
ALTER TABLE lead ADD COLUMN IF NOT EXISTS internal_note TEXT;
