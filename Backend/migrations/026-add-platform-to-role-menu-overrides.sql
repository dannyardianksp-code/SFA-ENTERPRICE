-- Menu Access sekarang juga per PLATFORM (WEB/MOBILE) -- web (sidebar)
-- dan mobile (QuickMenu) punya daftar menu yang SAMA SEKALI BEDA
-- (menu_key berbeda arti di tiap platform), jadi harus dipisah di
-- level baris, bukan cuma dibedakan nama menu_key-nya saja.
--
-- Baris yang sudah ada SEMUANYA baris Web (Menu Access selama ini cuma
-- ada buat web) -- default 'WEB' di ADD COLUMN otomatis mengisi semua
-- baris lama tanpa UPDATE terpisah, lalu PK diperluas supaya kombinasi
-- WEB dan MOBILE untuk (channel, role, menu_key) yang sama bisa
-- hidup berdampingan.

ALTER TABLE role_menu_overrides
    ADD COLUMN platform VARCHAR(10) NOT NULL DEFAULT 'WEB' AFTER channel_id;

-- FK ke channels(id) HARUS dicabut dulu -- begitu PK lama (yang
-- channel_id ada di posisi pertama) dicabut, tidak ada index lagi yang
-- menjadikan channel_id sebagai prefix kiri, dan MySQL menolak
-- rename/alter tabel yang FK-nya jadi "tidak terbentuk dengan benar".
-- channel_id SENGAJA diletakkan di depan platform pada PK baru supaya
-- tetap jadi leftmost prefix, lalu FK dipasang lagi di akhir.
ALTER TABLE role_menu_overrides DROP FOREIGN KEY fk_role_menu_overrides_channel;

ALTER TABLE role_menu_overrides DROP PRIMARY KEY;

ALTER TABLE role_menu_overrides
    ADD PRIMARY KEY (channel_id, platform, role, menu_key);

ALTER TABLE role_menu_overrides
    ADD CONSTRAINT fk_role_menu_overrides_channel
    FOREIGN KEY (channel_id) REFERENCES channels(id);
