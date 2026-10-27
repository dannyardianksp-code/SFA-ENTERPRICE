-- Menu Excel Uploader (web) -- file Excel disimpan ke Amazon S3, bukan
-- ke disk server. Dua tabel:
--
-- 1. app_settings: setting global key/value yang diatur ADMINISTRATOR
--    dari web (bucket, region, endpoint, folder/prefix S3). Kredensial
--    S3 (access key + secret) SENGAJA tidak di sini -- tetap di .env
--    server, tidak pernah lewat database maupun API.
--
-- 2. excel_uploads: metadata tiap file yang di-upload. Bucket ikut
--    disimpan per baris supaya file lama tetap bisa di-download/hapus
--    walaupun setting bucket/prefix diganti sesudahnya.
CREATE TABLE app_settings (
    setting_key VARCHAR(64) PRIMARY KEY,
    setting_value TEXT NULL,
    updated_by INT NULL,
    updated_at DATETIME NOT NULL
);

CREATE TABLE excel_uploads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    original_name VARCHAR(255) NOT NULL,
    s3_bucket VARCHAR(255) NOT NULL,
    s3_key VARCHAR(1024) NOT NULL,
    size_bytes BIGINT NOT NULL,
    content_type VARCHAR(255) NULL,
    uploaded_by INT NOT NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_excel_uploads_created_at (created_at),
    CONSTRAINT fk_excel_uploads_user
        FOREIGN KEY (uploaded_by) REFERENCES users(id)
);
