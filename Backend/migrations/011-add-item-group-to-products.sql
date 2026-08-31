-- Klasifikasi tambahan per product, terpisah dari `category`
-- (JUAL/PROMOSI/COMPETITOR). Nilai tetap: CC, CMP, NDC, RMS, RTD --
-- diinput langsung lewat form, tidak perlu tabel master baru.
ALTER TABLE products ADD COLUMN item_group VARCHAR(10) NULL;
