-- Tambah tipe field PRODUCT -- dropdown pilih nama produk yang diambil
-- LIVE dari tabel products (bukan daftar string tetap seperti DROPDOWN).
-- Alasan: Nama Produk sempat jadi TEXT bebas ketik pas migrasi ke
-- activity_field_definitions, tapi itu lepas dari master data produk --
-- produk baru/berubah nama tidak konsisten dengan yang diketik user.
--
-- options TETAP NULL untuk PRODUCT (sama seperti TEXT/NUMBER/DATE/PHOTO)
-- -- daftar pilihannya tidak disimpan di sini, diambil live dari
-- GET /products setiap form dibuka.
ALTER TABLE activity_field_definitions
    MODIFY field_type ENUM('TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'PRODUCT', 'PHOTO') NOT NULL;
