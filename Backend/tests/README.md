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
| `visit-model.test.js` | deklarasi kolom `location_accuracy` di model Visit |
| `user-management.test.js` | `assertUserManagement` sebagai gerbang ADMINISTRATOR untuk penulisan akun, gagal-tertutup untuk user kosong dan role tak dikenal; `wouldRemoveLastActiveAdministrator` sebagai keputusan lantai administrator |
| `lock.util.test.js` | `isLockConflictError` mengenali `ER_LOCK_WAIT_TIMEOUT`/`ER_LOCK_DEADLOCK` lewat kode di `parent`/`original` (bukan substring pesan) dan **gagal-tertutup** untuk error lain; `applyLockWaitTimeout` menembak koneksi transaksinya sendiri; `restoreLockWaitTimeout` tidak pernah melempar sehingga tidak menutupi error asli |
| `subtree-where.test.js` | arti `null` versus `[]` pada klausa subtree, dan koersi tipe pada gerbang sumber-tunggal |
| `nullable-update.test.js` | arti tiga arah field update: tidak dikirim, string kosong, bernilai |
| `boot-require.test.js` | ejaan `require` route di `app.js` dicocokkan dengan `git ls-files`; `t.skip` (bukan meledak) kalau `git` tidak tersedia atau direktorinya bukan working copy git |
| `activity-field-rules.test.js` | aturan field per tipe activity dan validasi qty |

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

`tests/e2e/visit-activity-create.test.js` membuat `visits` dan
`visit_activities` sementaranya sendiri, dihapus di `after()`
berdasarkan id tertangkap -- termasuk **menghapus berkas foto dari
disk**, bukan cuma barisnya di database.

`tests/e2e/visit-plan.test.js` dan `tests/e2e/hierarchy-access.test.js`
sempat membuat fixture-nya lewat `POST /api/visit-plans`, dan itu cuma
berhasil karena endpoint itu belum punya penjaga kepemilikan. Begitu
lubangnya ditutup (lihat "role ditulis dari body tanpa gerbang" di bawah
— bedanya, ini soal kepemilikan, bukan role), 22 tes yang penyiapannya
lewat endpoint tadi gagal serentak, bukan karena tesnya salah, tapi
karena fixture yang lewat endpoint mewarisi aturan otorisasi endpoint
itu — perubahan otorisasi yang sama sekali tidak berkaitan bisa merusak
penyiapan tes yang tidak sedang menguji otorisasi. Builder fixture
kedua berkas ini ditulis ulang untuk menyisipkan baris `visit_plans`
**langsung lewat `mysql2`**, dihapus di `after()` lewat id yang
ditangkap saat insert.

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

`tests/e2e/data-leak.test.js` membuat satu user sementara dengan keempat
kolom `code`, `area_id`, `channel_id`, dan `supervisor_id` terisi, lalu
menghapusnya di `after()` **berdasarkan id yang ditangkap, bukan
berdasarkan `code`** — kalau perbaikan `nullableUpdate` gagal, `code`
justru yang dikosongkan dan pembersihan berbasis `code` tidak akan
menemukan barisnya. Pre-clean fixture ini (lewat `code` ATAU `email`)
sengaja dijalankan di `before()` TINGKAT BERKAS, bukan di `before()`
milik describe-nya sendiri yang dideklarasikan paling akhir — lihat
"Kenapa `--test-concurrency=1` load-bearing" di atas untuk alasannya.

Ia juga membuat satu administrator sementara ber-`code` NULL (meniru
kedua administrator sungguhan) untuk menguji bahwa `PUT /api/users/:id`
menolak `{code: 0}` dari dirinya sendiri, dihapus di `after()` lewat id
yang ditangkap. **Bukan administrator 2 atau 29** — keduanya tidak
pernah jadi sasaran tulis di berkas ini.

Ia juga membuat beberapa `visit_plans` pada tanggal `2026-12-30`
(endpoint `POST /api/visit-plans`) dan `2026-12-29` (endpoint
`POST /api/visit-plans/upload`, diuji lewat unggahan `.xlsx` sungguhan
yang dibangun di memori dengan paket `xlsx` dan dikirim sebagai
`multipart/form-data` memakai `FormData`/`Blob` bawaan Node — bukan cuma
memanggil controller-nya langsung) yang tidak dipakai data sungguhan
hari ini. Baris yang benar-benar tersimpan ditangkap id-nya dan dihapus
satu per satu di `after()` — kedua tanggal itu tetap dipakai untuk
pengukuran `COUNT`, tapi TIDAK LAGI sebagai kunci `DELETE`, karena
keduanya tanggal masa depan yang bisa sah-sah saja diisi importer Excel
sebelum tes ini berjalan lagi.

