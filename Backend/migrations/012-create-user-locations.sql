-- Live tracking (near-live) -- 1 baris per user, ditimpa (upsert) tiap
-- kali mobile kirim ping lokasi selama app kebuka. Bukan history/log
-- perjalanan, cuma posisi TERAKHIR yang diketahui.
CREATE TABLE user_locations (
    user_id INT PRIMARY KEY,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    accuracy DECIMAL(7, 2) NULL,
    updated_at DATETIME NOT NULL
);
