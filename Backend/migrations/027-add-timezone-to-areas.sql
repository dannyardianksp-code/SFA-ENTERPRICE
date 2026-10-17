-- Indonesia punya 3 zona waktu (WIB/WITA/WIT) -- sebelum ini seluruh
-- sistem (koneksi DB + tampilan report) dipaksa WIB (lihat
-- BUSINESS_TIMEZONE di date.util.js dan hardcode Asia/Jakarta di
-- attendance/page.tsx), jadi absen pegawai di luar WIB tampil salah
-- jam di report.
--
-- Default 'Asia/Jakarta' -- perilaku SEKARANG (semua area dianggap
-- WIB) tidak berubah sampai admin eksplisit mengubah timezone area
-- tertentu ke WITA/WIT.
ALTER TABLE areas
    ADD COLUMN timezone VARCHAR(32) NOT NULL DEFAULT 'Asia/Jakarta' AFTER checkin_radius_meters;