Berkas ini juga menyisipkan satu baris `visit_activities` **yatim**
(`visit_id = 999999901`) untuk menguji `required: true` — lewat kolom
`notes`. `visit_activities` **tidak punya** kolom `activity_type`; draf
awal berkas ini memakainya dan gagal di database sungguhan sebelum
diperbaiki. Fixture `visits` di berkas yang sama ditandai lewat kolom
`latitude` (dipinjam sebagai penanda teks, bukan koordinat sungguhan)
supaya bisa ditemukan dan dipulihkan kalau proses tes mati di tengah,
sama seperti fixture `sales_orders` menandai dirinya lewat `doc_no`
berawalan `'UJI-'`. Semuanya dihapus di `after()`.

Akun sungguhan dipakai **hanya sebagai pemanggil baca-saja**. Tidak ada
satu pun tes di berkas ini yang menjadikannya sasaran tulis.

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

`tests/e2e/checkin-checkout.test.js` membuat `visit_plans` dan `visits`
sementaranya sendiri, dihapus di `after()` berdasarkan id yang
ditangkap. Akun sungguhan (SPG 1, 37, 34, SUPERVISOR 3) dipakai hanya
sebagai pemanggil.

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
untuk lapis pertama.

**Skenario itu BUKAN cuma hipotesis — ia sudah ada di berkas ini hari
ini.** Fixture user sementara di blok "PUT /api/users/:id tidak
menghapus field yang tidak dikirim" (di bawah) disisipkan dengan
`supervisor_id = 3`, yang berarti baris itu duduk DI DALAM subtree 3
maupun subtree 30 sekaligus — persis dua subtree yang diperiksa
assertion daftar id eksplisit di atas. Pre-clean-nya sempat hidup di
`before()` milik describe-nya sendiri, yang dideklarasikan paling akhir
di berkas ini — jauh setelah assertion SUPERVISOR/MANAGER tadi. Proses
tes yang mati di antara `INSERT` dan `DELETE` fixture itu meninggalkan
barisnya, dan run berikutnya akan mengevaluasi assertion daftar id
eksplisit SEBELUM pre-clean describe yang belakangan itu sempat berjalan
— membuat kedua tes itu merah dengan pesan yang terbaca seolah filter
subtree-nya bocor, padahal yang bocor cuma proses tes sebelumnya.
Pre-clean-nya sudah dipindahkan ke `before()` tingkat berkas supaya
selalu berjalan lebih dulu (lihat komentar di sana), tapi bentuk
interferensinya sendiri tetap nyata selama berkas ini menyisipkan baris
sementara di dalam subtree yang sama dengan yang diuji — itulah yang
membuat `--test-concurrency=1` **load-bearing, bukan pencegahan
seadanya**: tanpanya, berkas e2e lain yang kebetulan berjalan bersamaan
dan menyisipkan baris dengan `supervisor_id` di dalam subtree 3 atau 30
bisa memicu kegagalan yang sama persis, kapan saja.

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
- **`null` berarti tidak dibatasi** — `ownerWhere(null)` harus
  menghasilkan objek kosong. `{ [Op.in]: null }` adalah SQL yang tidak
  sah, dan array kosong membuat administrator melihat nol.
- **`area_id` tunggal sebagai aturan visibilitas** — `GET /api/users`
  pernah memfilter `area_id: req.user.area_id`. Untuk MANAGER yang
  `area_id`-nya NULL, Sequelize menerjemahkannya menjadi `IS NULL`,
  sehingga ia justru melihat kedua administrator dan nol bawahannya.
- **`visit_id` tanpa pemeriksaan kepemilikan pada create activity** —
  siapa pun bisa mencatat activity untuk kunjungan siapa pun, dan bisa
  membuat sendiri baris yatim yang justru disembunyikan `required: true`
  pada `GET /api/visit-activities/visit/:id`.
- **`activity_id` tanpa validasi** — nilai di luar 1-11 gagal di FK
  constraint MySQL sebagai 500, bukan 400 yang bersih.
