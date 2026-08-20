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
| `user-management.test.js` | `assertUserManagement` sebagai gerbang ADMINISTRATOR untuk penulisan akun, gagal-tertutup untuk user kosong dan role tak dikenal; `wouldRemoveLastActiveAdministrator` sebagai keputusan lantai administrator |
| `lock.util.test.js` | `isLockConflictError` mengenali `ER_LOCK_WAIT_TIMEOUT`/`ER_LOCK_DEADLOCK` lewat kode di `parent`/`original` (bukan substring pesan) dan **gagal-tertutup** untuk error lain; `applyLockWaitTimeout` menembak koneksi transaksinya sendiri; `restoreLockWaitTimeout` tidak pernah melempar sehingga tidak menutupi error asli |

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

Blok `kontensi lock dijawab 503 yang bisa diulang` di
`tests/e2e/user-management.test.js` **memaksa** kontensi lock, tidak
mengundinya: satu koneksi `mysql2` terpisah memegang
`SELECT ... FOR UPDATE` atas baris buangannya sendiri selama request
berjalan, sehingga locking read di dalam handler pasti menunggu dan pasti
kehabisan waktu pada 5 detik. Tidak ada jendela waktu yang harus tepat,
jadi tesnya tidak flaky.

Blok itu sengaja berada di berkas yang sama dengan tes penulisan user
lainnya. `node --test` menjalankan **berkas** secara paralel tapi tes di
dalam satu berkas berurutan — dan selama handler menunggu, ia memegang
lock dari counting read-nya, jadi request penulisan user lain yang
berjalan bersamaan bisa ikut kalah balapan. Dipindahkan ke berkas sendiri,
blok ini akan membuat tes lain gagal secara acak.

`tests/e2e/user-auth.test.js` menyisipkan **satu user sementara** lewat
`mysql2` sebagai sasaran reset password, lalu menghapusnya di `after()`.

Ia sengaja tidak mereset password user sungguhan: mereset password Danny
membuat aplikasi mobile tidak bisa login, dan tes yang mati di tengah akan
meninggalkan akun itu dengan password acak yang tidak diketahui siapa pun —
termasuk tesnya sendiri.

`tests/e2e/user-management.test.js` membuat lima user sekali pakai langsung
lewat `mysql2`:

| Baris | Lingkup | Untuk |
|---|---|---|
| satu SPG | level berkas | gerbang login, penolakan token setelah nonaktif, `parseId` di `GET /:id` dan `reset-password` |
| satu ADMINISTRATOR | blok penonaktifan | dua tes larangan menonaktifkan-diri-sendiri |
| satu ADMINISTRATOR | blok penjaga identitas | larangan mengubah role, email, dan code sendiri |
| dua ADMINISTRATOR | blok lantai administrator | dua request bersamaan yang saling menurunkan role dan saling menonaktifkan |

Semuanya dihapus di `after()` masing-masing, **lewat id yang ditangkap saat
insert** — bukan lewat `code` atau `email`, karena `PUT /api/users/:id`
menulis `code` sebagai `code || null` dan pembersihan tidak boleh
bergantung pada kolom yang request di bawah uji bisa mengubah. Setiap blok
yang menyisipkan baris juga **pre-clean lewat seluruh kunci unik yang
dipakainya**, sehingga satu run yang mati di tengah tidak meracuni run
berikutnya: `email` pun punya unique index dan bisa menahan `INSERT`
sendirian.

Ia juga membuat beberapa user lewat `POST /api/users` sebagai administrator
sungguhan (untuk menguji gerbang role dan validasi role) lalu
menghapusnya.

**Akun sungguhan (`SPG` id 1, `ADMIN` id 2) dipakai HANYA sebagai
pemanggil, tidak pernah sebagai sasaran tulis.** Alasannya bukan kerapian:
kalau sebuah penjaga regresi, request yang seharusnya ditolak akan
*berhasil*. Assertion-nya gagal dengan berisik, tapi tidak ada yang
mengembalikan barisnya — dan akun administrator yang terlanjur jadi SPG
tidak punya jalur pemulihan, karena reset password pun ADMINISTRATOR-saja.
Percobaan sebelumnya menonaktifkan akun administrator asli lewat tes ini,
dan 401 yang dihasilkannya menjalar ke blok tes lain yang sedang berjalan
bersamaan — bukan cuma tes ini yang gagal. Tidak ada user sungguhan yang
datanya diubah, dan tidak ada password user sungguhan yang pernah ditulis
ulang.

