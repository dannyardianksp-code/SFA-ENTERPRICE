-- `category` sudah ada di skema (VARCHAR(100), belum pernah dipakai
-- kode/model manapun) -- cuma photo_url yang benar-benar baru.
ALTER TABLE products
    ADD COLUMN photo_url TEXT NULL;