- **check-out tanpa activity** — sebelumnya bisa langsung checkout
  tanpa mencatat apa pun selama kunjungan.
- **`field || null`** — pola ini mengubah "tidak dikirim" menjadi NULL.
  Setiap penyuntingan user lewat web mengosongkan `code` dan `area_id`,
  dan `area_id` itulah yang memberi makan hak akses wilayah SPG.
- **`required: true` pada include Visit — buktinya bukan menghapus
  barisnya.** Sequelize sendiri **menyimpulkan** `required: true` kapan
  pun sebuah include membawa `where`
  (`node_modules/sequelize/lib/model.js`:
  `if (include.required === void 0) { include.required = !!include.where }`).
  Include Visit di atas selalu membawa `where: visitWhere`, jadi
  "teeth-proof" naif — menghapus baris `required: true` lalu melihat
  apakah tesnya tetap hijau — **tidak membuktikan apa pun**: Sequelize
  menyimpulkan nilai `true` yang sama persis dari `where`-nya sendiri.
  Yang benar-benar membuktikan guard ini teruji adalah mengganti
  nilainya jadi `required: false` **secara eksplisit** dan melihat tes
  baris yatim gagal. Baris eksplisit `required: true` itu sendiri tetap
  dipertahankan sebagai pertahanan lapis kedua: kalau suatu saat
  `where`-nya dihapus tapi baris `required: true` terlupa ikut dihapus,
  baris eksplisit itulah yang mencegah Sequelize diam-diam menyimpulkan
  ulang `required` menjadi `false`. Dicatat di sini supaya orang
  berikutnya yang menguji ini tidak menyimpulkan guard-nya sudah teruji
  hanya dari menghapus baris itu.
- **spread `req.body` pada create** — `POST /api/visit-plans` pernah
  menyebar seluruh body, sehingga `user_id` bisa ditulis siapa pun. Ia
  juga tidak punya gerbang role sama sekali, sehingga SPG bisa membuat
  jadwal kunjungan.
- **`user_id: 0` dari administrator lolos NOT NULL — dibuktikan
  langsung, bukan cuma dinalar.** `POST /api/visit-plans` sempat
  menerima `user_id: 0` dari administrator dan **benar-benar membuat**
  visit plan yatim — baris id 820, dipastikan lewat `SELECT` langsung ke
  tabelnya sebelum dihapus. `visit_plans` tidak punya foreign key sama
  sekali, jadi NOT NULL saja tidak melindunginya. Id dari body request
  kini dinormalkan lewat `parseId` sebelum dipakai.
- **ejaan `require` peka huruf besar-kecil** — filesystem Windows tidak
  peka huruf besar-kecil, jadi ejaan yang salah boot di sini dan gagal
  `MODULE_NOT_FOUND` di Linux. Tesnya membandingkan dengan `git ls-files`,
  bukan `fs.readdir`, karena readdir melaporkan ejaan salah pun sebagai
  ada.
- **`POST /api/visit-plans/upload` tidak punya gerbang sama sekali —
  ditemukan review akhir SETELAH `create` sudah diperbaiki.** Endpoint
  ini menyimpulkan pemilik tiap baris dari kolom "Sales Code" di
  spreadsheet lewat `User.findOne`, lalu langsung `VisitPlan.create`,
  tanpa gerbang role maupun `assertWithinSubtree` — sehingga SPG mana
  pun yang punya token bisa mengunggah spreadsheet berisi kode sales
  siapa saja dan membuat jadwal kunjungan untuk seluruh perusahaan lewat
  jalur upload massal, persis lubang yang sama dengan `create` sebelum
  gerbangnya dipasang, hanya lewat pintu yang berbeda. Subtree pemanggil
  kini diambil SEKALI di luar loop baris (satu query untuk seluruh
  file), dan tiap baris diperiksa `assertWithinSubtree` sebelum ditulis
  — baris yang gagal dilaporkan lewat mekanisme error per-baris yang
  sudah ada, bukan menggagalkan seluruh upload.
- **id yang sah bentuknya tapi tidak ada barisnya, lolos sampai
  `INSERT`** — `parseId` hanya memastikan "bilangan bulat >= 1"; ia
  tidak pernah memeriksa apakah barisnya ADA. Karena `visit_plans` tidak
  punya foreign key sama sekali, administrator (satu-satunya role yang
  `assertWithinSubtree`-nya tidak pernah melihat `user_id`) yang
  mengirim `user_id` atau `customer_id` yang sah bentuknya tapi tidak
  ada baris sungguhannya tetap bisa membuat jadwal yatim yang menunjuk
  user atau customer yang tidak pernah ada. `POST /api/visit-plans`
  kini memeriksa keberadaan keduanya lewat `findByPk` setelah gerbang
  kepemilikan, sebelum `create`.
