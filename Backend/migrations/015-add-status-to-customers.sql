-- Deactivate customer -- customer yang tokonya tutup/tidak aktif lagi
-- ditandai INACTIVE (bukan dihapus), supaya riwayat kunjungan/order-nya
-- tetap utuh dan bisa diaktifkan lagi kalau perlu. Sama polanya dengan
-- users.status.
ALTER TABLE customers ADD COLUMN status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE';
