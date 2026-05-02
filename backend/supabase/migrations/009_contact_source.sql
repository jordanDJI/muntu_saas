-- Canal d'entrée du client (bouche à oreille, Google, réseaux sociaux, etc.)
ALTER TABLE contact ADD COLUMN IF NOT EXISTS source VARCHAR(50);
