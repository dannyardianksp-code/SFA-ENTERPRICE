-- 001 add customer code fields
--
-- 1. customer_groups.code  -> dipakai sebagai prefix kode customer
-- 2. customers.location_accuracy (meter) -> jejak kualitas GPS saat didaftarkan
-- 3. unique index pada customers.code -> pengaman race condition generator
--
-- Aturan customer_groups.code: hanya A-Z, tanpa angka, tanpa tanda hubung.
-- Tanda hubung akan merusak pola kode customer {PREFIX}-{YY}{NNNN}.

ALTER TABLE customer_groups ADD COLUMN code VARCHAR(10) NULL AFTER id;

UPDATE customer_groups SET code = 'IDM' WHERE name = 'IDM';
UPDATE customer_groups SET code = 'SAT' WHERE name = 'SAT';
UPDATE customer_groups SET code = 'MID' WHERE name = 'MIDI';
UPDATE customer_groups SET code = 'IGR' WHERE name = 'INDOGROSIR';
UPDATE customer_groups SET code = 'NGA' WHERE name = 'NAGA';
UPDATE customer_groups SET code = 'HRH' WHERE name = 'HARI-HARI';

ALTER TABLE customers ADD COLUMN location_accuracy DECIMAL(7,2) NULL;

ALTER TABLE customers ADD UNIQUE INDEX uq_customers_code (code);
