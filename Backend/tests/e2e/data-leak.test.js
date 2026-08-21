require('dotenv').config({ quiet: true })

const { test, describe, before, after } = require('node:test')
const assert = require('node:assert')
const jwt = require('jsonwebtoken')
const mysql = require('mysql2/promise')
const XLSX = require('xlsx')

const BASE = process.env.TEST_BASE_URL || 'http://localhost:1000'

// Akun sungguhan, dipakai HANYA sebagai pemanggil baca-saja. Tidak ada
// satu pun tes di berkas ini yang menjadikannya sasaran tulis.
const SPG = 1               // anak dari 3
const ADMIN = 2
const SUPERVISOR = 3        // anak dari 30; punya 1, 37, 38
const MANAGER = 30          // punya 3, 31, 33 dan cucunya
const SPG_LUAR = 34         // anak dari 33 — di luar subtree 3

// `visits` tidak punya kolom teks bebas seperti `doc_no` milik
// sales_orders untuk menandai baris fixture. `latitude` dipinjam untuk
// itu: kolomnya STRING dan tidak pernah dibaca sebagai koordinat oleh
// tes mana pun di berkas ini. Sama seperti fixture sales_orders yang
// menandai dirinya lewat `doc_no` berawalan 'UJI-', baris `visits` yang
// dibuat berkas ini semuanya bisa ditemukan lewat
// `WHERE latitude = ?` [VISIT_FIXTURE_MARKER] -- pemulihan setelah
// proses tes mati di tengah tidak lagi bergantung pada asumsi tak
// tertulis bahwa user 34 tidak pernah punya kunjungan sungguhan.
const VISIT_FIXTURE_MARKER = 'UJI-VISIT-FIXTURE-DATA-LEAK'

// Dipakai oleh blok "PUT /api/users/:id tidak menghapus field yang
// tidak dikirim" di bawah. Didefinisikan di sini, di tingkat berkas --
// bukan di dalam describe-nya sendiri -- supaya pre-clean-nya bisa
// dijalankan di before() tingkat berkas (lihat komentar di sana).
const SEMENTARA = {
    code: 'UJI-NULLABLE-15082026',
    email: 'uji.nullable.15082026@contoh.invalid',
}

let db

const tokenUntuk = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '15m' })

const kirim = async (method, path, userId, body) => {
    const headers = { 'Content-Type': 'application/json' }

    if (userId !== null) {
        headers.Authorization = 'Bearer ' + tokenUntuk(userId)
    }

    const res = await fetch(BASE + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    })

    let data = null

    try {
        data = await res.json()
    } catch {
        data = null
    }

    return { status: res.status, data }
}

/** Respons kadang array telanjang, kadang { data }. */
const daftarDari = (data) =>
    Array.isArray(data) ? data : (data?.data ?? [])

/**
 * Membangun buffer .xlsx sungguhan di memori dari array of object, lalu
 * mengunggahnya sebagai multipart/form-data ke
 * POST /api/visit-plans/upload -- dipakai untuk MEMBUKTIKAN gerbang FIX 1
 * (lihat blok "POST /api/visit-plans/upload" di bawah) lewat request HTTP
 * sungguhan, bukan lewat memanggil controller-nya langsung.
 *
 * FormData dan Blob bawaan Node (tanpa dependency tambahan) cukup untuk
 * ini sejak Node 18 -- fetch bawaan mengurus header dan boundary
 * multipart-nya sendiri selama body-nya instance FormData.
 */
const kirimExcel = async (userId, rows) => {
    const sheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1')

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    const form = new FormData()

    form.append(
        'file',
        new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        'uji-upload.xlsx'
    )

    const headers = {}

    if (userId !== null) {
        headers.Authorization = 'Bearer ' + tokenUntuk(userId)
    }

    const res = await fetch(BASE + '/api/visit-plans/upload', {
        method: 'POST',
        headers,
        body: form,
    })

    let data = null

    try {
        data = await res.json()
    } catch {
        data = null
    }

    return { status: res.status, data }
}

before(async () => {
    try {
        await fetch(BASE + '/api/users')
    } catch {
        throw new Error(
            `Server tidak menjawab di ${BASE}. Jalankan "npm run dev" lebih dulu.`
        )
    }

    db = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
    })

    // Pre-clean fixture "PUT /api/users/:id" ini SENGAJA dijalankan di
    // sini, di before() tingkat BERKAS -- bukan di before() milik
    // describe-nya sendiri, yang dideklarasikan paling akhir di berkas
    // ini. User sementara itu punya supervisor_id = 3, sehingga ia
    // duduk DI DALAM subtree 3 maupun subtree 30 sekaligus. Kalau
    // pre-clean-nya menunggu sampai describe-nya sendiri berjalan, satu
    // proses tes yang mati di antara INSERT dan DELETE meninggalkan
    // barisnya, dan run BERIKUTNYA akan mengevaluasi assertion daftar id
    // eksplisit SUPERVISOR/MANAGER ("GET /api/users memakai subtree",
    // jauh lebih awal di berkas ini) SEBELUM pre-clean describe yang
    // belakangan itu sempat menghapusnya -- kedua tes itu merah, dan
    // pesannya terbaca seolah filter subtree bocor, padahal yang bocor
    // cuma proses tes sebelumnya.
    await db.query(
        'DELETE FROM users WHERE code = ? OR email = ?',
        [SEMENTARA.code, SEMENTARA.email]
    )
})

after(async () => {
    if (db) {
        await db.end()
    }
})


