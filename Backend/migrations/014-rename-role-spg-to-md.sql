-- Ganti nama role SPG jadi MD -- murni penamaan, hirarki/permission
-- sama persis (masih role pertama sebelum SUPERVISOR).
-- 3 langkah supaya baris existing tidak pernah invalid di tengah jalan:
-- ENUM MySQL yang kehilangan sebuah value langsung menolak baris yang
-- masih memakainya, jadi 'SPG' harus tetap ada di ENUM sampai semua
-- baris sudah dipindah ke 'MD'.
ALTER TABLE users MODIFY COLUMN role ENUM(
    'SPG',
    'MD',
    'SUPERVISOR',
    'MANAGER',
    'REGIONAL MANAGER',
    'GENERAL MANAGER',
    'ADMINISTRATOR'
) DEFAULT 'SPG';

UPDATE users SET role = 'MD' WHERE role = 'SPG';

ALTER TABLE users MODIFY COLUMN role ENUM(
    'MD',
    'SUPERVISOR',
    'MANAGER',
    'REGIONAL MANAGER',
    'GENERAL MANAGER',
    'ADMINISTRATOR'
) DEFAULT 'MD';
