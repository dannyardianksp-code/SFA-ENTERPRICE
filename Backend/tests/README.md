# Tests

Memakai test runner bawaan Node (`node:test` + `node:assert`) — tanpa
dependency tambahan, tidak ada yang perlu di-install.

## Menjalankan

```bash
npm test          # unit — cepat, tidak perlu server / database
npm run test:e2e  # end-to-end — WAJIB server + MySQL sudah jalan
npm run test:all  # keduanya
```

## Struktur

```
tests/
  unit/    tidak menyentuh jaringan maupun database
  e2e/     memanggil HTTP ke server yang sedang berjalan
```

### unit/

| File | Menguji |
|---|---|
| `geo.util.test.js` | parsing koordinat, validasi rentang, perhitungan & pengurutan jarak |
| `area.util.test.js` | resolusi hak akses area (multi-area + fallback `area_id`) |
| `response.util.test.js` | bentuk error `{ message }`, penyembunyian detail saat production |
| `customer.controller.test.js` | cabang validasi `getNearbyCustomers` lewat `req`/`res` palsu |
| `access.util.test.js` | aturan hak akses area + channel, cakupan hierarki subtree, termasuk gagal-tertutup untuk user kosong |
| `customer-update.test.js` | validasi field teks, field terkunci, dan koordinat pada jalur update |
| `date.util.test.js` | tanggal lokal Asia/Jakarta, termasuk jam malam UTC yang sudah tanggal berikutnya |
| `visit-plan.test.js` | rentang tanggal SPG, batas bulan dan batas tahun |
| `password.util.test.js` | alfabet tanpa karakter yang mudah tertukar, panjang, dan keacakan password sementara |
| `id.util.test.js` | `parseId` menolak apa pun yang bukan angka bulat positif murni, termasuk `'2abc'` yang MySQL sendiri akan mengoersi jadi baris 2 |
| `user-model.test.js` | deklarasi kolom `status` (dengan default `ACTIVE`) dan ENUM `role` di model User |
| `user-management.test.js` | `assertUserManagement` sebagai gerbang ADMINISTRATOR untuk penulisan akun, gagal-tertutup untuk user kosong dan role tak dikenal |

`customer.controller.test.js` bisa jalan tanpa database karena seluruh
validasi parameter terjadi **sebelum** `User.findByPk` dipanggil.

### e2e/

Jalankan `npm run dev` lebih dulu. Kalau server mati, tesnya gagal
dengan pesan yang menjelaskan hal itu, bukan error yang membingungkan.

Token JWT ditandatangani langsung dari `JWT_SECRET`, sehingga tes
**tidak perlu password** dan **tidak menulis apa pun ke database**.

Bisa diatur lewat environment variable:

| Variable | Default |
|---|---|
| `TEST_BASE_URL` | `http://localhost:1000` |
| `TEST_USER_ID` | `1` — harus user yang punya area (assigned atau `area_id`) |
| `TEST_EMAIL` | `danny@mail.com` — hanya untuk tes password salah, tidak perlu password |

## ⚠️ Tes e2e menulis ke database

`tests/e2e/customer-create.test.js` dan
`tests/e2e/customer-update.test.js` membuat customer sungguhan lalu
menghapusnya di hook `after()` (langsung lewat `mysql2`, karena tidak
ada endpoint DELETE customer).

`customer-update.test.js` sengaja **membuat customer sendiri** untuk
diedit dan tidak pernah menyentuh customer yang sudah ada — mengedit
data nyata di database dev sama saja merusaknya.

Nomor urut kode yang terpakai **tidak kembali** setelah baris dihapus,
sehingga deret kode akan berlubang. Aman di database dev.

`tests/e2e/visit-plan.test.js` membuat dua visit plan (hari ini dan
lusa) lalu menghapusnya di `after()`. Yang lusa ada supaya batas atas
rentang benar-benar diuji, bukan diasumsikan.

`tests/e2e/hierarchy-access.test.js` membuat beberapa visit plan —
termasuk **milik user lain** (Tino, SUBUR, Tria) karena itu yang
membuktikan cakupan subtree — lalu menghapus semuanya di `after()`. Satu
di antaranya diubah statusnya menjadi `'ON VISIT'` langsung lewat
`mysql2`, karena `create` memaksa `'PENDING'` sehingga status non-PENDING
tidak bisa dibuat lewat API. Berkas ini juga menyisipkan satu baris
`visit_activities` **yatim** (menunjuk `visit_id` yang tidak ada) langsung
lewat `mysql2` untuk menguji `required: true` pada include `Visit`, lalu
menghapusnya lagi di `after()` lokal blok itu.