describe('GET /api/users memakai subtree', () => {

    // Angka pastinya, bukan "kurang dari 11". "Kurang" tetap hijau kalau
    // filternya bocor sebagian — dan bocor sebagian tetap bocor.
    test('SPG melihat tepat 1 user, dirinya sendiri', async () => {
        const { status, data } = await kirim('GET', '/api/users', SPG)

        assert.strictEqual(status, 200)

        const daftar = daftarDari(data)

        assert.strictEqual(daftar.length, 1)
        assert.strictEqual(Number(daftar[0].id), SPG)
    })

    test('SUPERVISOR melihat 4: dirinya dan tiga SPG-nya', async () => {
        const { data } = await kirim('GET', '/api/users', SUPERVISOR)

        const ids = daftarDari(data)
            .map(u => Number(u.id))
            .sort((a, b) => a - b)

        assert.deepStrictEqual(ids, [1, 3, 37, 38])
    })

    // Inti perbaikannya. Sebelumnya MANAGER melihat TIGA user: kedua
    // administrator dan dirinya sendiri, karena filternya membandingkan
    // area_id bernilai NULL yang diterjemahkan Sequelize menjadi
    // IS NULL.
    test('MANAGER melihat 9 dan tidak satu pun ADMINISTRATOR', async () => {
        const { data } = await kirim('GET', '/api/users', MANAGER)

        const daftar = daftarDari(data)
        const ids = daftar.map(u => Number(u.id)).sort((a, b) => a - b)

        assert.deepStrictEqual(ids, [1, 3, 30, 31, 32, 33, 34, 37, 38])

        assert.strictEqual(
            daftar.filter(u => u.role === 'ADMINISTRATOR').length,
            0,
            'akun administrator tidak boleh terlihat oleh manager'
        )
    })

    // Dibandingkan dengan jumlah baris hidup di database, bukan angka
    // yang dipaku: administrator TIDAK dibatasi, jadi yang benar adalah
    // "sebanyak yang ada di tabel", apa pun isinya saat ini. Angka
    // literal mengikat tes ini pada kardinalitas seluruh tabel users,
    // sehingga berkas e2e lain yang menyisipkan satu baris sementara
    // membuatnya merah tanpa ada yang rusak.
    test('ADMINISTRATOR melihat semuanya', async () => {
        const [semua] = await db.query('SELECT COUNT(*) n FROM users')

        const { data } = await kirim('GET', '/api/users', ADMIN)

        assert.strictEqual(daftarDari(data).length, Number(semua[0].n))
    })

    // Relasi User pernah membawa seluruh baris termasuk hash bcrypt.
    test('tidak ada respons yang memuat password', async () => {
        for (const pemanggil of [SPG, SUPERVISOR, MANAGER, ADMIN]) {
            const { data } = await kirim('GET', '/api/users', pemanggil)

            for (const u of daftarDari(data)) {
                assert.strictEqual(
                    'password' in u,
                    false,
                    `password ikut terkirim untuk pemanggil ${pemanggil}`
                )
            }
        }
    })

})


describe('GET /api/users/:id memakai subtree', () => {

    test('SPG membaca administrator ditolak 403', async () => {
        const { status } = await kirim('GET', `/api/users/${ADMIN}`, SPG)

        assert.strictEqual(status, 403)
    })

    test('SPG membaca dirinya sendiri boleh', async () => {
        const { status } = await kirim('GET', `/api/users/${SPG}`, SPG)

        assert.strictEqual(status, 200)
    })

    test('SUPERVISOR membaca SPG di luar subtree ditolak 403', async () => {
        const { status } = await kirim(
            'GET',
            `/api/users/${SPG_LUAR}`,
            SUPERVISOR
        )

        assert.strictEqual(status, 403)
    })

    test('SUPERVISOR membaca SPG-nya sendiri boleh', async () => {
        const { status } = await kirim('GET', `/api/users/${SPG}`, SUPERVISOR)

        assert.strictEqual(status, 200)
    })

    test('ADMINISTRATOR membaca siapa pun boleh', async () => {
        const { status } = await kirim('GET', `/api/users/${SPG}`, ADMIN)

        assert.strictEqual(status, 200)
    })

    test('id yang tidak ada tetap 404 bagi administrator', async () => {
        const { status } = await kirim('GET', '/api/users/99999999', ADMIN)

        assert.strictEqual(status, 404)
    })

})


