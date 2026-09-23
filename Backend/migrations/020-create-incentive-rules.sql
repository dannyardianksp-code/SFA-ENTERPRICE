-- Skema insentif -- bisa lebih dari satu rule aktif sekaligus, tiap
-- rule kriterianya beda-beda (kunjungan customer group tertentu, atau
-- activity tertentu), berlaku buat role tertentu saja.
--
-- criteria_ids: JSON array id customer_group ATAU id activity,
-- tergantung `jenis` -- dipilih lewat checklist di halaman Pengaturan.
-- roles: JSON array nama role (string), role mana saja skema ini berlaku.
--
-- ambang_minimal: persentase minimal dari target supaya dapat bonus
-- (di bawahnya bonus Rp 0). Begitu tercapai, bonus dihitung
-- proporsional terhadap persentase pencapaian, maksimal 100% di target
-- penuh -- lihat src/utils/incentive.util.js (hitungBonus), SATU-
-- SATUNYA tempat rumus ini boleh dihitung.
CREATE TABLE incentive_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama VARCHAR(150) NOT NULL,
    jenis ENUM('CUSTOMER_GROUP_VISIT', 'ACTIVITY') NOT NULL,
    criteria_ids JSON NOT NULL,
    target INT NOT NULL,
    frekuensi ENUM('HARIAN', 'BULANAN') NOT NULL,
    bonus DECIMAL(12,2) NOT NULL,
    ambang_minimal INT NOT NULL DEFAULT 80,
    roles JSON NOT NULL,
    aktif TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
