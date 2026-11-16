# Daftar API -- SFA Backend

> **Catatan buat siapa pun yang nambah API baru (termasuk Claude):**
> tiap kali ada endpoint baru/berubah (method, path, atau query
> parameter penting), **update file ini juga** di commit yang sama.
> Biar daftar ini selalu cocok dengan kode, bukan basi.

Semua path di bawah pakai prefix `/api/...` kecuali disebutkan lain
(lihat bagian **Di luar `/api`** paling bawah). Semua butuh header
`Authorization: Bearer <token>` kecuali yang ditandai **publik**.

Mount lengkapnya ada di `src/app.js`.

---

## Auth

| Method | Path | Keterangan |
|---|---|---|
| POST | `/auth/login` | **Publik.** Balas `{ token, user }`. |

## Customer

| Method | Path | Keterangan |
|---|---|---|
| GET | `/customers` | Daftar customer. `?status=ACTIVE\|INACTIVE` opsional. |
| GET | `/customers/nearby` | Kandidat check-in terdekat (layar Nearby). `?latitude=&longitude=&radius=` (km, default 10). Disaring area+channel user. |
| GET | `/customers/form-options` | Pilihan area/channel/class/customer-group buat form. |
| GET | `/customers/:id` | |
| POST | `/customers` | Create. |
| PUT | `/customers/:id/location` | Perbaiki koordinat. |
| PUT | `/customers/:id` | Update field teks (code/group/area/channel terkunci). |
| PUT | `/customers/:id/status` | Aktif/nonaktifkan (admin-only). |
| DELETE | `/customers/:id` | Admin-only. |

## Product

| Method | Path | Keterangan |
|---|---|---|
| GET | `/products` | |
| POST | `/products` | Admin-only, `multipart/form-data` (field `photo`). |
| PUT | `/products/:id` | Admin-only, `multipart/form-data`. |
| DELETE | `/products/:id` | Admin-only. |

## Order
*(fitur lama, belum terhubung ke rancangan Order→SAP)*

| Method | Path | Keterangan |
|---|---|---|
| POST | `/orders` | |
| GET | `/orders` | |

## Visit

| Method | Path | Keterangan |
|---|---|---|
| POST | `/visits/checkin` | Check-in dari Visit Plan terjadwal. Butuh `visit_plan_id`. |
| POST | `/visits/checkin-nearby` | Check-in dadakan dari Nearby, tanpa Visit Plan. Butuh `customer_id` (bukan `visit_plan_id`). Backend otomatis bikin Visit Plan `source=ADHOC`. Gerbang kapabilitas: Menu Access platform MOBILE, menu_key `nearbyCheckin`, default MATI. |
| GET | `/visits` | |
| GET | `/visits/:id/products` | |
| GET | `/visits/:id` | |
| POST | `/visits/:id/checkout` | |

## Visit Activity

| Method | Path | Keterangan |
|---|---|---|
| POST | `/visit-activities` | `multipart/form-data`, field foto dinamis `photo_<field_definition_id>`. |
| GET | `/visit-activities` | |
| GET | `/visit-activities/visit/:id` | |
| DELETE | `/visit-activities/:id` | |

## Visit Plan

| Method | Path | Keterangan |
|---|---|---|
| GET | `/visit-plans` | `?mine=1` riwayat pribadi (mobile); tanpa itu subtree penuh (web). |
| POST | `/visit-plans` | |
| POST | `/visit-plans/upload` | Import Excel, `multipart/form-data` field `file`. |
| GET | `/visit-plans/template` | Unduh template Excel. |
| PUT | `/visit-plans/:id` | |
| DELETE | `/visit-plans/:id` | |

## Attendance

| Method | Path | Keterangan |
|---|---|---|
| POST | `/attendances/checkin` | `multipart/form-data` field `photo`. Terkunci kalau masih ada absen pulang hari sebelumnya yang belum diselesaikan. |
| POST | `/attendances/checkout` | `multipart/form-data` field `photo`. Menutup absen TERLAMA yang masih terbuka. |
| GET | `/attendances/today` | `{ today, staleUnresolved }`. |
| GET | `/attendances/report` | **Laporan "matang"** -- tanggal/jam sudah diformat di zona waktu pegawai (WIB/WITA/WIT), status dihitung, ada rekap. Query opsional: `?mine=1`, `?from=&to=` (YYYY-MM-DD), `?area_id=`, `?user_id=`, `?role=` (satu/lebih dipisah koma, mis. `MD,SPG`). Balas `{ summary: { hadir, belum_pulang }, rows: [...] }`. |
| GET | `/attendances` | Baris mentah, subtree-wide. `?mine=1`, `?from=&to=`. |

## User

| Method | Path | Keterangan |
|---|---|---|
| GET | `/users` | |
| POST | `/users` | Admin-only. `name` dipaksa huruf besar. |
| PUT | `/users/:id/status` | Aktif/nonaktifkan, admin-only. |
| GET | `/users/template` | Unduh template Excel (HARUS tetap di atas `GET /:id` di routes). |
| GET | `/users/:id` | |
| PUT | `/users/:id` | Admin-only. `name` dipaksa huruf besar kalau dikirim. |
| PUT | `/users/:id/reset-password` | Admin-only. |
| POST | `/users/upload` | Import Excel massal, admin-only. `name` dipaksa huruf besar. |
| GET | `/users/:id/areas` | Mounted bareng `/api/users` (file `userArea.routes.js`). |

