-- Menu Access sekarang per (channel, role), bukan cuma per role --
-- tiap channel mengatur menunya sendiri-sendiri, TIDAK ADA aturan
-- bersama/fallback yang dipakai semua channel (beda pola dengan
-- channel_ids di incentive_rules yang boleh kosong = semua channel).
--
-- Baris yang sudah ada (override per role, sebelum fitur ini) di-copy
-- ke SETIAP channel supaya jadi titik awal yang sama persis dengan
-- config yang berjalan sekarang -- tidak ada channel yang tiba-tiba
-- kehilangan override yang sudah disetel sebelumnya. Admin tinggal
-- menyesuaikan per channel dari titik awal itu.

ALTER TABLE role_menu_overrides ADD COLUMN channel_id INT NULL AFTER role;

-- PK lama (role, menu_key) harus dicabut DULU -- kalau tidak, INSERT
-- di bawah (satu baris lama jadi N baris, satu per channel) langsung
-- kena duplicate-key karena PK lama tidak mengenal channel_id sama
-- sekali.
ALTER TABLE role_menu_overrides DROP PRIMARY KEY;

INSERT INTO role_menu_overrides (channel_id, role, menu_key, visible)
SELECT c.id, r.role, r.menu_key, r.visible
FROM role_menu_overrides r
CROSS JOIN channels c
WHERE r.channel_id IS NULL;

DELETE FROM role_menu_overrides WHERE channel_id IS NULL;

ALTER TABLE role_menu_overrides MODIFY COLUMN channel_id INT NOT NULL;

ALTER TABLE role_menu_overrides ADD PRIMARY KEY (channel_id, role, menu_key);

ALTER TABLE role_menu_overrides
    ADD CONSTRAINT fk_role_menu_overrides_channel
    FOREIGN KEY (channel_id) REFERENCES channels(id);