describe('GET /api/orders memakai subtree', () => {

    // Fixture IDs untuk dihapus di after()
    let ujiOrderLuarSubtreeId
    let ujiOrderDalamSubtreeId

    const daftarOrder = async (pemanggil) => {
        const { status, data } = await kirim('GET', '/api/orders', pemanggil)

        assert.strictEqual(status, 200)

        return daftarDari(data)
    }

    before(async () => {
        // Buat order milik SPG_LUAR (user 34, di luar subtree supervisor 3).
        // Diperlukan untuk membuktikan filter benar-benar membedakan anggota
        // subtree dari yang di luarnya, bukan hanya mengalami keberuntungan data.
        const [resultLuar] = await db.query(
            'INSERT INTO sales_orders (doc_no, user_id, customer_id, doc_date, total, status) VALUES (?, ?, ?, NOW(), ?, ?)',
            ['UJI-LUAR-' + Date.now(), SPG_LUAR, null, 0, 'DRAFT']
        )
        ujiOrderLuarSubtreeId = resultLuar.insertId

        // Buat order milik SPG (user 1, dalam subtree supervisor 3).
        const [resultDalam] = await db.query(
            'INSERT INTO sales_orders (doc_no, user_id, customer_id, doc_date, total, status) VALUES (?, ?, ?, NOW(), ?, ?)',
            ['UJI-DALAM-' + Date.now(), SPG, null, 0, 'DRAFT']
        )
        ujiOrderDalamSubtreeId = resultDalam.insertId
    })

    after(async () => {
        // Hapus fixture yang dibuat
        if (ujiOrderLuarSubtreeId) {
            await db.query('DELETE FROM sales_orders WHERE id = ?', [ujiOrderLuarSubtreeId])
        }
        if (ujiOrderDalamSubtreeId) {
            await db.query('DELETE FROM sales_orders WHERE id = ?', [ujiOrderDalamSubtreeId])
        }
    })

    // Dibandingkan dengan database, bukan dengan angka yang dipaku:
    // jumlah order berubah setiap kali seseorang membuat order, dan tes
    // yang memaku angka akan merah karena alasan yang salah.
    test('ADMINISTRATOR melihat semua order', async () => {
        const [semua] = await db.query('SELECT COUNT(*) n FROM sales_orders')

        const hasil = await daftarOrder(ADMIN)

        assert.strictEqual(hasil.length, Number(semua[0].n))
    })

    test('SUPERVISOR hanya melihat order subtree-nya', async () => {
        const [subtree] = await db.query(
            'SELECT COUNT(*) n FROM sales_orders WHERE user_id IN (1, 3, 37, 38)'
        )

        const hasil = await daftarOrder(SUPERVISOR)

        assert.strictEqual(hasil.length, Number(subtree[0].n))
    })

    test('SPG hanya melihat ordernya sendiri', async () => {
        const [milikSendiri] = await db.query(
            'SELECT COUNT(*) n FROM sales_orders WHERE user_id = ?',
            [SPG]
        )

        const hasil = await daftarOrder(SPG)

        assert.strictEqual(hasil.length, Number(milikSendiri[0].n))
    })

    test('tidak ada order milik user di luar subtree yang muncul', async () => {
        const hasil = await daftarOrder(SUPERVISOR)

        for (const o of hasil) {
            assert.ok(
                [1, 3, 37, 38].includes(Number(o.user_id)),
                `order user_id ${o.user_id} di luar subtree supervisor 3`
            )
        }
    })

    // Relasi User mengambil dari tabel users. Tanpa attributes yang
    // dibatasi, seluruh baris termasuk hash bcrypt masuk ke respons.
    test('respons tidak memuat hash password lewat relasi User', async () => {
        const hasil = await daftarOrder(ADMIN)

        for (const o of hasil) {
            assert.strictEqual(
                o.User && 'password' in o.User,
                false,
                'password ikut terkirim lewat relasi User'
            )
        }
    })

})


describe('GET /api/visits/:id/products memakai subtree', () => {

    let visitDalam

    // Fixture id untuk dihapus di after(). Database dev hanya berisi
    // kunjungan milik user 1 dan 37 -- keduanya DI DALAM subtree 3. Tanpa
    // baris buatan di sini, sisi "luar subtree" kosong dan tesnya akan
    // di-skip, bukan membuktikan apa pun. Ini persis pelajaran Task 5:
    // tes yang hijau karena tidak pernah menyentuh sisi yang salah.
    let visitLuarFixtureId

    before(async () => {
        const [dalam] = await db.query(
            'SELECT id FROM visits WHERE user_id IN (1, 37, 38) LIMIT 1'
        )

        visitDalam = dalam[0]?.id ?? null

        // Kunjungan milik SPG_LUAR (34), anak dari supervisor 33 --
        // di luar subtree supervisor 3 (1, 37, 38). customer_id memakai
        // customer nyata (2, ALFAMART DEPOK, dipakai juga oleh visit
        // dalam-subtree lain) supaya rantai Customer->CustomerGroup->
        // Product lengkap. Tanpa itu, handler lama gagal karena null
        // chain, bukan karena kebocoran datanya sendiri terbukti.
        const [resultLuar] = await db.query(
            'INSERT INTO visits (user_id, customer_id, latitude) VALUES (?, ?, ?)',
            [SPG_LUAR, 2, VISIT_FIXTURE_MARKER]
        )
        visitLuarFixtureId = resultLuar.insertId
    })

    after(async () => {
        if (visitLuarFixtureId) {
            await db.query('DELETE FROM visits WHERE id = ?', [visitLuarFixtureId])
        }
    })

    test('kunjungan dalam subtree boleh', async (t) => {
        if (visitDalam === null) {
            t.skip('tidak ada kunjungan milik subtree 3 di database')
            return
        }

        const { status } = await kirim(
            'GET',
            `/api/visits/${visitDalam}/products`,
            SUPERVISOR
        )

        assert.strictEqual(status, 200)
    })

    test('kunjungan di luar subtree ditolak 403', async () => {
        const { status } = await kirim(
            'GET',
            `/api/visits/${visitLuarFixtureId}/products`,
            SUPERVISOR
        )

        assert.strictEqual(status, 403)
    })

    test('ADMINISTRATOR boleh membaca kunjungan mana pun', async () => {
        const { status } = await kirim(
            'GET',
            `/api/visits/${visitLuarFixtureId}/products`,
            ADMIN
        )

        assert.strictEqual(status, 200)
    })

    // Handler lama memakai visit.Customer tanpa memeriksa visit, jadi id
    // yang tidak ada menghasilkan 500 -- pesan exception, bukan jawaban.
    test('kunjungan yang tidak ada menghasilkan 404, bukan 500', async () => {
        const { status } = await kirim(
            'GET',
            '/api/visits/99999999/products',
            ADMIN
        )

        assert.strictEqual(status, 404)
    })

    test('id non-numerik ditolak 400', async () => {
        const { status } = await kirim(
            'GET',
            '/api/visits/12abc/products',
            ADMIN
        )

        assert.strictEqual(status, 400)
    })

})


