require('dotenv').config({ quiet: true })

const { test, describe, before, after } = require('node:test')
const assert = require('node:assert')
const jwt = require('jsonwebtoken')

const { localDateString } = require('../../src/utils/date.util')

const BASE = process.env.TEST_BASE_URL || 'http://localhost:1000'

// Id ini mengikuti struktur organisasi di database dev:
//   MANAGER 1 (30) -> SUPERVISOR JAKARTA (3) -> Danny (1), Tino (37), SUBUR (38)
//                  -> SUPERVISOR BANDUNG (31) -> Tria (32)
const DANNY = 1
const JAKARTA = 3
const TINO = 37
const SUBUR = 38
const TRIA = 32
const MANAGER = 30
const ADMIN = 2

const tokenUntuk = (id, role) =>
    jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '15m' })

const get = async (path, userId, role) => {
    const res = await fetch(BASE + path, {
        headers: { Authorization: 'Bearer ' + tokenUntuk(userId, role) },
    })
    const text = await res.text()
    let body
    try { body = JSON.parse(text) } catch { body = text }
    return { status: res.status, body }
}

const kirim = async (method, path, userId, role, body) => {
    const res = await fetch(BASE + path, {
        method,
        headers: {
            Authorization: 'Bearer ' + tokenUntuk(userId, role),
            'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    let parsed
    try { parsed = JSON.parse(text) } catch { parsed = text }
    return { status: res.status, body: parsed }
}

/** Koneksi mysql2 untuk penyiapan dan pembersihan langsung. */
const db = async () => {
    const mysql = require('mysql2/promise')
    return mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
    })
}

// Dipakai seluruh blok describe di berkas ini.
const dibuat = []
let customerId = null

before(async () => {
    try {
        const res = await fetch(BASE + '/')
        assert.strictEqual(res.status, 200)
    } catch {
        throw new Error(
            `Server tidak bisa dihubungi di ${BASE}.\n` +
            `Jalankan "npm run dev" lebih dulu.`
        )
    }

    const customers = await get('/api/customers', DANNY, 'SPG')

    assert.strictEqual(customers.status, 200)
    assert.ok(customers.body.length > 0, 'Danny tidak melihat customer apa pun')

    customerId = customers.body[0].id
})

after(async () => {
    if (dibuat.length === 0) return

    const c = await db()
    await c.query('DELETE FROM visit_plans WHERE id IN (?)', [dibuat])
    await c.end()

    console.log(`  (bersih-bersih: ${dibuat.length} visit plan tes dihapus)`)
})

/**
 * Baris disisipkan LANGSUNG lewat mysql2, bukan lewat
 * POST /api/visit-plans. `create` sekarang menggerbang role DAN
 * kepemilikan (assertWithinSubtree pada user_id), jadi endpoint itu
 * tidak lagi bisa dipinjam untuk membuat rencana atas nama user lain
 * -- meminjamnya di sini hanya akan meminjam gerbang otorisasi yang
 * tidak sedang diuji oleh describe block di bawah. Insert langsung
 * tetap menghasilkan baris milik user lain, yang justru dibutuhkan
 * untuk membuktikan cakupan subtree pada GET/PUT/DELETE.
 */
const buatRencana = async (userId) => {
    const c = await db()
    const [hasil] = await c.query(
        'INSERT INTO visit_plans (user_id, customer_id, visit_date, status) VALUES (?, ?, ?, ?)',
        [userId, customerId, localDateString(), 'PENDING']
    )
    await c.end()

    dibuat.push(hasil.insertId)

    return hasil.insertId
}


describe('GET /api/visit-plans — cakupan hierarki', () => {

    let rencanaDanny = null
    let rencanaTino = null
    let rencanaSubur = null
    let rencanaTria = null

    before(async () => {
        rencanaDanny = await buatRencana(DANNY)
        rencanaTino = await buatRencana(TINO)
        rencanaSubur = await buatRencana(SUBUR)
        rencanaTria = await buatRencana(TRIA)
    })

    const idDi = (body) => body.map(p => p.id)

    test('SPG hanya melihat rencana miliknya', async () => {
        const res = await get('/api/visit-plans', DANNY, 'SPG')

        assert.strictEqual(res.status, 200)

        const ids = idDi(res.body)

        assert.ok(ids.includes(rencanaDanny), 'rencana Danny tidak ada')
        assert.ok(!ids.includes(rencanaTino), 'rencana Tino seharusnya tidak terlihat')
        assert.ok(!ids.includes(rencanaTria), 'rencana Tria seharusnya tidak terlihat')
    })

    // Tes ini membuktikan supervisor melihat rencana seluruh SPG di
    // bawahnya. Ia TIDAK membedakan aturan lama dari aturan baru: di
    // database dev, Danny, Tino, dan SUBUR semuanya punya area_id dan
    // channel_id yang sama dengan supervisornya JAKARTA, jadi filter
    // lama (yang juga menyaring area_id/channel_id) kebetulan
    // menghasilkan himpunan yang sama persis. Daya beda terhadap aturan
    // lama ada di tes unit collectSubtreeIds pada
    // tests/unit/access.util.test.js, yang membuktikan penurunannya
    // hanya memakai supervisor_id.
    test('supervisor melihat rencana seluruh SPG di bawahnya', async () => {
        const res = await get('/api/visit-plans', JAKARTA, 'SUPERVISOR')

        assert.strictEqual(res.status, 200)

        const ids = idDi(res.body)

        assert.ok(ids.includes(rencanaDanny), 'rencana Danny tidak ada')
        assert.ok(ids.includes(rencanaTino), 'rencana Tino tidak ada')
        assert.ok(ids.includes(rencanaSubur), 'rencana SUBUR tidak ada')
    })

    test('supervisor tidak melihat rencana di luar subtree-nya', async () => {
        const res = await get('/api/visit-plans', JAKARTA, 'SUPERVISOR')

        assert.ok(
            !idDi(res.body).includes(rencanaTria),
            'Tria ada di bawah BANDUNG, seharusnya tidak terlihat JAKARTA'
        )
    })

    // Sebelum perbaikan ini, kasus ini mengembalikan kosong: filter
    // area_id manager bernilai NULL sehingga tidak cocok dengan sales
    // mana pun.
    test('manager melihat rencana seluruh subtree, termasuk dua tingkat ke bawah', async () => {
        const res = await get('/api/visit-plans', MANAGER, 'MANAGER')

        assert.strictEqual(res.status, 200)

        const ids = idDi(res.body)

        assert.ok(ids.includes(rencanaDanny), 'Danny (di bawah JAKARTA) tidak ada')
        assert.ok(ids.includes(rencanaTria), 'Tria (di bawah BANDUNG) tidak ada')
    })

    test('administrator melihat semuanya', async () => {
        const res = await get('/api/visit-plans', ADMIN, 'ADMINISTRATOR')

        assert.strictEqual(res.status, 200)

        const ids = idDi(res.body)

        assert.ok(ids.includes(rencanaDanny))
        assert.ok(ids.includes(rencanaTria))
    })

})

describe('GET /api/visit-activities — cakupan hierarki', () => {

    // Berkas ini tidak membuat visit maupun activity — keduanya butuh
    // check-in yang divalidasi jarak GPS, di luar cakupan plan ini.
    // Yang diuji adalah bentuk dan arah penyaringannya terhadap 10
    // activity yang sudah ada di database dev.
    //
    // Satu pengecualian: tes "tidak ada activity tanpa kunjungan induk"
    // di bawah membuat satu baris yatim sendiri lewat before/after lokal
    // ini, supaya required: true pada include Visit benar-benar
    // teruji — lihat komentar di tes itu.

    let idYatim = null

    before(async () => {
        const c = await db()
        const [hasil] = await c.query(
            'INSERT INTO visit_activities (visit_id, created_at) VALUES (?, NOW())',
            [99999999]
        )
        await c.end()

        idYatim = hasil.insertId
    })

    after(async () => {
        const c = await db()
        await c.query('DELETE FROM visit_activities WHERE id = ?', [idYatim])
        await c.end()

        console.log(`  (bersih-bersih: 1 visit activity yatim dihapus)`)
    })

    test('SPG mendapat array, bukan objek berbungkus', async () => {
        const res = await get('/api/visit-activities', DANNY, 'SPG')

        assert.strictEqual(res.status, 200)
        assert.ok(
            Array.isArray(res.body),
            `respons bukan array: ${JSON.stringify(res.body).slice(0, 120)}`
        )
    })

    test('setiap activity yang terlihat SPG milik kunjungan SPG itu', async () => {
        const res = await get('/api/visit-activities', DANNY, 'SPG')

        for (const a of res.body) {
            assert.ok(a.Visit, 'relasi Visit tidak di-include')
            assert.strictEqual(
                a.Visit.user_id,
                DANNY,
                `activity ${a.id} milik user ${a.Visit.user_id}, bukan Danny`
            )
        }
    })

    // Supervisor melihat miliknya sendiri DAN bawahannya. Sebelum
    // perbaikan ini, cabangnya hanya mengambil bawahan, jadi activity
    // supervisor sendiri tidak pernah terlihat olehnya.
    test('supervisor melihat minimal semua yang dilihat SPG bawahannya', async () => {
        const spg = await get('/api/visit-activities', DANNY, 'SPG')
        const spv = await get('/api/visit-activities', JAKARTA, 'SUPERVISOR')

        assert.strictEqual(spv.status, 200)

        const idsSpv = spv.body.map(a => a.id)

        for (const a of spg.body) {
            assert.ok(
                idsSpv.includes(a.id),
                `activity ${a.id} terlihat Danny tapi tidak terlihat atasannya`
            )
        }
    })

    // Sebelumnya ini membandingkan panjang array dengan `>=`, yang juga
    // lulus bila keduanya nol. Sekarang dibuktikan lewat keanggotaan id
    // seperti tes supervisor di atas: setiap activity yang terlihat
    // manager (role dibatasi subtree) harus ikut terlihat administrator
    // (role tak terbatas) — ini benar secara logika akses, bukan
    // kebetulan jumlah.
    test('administrator melihat semua yang dilihat manager', async () => {
        const mgr = await get('/api/visit-activities', MANAGER, 'MANAGER')
        const adm = await get('/api/visit-activities', ADMIN, 'ADMINISTRATOR')

        assert.strictEqual(mgr.status, 200)
        assert.strictEqual(adm.status, 200)

        const idsAdm = adm.body.map(a => a.id)

        for (const a of mgr.body) {
            assert.ok(
                idsAdm.includes(a.id),
                `activity ${a.id} terlihat manager tapi tidak terlihat administrator`
            )
        }
    })

    // idYatim (dibuat before() di atas) menunjuk visit_id yang tidak ada
    // di tabel visits. required: true pada include Visit yang menjamin
    // baris ini tidak ikut terkirim; kalau dihapus saat where kosong
    // untuk role tak terbatas, baris ini akan lolos dengan Visit
    // bernilai null — assertion kedua di bawah yang menangkapnya secara
    // langsung, bukan lewat data dev yang kebetulan bersih.
    test('tidak ada activity tanpa kunjungan induk, bahkan untuk administrator', async () => {
        const res = await get('/api/visit-activities', ADMIN, 'ADMINISTRATOR')

        for (const a of res.body) {
            assert.ok(
                a.Visit,
                `activity ${a.id} terkirim tanpa relasi Visit`
            )
        }

        assert.ok(
            !res.body.some(a => a.id === idYatim),
            `activity yatim ${idYatim} seharusnya tidak ikut terkirim ke administrator`
        )
    })

})


describe('GET /api/visits — cakupan hierarki', () => {

    test('SPG mendapat array dan semuanya miliknya', async () => {
        const res = await get('/api/visits', DANNY, 'SPG')

        assert.strictEqual(res.status, 200)
        assert.ok(Array.isArray(res.body))

        for (const v of res.body) {
            assert.strictEqual(
                v.user_id,
                DANNY,
                `visit ${v.id} milik user ${v.user_id}`
            )
        }
    })

    test('supervisor melihat minimal semua yang dilihat bawahannya', async () => {
        const spg = await get('/api/visits', DANNY, 'SPG')
        const spv = await get('/api/visits', JAKARTA, 'SUPERVISOR')

        assert.strictEqual(spv.status, 200)

        const idsSpv = spv.body.map(v => v.id)

        for (const v of spg.body) {
            assert.ok(
                idsSpv.includes(v.id),
                `visit ${v.id} terlihat Danny tapi tidak terlihat atasannya`
            )
        }
    })

    // Sebelum perbaikan ini, MANAGER tidak punya cabang sama sekali
    // sehingga where = {} dan ia melihat SEMUA kunjungan. Setelah
    // perubahan ini aksesnya menyempit ke subtree-nya — pengetatan yang
    // disengaja.
    //
    // Tes ini HANYA menjaga bentuk respons (200 + array), bukan
    // cakupannya. Membuktikan cakupan butuh sebuah kunjungan yang
    // diketahui milik user DI LUAR subtree MANAGER, tapi kunjungan hanya
    // bisa dibuat lewat check-in yang memvalidasi jarak GPS — di luar
    // cakupan sub-proyek ini — dan seluruh id user yang diketahui berkas
    // ini (Danny, Tino, SUBUR, Tria) ada DI DALAM subtree MANAGER,
    // sehingga tidak ada kandidat untuk membuktikan pengecualian.
    test('manager melihat kunjungan subtree-nya (bentuk respons saja)', async () => {
        const res = await get('/api/visits', MANAGER, 'MANAGER')

        assert.strictEqual(res.status, 200)
        assert.ok(Array.isArray(res.body))
    })

    // Role diambil dari database, bukan dari token. Token yang mengaku
    // ADMINISTRATOR untuk user yang sebenarnya SPG tidak boleh dipercaya.
    test('role dari token yang dipalsukan tidak dipercaya', async () => {
        const jujur = await get('/api/visits', DANNY, 'SPG')
        const palsu = await get('/api/visits', DANNY, 'ADMINISTRATOR')

        assert.strictEqual(palsu.status, 200)
        assert.strictEqual(
            palsu.body.length,
            jujur.body.length,
            'token yang mengaku ADMINISTRATOR mendapat lebih banyak data'
        )
    })

})


describe('GET /api/visits -- ?mine=1 dan filter tanggal', () => {

    const visitIdsDibuat = []

    const buatVisit = async (userId, tanggalCheckin) => {
        const conn = await db()
        const [customerRow] = await conn.query(
            'SELECT id FROM customers WHERE id NOT IN (97, 123) LIMIT 1'
        )
        const [hasil] = await conn.query(
            `INSERT INTO visits (user_id, customer_id, checkin_time)
             VALUES (?, ?, ?)`,
            [userId, customerRow[0].id, tanggalCheckin]
        )
        await conn.end()

        visitIdsDibuat.push(hasil.insertId)
        return hasil.insertId
    }

    after(async () => {
        if (visitIdsDibuat.length === 0) return
        const conn = await db()
        await conn.query('DELETE FROM visits WHERE id IN (?)', [visitIdsDibuat])
        await conn.end()
    })

    test('tanpa ?mine=1: perilaku default TIDAK berubah -- tidak difilter tanggal (sfa-web memanggil endpoint ini tanpa parameter apa pun)', async () => {
        const bulanLalu = '2020-01-15 08:00:00' // jauh di luar bulan berjalan manapun
        const idLama = await buatVisit(DANNY, bulanLalu)

        const res = await get('/api/visits', DANNY, 'SPG')

        assert.strictEqual(res.status, 200)
        assert.ok(
            res.body.some(v => v.id === idLama),
            'visit lama seharusnya tetap ikut tanpa ?mine=1 -- default TIDAK boleh memfilter tanggal'
        )
    })

    test('dengan ?mine=1: visit bulan lalu TIDAK ikut, visit hari ini ikut', async () => {
        const bulanLalu = '2020-01-15 08:00:00'
        const idLama = await buatVisit(DANNY, bulanLalu)
        const idBaru = await buatVisit(DANNY, `${localDateString()} 08:00:00`)

        const res = await get('/api/visits?mine=1', DANNY, 'SPG')

        assert.strictEqual(res.status, 200)

        const ids = res.body.map(v => v.id)

        assert.ok(!ids.includes(idLama), 'visit bulan lalu seharusnya di luar rentang default')
        assert.ok(ids.includes(idBaru), 'visit hari ini seharusnya ikut (dalam bulan berjalan)')
    })

    test('dengan ?mine=1: SUPERVISOR cuma melihat visit miliknya sendiri, bukan bawahannya', async () => {
        const idBawahan = await buatVisit(DANNY, `${localDateString()} 08:00:00`)
        const idAtasan = await buatVisit(JAKARTA, `${localDateString()} 09:00:00`)

        const res = await get('/api/visits?mine=1', JAKARTA, 'SUPERVISOR')

        assert.strictEqual(res.status, 200)

        const ids = res.body.map(v => v.id)

        assert.ok(!ids.includes(idBawahan), 'supervisor dengan ?mine=1 tidak boleh melihat visit bawahan')
        assert.ok(ids.includes(idAtasan), 'supervisor dengan ?mine=1 tetap melihat visitnya sendiri')
    })

    test('from/to eksplisit tanpa ?mine=1: tetap memfilter tanggal (subtree, bukan personal)', async () => {
        const idLama = await buatVisit(DANNY, '2020-01-15 08:00:00')
        const idBaru = await buatVisit(DANNY, `${localDateString()} 08:00:00`)

        const res = await get(
            `/api/visits?from=${localDateString()}&to=${localDateString()}`,
            DANNY,
            'SPG'
        )

        assert.strictEqual(res.status, 200)

        const ids = res.body.map(v => v.id)

        assert.ok(!ids.includes(idLama), 'from/to eksplisit seharusnya tetap memfilter walau tanpa mine=1')
        assert.ok(ids.includes(idBaru))
    })

    test('?customer_id: cuma visit ke customer itu yang ikut', async () => {
        const conn = await db()
        const [customerRows] = await conn.query(
            'SELECT id FROM customers WHERE id NOT IN (97, 123) LIMIT 2'
        )
        await conn.end()

        const [customerA, customerB] = customerRows

        const buatVisitKeCustomer = async (customerId) => {
            const c = await db()
            const [hasil] = await c.query(
                `INSERT INTO visits (user_id, customer_id, checkin_time)
                 VALUES (?, ?, ?)`,
                [DANNY, customerId.id, `${localDateString()} 08:00:00`]
            )
            await c.end()
            visitIdsDibuat.push(hasil.insertId)
            return hasil.insertId
        }

        const idA = await buatVisitKeCustomer(customerA)
        const idB = await buatVisitKeCustomer(customerB)

        const res = await get(
            `/api/visits?mine=1&customer_id=${customerA.id}`,
            DANNY,
            'SPG'
        )

        assert.strictEqual(res.status, 200)

        const ids = res.body.map(v => v.id)

        assert.ok(ids.includes(idA), 'visit ke customer yang diminta harus ikut')
        assert.ok(!ids.includes(idB), 'visit ke customer lain tidak boleh ikut')
    })

})


describe('GET /api/visits/:id — kepemilikan', () => {

    let visitId = null
    let pemilikId = null

    before(async () => {
        const res = await get('/api/visits', ADMIN, 'ADMINISTRATOR')

        if (res.body.length === 0) return

        visitId = res.body[0].id

        const c = await db()
        const [rows] = await c.query(
            'SELECT user_id FROM visits WHERE id = ?',
            [visitId]
        )
        await c.end()

        pemilikId = rows[0].user_id
    })

    test('pemiliknya boleh membaca', async (t) => {
        if (visitId === null) {
            t.skip('database dev tidak punya kunjungan untuk diuji')
            return
        }

        const res = await get(`/api/visits/${visitId}`, pemilikId, 'SPG')

        assert.strictEqual(res.status, 200)
        assert.strictEqual(res.body.id, visitId)
    })

    // Sebelum perbaikan ini, endpoint ini tidak memeriksa apa pun: siapa
    // saja bisa membaca kunjungan siapa saja dengan menebak id.
    test('user di luar subtree ditolak 403', async (t) => {
        if (visitId === null) {
            t.skip('database dev tidak punya kunjungan untuk diuji')
            return
        }

        // Tria (32) ada di bawah BANDUNG, bukan atasan siapa pun.
        if (pemilikId === TRIA) {
            t.skip('kunjungan pertama justru milik Tria')
            return
        }

        const res = await get(`/api/visits/${visitId}`, TRIA, 'SPG')

        assert.strictEqual(res.status, 403)
        assert.match(res.body.message, /jangkauan|akses|berhak/i)
    })

    test('administrator boleh membaca kunjungan siapa pun', async (t) => {
        if (visitId === null) {
            t.skip('database dev tidak punya kunjungan untuk diuji')
            return
        }

        const res = await get(`/api/visits/${visitId}`, ADMIN, 'ADMINISTRATOR')

        assert.strictEqual(res.status, 200)
    })

    test('id tidak ada ditolak 404', async () => {
        const res = await get('/api/visits/99999999', ADMIN, 'ADMINISTRATOR')

        assert.strictEqual(res.status, 404)
    })

})

describe('PUT dan DELETE /api/visit-plans/:id', () => {

    let rencanaDanny = null
    let rencanaTria = null
    let rencanaBerjalan = null

    before(async () => {
        rencanaDanny = await buatRencana(DANNY)
        rencanaTria = await buatRencana(TRIA)
        rencanaBerjalan = await buatRencana(DANNY)

        // Status non-PENDING tidak bisa dibuat lewat POST karena create
        // memaksa 'PENDING'. Diubah langsung, pada baris yang dibuat
        // tes ini sendiri.
        const c = await db()
        await c.query(
            "UPDATE visit_plans SET status = 'ON VISIT' WHERE id = ?",
            [rencanaBerjalan]
        )
        await c.end()
    })

    const besok = () => {
        const d = new Date()
        d.setDate(d.getDate() + 1)
        return localDateString(d)
    }

    test('SPG ditolak 403 saat mengubah', async () => {
        const res = await kirim(
            'PUT',
            `/api/visit-plans/${rencanaDanny}`,
            DANNY,
            'SPG',
            { visit_date: besok() }
        )

        assert.strictEqual(res.status, 403)
    })

    test('SPG ditolak 403 saat menghapus', async () => {
        const res = await kirim(
            'DELETE',
            `/api/visit-plans/${rencanaDanny}`,
            DANNY,
            'SPG'
        )

        assert.strictEqual(res.status, 403)
    })

    test('supervisor pemiliknya boleh mengubah', async () => {
        const res = await kirim(
            'PUT',
            `/api/visit-plans/${rencanaDanny}`,
            JAKARTA,
            'SUPERVISOR',
            { visit_date: besok() }
        )

        assert.strictEqual(res.status, 200, JSON.stringify(res.body))
    })

    test('supervisor lain ditolak 403', async () => {
        // rencanaTria milik Tria, di bawah BANDUNG (31), bukan JAKARTA.
        const res = await kirim(
            'PUT',
            `/api/visit-plans/${rencanaTria}`,
            JAKARTA,
            'SUPERVISOR',
            { visit_date: besok() }
        )

        assert.strictEqual(res.status, 403)
    })

    test('manager boleh mengubah rencana dua tingkat di bawahnya', async () => {
        const res = await kirim(
            'PUT',
            `/api/visit-plans/${rencanaTria}`,
            MANAGER,
            'MANAGER',
            { visit_date: besok() }
        )

        assert.strictEqual(res.status, 200, JSON.stringify(res.body))
    })

    test('id tidak ada ditolak 404', async () => {
        const res = await kirim(
            'PUT',
            '/api/visit-plans/99999999',
            ADMIN,
            'ADMINISTRATOR',
            { visit_date: besok() }
        )

        assert.strictEqual(res.status, 404)
    })

    // INI bug yang diperbaiki: sebelumnya datanya diubah dulu, baru
    // statusnya diperiksa, sehingga penolakan 400 datang setelah
    // datanya sudah rusak.
    test('rencana non-PENDING ditolak 400 DAN datanya tidak berubah', async () => {
        const c = await db()

        const [sebelum] = await c.query(
            'SELECT visit_date FROM visit_plans WHERE id = ?',
            [rencanaBerjalan]
        )

        const res = await kirim(
            'PUT',
            `/api/visit-plans/${rencanaBerjalan}`,
            ADMIN,
            'ADMINISTRATOR',
            { visit_date: '2030-01-01' }
        )

        const [sesudah] = await c.query(
            'SELECT visit_date FROM visit_plans WHERE id = ?',
            [rencanaBerjalan]
        )

        await c.end()

        assert.strictEqual(res.status, 400)
        assert.strictEqual(
            String(sesudah[0].visit_date),
            String(sebelum[0].visit_date),
            'tanggalnya berubah padahal permintaannya ditolak'
        )
    })

    test('rencana non-PENDING ditolak 400 dan barisnya MASIH ADA', async () => {
        const res = await kirim(
            'DELETE',
            `/api/visit-plans/${rencanaBerjalan}`,
            ADMIN,
            'ADMINISTRATOR'
        )

        assert.strictEqual(res.status, 400)

        const c = await db()
        const [rows] = await c.query(
            'SELECT id FROM visit_plans WHERE id = ?',
            [rencanaBerjalan]
        )
        await c.end()

        assert.strictEqual(
            rows.length,
            1,
            'barisnya terhapus padahal permintaannya ditolak'
        )
    })

    test('body tanpa field yang bisa diubah ditolak 400', async () => {
        const res = await kirim(
            'PUT',
            `/api/visit-plans/${rencanaDanny}`,
            ADMIN,
            'ADMINISTRATOR',
            { notes: 'kolom ini tidak ada di tabel' }
        )

        assert.strictEqual(res.status, 400)
    })

    test('administrator boleh menghapus rencana PENDING', async () => {
        const res = await kirim(
            'DELETE',
            `/api/visit-plans/${rencanaDanny}`,
            ADMIN,
            'ADMINISTRATOR'
        )

        assert.strictEqual(res.status, 200, JSON.stringify(res.body))

        const c = await db()
        const [rows] = await c.query(
            'SELECT id FROM visit_plans WHERE id = ?',
            [rencanaDanny]
        )
        await c.end()

        assert.strictEqual(rows.length, 0, 'barisnya masih ada')
    })

})


describe('GET /api/orders -- ?mine=1', () => {

    const orderIdsDibuat = []

    const buatOrder = async (userId) => {
        const conn = await db()
        const [customerRow] = await conn.query(
            'SELECT id FROM customers WHERE id NOT IN (97, 123) LIMIT 1'
        )
        const [hasil] = await conn.query(
            `INSERT INTO sales_orders (doc_no, user_id, customer_id, doc_date, total, status)
             VALUES (?, ?, ?, NOW(), 10000, 'DRAFT')`,
            [`SO-TEST-${Date.now()}-${Math.random()}`, userId, customerRow[0].id]
        )
        await conn.end()

        orderIdsDibuat.push(hasil.insertId)
        return hasil.insertId
    }

    after(async () => {
        if (orderIdsDibuat.length === 0) return
        const conn = await db()
        await conn.query('DELETE FROM sales_orders WHERE id IN (?)', [orderIdsDibuat])
        await conn.end()
    })

    test('tanpa ?mine=1: perilaku default TIDAK berubah -- order bawahan tetap ikut (sfa-web memanggil endpoint ini tanpa parameter apa pun)', async () => {
        const idBawahan = await buatOrder(DANNY)

        const res = await get('/api/orders', JAKARTA, 'SUPERVISOR')

        assert.strictEqual(res.status, 200)
        assert.ok(
            res.body.some(o => o.id === idBawahan),
            'order bawahan seharusnya tetap ikut tanpa ?mine=1'
        )
    })

    test('dengan ?mine=1: SUPERVISOR cuma melihat order miliknya sendiri, bukan bawahannya', async () => {
        const idBawahan = await buatOrder(DANNY)
        const idAtasan = await buatOrder(JAKARTA)

        const res = await get('/api/orders?mine=1', JAKARTA, 'SUPERVISOR')

        assert.strictEqual(res.status, 200)

        const ids = res.body.map(o => o.id)

        assert.ok(!ids.includes(idBawahan), 'order bawahan tidak boleh ikut dengan ?mine=1')
        assert.ok(ids.includes(idAtasan), 'order milik sendiri harus tetap ikut')
    })

})


describe('GET /api/visit-activities -- ?mine=1 dan ?customer_id', () => {

    const visitIdsDibuat = []
    const activityIdsDibuat = []

    const buatVisitDenganActivity = async (userId, customerId) => {
        const conn = await db()
        const [visitHasil] = await conn.query(
            `INSERT INTO visits (user_id, customer_id, checkin_time)
             VALUES (?, ?, NOW())`,
            [userId, customerId]
        )
        const visitId = visitHasil.insertId
        visitIdsDibuat.push(visitId)

        const [activityHasil] = await conn.query(
            `INSERT INTO visit_activities (visit_id, product_name, created_at)
             VALUES (?, 'Produk Tes', NOW())`,
            [visitId]
        )
        activityIdsDibuat.push(activityHasil.insertId)
        await conn.end()

        return { visitId, activityId: activityHasil.insertId }
    }

    after(async () => {
        const conn = await db()
        if (activityIdsDibuat.length > 0) {
            await conn.query('DELETE FROM visit_activities WHERE id IN (?)', [activityIdsDibuat])
        }
        if (visitIdsDibuat.length > 0) {
            await conn.query('DELETE FROM visits WHERE id IN (?)', [visitIdsDibuat])
        }
        await conn.end()
    })

    test('tanpa mine/customer_id: perilaku default TIDAK berubah -- activity bawahan tetap ikut', async () => {
        const conn = await db()
        const [customerRow] = await conn.query(
            'SELECT id FROM customers WHERE id NOT IN (97, 123) LIMIT 1'
        )
        await conn.end()

        const { activityId } = await buatVisitDenganActivity(DANNY, customerRow[0].id)

        const res = await get('/api/visit-activities', JAKARTA, 'SUPERVISOR')

        assert.strictEqual(res.status, 200)
        assert.ok(
            res.body.some(a => a.id === activityId),
            'activity bawahan seharusnya tetap ikut tanpa parameter apa pun'
        )
    })

    test('dengan ?mine=1: SUPERVISOR cuma melihat activity miliknya sendiri', async () => {
        const conn = await db()
        const [customerRow] = await conn.query(
            'SELECT id FROM customers WHERE id NOT IN (97, 123) LIMIT 1'
        )
        await conn.end()

        const bawahan = await buatVisitDenganActivity(DANNY, customerRow[0].id)
        const atasan = await buatVisitDenganActivity(JAKARTA, customerRow[0].id)

        const res = await get('/api/visit-activities?mine=1', JAKARTA, 'SUPERVISOR')

        assert.strictEqual(res.status, 200)
        const ids = res.body.map(a => a.id)

        assert.ok(!ids.includes(bawahan.activityId), 'activity bawahan tidak boleh ikut dengan ?mine=1')
        assert.ok(ids.includes(atasan.activityId), 'activity milik sendiri harus tetap ikut')
    })

    test('dengan ?customer_id: cuma activity dari kunjungan ke customer itu yang ikut', async () => {
        const conn = await db()
        const [customerRows] = await conn.query(
            'SELECT id FROM customers WHERE id NOT IN (97, 123) LIMIT 2'
        )
        await conn.end()

        const [customerA, customerB] = customerRows

        const keA = await buatVisitDenganActivity(DANNY, customerA.id)
        const keB = await buatVisitDenganActivity(DANNY, customerB.id)

        const res = await get(
            `/api/visit-activities?mine=1&customer_id=${customerA.id}`,
            DANNY,
            'SPG'
        )

        assert.strictEqual(res.status, 200)
        const ids = res.body.map(a => a.id)

        assert.ok(ids.includes(keA.activityId), 'activity ke customer yang diminta harus ikut')
        assert.ok(!ids.includes(keB.activityId), 'activity ke customer lain tidak boleh ikut')
    })

})


describe('GET /api/attendances -- cakupan hierarki dan filter tanggal', () => {

    const attendanceIdsDibuat = []

    // Tanggal jauh di masa lalu, BUKAN hari ini -- data absen hari ini
    // dibaca dashboard mobile (banner "belum absen") dan pernah
    // ketercemar tes serupa sebelumnya (lihat commit "fix: dashboard
    // spg" di sesi yang sama). Insert langsung ke tanggal lampau
    // menghindari itu sepenuhnya.
    const tanggalLampau = '2020-01-15'

    const buatAbsen = async (userId, tanggal) => {
        const conn = await db()
        const [hasil] = await conn.query(
            `INSERT INTO attendances (user_id, tanggal, clock_in_time, created_at)
             VALUES (?, ?, ?, NOW())`,
            [userId, tanggal, `${tanggal} 08:00:00`]
        )
        await conn.end()

        attendanceIdsDibuat.push(hasil.insertId)
        return hasil.insertId
    }

    after(async () => {
        if (attendanceIdsDibuat.length === 0) return
        const conn = await db()
        await conn.query('DELETE FROM attendances WHERE id IN (?)', [attendanceIdsDibuat])
        await conn.end()
    })

    test('SUPERVISOR melihat absen bawahan dan dirinya sendiri', async () => {
        const idBawahan = await buatAbsen(DANNY, tanggalLampau)
        const idAtasan = await buatAbsen(JAKARTA, tanggalLampau)

        const res = await get('/api/attendances', JAKARTA, 'SUPERVISOR')

        assert.strictEqual(res.status, 200)
        const ids = res.body.map(a => a.id)

        assert.ok(ids.includes(idBawahan), 'absen bawahan harus ikut')
        assert.ok(ids.includes(idAtasan), 'absen sendiri harus ikut')
    })

    test('SPG cuma melihat absennya sendiri, bukan rekan setingkat', async () => {
        const idSendiri = await buatAbsen(DANNY, tanggalLampau)
        const idRekan = await buatAbsen(TINO, tanggalLampau)

        const res = await get('/api/attendances', DANNY, 'SPG')

        assert.strictEqual(res.status, 200)
        const ids = res.body.map(a => a.id)

        assert.ok(ids.includes(idSendiri), 'absen sendiri harus ikut')
        assert.ok(!ids.includes(idRekan), 'absen rekan setingkat tidak boleh ikut')
    })

    test('from/to memfilter berdasarkan tanggal', async () => {
        const idDalamRentang = await buatAbsen(DANNY, tanggalLampau)
        const idLuarRentang = await buatAbsen(DANNY, '2021-06-01')

        const res = await get(
            `/api/attendances?from=${tanggalLampau}&to=${tanggalLampau}`,
            DANNY,
            'SPG'
        )

        assert.strictEqual(res.status, 200)
        const ids = res.body.map(a => a.id)

        assert.ok(ids.includes(idDalamRentang), 'tanggal dalam rentang harus ikut')
        assert.ok(!ids.includes(idLuarRentang), 'tanggal di luar rentang tidak boleh ikut')
    })

    test('?mine=1: SUPERVISOR cuma melihat absennya sendiri, bukan bawahan', async () => {
        const idBawahan = await buatAbsen(DANNY, tanggalLampau)
        const idAtasan = await buatAbsen(JAKARTA, tanggalLampau)

        const res = await get('/api/attendances?mine=1', JAKARTA, 'SUPERVISOR')

        assert.strictEqual(res.status, 200)
        const ids = res.body.map(a => a.id)

        assert.ok(!ids.includes(idBawahan), 'absen bawahan tidak boleh ikut dengan ?mine=1')
        assert.ok(ids.includes(idAtasan), 'absen sendiri harus tetap ikut')
    })

})


describe('POST /api/attendances/checkin -- dikunci selama ada absen pulang tertinggal', () => {

    // SUBUR dipakai (bukan DANNY/TINO) -- keduanya sudah punya baris
    // attendance sungguhan dari pemakaian nyata sesi ini, jadi tidak
    // aman dijadikan starting state bersih buat tes ini.
    const attendanceIdsDibuat = []

    // Tanggal beda per tes -- (user_id, tanggal) UNIQUE di tabel ini,
    // dan pembersihan cuma jalan di after() (bukan antar tes), jadi
    // dua tes yang pakai tanggal sama akan tabrakan constraint.
    const tanggalLampau1 = '2020-01-15'
    const tanggalLampau2 = '2020-02-15'
    const tanggalLampau3 = '2020-03-15'

    const buatAbsenTerbuka = async (userId, tanggal) => {
        const conn = await db()
        const [hasil] = await conn.query(
            `INSERT INTO attendances (user_id, tanggal, clock_in_time, created_at)
             VALUES (?, ?, ?, NOW())`,
            [userId, tanggal, `${tanggal} 08:00:00`]
        )
        await conn.end()

        attendanceIdsDibuat.push(hasil.insertId)
        return hasil.insertId
    }

    after(async () => {
        if (attendanceIdsDibuat.length === 0) return
        const conn = await db()
        await conn.query('DELETE FROM attendances WHERE id IN (?)', [attendanceIdsDibuat])
        await conn.end()
    })

    test('checkin ditolak 409 kalau ada absen pulang tanggal sebelumnya yang belum selesai', async () => {
        await buatAbsenTerbuka(SUBUR, tanggalLampau1)

        const res = await kirim('POST', '/api/attendances/checkin', SUBUR, 'SPG', {
            latitude: '-6.2',
            longitude: '106.8',
        })

        assert.strictEqual(res.status, 409)
        assert.ok(
            res.body.message.includes(tanggalLampau1),
            'pesan error harus menyebut tanggal yang belum diselesaikan'
        )
    })

    test('checkout menemukan absen TERLAMA yang terbuka, bukan cuma milik hari ini', async () => {
        await buatAbsenTerbuka(SUBUR, tanggalLampau2)

        // Tanpa foto (multipart) sengaja ditolak di langkah validasi foto
        // -- pesannya "Foto wajib diisi", BUKAN "Anda belum absen masuk",
        // itu bukti checkout sudah menemukan baris yang tanggalnya lampau.
        const res = await kirim('POST', '/api/attendances/checkout', SUBUR, 'SPG', {
            latitude: '-6.2',
            longitude: '106.8',
        })

        assert.strictEqual(res.status, 400)
        assert.strictEqual(res.body.message, 'Foto wajib diisi untuk absen pulang.')
    })

    test('GET /api/attendances/today menyertakan staleUnresolved (yang paling lama)', async () => {
        await buatAbsenTerbuka(SUBUR, tanggalLampau3)

        // Tes sebelumnya di describe block ini sudah menyisakan absen
        // terbuka di tanggalLampau1 dan tanggalLampau2 juga (cuma
        // dibersihkan di after(), bukan antar tes) -- staleUnresolved
        // seharusnya konsisten dengan urutan ASC di checkIn/checkOut:
        // yang PALING LAMA (tanggalLampau1), bukan yang baru saja
        // dibuat tes ini.
        const res = await get('/api/attendances/today', SUBUR, 'SPG')

        assert.strictEqual(res.status, 200)
        assert.ok(res.body.staleUnresolved, 'staleUnresolved seharusnya ada')
        assert.strictEqual(res.body.staleUnresolved.tanggal, tanggalLampau1)
    })

})


describe('PUT /api/areas/:id -- radius check-in per area', () => {

    // Area 43 (PALU) dipilih karena tidak dipakai user hierarki mana
    // pun di tes lain di berkas ini -- aman diubah-ubah dan
    // dikembalikan ke null di after().
    const AREA_ID = 43

    after(async () => {
        const conn = await db()
        await conn.query(
            'UPDATE areas SET checkin_radius_meters = NULL WHERE id = ?',
            [AREA_ID]
        )
        await conn.end()
    })

    test('non-administrator ditolak 403', async () => {
        const res = await kirim(
            'PUT',
            `/api/areas/${AREA_ID}`,
            DANNY,
            'SPG',
            { checkin_radius_meters: 500 }
        )

        assert.strictEqual(res.status, 403)
    })

    test('administrator bisa set radius, dan tersimpan', async () => {
        const res = await kirim(
            'PUT',
            `/api/areas/${AREA_ID}`,
            ADMIN,
            'ADMINISTRATOR',
            { checkin_radius_meters: 200 }
        )

        assert.strictEqual(res.status, 200)
        assert.strictEqual(res.body.checkin_radius_meters, 200)

        const cek = await get('/api/areas', ADMIN, 'ADMINISTRATOR')
        const area = cek.body.find((a) => a.id === AREA_ID)

        assert.strictEqual(area.checkin_radius_meters, 200)
    })

    test('radius 0 atau negatif ditolak 400', async () => {
        const res = await kirim(
            'PUT',
            `/api/areas/${AREA_ID}`,
            ADMIN,
            'ADMINISTRATOR',
            { checkin_radius_meters: 0 }
        )

        assert.strictEqual(res.status, 400)
    })

    test('null mengembalikan ke default (dikosongkan)', async () => {
        await kirim(
            'PUT',
            `/api/areas/${AREA_ID}`,
            ADMIN,
            'ADMINISTRATOR',
            { checkin_radius_meters: 500 }
        )

        const res = await kirim(
            'PUT',
            `/api/areas/${AREA_ID}`,
            ADMIN,
            'ADMINISTRATOR',
            { checkin_radius_meters: null }
        )

        assert.strictEqual(res.status, 200)
        assert.strictEqual(res.body.checkin_radius_meters, null)
    })

})


describe('POST /api/areas -- tambah area baru', () => {

    const areaIdsDibuat = []

    after(async () => {
        if (areaIdsDibuat.length === 0) return
        const conn = await db()
        await conn.query('DELETE FROM areas WHERE id IN (?)', [areaIdsDibuat])
        await conn.end()
    })

    test('non-administrator ditolak 403', async () => {
        const res = await kirim(
            'POST',
            '/api/areas',
            DANNY,
            'SPG',
            { code: 'TESTAREA', name: 'Test Area' }
        )

        assert.strictEqual(res.status, 403)
    })

    test('code atau name kosong ditolak 400', async () => {
        const res = await kirim(
            'POST',
            '/api/areas',
            ADMIN,
            'ADMINISTRATOR',
            { code: '', name: 'Test Area' }
        )

        assert.strictEqual(res.status, 400)
    })

    test('administrator bisa tambah area baru, dengan atau tanpa radius', async () => {
        const res = await kirim(
            'POST',
            '/api/areas',
            ADMIN,
            'ADMINISTRATOR',
            { code: 'TESTAREA', name: 'Test Area E2E', checkin_radius_meters: 300 }
        )

        assert.strictEqual(res.status, 200)
        assert.strictEqual(res.body.code, 'TESTAREA')
        assert.strictEqual(res.body.checkin_radius_meters, 300)

        areaIdsDibuat.push(res.body.id)

        const cek = await get('/api/areas', ADMIN, 'ADMINISTRATOR')
        assert.ok(cek.body.some((a) => a.id === res.body.id))
    })

})
