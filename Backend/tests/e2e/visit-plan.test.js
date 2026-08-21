require('dotenv').config({ quiet: true })

const { test, describe, before, after } = require('node:test')
const assert = require('node:assert')
const jwt = require('jsonwebtoken')

const {
    spgDateRange,
} = require('../../src/controllers/visitPlan.controller')

const {
    addDaysLocal,
} = require('../../src/utils/date.util')

const BASE = process.env.TEST_BASE_URL || 'http://localhost:1000'
const USER_ID = Number(process.env.TEST_USER_ID || 1)

const authHeader = () => ({
    Authorization: 'Bearer ' + jwt.sign(
        { id: USER_ID, role: 'SPG' },
        process.env.JWT_SECRET,
        { expiresIn: '10m' }
    ),
})

const get = async (path) => {
    const res = await fetch(BASE + path, { headers: authHeader() })
    const text = await res.text()
    let body
    try { body = JSON.parse(text) } catch { body = text }
    return { status: res.status, body }
}

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
})


describe('GET /api/visit-plans (SPG)', () => {

    const dibuat = []

    let customerId = null
    let hariIni = null
    let lusa = null

    // Tesnya MEMBUAT rencana sendiri. Tanpa itu assertion isinya
    // bergantung pada data yang kebetulan ada, dan tesnya lulus secara
    // hampa saat tabelnya kosong.
    //
    // Baris disisipkan LANGSUNG lewat mysql2, bukan lewat
    // POST /api/visit-plans: create sekarang menggerbang role
    // (SUPERVISOR ke atas), sedangkan tes ini memakai token SPG murni
    // untuk menguji GET-nya sendiri. Memanggil endpoint create di sini
    // hanya akan meminjam gerbang otorisasi yang tidak sedang diuji.
    before(async () => {
        const customers = await get('/api/customers')

        assert.strictEqual(customers.status, 200)
        assert.ok(
            customers.body.length > 0,
            'user tes tidak melihat customer apa pun'
        )

        customerId = customers.body[0].id

        const [ini] = spgDateRange()
        hariIni = ini
        lusa = addDaysLocal(new Date(), 2)

        const mysql = require('mysql2/promise')
        const c = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
        })

        for (const visitDate of [hariIni, lusa]) {
            const [hasil] = await c.query(
                'INSERT INTO visit_plans (user_id, customer_id, visit_date, status) VALUES (?, ?, ?, ?)',
                [USER_ID, customerId, visitDate, 'PENDING']
            )

            dibuat.push(hasil.insertId)
        }

        await c.end()
    })

    after(async () => {
        if (dibuat.length === 0) return

        const mysql = require('mysql2/promise')
        const c = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
        })
        await c.query('DELETE FROM visit_plans WHERE id IN (?)', [dibuat])
        await c.end()

        console.log(`  (bersih-bersih: ${dibuat.length} visit plan tes dihapus)`)
    })

    test('tanpa token ditolak 401', async () => {
        const res = await fetch(BASE + '/api/visit-plans')

        assert.strictEqual(res.status, 401)
    })

    // Bentuknya array telanjang, sama dengan /customers. Klien yang
    // memanggil .filter() langsung pada respons berbungkus akan error.
    test('mengembalikan array telanjang, bukan { data }', async () => {
        const res = await get('/api/visit-plans')

        assert.strictEqual(res.status, 200)
        assert.ok(
            Array.isArray(res.body),
            `respons bukan array: ${JSON.stringify(res.body).slice(0, 120)}`
        )
    })

    test('rencana hari ini ikut terkirim', async () => {
        const res = await get('/api/visit-plans')

        assert.ok(
            res.body.some(p => p.visit_date === hariIni),
            `rencana ${hariIni} tidak ada di respons`
        )
    })

    // Batas atas rentangnya. Kalau lusa ikut, rentangnya melebar tanpa
    // ada yang sadar.
    test('rencana lusa TIDAK terkirim', async () => {
        const res = await get('/api/visit-plans')

        assert.ok(
            !res.body.some(p => p.visit_date === lusa),
            `rencana ${lusa} seharusnya di luar rentang`
        )
    })

    test('setiap visit_date berada di hari ini atau besok', async () => {
        const [ini, besok] = spgDateRange()
        const res = await get('/api/visit-plans')

        for (const plan of res.body) {
            assert.ok(
                plan.visit_date === ini || plan.visit_date === besok,
                `visit_date ${plan.visit_date} di luar [${ini}, ${besok}]`
            )
        }
    })

    test('setiap item memuat Customer beserta code dan address', async () => {
        const res = await get('/api/visit-plans')

        const plan = res.body.find(p => p.visit_date === hariIni)

        assert.ok(plan, 'rencana tes tidak ditemukan')
        assert.ok(plan.Customer, 'Customer tidak di-include')
        assert.ok(plan.Customer.name, 'nama customer kosong')
        assert.ok('code' in plan.Customer, 'code tidak di-include')
        assert.ok('address' in plan.Customer, 'address tidak di-include')
    })

    // Dipakai layar untuk menentukan sudah/belum dikunjungi. Kolom
    // status memang berubah (checkIn -> 'ON VISIT', checkOut ->
    // 'COMPLETED'), tapi baris `visits` adalah faktanya sedangkan
    // status hanya turunan yang bisa menyimpang kalau update-nya gagal
    // separuh jalan.
    test('setiap item memuat key Visit', async () => {
        const res = await get('/api/visit-plans')

        const plan = res.body.find(p => p.visit_date === hariIni)

        assert.ok('Visit' in plan, 'relasi Visit tidak di-include')
    })

})
