-- Tambah 'SPG' dan 'SALES' sebagai nilai baru di enum users.role.
-- Murni ADDITIF -- tidak ada rename/hapus nilai lama, jadi aman
-- langsung ALTER sekali (beda dengan 014 yang harus 3 langkah karena
-- migrasi baris existing dari satu nilai ke nilai lain).
ALTER TABLE users MODIFY COLUMN role ENUM(
    'MD',
    'SPG',
    'SALES',
    'SUPERVISOR',
    'MANAGER',
    'REGIONAL MANAGER',
    'GENERAL MANAGER',
    'ADMINISTRATOR'
) DEFAULT 'MD';