Satu batas yang perlu diketahui: **cabang 409 lantai administrator tidak
ditutup e2e.** Jumlah administrator aktif dihitung global, dan database dev
selalu punya dua akun administrator sungguhan, jadi dua administrator
sekali pakai yang saling menurunkan role hanya menurunkan jumlahnya dari
empat ke dua. Membuat keadaan yang menyalakan 409 menuntut kedua
administrator sungguhan diturunkan lebih dulu. Keputusan tolak/terima-nya
ditutup unit test atas `wouldRemoveLastActiveAdministrator`; yang ditutup
e2e adalah transaksi dan locking read yang memasok angkanya, termasuk bahwa
dua arah bersamaan tidak berakhir sebagai deadlock.

**Jangan jalankan `npm run test:e2e` menghadap database produksi.**

## Kenapa e2e dijalankan berurutan

`test:e2e` memakai `--test-concurrency=1`. Ini BUKAN sisa debugging —
jangan dihapus tanpa membaca bagian ini.

`node --test` menjalankan berkas tes secara **konkuren** secara bawaan,
dan hampir semua berkas e2e di atas membuat baris sementara langsung
lewat `mysql2` yang hidup selama berkasnya sendiri berjalan (bukan hanya
selama satu tes). Tes yang membandingkan jumlah baris atau daftar id di
berkas LAIN yang kebetulan berjalan bersamaan bisa ikut melihat baris
sementara itu, dan gagal — padahal tidak ada apa pun yang benar-benar
rusak.

Interferensi itu properti dari runner terhadap database bersama yang
mutable, bukan sesuatu yang bisa dipertahankan satu tes secara individual.
Karena itu diperbaiki di tingkat runner (serialisasi), bukan dengan
melonggarkan assertion-nya: assertion yang dilonggarkan menjadi "kurang
dari N" tetap hijau ketika sebuah filter bocor sebagian, dan bocor
sebagian tetap bocor — itu justru properti yang tes-tes ini ada untuk
membuktikan.

`tests/e2e/data-leak.test.js` sendiri punya dua lapis pertahanan yang
saling melengkapi, bukan saling menggantikan: assertion SPG/SUPERVISOR/
MANAGER membandingkan daftar id eksplisit (kebal terhadap kardinalitas
tabel, tapi bisa rusak kalau suatu saat ada baris sementara yang
kebetulan masuk ke subtree-nya), sementara assertion ADMINISTRATOR
membandingkan terhadap `SELECT COUNT(*) FROM users` yang dibaca saat itu
juga (kebal terhadap baris sementara ADMIN-tak-terbatas manapun, tapi
tidak menutup kebocoran subtree). `--test-concurrency=1` tetap dibutuhkan
untuk lapis pertama; ia melindungi dari skenario yang belum pernah
terjadi hari ini tapi bisa terjadi kalau berkas e2e mendatang menyisipkan
baris sementara dengan `supervisor_id` di dalam subtree 3 atau 30.

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
- **nol administrator lewat balapan** — larangan diri sendiri saja tidak
  cukup. Ia dievaluasi per-request, baca-lalu-tulis, tanpa transaksi: admin
  2 mengirim `PUT /api/users/29 {role:'SPG'}` dan admin 29 mengirim
  `PUT /api/users/2 {role:'SPG'}` dalam beberapa milidetik yang sama,
  keduanya lolos karena sasaran masing-masing bukan dirinya sendiri, dan
  kedua `UPDATE` commit. Kedua handler sekarang menulis di dalam transaksi
  dan lebih dulu menghitung administrator aktif lewat
  `SELECT ... FOR UPDATE`. **Lock itulah perbaikannya**, bukan `COUNT`-nya:
  tanpa lock kedua transaksi membaca angka yang sama dan sama-sama lolos.
  Query hitungnya harus SELALU dijalankan pertama dan identik di kedua
  handler — urutan lock yang berbeda berakhir sebagai deadlock MySQL, bukan
  sebagai penolakan.
