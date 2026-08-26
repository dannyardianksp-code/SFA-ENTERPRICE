CREATE TABLE attendances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    tanggal DATE NOT NULL,
    clock_in_time DATETIME NOT NULL,
    clock_in_latitude VARCHAR(50) NULL,
    clock_in_longitude VARCHAR(50) NULL,
    clock_in_accuracy DECIMAL(7,2) NULL,
    clock_in_photo_url TEXT NULL,
    clock_out_time DATETIME NULL,
    clock_out_latitude VARCHAR(50) NULL,
    clock_out_longitude VARCHAR(50) NULL,
    clock_out_accuracy DECIMAL(7,2) NULL,
    clock_out_photo_url TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_user_tanggal (user_id, tanggal),
    CONSTRAINT fk_attendance_user FOREIGN KEY (user_id) REFERENCES users(id)
)
