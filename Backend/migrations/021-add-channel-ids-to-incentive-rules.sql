-- Filter channel opsional per skema insentif -- sama pola dengan
-- roles/criteria_ids (JSON array id), tapi BOLEH kosong/NULL: kosong
-- berarti berlaku buat SEMUA channel (tidak dibatasi), beda dengan
-- roles yang wajib diisi minimal 1.
ALTER TABLE incentive_rules ADD COLUMN channel_ids JSON NULL AFTER criteria_ids;
