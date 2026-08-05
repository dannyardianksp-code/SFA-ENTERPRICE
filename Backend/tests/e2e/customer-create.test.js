require('dotenv').config({ quiet: true })

// `after` dipakai oleh blok POST di Task 5 untuk membersihkan data.
const { test, describe, before, after } = require('node:test')
const assert = require('node:assert')
const jwt = require('jsonwebtoken')

const BASE = process.env.TEST_BASE_URL || 'http://localhost:1000'
const USER_ID = Number(process.env.TEST_USER_ID || 1)

const authHeader = () => ({
    Authorization: 'Bearer ' + jwt.sign(
        { id: USER_ID, role: 'SPG' },
        process.env.JWT_SECRET,
        { expiresIn: '10m' }
    ),
})

const get = async (path, withAuth = true) => {
    const res = await fetch(BASE + path, {
        headers: withAuth ? authHeader() : {},
    })
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

describe('GET /api/customers/form-options', () => {

    test('tanpa token ditolak 401', async () => {
        const res = await get('/api/customers/form-options', false)
        assert.strictEqual(res.status, 401)
    })

    test('mengembalikan tiga daftar', async () => {
        const res = await get('/api/customers/form-options')

        assert.strictEqual(res.status, 200)
        assert.ok(Array.isArray(res.body.areas), 'areas bukan array')
        assert.ok(Array.isArray(res.body.channels), 'channels bukan array')
        assert.ok(Array.isArray(res.body.customerGroups), 'customerGroups bukan array')
    })

    test('setiap group punya code hasil migrasi', async () => {
        const res = await get('/api/customers/form-options')

        assert.ok(res.body.customerGroups.length > 0)
        assert.ok(
            res.body.customerGroups.every(g => typeof g.code === 'string' && g.code.length > 0),
            'ada group tanpa code — migrasi 001 belum dijalankan?'
        )
        assert.ok(
            res.body.customerGroups.every(g => /^[A-Z]+$/.test(g.code)),
            'ada group code yang bukan huruf A-Z'
        )
    })

    // Dropdown harus mencerminkan aturan yang sama dengan yang menyaring
    // /api/customers, kalau tidak sales bisa memilih area yang lalu
    // ditolak 403 oleh POST-nya sendiri.
    test('area cocok dengan cakupan /api/customers', async () => {
        const opts = await get('/api/customers/form-options')
        const all = await get('/api/customers')

        const idsDropdown = opts.body.areas.map(a => a.id).sort()
        const idsData = [...new Set(all.body.map(c => c.area_id))].sort()

        for (const id of idsData) {
            assert.ok(
                idsDropdown.includes(id),
                `area_id ${id} muncul di data tapi tidak ada di dropdown`
            )
        }
    })

    test('role terbatas hanya dapat satu channel', async () => {
        const res = await get('/api/customers/form-options')
        assert.ok(res.body.channels.length <= 1,
            `SPG seharusnya dapat maksimal 1 channel, dapat ${res.body.channels.length}`)
    })

    // Database dev punya 53 customer_group, hanya 6 yang diberi code
    // oleh migrasi 001. Group tanpa code tidak boleh muncul di dropdown
    // karena POST akan menolaknya dengan 400.
    test('group tanpa code tidak ikut ditawarkan', async () => {
        const res = await get('/api/customers/form-options')

        const mysql = require('mysql2/promise')
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
        })
        const [rows] = await conn.query(
            'SELECT COUNT(*) n FROM customer_groups WHERE code IS NOT NULL'
        )
        await conn.end()

        assert.strictEqual(
            res.body.customerGroups.length,
            rows[0].n,
            'jumlah group di dropdown tidak sama dengan jumlah group ber-code'
        )
    })

})