describe('GET /api/visit-activities/visit/:id memakai subtree', () => {

    const VISIT_YATIM = 999999901

    // Fixture: kunjungan milik SPG_LUAR (34), anak dari supervisor 33 --
    // di luar subtree supervisor 3 (1, 3, 37, 38). Dicek langsung ke
    // database sebelum menulis tes ini: 9 baris visits, dan SEMUANYA di
    // dalam subtree 3 (8 milik user 1, 1 milik user 37) -- sisi luar
    // subtree kosong. Tanpa baris buatan di sini, visitLuar akan null
    // dan kedua tes di bawah cuma di-skip, bukan membuktikan apa pun.
    // Ini persis pelajaran Task 5/6. customer_id memakai customer nyata
    // (2, ALFAMART DEPOK) seperti fixture Task 6.
    let visitLuar
    let aktivitasLuarId

    before(async () => {
        const [luar] = await db.query(
            'INSERT INTO visits (user_id, customer_id, latitude) VALUES (?, ?, ?)',
            [SPG_LUAR, 2, VISIT_FIXTURE_MARKER]
        )
        visitLuar = luar.insertId

        const [aktivitas] = await db.query(
            'INSERT INTO visit_activities (visit_id, notes) VALUES (?, ?)',
            [visitLuar, 'FIXTURE TASK 7 - LUAR SUBTREE']
        )
        aktivitasLuarId = aktivitas.insertId

        // Baris YATIM: visit_id menunjuk kunjungan yang tidak ada.
        // Inilah yang menguji `required: true` pada include Visit —
        // tanpa baris yatim, mematikan `required` tetap hijau, karena
        // LEFT JOIN dan INNER JOIN menghasilkan hal yang sama selama
        // setiap activity punya induk.
        //
        // Kolomnya `notes`, bukan `activity_type` -- visit_activities
        // tidak punya kolom activity_type di database ini.
        await db.query(
            'DELETE FROM visit_activities WHERE visit_id = ?',
            [VISIT_YATIM]
        )

        await db.query(
            'INSERT INTO visit_activities (visit_id, notes) VALUES (?, ?)',
            [VISIT_YATIM, 'UJI YATIM']
        )
    })

    after(async () => {
        await db.query(
            'DELETE FROM visit_activities WHERE visit_id = ?',
            [VISIT_YATIM]
        )

        if (aktivitasLuarId) {
            await db.query(
                'DELETE FROM visit_activities WHERE id = ?',
                [aktivitasLuarId]
            )
        }

        if (visitLuar) {
            await db.query(
                'DELETE FROM visits WHERE id = ?',
                [visitLuar]
            )
        }
    })

    const aktivitas = async (visitId, pemanggil) => {
        const { status, data } = await kirim(
            'GET',
            `/api/visit-activities/visit/${visitId}`,
            pemanggil
        )

        return { status, daftar: daftarDari(data) }
    }

    test('SUPERVISOR membaca kunjungan di luar subtree: nol baris', async () => {
        const { daftar } = await aktivitas(visitLuar, SUPERVISOR)

        assert.strictEqual(daftar.length, 0)
    })

    test('ADMINISTRATOR membaca kunjungan yang sama: ada isinya', async () => {
        const [punya] = await db.query(
            'SELECT COUNT(*) n FROM visit_activities WHERE visit_id = ?',
            [visitLuar]
        )

        const { daftar } = await aktivitas(visitLuar, ADMIN)

        assert.strictEqual(daftar.length, Number(punya[0].n))
    })

    // Ini tes required: true. Baris yatim tidak punya kunjungan induk,
    // jadi ia TIDAK BOLEH muncul untuk siapa pun — termasuk
    // administrator, yang subtree-nya null.
    test('baris yatim tidak muncul, bahkan untuk ADMINISTRATOR', async () => {
        const { daftar } = await aktivitas(VISIT_YATIM, ADMIN)

        assert.strictEqual(
            daftar.length,
            0,
            'activity tanpa kunjungan induk tidak boleh terkirim'
        )
    })

    test('id non-numerik ditolak 400', async () => {
        const { status } = await aktivitas('12abc', ADMIN)

        assert.strictEqual(status, 400)
    })

})