- **`email` sebagai jalan mengunci diri sendiri** — `email` adalah
  identitas login, dan `PUT /api/users/:id` menulisnya tanpa penjaga; yang
  lama hanya menutup `role`. Administrator yang salah mengetik emailnya
  sendiri tetap punya satu baris administrator aktif, tapi begitu tokennya
  kedaluwarsa (1 hari) **nol administrator bisa login**, dan tidak ada
  lagi yang bisa mereset password siapa pun. `email` dan `code` kini ikut
  dijaga dengan pola bandingkan-nilai yang sama seperti `role`.
- **`JWT_SECRET` hilang menjadi logout massal** — `jwt.verify` juga
  melempar saat secretnya tidak terpasang
  (`secretOrPublicKey must have a value`) dan saat secret dirotasi. Catch
  yang meruntuhkan setiap lemparan menjadi 401 membuat interceptor mobile
  me-logout **seluruh user di lapangan** sekaligus, tanpa satu baris pun di
  log server. Hanya `TokenExpiredError` dan `JsonWebTokenError` yang 401;
  sisanya 500 supaya klien mencoba lagi alih-alih logout.
- **email non-teks di login** — penjaga yang memeriksa truthiness saja
  meloloskan `{"email":{"a":1}}` sampai ke `findOne` dan pulang sebagai 500
  pada endpoint tanpa autentikasi. Nilai array lebih buruk: Sequelize
  mengubahnya menjadi klausa `IN`, sehingga satu password bisa dicoba
  terhadap sekumpulan email sekaligus. `?.` tidak menolong — ia menjaga
  `null` dan `undefined`, bukan tipe.
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

Wave ini **tidak menambah migration**. Index `(role, status)` yang
sempat dibuat untuk mempersempit locking read di `user.routes.js`
dibatalkan setelah diukur — alasannya di bawah.

### Index (role, status): sudah dicoba, JANGAN diulang tanpa membaca ini

Locking read yang menjaga lantai administrator,

```sql
SELECT id FROM users WHERE role='ADMINISTRATOR' AND status='ACTIVE' FOR UPDATE
```

berjalan sebagai full scan karena `role` dan `status` tidak berindeks,
sehingga ia mengunci **seluruh** tabel `users`, bukan hanya baris
administrator. Itu benar dan sudah diukur: sementara transaksinya
terbuka, `UPDATE` atas baris SPG yang tidak berkaitan pun terblokir
sampai `ER_LOCK_WAIT_TIMEOUT`.

Index `(role, status)` memang memperbaiki bagian itu — `EXPLAIN` berubah
dari `type=ALL, key=NULL, rows=11` menjadi
`type=ref, key=idx_users_role_status, rows=2, Using index`, dan baris SPG
yang tidak berkaitan lolos dalam 18 ms alih-alih terblokir.

**Tapi index itu justru menimbulkan deadlock**, dan deadlock lebih buruk
daripada lock yang lebar: yang satu menggagalkan operasi yang sebelumnya
berhasil, yang lain hanya memperlambatnya. Diukur pada MariaDB 10.6.22,
dua administrator yang saling menurunkan role secara bersamaan:

| Keadaan | Putaran yang berakhir `ER_LOCK_DEADLOCK` |
|---|---|
| tanpa index | 0 dari 8 |
| dengan index | 6 dari 8 |

Penyebabnya bukan jalur bacanya, melainkan **pemeliharaan index sekunder
saat kolom `role` ditulis**. Dengan index yang sama terpasang:

| `UPDATE` yang dijalankan | Putaran yang deadlock |
|---|---|
| menyentuh `role` | 5 dari 6 |
| hanya `name` | 0 dari 6 |

