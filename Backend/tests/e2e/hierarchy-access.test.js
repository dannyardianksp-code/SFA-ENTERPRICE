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
 * POST /api/visit-plans menyalin req.body apa adanya dan TIDAK memeriksa
 * kepemilikan, jadi tes bisa membuat rencana milik user lain. Itu justru
 * yang dibutuhkan untuk membuktikan cakupan subtree.
 */
const buatRencana = async (userId) => {
    const res = await kirim('POST', '/api/visit-plans', DANNY, 'SPG', {
        user_id: userId,
        customer_id: customerId,
        visit_date: localDateString(),
    })

    assert.ok(
        res.status === 200 || res.status === 201,
        `gagal membuat rencana untuk user ${userId}: ${JSON.stringify(res.body)}`
    )

    dibuat.push(res.body.id)

    return res.body.id
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

    // Kasus yang sekarang mengembalikan kosong: filter area_id manager
    // bernilai NULL sehingga tidak cocok dengan sales mana pun.
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

    // Supervisor melihat miliknya sendiri DAN bawahannya. Sekarang
    // cabangnya hanya mengambil bawahan, jadi activity supervisor
    // sendiri tidak pernah terlihat olehnya.
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

    test('administrator melihat minimal sebanyak manager', async () => {
        const mgr = await get('/api/visit-activities', MANAGER, 'MANAGER')
        const adm = await get('/api/visit-activities', ADMIN, 'ADMINISTRATOR')

        assert.strictEqual(mgr.status, 200)
        assert.strictEqual(adm.status, 200)

        assert.ok(
            adm.body.length >= mgr.body.length,
            `administrator ${adm.body.length} < manager ${mgr.body.length}`
        )
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
