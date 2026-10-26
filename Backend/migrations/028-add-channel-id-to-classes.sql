-- Class (klasifikasi toko -- PASAR/GROSIR/ROMBONG vs MODERN MARKET,
-- dll) sebelumnya sama sekali tidak dibatasi channel -- semua pilihan
-- class muncul buat semua customer apa pun channel-nya, padahal
-- klasifikasinya sendiri jelas berbeda gaya per channel (general trade
-- vs modern trade vs food service).
--
-- NULL = berlaku buat SEMUA channel (default, sama pola dengan
-- activities.channel_id) -- class yang sudah ada sekarang otomatis
-- tetap muncul di semua channel sampai admin eksplisit membatasinya.
ALTER TABLE classes
    ADD COLUMN channel_id INT NULL AFTER name,
    ADD CONSTRAINT fk_classes_channel
    FOREIGN KEY (channel_id) REFERENCES channels(id);
