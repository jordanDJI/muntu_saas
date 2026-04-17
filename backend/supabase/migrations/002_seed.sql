-- ============================================================
-- Seed — Plans & Templates
-- ============================================================

-- Plans
INSERT INTO plan_subscription (id, name, price_eur, features) VALUES
    (uuid_generate_v4(), 'Starter',  29.00, '{"sites": 1, "leads": 100, "appointments": 50}'),
    (uuid_generate_v4(), 'Pro',      59.00, '{"sites": 3, "leads": 500, "appointments": 200, "analytics": true}'),
    (uuid_generate_v4(), 'Business', 99.00, '{"sites": 10, "leads": -1, "appointments": -1, "analytics": true, "b2b": true}');

-- Templates
INSERT INTO template (id, name, sector) VALUES
    (uuid_generate_v4(), 'Infirmière à domicile',   'health'),
    (uuid_generate_v4(), 'Kinésithérapeute',         'health'),
    (uuid_generate_v4(), 'Coach / Consultant',       'coaching'),
    (uuid_generate_v4(), 'Artisan / Commerçant',     'trade'),
    (uuid_generate_v4(), 'Esthéticienne / Beauté',   'beauty'),
    (uuid_generate_v4(), 'Conseiller financier',     'finance'),
    (uuid_generate_v4(), 'Autre professionnel',      'other');