describe('POST /api/visit-plans', () => {

    // Tanggal yang tidak dipakai data sungguhan HARI INI, dipakai HANYA
    // untuk pengukuran COUNT (jumlahPada/totalPada) di bawah -- bukan
    // lagi sebagai kunci pembersihan. Baris ini adalah tanggal MASA
    // DEPAN, dan importer Excel (`uploadExcel`) bisa sah-sah saja
    // mengisinya dengan jadwal sungguhan sebelum tes ini jalan lagi.
    // Menghapus lewat `WHERE visit_date = ?` saja -- seperti sebelumnya
    // -- akan ikut memusnahkan jadwal sungguhan itu. Baris yang
    // benar-benar dibuat tes-tes di bawah ditangkap id-nya ke
    // idsDibuat dan dihapus SATU PER SATU di after(), persis pola yang
    // dipakai setiap blok lain di berkas ini.
    const TANGGAL = '2026-12-30'

    let customerUji
    const idsDibuat = []

    before(async () => {
        const [c] = await db.query(
            'SELECT id FROM customers WHERE id <> 97 LIMIT 1'
        )

        customerUji = c[0]?.id ?? null
    })

    after(async () => {
        for (const id of idsDibuat) {
            await db.query('DELETE FROM visit_plans WHERE id = ?', [id])
        }
    })

    const jumlahPada = async (userId) => {
        const [r] = await db.query(
            'SELECT COUNT(*) n FROM visit_plans WHERE visit_date = ? AND user_id = ?',
            [TANGGAL, userId]
        )

        return Number(r[0].n)
    }

    /** Total baris pada TANGGAL, tanpa peduli user_id -- dipakai untuk
     * membuktikan TIDAK ADA baris baru tersimpan sama sekali, termasuk
     * untuk user_id yang cacat (null, 0, non-numerik) yang tidak bisa
     * dicocokkan dengan aman lewat `= ?` biasa. */
    const totalPada = async () => {
        const [r] = await db.query(
            'SELECT COUNT(*) n FROM visit_plans WHERE visit_date = ?',
            [TANGGAL]
        )

        return Number(r[0].n)
    }

    // Keputusan sub-proyek visit-plan: SUPERVISOR ke atas. create tidak
    // punya gerbang role sama sekali sebelum perbaikan ini.
    test('SPG tidak boleh membuat jadwal kunjungan', async (t) => {
        if (customerUji === null) {
            t.skip('tidak ada customer selain id 97 di database')
            return
        }

        const { status } = await kirim('POST', '/api/visit-plans', SPG, {
            user_id: SPG,
            customer_id: customerUji,
            visit_date: TANGGAL,
        })

        assert.strictEqual(status, 403)

        // Diperiksa ke database. Tanpa ini, tesnya juga lulus pada
        // handler yang menyimpan barisnya lalu mengembalikan 403.
        assert.strictEqual(await jumlahPada(SPG), 0)
    })

    test('SUPERVISOR tidak boleh menjadwalkan untuk SPG di luar subtree', async (t) => {
        if (customerUji === null) {
            t.skip('tidak ada customer selain id 97 di database')
            return
        }

        const { status } = await kirim('POST', '/api/visit-plans', SUPERVISOR, {
            user_id: SPG_LUAR,
            customer_id: customerUji,
            visit_date: TANGGAL,
        })

        assert.strictEqual(status, 403)
        assert.strictEqual(await jumlahPada(SPG_LUAR), 0)
    })

    test('SUPERVISOR boleh menjadwalkan untuk SPG-nya sendiri', async (t) => {
        if (customerUji === null) {
            t.skip('tidak ada customer selain id 97 di database')
            return
        }

        const { status, data } = await kirim('POST', '/api/visit-plans', SUPERVISOR, {
            user_id: SPG,
            customer_id: customerUji,
            visit_date: TANGGAL,
        })

        // res.json(data), bukan res.status(201) — diperiksa, bukan
        // diandaikan.
        assert.strictEqual(status, 200)
        assert.strictEqual(await jumlahPada(SPG), 1)

        idsDibuat.push(data.id)
    })

    // status HARUS dipaksa PENDING. Klien tidak boleh membuat jadwal
    // yang langsung COMPLETED — update dan delete menolak non-PENDING,
    // sehingga jadwal seperti itu terkunci selamanya.
    test('status dari klien diabaikan, selalu PENDING', async (t) => {
        if (customerUji === null) {
            t.skip('tidak ada customer selain id 97 di database')
            return
        }

        const { data } = await kirim('POST', '/api/visit-plans', SUPERVISOR, {
            user_id: 37,
            customer_id: customerUji,
            visit_date: TANGGAL,
            status: 'COMPLETED',
        })

        idsDibuat.push(data.id)

        const [r] = await db.query(
            'SELECT status FROM visit_plans WHERE id = ?',
            [data.id]
        )

        assert.strictEqual(r[0]?.status, 'PENDING')
    })

    test('user_id yang tidak dikirim ditolak 400', async (t) => {
        if (customerUji === null) {
            t.skip('tidak ada customer selain id 97 di database')
            return
        }

        const { status } = await kirim('POST', '/api/visit-plans', SUPERVISOR, {
            customer_id: customerUji,
            visit_date: TANGGAL,
        })

        assert.strictEqual(status, 400)
    })

    // Temuan review lanjutan: assertWithinSubtree mengembalikan "boleh"
    // seketika saat subordinateIds === null (ADMINISTRATOR), TANPA
    // PERNAH melihat user_id. Keempat tes di bawah memanggil sebagai
    // ADMINISTRATOR karena di situlah lubangnya -- SPG dan SUPERVISOR
    // tidak pernah lolos gerbang kepemilikan dengan subordinateIds
    // berupa array, apa pun nilai user_id yang mereka kirim.
    //
    // Assertion-nya memeriksa DATABASE, bukan cuma status HTTP: handler
    // yang menyimpan barisnya lalu mengembalikan 400 tetap merusak data.

    test('ADMINISTRATOR: user_id null ditolak 400, tidak ada baris tersimpan', async (t) => {
        if (customerUji === null) {
            t.skip('tidak ada customer selain id 97 di database')
            return
        }

        const sebelum = await totalPada()

        const { status } = await kirim('POST', '/api/visit-plans', ADMIN, {
            user_id: null,
            customer_id: customerUji,
            visit_date: TANGGAL,
        })

        assert.strictEqual(status, 400)
        assert.strictEqual(await totalPada(), sebelum)

        const [yatim] = await db.query(
            'SELECT COUNT(*) n FROM visit_plans WHERE visit_date = ? AND user_id IS NULL',
            [TANGGAL]
        )

        assert.strictEqual(Number(yatim[0].n), 0)
    })

    // Kasus intinya: visit_plans.user_id NOT NULL tapi TANPA foreign
    // key. user_id: 0 lolos NOT NULL begitu saja -- tanpa validasi ini,
    // baris tersimpan sebagai baris yatim yang tidak menunjuk user mana
    // pun.
    test('ADMINISTRATOR: user_id 0 ditolak 400, tidak ada baris yatim', async (t) => {
        if (customerUji === null) {
            t.skip('tidak ada customer selain id 97 di database')
            return
        }

        const sebelum = await totalPada()

        const { status } = await kirim('POST', '/api/visit-plans', ADMIN, {
            user_id: 0,
            customer_id: customerUji,
            visit_date: TANGGAL,
        })

        assert.strictEqual(status, 400)
        assert.strictEqual(await totalPada(), sebelum)

        const [yatim] = await db.query(
            'SELECT COUNT(*) n FROM visit_plans WHERE visit_date = ? AND user_id = 0',
            [TANGGAL]
        )

        assert.strictEqual(
            Number(yatim[0].n),
            0,
            'baris yatim user_id=0 tidak boleh ada'
        )
    })

    test('ADMINISTRATOR: user_id non-numerik ditolak 400, tidak ada baris tersimpan', async (t) => {
        if (customerUji === null) {
            t.skip('tidak ada customer selain id 97 di database')
            return
        }

        const sebelum = await totalPada()

        const { status } = await kirim('POST', '/api/visit-plans', ADMIN, {
            user_id: 'abc',
            customer_id: customerUji,
            visit_date: TANGGAL,
        })

        assert.strictEqual(status, 400)
        assert.strictEqual(await totalPada(), sebelum)
    })

    test('ADMINISTRATOR: customer_id 0 ditolak 400, tidak ada baris tersimpan', async (t) => {
        if (customerUji === null) {
            t.skip('tidak ada customer selain id 97 di database')
            return
        }

        const sebelum = await totalPada()

        const { status } = await kirim('POST', '/api/visit-plans', ADMIN, {
            user_id: SPG,
            customer_id: 0,
            visit_date: TANGGAL,
        })

        assert.strictEqual(status, 400)
        assert.strictEqual(await totalPada(), sebelum)
    })

    // FIX 2 dari review akhir: visit_plans tidak punya foreign key sama
    // sekali, dan parseId hanya memeriksa "bilangan bulat >= 1" -- id
    // yang sah bentuknya tapi tidak menunjuk baris mana pun lolos
    // begitu saja sampai sub-proyek ini. Keduanya dipanggil sebagai
    // ADMINISTRATOR dengan alasan yang sama seperti keempat tes di
    // atas: assertWithinSubtree(null, ...) tidak pernah melihat
    // user_id/customer_id-nya, jadi administrator-lah satu-satunya
    // yang bisa sampai ke pemeriksaan keberadaan baris ini.
    test('ADMINISTRATOR: user_id yang tidak ada ditolak 400, tidak ada baris tersimpan', async (t) => {
        if (customerUji === null) {
            t.skip('tidak ada customer selain id 97 di database')
            return
        }

        const sebelum = await totalPada()

        const { status } = await kirim('POST', '/api/visit-plans', ADMIN, {
            user_id: 999999,
            customer_id: customerUji,
            visit_date: TANGGAL,
        })

        assert.strictEqual(status, 400)
        assert.strictEqual(await totalPada(), sebelum)

        const [yatim] = await db.query(
            'SELECT COUNT(*) n FROM visit_plans WHERE visit_date = ? AND user_id = 999999',
            [TANGGAL]
        )

        assert.strictEqual(
            Number(yatim[0].n),
            0,
            'baris yatim user_id tak-ada tidak boleh ada'
        )
    })

    test('ADMINISTRATOR: customer_id yang tidak ada ditolak 400, tidak ada baris tersimpan', async () => {
        const sebelum = await totalPada()

        const { status } = await kirim('POST', '/api/visit-plans', ADMIN, {
            user_id: SPG,
            customer_id: 999999,
            visit_date: TANGGAL,
        })

        assert.strictEqual(status, 400)
        assert.strictEqual(await totalPada(), sebelum)

        const [yatim] = await db.query(
            'SELECT COUNT(*) n FROM visit_plans WHERE visit_date = ? AND customer_id = 999999',
            [TANGGAL]
        )

        assert.strictEqual(
            Number(yatim[0].n),
            0,
            'baris yatim customer_id tak-ada tidak boleh ada'
        )
    })

})


