-- Unknown historical counts remain NULL, distinct from zero WORK.
ALTER TABLE clear_records ADD COLUMN work_count INTEGER CHECK (work_count IS NULL OR (typeof(work_count) = 'integer' AND work_count >= 0 AND work_count <= 9007199254740991));
ALTER TABLE bankroll_records ADD COLUMN work_count INTEGER CHECK (work_count IS NULL OR (typeof(work_count) = 'integer' AND work_count >= 0 AND work_count <= 9007199254740991));
