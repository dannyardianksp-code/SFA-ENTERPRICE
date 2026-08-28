-- Master data "Class" toko (PASAR, GROSIR, ROMBONG, MODERN MARKET) --
-- klasifikasi terpisah dari Channel (General/Modern Trade) dan
-- Customer Group (banner/chain). Sama struktur dengan channels/areas.
CREATE TABLE classes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50),
    name VARCHAR(100),
    createdAt DATETIME,
    updatedAt DATETIME
);

INSERT INTO classes (code, name, createdAt, updatedAt) VALUES
    ('PSR', 'PASAR', NOW(), NOW()),
    ('GRS', 'GROSIR', NOW(), NOW()),
    ('RBG', 'ROMBONG', NOW(), NOW()),
    ('MMK', 'MODERN MARKET', NOW(), NOW());

-- Tidak dikunci di update (tidak dipakai formatCustomerCode seperti
-- customer_group_id/area_id/channel_id) -- boleh dikoreksi belakangan.
ALTER TABLE customers ADD COLUMN class_id INT NULL;