describe('POST /api/visit-plans/upload', () => {

    // FIX 1 dari review akhir, dan satu-satunya CRITICAL-nya: endpoint
    // ini menyimpulkan pemilik baris LANGSUNG dari kolom "Sales Code" di
    // spreadsheet lewat User.findOne, lalu VisitPlan.create -- tanpa
    // gerbang role dan tanpa assertWithinSubtree sama sekali. SPG mana
    // pun yang punya token bisa mengunggah spreadsheet berisi kode sales
    // siapa saja dan membuat jadwal kunjungan untuk SELURUH perusahaan.
    //
    // Tanggal sentinel SENGAJA berbeda dari blok "POST /api/visit-plans"
    // di atas (2026-12-30) -- keduanya independen: kalau blok ini
    // memakai tanggal yang sama, baris yang dibuat blok atas untuk
    // (SPG, customerUji, TANGGAL) bisa membuat pemeriksaan DUPLICATE di
    // uploadExcel diam-diam men-skip baris yang seharusnya diimpor di
    // sini, tergantung urutan cleanup antar describe.
    const TANGGAL_UPLOAD = new Date(2026, 11, 29) // 2026-12-29

    // Kode sales sungguhan, bukan id -- uploadExcel mencari
    // User.findOne({ where: { code } }), bukan by id.
    const KODE_DALAM_SUBTREE = 'JKT001' // user 1 (SPG), anak dari supervisor 3
    const KODE_LUAR_SUBTREE = 'SBY001'  // user 34 (SPG_LUAR), anak dari supervisor 33

    let customerCodeUji
    const idsDibuat = []

    before(async () => {
        const [c] = await db.query(
            'SELECT code FROM customers WHERE id NOT IN (97, 123) AND code IS NOT NULL LIMIT 1'
        )

        customerCodeUji = c[0]?.code ?? null
    })

    after(async () => {
        for (const id of idsDibuat) {
            await db.query('DELETE FROM visit_plans WHERE id = ?', [id])
        }
    })

    const jumlahPadaUpload = async (userId) => {
        const [r] = await db.query(
            'SELECT COUNT(*) n FROM visit_plans WHERE visit_date = ? AND user_id = ?',
            ['2026-12-29', userId]
        )

        return Number(r[0].n)
    }

    // Bukti gerbang FIX 1 sisi SPG: request HTTP sungguhan, file .xlsx
    // sungguhan, ditolak 403, dan TIDAK ADA baris tersimpan -- bukan cuma
    // status HTTP-nya yang diperiksa.
    test('SPG mengunggah file ditolak 403, tidak ada baris tersimpan', async (t) => {
        if (customerCodeUji === null) {
            t.skip('tidak ada customer selain id 97/123 di database')
            return
        }

        const sebelum = await jumlahPadaUpload(SPG)

        const { status } = await kirimExcel(SPG, [
            {
                'Sales Code': KODE_DALAM_SUBTREE, // SPG mencoba menjadwalkan dirinya sendiri
                'Customer Code': customerCodeUji,
                'Visit Date': TANGGAL_UPLOAD,
            },
        ])

        assert.strictEqual(status, 403)
        assert.strictEqual(await jumlahPadaUpload(SPG), sebelum)
    })

    // Bukti gerbang FIX 1 sisi SUPERVISOR: satu file, DUA baris -- satu
    // dalam subtree-nya (harus diimpor) dan satu di luar subtree-nya
    // (harus ditolak dan dilaporkan lewat mekanisme error per-baris yang
    // SUDAH ADA di uploadExcel, bukan menggagalkan seluruh upload).
    test('SUPERVISOR: baris dalam subtree diimpor, baris luar subtree dilaporkan sebagai error', async (t) => {
        if (customerCodeUji === null) {
            t.skip('tidak ada customer selain id 97/123 di database')
            return
        }

        const sebelumDalam = await jumlahPadaUpload(SPG)
        const sebelumLuar = await jumlahPadaUpload(SPG_LUAR)

        const { status, data } = await kirimExcel(SUPERVISOR, [
            {
                'Sales Code': KODE_DALAM_SUBTREE,
                'Customer Code': customerCodeUji,
                'Visit Date': TANGGAL_UPLOAD,
            },
            {
                'Sales Code': KODE_LUAR_SUBTREE,
                'Customer Code': customerCodeUji,
                'Visit Date': TANGGAL_UPLOAD,
            },
        ])

        assert.strictEqual(status, 200)

        // Baris pertama masuk, baris kedua dilaporkan -- upload TIDAK
        // gagal seluruhnya karena satu baris di luar jangkauan.
        assert.strictEqual(data.inserted, 1)
        assert.strictEqual(data.failed, 1)
        assert.strictEqual(data.errors.length, 1)
        assert.strictEqual(
            data.errors[0].reason,
            'Sales Code di luar jangkauan Anda'
        )

        assert.strictEqual(await jumlahPadaUpload(SPG), sebelumDalam + 1)

        // Baris di luar subtree TIDAK BOLEH tersimpan sama sekali.
        assert.strictEqual(await jumlahPadaUpload(SPG_LUAR), sebelumLuar)

        // Ditangkap untuk dihapus di after() -- lewat id, bukan lewat
        // tanggal, konsisten dengan blok lain di berkas ini.
        const [baris] = await db.query(
            'SELECT id FROM visit_plans WHERE visit_date = ? AND user_id = ? ORDER BY id DESC LIMIT 1',
            ['2026-12-29', SPG]
        )

        if (baris[0]) {
            idsDibuat.push(baris[0].id)
        }
    })

})