- **penjaga dan baris tulis yang menormalkan berbeda untuk field yang
  sama** — penjaga "tidak boleh mengubah code sendiri" di
  `PUT /api/users/:id` memakai `code || null`, sementara baris tulis di
  bawahnya memakai `nullableUpdate`. Untuk administrator ber-`code` NULL
  (kedua administrator sungguhan persis begini), `{code: 0}` membuat
  penjaga menghitung `0 || null` menjadi `null` — sama dengan `code`
  sekarang — dan meloloskannya sebagai "tidak ada perubahan", padahal
  baris tulis memakai `nullableUpdate(0)` yang mengembalikan `0` apa
  adanya dan benar-benar menyimpannya sebagai `'0'`. Keduanya kini
  memanggil `nullableUpdate` yang sama persis di kedua sisi.
- **plan tanpa pemeriksaan kepemilikan pada checkIn** — visit_plan_id
  dari body dipakai tanpa memeriksa plan.user_id, sehingga siapa pun
  bisa check-in ke plan milik orang lain.
- **customer_id dari body pada checkIn** — dikirim terpisah dari
  visit_plan_id, tidak diperiksa cocok dengan plan.customer_id. Klien
  bisa check-in ke plan A tapi mencatat lokasi customer B.
- **checkOut tanpa gerbang kepemilikan** — siapa pun dengan token yang
  sah bisa checkout kunjungan siapa pun.
- **res.json sebelum VisitPlan.update pada checkOut** — kegagalan
  update sebelumnya tidak pernah terlihat klien.

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
- **`GET /api/users` menyempit tajam.** SPG dari 11 user menjadi 1
  (dirinya). MANAGER dari 3 (kedua administrator dan dirinya) menjadi 9
  bawahannya, tanpa satu pun administrator. SUPERVISOR dari 3 menjadi 4
  (dirinya ikut). ADMINISTRATOR tetap 11.
- **`GET /api/users/:id` menolak 403** di luar subtree pemanggil.
- **`GET /api/orders` menyempit** dari semua order menjadi subtree.
- **`GET /api/visits/:id/products` menolak 403** di luar subtree, dan id
  yang tidak ada kini menjawab **404, bukan 500**.
- **`GET /api/visit-activities/visit/:id`** mengembalikan nol baris untuk
  kunjungan di luar subtree.
- **`POST /api/visit-plans` menolak SPG dengan 403.** Sebelumnya siapa pun
  yang punya token bisa membuat jadwal kunjungan.
- **`PUT /api/users/:id` berhenti mengosongkan** `code`, `area_id`,
  `channel_id`, dan `supervisor_id` ketika field itu tidak dikirim.
- **`POST /api/visit-plans/upload` menolak SPG dengan 403**, dan
  memfilter tiap baris spreadsheet lewat subtree pemanggil. Sebelumnya
  endpoint ini tidak punya gerbang apa pun — sama seperti `create`
  sebelum perbaikannya sendiri, tapi lewat jalur upload massal. Baris
  yang pemiliknya di luar subtree kini dilaporkan lewat mekanisme error
  per-baris yang sudah ada (`errors[]`), bukan menggagalkan seluruh
  upload.
- **`POST /api/visit-plans` dan `uploadExcel` menolak `user_id`/
  `customer_id` yang bentuknya sah tapi tidak menunjuk baris mana pun**
  (`400`, tanpa baris tersimpan). Sebelumnya id yang lolos `parseId`
  (bilangan bulat positif) langsung dipakai tanpa diperiksa
  keberadaannya, dan `visit_plans` tidak punya foreign key sama sekali
  untuk menangkapnya.
- **`PUT /api/users/:id` untuk diri sendiri kini menolak `{code: 0}`**
  (dan nilai falsy senada seperti `false`). Sebelumnya penjaga
  "tidak boleh mengubah code sendiri" memakai normalisasi `|| null`
  sementara baris tulis di bawahnya memakai `nullableUpdate` — pada
  administrator yang `code`-nya NULL (kedua administrator sungguhan
  persis begini), keduanya tidak sepakat: penjaga melihat `0 || null`
  sebagai "tidak berubah" dan meloloskannya, padahal baris tulis
  benar-benar menyimpan `0` sebagai `'0'`.
