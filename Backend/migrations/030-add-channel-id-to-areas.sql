-- Area (kota/wilayah operasional) sebelumnya sama sekali tidak dibatasi
-- channel -- semua area muncul buat semua channel, padahal kenyataannya
-- kota besar memang dipakai bareng semua channel, tapi daerah lain
-- cuma digarap satu channel tertentu (mis. kawasan industri cuma
-- channel Industri, jalur horeka cuma channel Horeka).
--
-- NULL = berlaku buat SEMUA channel (default, sama pola dengan
-- activities.channel_id dan classes.channel_id) -- area yang sudah ada
-- sekarang otomatis tetap muncul di semua channel sampai admin eksplisit
-- membatasinya.
ALTER TABLE areas
    ADD COLUMN channel_id INT NULL AFTER timezone,
    ADD CONSTRAINT fk_areas_channel
    FOREIGN KEY (channel_id) REFERENCES channels(id);
