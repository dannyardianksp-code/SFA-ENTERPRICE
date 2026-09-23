-- Tarif gaji harian per user. NULL default -- user yang belum di-set
-- tarifnya dianggap belum masuk skema payroll (bukan gaji Rp 0).
ALTER TABLE users ADD COLUMN daily_rate DECIMAL(10,2) NULL DEFAULT NULL;
