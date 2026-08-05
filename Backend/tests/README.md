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

## Kenapa tes ini ada

Beberapa di antaranya menjaga bug yang pernah benar-benar terjadi —
jangan dihapus tanpa membaca komentarnya:

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
