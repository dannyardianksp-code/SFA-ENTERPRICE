-- Kontrol per-user boleh/tidaknya login lewat sfa-web, diatur admin
-- lewat form user -- bukan hardcode role SPG lagi di auth.controller.js.
ALTER TABLE users ADD COLUMN can_access_web TINYINT(1) NOT NULL DEFAULT 1;

-- Pertahankan perilaku sekarang: SPG yang sudah ada tetap terkunci dari
-- web sampai admin membukanya manual lewat form edit user.
UPDATE users SET can_access_web = 0 WHERE role = 'SPG';
