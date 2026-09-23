-- Hari kerja per user PER PERIODE (bulan) -- diisi manual oleh admin,
-- bukan dihitung dari kalender, karena tidak ada pola tetap (sebagian
-- MD kerja 5 hari/minggu, sebagian 6, dan bisa berubah).
CREATE TABLE user_work_days (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    period CHAR(7) NOT NULL COMMENT 'YYYY-MM',
    hari_kerja INT NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_user_period (user_id, period)
);