Karena itu tidak ada cara menulis ulang query bacanya untuk menghindari
deadlock — masalahnya ada di sisi tulisnya. Yang sudah dicoba dan gagal:
memaksa locking read ikut mengunci baris clustered (`attributes:
['id','name']`) supaya urutan lock deterministik. Hasilnya deadlock tetap
muncul (2 dari 5) **dan** optimiser meninggalkan indexnya
(`type=ALL`), jadi penyempitannya ikut hilang.

Tanpa index, kerusakan dari lock yang lebar dibatasi oleh
`withShortLockWait` (`src/utils/lock.util.js`): pemegang koneksi menyerah
setelah 5 detik, bukan 50, sehingga pool `max = 5` tidak kering. Itulah
yang membuat lock lebar bisa ditanggung.

Kalau suatu saat index ini tetap dibutuhkan, keputusannya adalah
**menukar lock lebar dengan deadlock yang bisa diulang** — dan itu hanya
masuk akal kalau pemanggilnya (`sfa-web`) benar-benar mengulang otomatis
pada `503`. Sekarang tidak.

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
- User yang dinonaktifkan mendapat **401** dari middleware `auth`, bukan
  403, supaya aplikasi mobile mengeluarkannya alih-alih menjebaknya di
  layar yang error.

  **`POST /api/auth/login` tetap menjawab 403** untuk kondisi yang sama,
  dan itu bukan ketidakkonsistenan yang terlewat. Interceptor mobile
  mengecualikan login dari pemicu logout-nya, jadi 401 di sana hanya akan
  menghapus sesi yang belum ada sambil menyembunyikan alasannya dari user.
  403 pada login-lah yang membuat pesan "akun Anda tidak aktif" sampai ke
  layar. Aturannya: **401 = "sesi Anda sudah tidak berlaku, keluar"**,
  yang hanya bermakna kalau sesinya memang pernah ada; **403 = "permintaan
  ini ditolak, dan ini alasannya"**.
- **Keempat** route `:id` di `user.routes.js` kini menolak `:id` yang bukan
  angka bulat positif murni dengan **400**: `PUT /:id`, `PUT /:id/status`,
  `GET /:id`, dan `PUT /:id/reset-password`. Sebelumnya diterima begitu saja
  dan diteruskan mentah-mentah ke `where`, yang juga berarti bisa melewati
  penjaga larangan-ubah-diri-sendiri (lihat bagian "Kenapa tes ini ada" di
  atas). `GET /api/users/2abc` dulu mengembalikan baris admin id 2, dan
  `PUT /api/users/2abc/reset-password` mereset password baris id 2. Kedua
  route itu tidak punya penjaga yang bisa dilewati, jadi bukan celah yang
  bisa dieksploitasi — tapi penormalannya membuat invarian "penjaga dan
  klausa `where` selalu melihat nilai yang sama" berlaku secara struktural,
  bukan per-route.
- `PUT /api/users/:id` dan `PUT /api/users/:id/status` kini bisa menjawab
  **409** kalau operasinya akan menghabiskan administrator aktif terakhir.
  Hanya tercapai di jalur bersamaan: route-nya sudah memastikan pemanggilnya
  ADMINISTRATOR aktif dan sasarannya bukan dirinya sendiri, sehingga di
  request yang berurutan jumlahnya selalu minimal dua.
- `PUT /api/users/:id` kini menolak **400** kalau administrator mengubah
  `email` atau `code` **akun sendiri**. Nilai yang dikirim sama dengan yang
  sekarang tetap diterima, sehingga form web yang mengirim balik seluruh
  objeknya tetap bisa dipakai mengubah nama.
- `PUT /api/users/:id/reset-password` kini memakai gerbang bersama
  `assertUserManagement`, sehingga **pesan 403-nya berubah** menjadi
  "Hanya administrator yang boleh mengelola akun user." Cabang 404 "akun
  Anda tidak ditemukan" hilang; ia sudah tidak bisa dicapai sejak middleware
  menolak 401 untuk user yang tidak ada.
- `POST /api/auth/login` kini menjawab **400** untuk `email` atau `password`
  yang bukan string; sebelumnya objek menghasilkan 500 dan array diam-diam
  menjadi klausa `IN`.