`tests/e2e/user-auth.test.js` menyisipkan **satu user sementara** lewat
`mysql2` sebagai sasaran reset password, lalu menghapusnya di `after()`.

Ia sengaja tidak mereset password user sungguhan: mereset password Danny
membuat aplikasi mobile tidak bisa login, dan tes yang mati di tengah akan
meninggalkan akun itu dengan password acak yang tidak diketahui siapa pun —
termasuk tesnya sendiri.

`tests/e2e/user-management.test.js` membuat dua user sekali pakai langsung
lewat `mysql2`: satu SPG di level berkas (dipakai untuk menguji gerbang
login dan penolakan token setelah nonaktif) dan satu ADMINISTRATOR sekali
pakai yang dibatasi ke satu blok (khusus dua tes larangan
menonaktifkan-diri-sendiri). Keduanya dihapus di `after()` masing-masing.
Ia juga membuat beberapa user lewat `POST /api/users` sebagai administrator
sungguhan (untuk menguji gerbang role dan validasi role) lalu menghapusnya.
Sengaja memakai akun sekali pakai untuk kedua peran itu, bukan akun ADMIN
sungguhan: percobaan sebelumnya menonaktifkan akun administrator asli lewat
tes ini, dan 401 yang dihasilkannya menjalar ke blok tes lain yang sedang
berjalan bersamaan — bukan cuma tes ini yang gagal. Tidak ada user
sungguhan yang datanya diubah, dan tidak ada password user sungguhan yang
pernah ditulis ulang.

**Jangan jalankan `npm run test:e2e` menghadap database produksi.**

## Kenapa tes ini ada

Beberapa di antaranya menjaga bug yang pernah benar-benar terjadi —
jangan dihapus tanpa membaca komentarnya:

- **reset password tanpa gerbang role** — endpoint ini pernah memakai
  middleware `auth` saja, menyetel password user mana pun menjadi
  `123456`, dan mengembalikannya di respons. SPG mana pun bisa mereset
  password administrator lalu login sebagai administrator.
- **`Number("") === 0`** — koordinat kosong pernah terbaca sebagai
  titik 0°,0° di Samudra Atlantik, membuat customer tanpa koordinat
  muncul dengan jarak ~5.000 km.
- **jarak 0 km** — `0` itu falsy; filter dengan truthy check akan
  membuang customer yang berada tepat di posisi user.
- **pesan login identik** — membedakan "email tidak ada" dari
  "password salah" membocorkan email mana yang terdaftar
  (user enumeration).
- **array telanjang** — cabang "user tanpa area" pernah mengembalikan
  `{ success, message, data }` sehingga client yang memanggil
  `.filter()` langsung error.
- **cakupan area sama** — `getAll` dan `getNearbyCustomers` harus
  memakai `resolveAccessibleAreaIds` yang sama, supaya sales tidak
  melihat kumpulan customer berbeda di dua layar.
- **relasi `Channel`** — pernah tidak di-include di `/customers/nearby`,
  membuat kolom channel di mobile tampil `-`.
- **field terkunci diabaikan diam-diam** — kode customer dibentuk dari
  group, area, dan channel. Klien yang mencoba mengubah salah satunya
  harus mendapat 400, bukan 200 yang membuatnya menyangka perubahannya
  tersimpan.
- **`"1"` vs `1`** — JSON tidak menjamin tipe. Perbandingan field
  terkunci yang tidak meng-koersi tipe akan menolak klien yang
  mengirim balik objek customer apa adanya.
- **kolom `password` ikut terkirim** — relasi `UpdatedBy` mengambil dari
  tabel `users`. Tanpa `attributes` yang dibatasi, seluruh baris user
  termasuk password hash-nya masuk ke respons.
- **`toISOString()` untuk tanggal lokal** — itu UTC. Di WIB setiap pagi
  antara 00:00 dan 07:00 hasilnya tanggal kemarin, sehingga SPG yang
  membuka aplikasi jam 6 pagi melihat rencana kunjungan kemarin.
- **`null` vs `[]` pada hak akses** — `null` berarti "tidak dibatasi",
  array kosong berarti "tidak ada siapa pun". Membalik keduanya mengubah
  administrator dari melihat segalanya menjadi melihat nol, tanpa error.
- **penurunan satu tingkat** — anak langsung MANAGER semuanya SUPERVISOR,
  nol SPG. Helper yang hanya mengambil satu tingkat membuat manager tidak
  melihat kunjungan SPG mana pun.
