-- 042 — Type de prestation : service | product | menu_item
-- category : permet de grouper (ex. "Entrées", "Plats", "Desserts" pour un restaurant)

ALTER TABLE service_offer
  ADD COLUMN IF NOT EXISTS service_type text NOT NULL DEFAULT 'service'
    CHECK (service_type IN ('service', 'product', 'menu_item'));

ALTER TABLE service_offer
  ADD COLUMN IF NOT EXISTS category text;
