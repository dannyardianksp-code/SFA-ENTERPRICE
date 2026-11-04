-- Visit Nearby: check-in toko langsung dari Nearby tanpa Visit Plan
-- terjadwal. Daripada bikin visit_plan_id boleh kosong (dan menambal
-- setiap tempat yang join Visit->VisitPlan buat laporan/insentif),
-- pendekatannya: tetap bikin VisitPlan seperti biasa, otomatis, status
-- langsung 'ON VISIT' -- cuma ditandai asalnya lewat kolom ini supaya
-- laporan nanti bisa membedakan "sesuai jadwal" vs "dadakan" kalau
-- perlu, tanpa mengubah satu pun kode yang sudah ada.
ALTER TABLE visit_plans
    ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED' AFTER status;
