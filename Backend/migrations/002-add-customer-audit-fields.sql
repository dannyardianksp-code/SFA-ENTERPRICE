-- 002 add customer audit fields
--
-- Jejak perubahan minimal: siapa yang terakhir mengubah dan kapan.
-- Dibutuhkan begitu fitur edit customer dibuka — tanpa ini data master
-- bisa berubah tanpa bisa dilacak siapa pelakunya.
--
-- Tanpa foreign key constraint, mengikuti pola tabel lain di skema ini.
--
-- Customer lama bernilai NULL pada keduanya, dan layar detail memang
-- tidak menampilkan keterangan "terakhir diubah" untuk mereka. Lebih
-- baik tidak menampilkan apa pun daripada tanggal yang dikarang.

ALTER TABLE customers ADD COLUMN updated_at DATETIME NULL;

ALTER TABLE customers ADD COLUMN updated_by INT NULL;