## Area

| Method | Path | Keterangan |
|---|---|---|
| GET | `/areas` | Disaring area yang di-assign buat role terbatas. |
| POST | `/areas` | Admin-only. Field: `code, name, checkin_radius_meters, timezone, channel_id`. |
| PUT | `/areas/:id` | Admin-only. |
| DELETE | `/areas/:id` | Admin-only, ditolak kalau masih dipakai. |

## Channel

| Method | Path | Keterangan |
|---|---|---|
| GET | `/channels` | |

## Class
*(klasifikasi toko -- PASAR/GROSIR/dll, beda dari Channel)*

| Method | Path | Keterangan |
|---|---|---|
| GET | `/classes` | |
| POST | `/classes` | Admin-only. Field termasuk `channel_id` (null = semua channel). |
| PUT | `/classes/:id` | Admin-only. |
| DELETE | `/classes/:id` | Admin-only. |

## Customer Group

| Method | Path | Keterangan |
|---|---|---|
| GET | `/customer-groups` | |
| POST | `/customer-groups` | Admin-only. |
| PUT | `/customer-groups/:id` | Admin-only. |
| DELETE | `/customer-groups/:id` | Admin-only. |

## Customer Product (mapping)

| Method | Path | Keterangan |
|---|---|---|
| POST | `/customer-products` | Simpan mapping produk per customer (hapus-lalu-tulis-ulang). |

## Activity (master activity + field builder)

| Method | Path | Keterangan |
|---|---|---|
| GET | `/activities` | |
| POST | `/activities` | Admin-only. |
| PUT | `/activities/:id` | Admin-only. |
| DELETE | `/activities/:id` | Admin-only. |
| GET | `/activities/:id/fields` | Daftar field dinamis milik satu activity. |
| PUT | `/activities/:id/fields` | Admin-only, ganti seluruh definisi field. |

## User Location

| Method | Path | Keterangan |
|---|---|---|
| POST | `/user-locations/ping` | Mobile kirim lokasi live (dipanggil berkala selagi app kebuka). |
| GET | `/user-locations` | |

## Dashboard

| Method | Path | Keterangan |
|---|---|---|
| GET | `/dashboard/spg` | Ringkasan target/visit/order/tim buat dasbor pribadi (SPG/MD/Sales) + tim (Supervisor ke atas). |

## Role Menu Access

| Method | Path | Keterangan |
|---|---|---|
| GET | `/role-menu-access` | Admin-only, seluruh baris override. |
| GET | `/role-menu-access/mine` | Dipakai Sidebar (web)/QuickMenu (mobile). `?platform=web\|mobile` (default web). |
| PUT | `/role-menu-access` | Admin-only. Body: `{ platform, channel_id, role, items: [{menu_key, visible}] }`. |

## Payroll

| Method | Path | Keterangan |
|---|---|---|
| GET | `/payroll` | |
| PUT | `/payroll/:userId/rate` | |
| PUT | `/payroll/:userId/hari-kerja` | |

## Incentive Rule

| Method | Path | Keterangan |
|---|---|---|
| GET | `/incentive-rules` | |
| GET | `/incentive-rules/progress` | |
| POST | `/incentive-rules` | |
| PUT | `/incentive-rules/:id` | |
| PUT | `/incentive-rules/:id/toggle` | Aktif/nonaktifkan rule. |
| DELETE | `/incentive-rules/:id` | |

## Excel Uploader
*(simpan file Excel apa saja ke S3, bukan cuma Visit Plan/User)*

| Method | Path | Keterangan |
|---|---|---|
| GET | `/excel-uploads/settings` | Admin-only. |
| PUT | `/excel-uploads/settings` | Admin-only. Bucket/region/endpoint/prefix/sub-folder. |
| POST | `/excel-uploads/settings/test` | Admin-only, tes tulis+hapus ke S3. |
| GET | `/excel-uploads` | Gerbang Menu Access (`excelUploader`). |
| POST | `/excel-uploads` | `multipart/form-data` field `files` (maks 10). |
| GET | `/excel-uploads/:id/download` | Balas link presigned S3, berlaku 5 menit. |
| DELETE | `/excel-uploads/:id` | Cuma yang upload sendiri atau admin. |

---

## Di luar `/api`

| Method | Path | Keterangan |
|---|---|---|
| POST | `/deploy-webhook` | **Publik** (diverifikasi HMAC signature GitHub). Auto-deploy saat push ke `main`. |
| GET | `/download/*` | **Publik**, static. Distribusi APK (`releases/`, gitignored, upload manual). |
| GET | `/uploads/*` | **Publik**, static. Foto-foto hasil upload (absen, activity, dll). |
| GET | `/` | **Publik.** Health check, balas `SFA API RUNNING 🚀`. |
