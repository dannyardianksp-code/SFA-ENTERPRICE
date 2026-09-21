-- Menu Access: role bisa nyembunyiin/nampilin menu tertentu di sidebar,
-- override dari default per grup (MAIN/SALES=keliatan, ADMIN=disembunyikan)
-- yang didefinisikan di sfa-web/app/utils/sidebar-menu.ts.
--
-- Cuma nyimpen OVERRIDE, bukan matriks penuh -- baris yang gak ada di
-- sini berarti "pakai default grup". Jadi menu baru yang ditambahkan
-- developer ke sidebar-menu.ts otomatis kebagian default yang masuk
-- akal buat semua role, tanpa perlu migration data tambahan.
--
-- ADMINISTRATOR SENGAJA tidak pernah punya baris di sini -- selalu
-- lihat semua menu tanpa terkecuali, tidak bisa dibatasi lewat fitur
-- ini (lihat gerbang di roleMenuAccess.controller.js).
CREATE TABLE role_menu_overrides (
    role VARCHAR(32) NOT NULL,
    menu_key VARCHAR(64) NOT NULL,
    visible TINYINT(1) NOT NULL,
    PRIMARY KEY (role, menu_key)
);
