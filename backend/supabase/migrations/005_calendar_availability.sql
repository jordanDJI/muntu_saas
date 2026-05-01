-- Disponibilités hebdomadaires récurrentes
CREATE TABLE IF NOT EXISTS availability_slot (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    calendar_id         UUID NOT NULL REFERENCES calendar(id) ON DELETE CASCADE,
    day_of_week         SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Lun, 6=Dim
    start_time          TIME NOT NULL,
    end_time            TIME NOT NULL,
    slot_duration_min   INT NOT NULL DEFAULT 30,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMP DEFAULT NOW()
);

-- Blocages ponctuels (congés, absences, événements)
CREATE TABLE IF NOT EXISTS blocked_period (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    calendar_id     UUID NOT NULL REFERENCES calendar(id) ON DELETE CASCADE,
    start_at        TIMESTAMPTZ NOT NULL,
    end_at          TIMESTAMPTZ NOT NULL,
    reason          TEXT,
    created_by      VARCHAR(20) DEFAULT 'user', -- 'user' ou 'agent'
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_availability_slot_calendar ON availability_slot(calendar_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_blocked_period_calendar ON blocked_period(calendar_id, start_at, end_at);

-- RLS
ALTER TABLE availability_slot ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_period ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'availability_slot' AND policyname = 'tenant_rls_availability_slot'
  ) THEN
    CREATE POLICY "tenant_rls_availability_slot" ON availability_slot
      USING (
        calendar_id IN (
          SELECT id FROM calendar
          WHERE tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'blocked_period' AND policyname = 'tenant_rls_blocked_period'
  ) THEN
    CREATE POLICY "tenant_rls_blocked_period" ON blocked_period
      USING (
        calendar_id IN (
          SELECT id FROM calendar
          WHERE tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
        )
      );
  END IF;
END $$;
