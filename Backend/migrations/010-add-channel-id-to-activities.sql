-- Activity per channel -- NULL berarti activity berlaku di semua
-- channel (default 11 activity lama, tidak dipaksa diisi ulang).
ALTER TABLE activities ADD COLUMN channel_id INT NULL;