- **mengubah data sebelum memeriksa status** — `update` dan `delete`
  visit plan pernah mengubah atau menghapus baris lalu mengembalikan 400.
  Datanya sudah rusak saat penolakannya dikirim.
- **role ditulis dari body tanpa gerbang** — `POST /api/users` dan
  `PUT /api/users/:id` pernah menerima `role: 'ADMINISTRATOR'` dari
  siapa pun yang punya token. Tesnya memeriksa langsung ke database,
  bukan hanya status HTTP: handler yang menyimpan barisnya lalu
  mengembalikan 403 tetap merusak data.
- **kolom yang tidak dideklarasikan tidak terbaca** — `status` pernah
  hilang dari model `User`, sehingga tombol Deactivate mengembalikan 200
  tanpa menulis apa pun dan gerbang login membandingkan `undefined`.
- **status diperiksa sebelum password** — akun nonaktif menjawab 403
  sementara email asing menjawab 401, sehingga siapa pun bisa mengetahui
  email mana yang terdaftar hanya dengan menebak.
- **nol administrator** — tidak ada jalur pemulihan kalau administrator
  terakhir menonaktifkan atau menurunkan dirinya sendiri; reset password
  pun ADMINISTRATOR-saja.
- **`Number(req.params.id)` dibandingkan, `where` mentah dieksekusi** —
  penjaga larangan-ubah-diri-sendiri pada `PUT /api/users/:id` dan
  `PUT /api/users/:id/status` sempat membandingkan
  `Number(req.params.id)` dengan `req.user.id`, sementara klausa `where`
  Sequelize memakai `req.params.id` mentah. MySQL mengoersi string ke
  angka saat dibandingkan dengan kolom numerik, jadi `WHERE id = '2abc'`
  tetap menyasar baris id 2 — padahal `Number('2abc')` di JavaScript
  adalah `NaN` dan tidak akan pernah sama dengan `req.user.id` mana pun.
  Akibatnya penjaganya bisa dilewati hanya dengan menambahkan huruf ke
  URL, sementara query-nya tetap mengenai baris yang sama persis.
  `parseId` (`src/utils/id.util.js`) menormalkan id sekali di awal
  sehingga penjaga dan `where` selalu membandingkan nilai yang sama.

## Urutan rilis

Migration harus dijalankan **sebelum** backend versi baru dideploy:

1. `migrations/001-add-customer-code-fields.sql`
2. `migrations/002-add-customer-audit-fields.sql`

Backend yang dideploy lebih dulu akan mencoba menulis `updated_at` dan
`updated_by` ke kolom yang belum ada, dan setiap penyimpanan hasil edit
gagal dengan 500.

## Perubahan perilaku yang disengaja

Dicatat supaya tidak terbaca sebagai regresi:

- `GET /api/visits` untuk MANAGER **menyempit** dari semua kunjungan
  menjadi subtree-nya. Sebelumnya MANAGER tidak punya cabang sama sekali
  sehingga filternya kosong.
- `GET /api/visits/:id` yang tadinya **terbuka** kini menolak `403` di
  luar subtree pemanggil.
- `PUT` dan `DELETE /api/visit-plans/:id` **kini terdaftar**. Tombol Edit
  dan Hapus di `sfa-web` yang sebelumnya no-op sekarang benar-benar
  bekerja.
- Tombol **Activate/Deactivate** di `sfa-web/app/users/page.tsx` yang
  sebelumnya no-op sekarang benar-benar bekerja, dan badge status yang
  sebelumnya kosong sekarang menampilkan nilai.
- **Setiap request kini memuat baris user dari database.** Role yang
  diturunkan atau akun yang dinonaktifkan berlaku seketika, bukan setelah
  token kedaluwarsa (token berlaku 1 hari).
- `POST /api/auth/register` **dihapus**; ia menjawab 404.
- User yang dinonaktifkan mendapat **401**, bukan 403, supaya aplikasi
  mobile mengeluarkannya alih-alih menjebaknya di layar yang error.
- `PUT /api/users/:id` dan `PUT /api/users/:id/status` kini menolak
  `:id` yang bukan angka bulat positif murni dengan **400**; sebelumnya
  diterima begitu saja dan diteruskan mentah-mentah ke `where`, yang
  juga berarti bisa melewati penjaga larangan-ubah-diri-sendiri (lihat
  bagian "Kenapa tes ini ada" di atas).
