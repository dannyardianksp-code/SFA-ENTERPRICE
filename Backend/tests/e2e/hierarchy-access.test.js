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

    // Sekarang cabang SUPERVISOR juga menyaring area_id dan channel_id
    // supervisor, sehingga SPG multi-area bisa lenyap dari daftar
    // atasannya sendiri.
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
