-- NULL berarti "pakai default global" (50 meter) -- kolom ini cuma
-- diisi kalau satu area butuh radius yang berbeda (mis. sinyal GPS
-- yang jelek bikin bacaan sering meleset, jadi radiusnya dilonggarkan).
ALTER TABLE areas ADD COLUMN checkin_radius_meters INT NULL;
