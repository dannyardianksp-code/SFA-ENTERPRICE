-- Field dinamis per Activity -- menggantikan ACTIVITY_FIELD_RULES yang
-- sebelumnya hardcode di kode (activity-field-rules.util.js). Admin
-- susun field dari web (label, tipe, wajib/opsional, urutan), form
-- mobile digenerate dari sini -- activity baru tidak lagi butuh deploy
-- kode.
--
-- field_type dibatasi ke 5 tipe TETAP (bukan bebas) -- justru supaya
-- mobile cukup tau cara render 5 tipe ini sekali, lalu activity BARU
-- apa pun (kombinasi field apa pun dari 5 tipe ini) otomatis jalan
-- tanpa update aplikasi.
--
-- options dipakai cuma buat DROPDOWN (JSON array of string), NULL buat
-- tipe lain.
CREATE TABLE activity_field_definitions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    activity_id INT NOT NULL,
    label VARCHAR(150) NOT NULL,
    field_type ENUM('TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'PHOTO') NOT NULL,
    options JSON NULL,
    required TINYINT(1) NOT NULL DEFAULT 1,
    display_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_activity_field_definitions_activity (activity_id)
);
