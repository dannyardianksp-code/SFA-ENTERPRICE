-- ID unik dibikin di HP buat idempotency antrian offline (lihat
-- comment di visitActivity.model.js) -- unique index izinkan banyak
-- NULL di MySQL, jadi baris lama tetap valid.
ALTER TABLE visit_activities
    ADD COLUMN client_ref VARCHAR(64) NULL,
    ADD UNIQUE INDEX idx_visit_activities_client_ref (client_ref);