describe('PUT /api/users/:id tidak menghapus field yang tidak dikirim', () => {

    // SEMENTARA didefinisikan di tingkat berkas (dekat konstanta lain
    // di atas) karena pre-clean-nya kini berjalan di before() tingkat
    // berkas, sebelum describe manapun -- lihat komentar di sana.

    let idSementara

    before(async () => {

        // Keempat kolom yang jadi korban pola lama diisi dengan
        // sengaja, supaya penghapusannya bisa terdeteksi.
        const [hasil] = await db.query(
            `INSERT INTO users
                (code, name, email, password, role, status,
                 area_id, channel_id, supervisor_id)
             VALUES (?, ?, ?, ?, 'SPG', 'ACTIVE', 1, 2, 3)`,
            [
                SEMENTARA.code,
                'User Uji Nullable',
                SEMENTARA.email,
                'bukan-hash-sungguhan',
            ]
        )

        idSementara = hasil.insertId
    })

    // Dihapus berdasarkan id yang ditangkap, BUKAN berdasarkan code:
    // kalau perbaikannya gagal, code-nya justru yang di-NULL-kan dan
    // pembersihan berbasis code tidak akan menemukan barisnya.
    after(async () => {
        if (idSementara) {
            await db.query('DELETE FROM users WHERE id = ?', [idSementara])
        }
    })

    const kolomDari = async (id) => {
        const [r] = await db.query(
            'SELECT code, area_id, channel_id, supervisor_id FROM users WHERE id = ?',
            [id]
        )

        return r[0]
    }

    // Tes inti sub-proyek ini. Form edit di web tidak pernah mengirim
    // code maupun area_id, jadi menyunting nama saja HARUS membiarkan
    // keempat kolom itu utuh.
    test('menyunting hanya name membiarkan keempat kolom utuh', async () => {
        const sebelum = await kolomDari(idSementara)

        const { status } = await kirim(
            'PUT',
            `/api/users/${idSementara}`,
            ADMIN,
            { name: 'Nama Sudah Diubah', email: SEMENTARA.email, role: 'SPG' }
        )

        assert.strictEqual(status, 200)

        const sesudah = await kolomDari(idSementara)

        assert.deepStrictEqual(sesudah, sebelum)
        assert.strictEqual(sesudah.code, SEMENTARA.code)
        assert.strictEqual(Number(sesudah.area_id), 1)
        assert.strictEqual(Number(sesudah.channel_id), 2)
        assert.strictEqual(Number(sesudah.supervisor_id), 3)
    })

    test('nama benar-benar tersimpan', async () => {
        const [r] = await db.query(
            'SELECT name FROM users WHERE id = ?',
            [idSementara]
        )

        assert.strictEqual(r[0].name, 'Nama Sudah Diubah')
    })

    // Kemampuan mengosongkan dengan sengaja harus tetap ada — itu yang
    // dikirim web ketika select supervisor dikosongkan.
    test('string kosong mengosongkan kolomnya', async () => {
        const { status } = await kirim(
            'PUT',
            `/api/users/${idSementara}`,
            ADMIN,
            {
                name: 'Nama Sudah Diubah',
                email: SEMENTARA.email,
                role: 'SPG',
                supervisor_id: '',
            }
        )

        assert.strictEqual(status, 200)

        const sesudah = await kolomDari(idSementara)

        assert.strictEqual(sesudah.supervisor_id, null)

        // Yang lain TIDAK ikut terhapus.
        assert.strictEqual(sesudah.code, SEMENTARA.code)
        assert.strictEqual(Number(sesudah.area_id), 1)
    })

    test('nilai baru tersimpan sebagai nilai, bukan null', async () => {
        const { status } = await kirim(
            'PUT',
            `/api/users/${idSementara}`,
            ADMIN,
            {
                name: 'Nama Sudah Diubah',
                email: SEMENTARA.email,
                role: 'SPG',
                area_id: 3,
            }
        )

        assert.strictEqual(status, 200)
        assert.strictEqual(Number((await kolomDari(idSementara)).area_id), 3)
    })

})