- **checkIn menolak check-in ke plan milik orang lain** dengan 403.
- **checkIn menolak akurasi GPS di atas 50 meter**, diperiksa sebelum
  jarak.
- **checkIn mengabaikan customer_id dari body**, selalu memakai
  customer_id milik plan.
- **checkOut menolak 403 di luar subtree** pemilik kunjungan.
- **`POST /api/visit-activities` menolak 403** kalau `visit_id` bukan
  milik pemanggil, dan 400 kalau field wajib tipe activity tidak
  lengkap.
- **`checkOut` menolak 400** kalau kunjungan belum punya activity
  tercatat sama sekali.

## Yang masih terbuka

Dicatat supaya tidak hilang, bukan sebagai pekerjaan yang tertunda tanpa
alasan:

- **Satu kebocoran ditemukan review akhir branch ini dan SENGAJA TIDAK
  diperbaiki di sini** — dengan alasannya:
  - **`app.js:38`** (`app.use('/uploads', express.static('uploads'))`)
    melayani folder upload tanpa auth sama sekali. Foto aktivitas bisa
    dibaca siapa pun yang menebak atau mendapatkan nama filenya, tanpa
    token.
- **`GET /api/customers/:id`** (`customer.controller.js:372`) tidak
  membatasi apa pun — token siapa pun bisa membaca customer mana pun
  lewat id-nya, termasuk yang di luar area/channel pemanggil.
- **Multi-area tidak punya jalur tulis.** `area_ids` di form web tidak
  diproses di `POST /api/users` maupun `PUT /api/users/:id`, dan
  `userArea.routes.js` hanya mendaftarkan satu route GET. Hanya satu user
  punya baris `user_areas`, dan itu disisipkan manual. Ini fitur yang
  hilang, bukan kebocoran — sub-proyek tersendiri.
- **checkOut tidak transaksional** — `visit.save()` dan `VisitPlan.update()`
  terpisah tanpa wrapper transaksi. Kalau update kedua gagal setelah yang
  pertama commit, `checkout_time` tersimpan tapi `visit_plans.status` tidak
  pernah menjadi `COMPLETED` — status tidak sinkron sampai diperbaiki
  manual. Di luar cakupan sub-proyek ini (urutan respons, bukan
  atomisitas).
- **checkIn juga tidak transaksional** — bentuknya sama persis:
  `Visit.create()` lalu `VisitPlan.update()` sebagai dua tulisan
  terpisah tanpa wrapper transaksi. Kalau update kedua gagal setelah
  yang pertama commit, baris `Visit` sudah ada tapi `visit_plans.status`
  tidak pernah menjadi `ON VISIT` — plan tetap tampak `PENDING` walau
  kunjungannya sudah tercatat. Sama seperti catatan `checkOut` di atas,
  di luar cakupan sub-proyek ini.
- **`sfa-web` membaca `data.error`** untuk sebagian endpoint, sementara
  backend mengirim `{ message }`. **Tidak berlaku untuk checkout**:
  `sfa-web/app/visit-detail/[id]/page.tsx`, `handleCheckout`, membaca
  `alert(data.message)` — `data.error` tidak muncul sama sekali di
  berkas itu — sehingga 400 baru dari FIX 3 (checkout kedua ditolak)
  tampil dengan pesan yang benar, bukan `alert(undefined)`. Catatan ini
  tetap berlaku untuk endpoint lain yang belum diperiksa di sini.
- **`GET /api/users/:id/areas`** nol pemanggil di ketiga aplikasi.
- **`parseId` memakai `Number()`, bukan validasi tipe.** `Number([5])`
  adalah `5`, dan `Number(true)` adalah `1` — jadi `parseId([5])` dan
  `parseId(true)` sama-sama lolos sebagai id yang sah. Ini belum jadi
  celah: setiap pemanggil lain memakai `req.params.id`, yang selalu
  string dari URL, dan array maupun boolean tidak pernah muncul di sana.
  `POST /api/visit-plans` adalah pemanggil **pertama** yang menerapkan
  `parseId` ke nilai dari body JSON, bukan dari `req.params`, dan body
  JSON-lah yang membuat koersi ini benar-benar bisa dicapai.