describe('PUT /api/users/:id menolak {code:0} pada diri sendiri', () => {

    // FIX 5 dari review akhir. Penjaga lama membandingkan
    // `code || null` sementara baris tulis di bawahnya memakai
    // nullableUpdate -- keduanya sepakat untuk hampir semua nilai, TAPI
    // berselisih persis pada `0`: `0 || null` jatuh ke null (dianggap
    // "sama dengan code yang sekarang", yakni NULL, jadi LOLOS penjaga),
    // sedangkan nullableUpdate(0) mengembalikan 0 apa adanya dan
    // benar-benar tersimpan sebagai string '0'.
    //
    // KEDUA administrator sungguhan (id 2 dan 29) punya code NULL --
    // persis pemicu bug ini. Administrator sekali-pakai di sini dibuat
    // dengan code NULL yang sama supaya skenarionya identik, TANPA
    // pernah menyentuh akun sungguhan 2 atau 29.
    const EMAIL_ADMIN_UJI = 'uji.code-nol.15082026@contoh.invalid'

    let idAdminUji

    before(async () => {
        // Sisa dari run yang pernah mati di tengah.
        await db.query(
            'DELETE FROM users WHERE email = ?',
            [EMAIL_ADMIN_UJI]
        )

        const [hasil] = await db.query(
            `INSERT INTO users (code, name, email, password, role, status)
             VALUES (NULL, ?, ?, ?, 'ADMINISTRATOR', 'ACTIVE')`,
            [
                'Admin Uji Code Nol',
                EMAIL_ADMIN_UJI,
                'bukan-hash-sungguhan',
            ]
        )

        idAdminUji = hasil.insertId
    })

    after(async () => {
        if (idAdminUji) {
            await db.query('DELETE FROM users WHERE id = ?', [idAdminUji])
        }
    })

    test('ADMINISTRATOR mengirim {code:0} untuk dirinya sendiri ditolak 400, code tidak berubah', async () => {
        const { status } = await kirim(
            'PUT',
            `/api/users/${idAdminUji}`,
            idAdminUji,
            { code: 0 }
        )

        assert.strictEqual(status, 400)

        const [r] = await db.query(
            'SELECT code FROM users WHERE id = ?',
            [idAdminUji]
        )

        assert.strictEqual(
            r[0].code,
            null,
            'code tidak boleh berubah dari NULL menjadi apa pun, termasuk string \'0\''
        )
    })

})
