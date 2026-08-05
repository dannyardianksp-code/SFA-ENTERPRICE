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

const post = async (path, payload, withAuth = true) => {
    const res = await fetch(BASE + path, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(withAuth ? authHeader() : {}),
        },
        body: JSON.stringify(payload),
    })
    const text = await res.text()
    let body
    try { body = JSON.parse(text) } catch { body = text }
    return { status: res.status, body }
}

describe('POST /api/customers', () => {

    const dibuat = []
    let opts

    const payloadValid = (patch = {}) => ({
        name: 'TES CLAUDE ' + Math.abs(Date.parse('2026-08-05')),
        customer_group_id: opts.customerGroups[0].id,
        area_id: opts.areas[0].id,
        channel_id: opts.channels[0].id,
        latitude: '-6.125722840252188',
        longitude: '106.78554763944275',
        location_accuracy: 12,
        ...patch,
    })

    before(async () => {
        const res = await get('/api/customers/form-options')
        opts = res.body

        assert.ok(opts.areas.length > 0, 'tidak ada area — tes tidak bisa jalan')
        assert.ok(opts.channels.length > 0, 'tidak ada channel')
        assert.ok(opts.customerGroups.length > 0, 'tidak ada customer group')
    })

    // Ini tes pertama yang MENULIS ke database. Baris yang dibuat harus
    // dihapus, dan karena tidak ada endpoint DELETE customer,
    // penghapusan dilakukan langsung lewat mysql2.
    after(async () => {
        if (dibuat.length === 0) return

        const mysql = require('mysql2/promise')
        const c = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
        })
        await c.query('DELETE FROM customers WHERE id IN (?)', [dibuat])
        await c.end()

        console.log(`  (bersih-bersih: ${dibuat.length} customer tes dihapus)`)
    })

    test('tanpa token ditolak 401', async () => {
        const res = await post('/api/customers', payloadValid(), false)
        assert.strictEqual(res.status, 401)
    })

    test('field wajib kurang ditolak 400', async () => {
        const res = await post('/api/customers', { name: 'X' })
        assert.strictEqual(res.status, 400)
        assert.strictEqual(typeof res.body.message, 'string')
    })

    test('akurasi 80 m ditolak 400', async () => {
        const res = await post('/api/customers', payloadValid({ location_accuracy: 80 }))
        assert.strictEqual(res.status, 400)
        assert.match(res.body.message, /[Aa]kurasi/)
    })

    test('area_id tidak ada ditolak', async () => {
        const res = await post('/api/customers', payloadValid({ area_id: 999999 }))
        assert.ok(
            res.status === 400 || res.status === 403,
            `harusnya 400/403, dapat ${res.status}`
        )
    })

    test('payload valid menghasilkan 201 dengan kode', async () => {
        const res = await post('/api/customers', payloadValid())

        assert.strictEqual(res.status, 201, JSON.stringify(res.body))
        assert.ok(res.body.id, 'tidak ada id')
        dibuat.push(res.body.id)

        assert.match(res.body.code, /^[A-Z]+-\d{6}$/)
        assert.ok(res.body.Area, 'relasi Area tidak disertakan')
        assert.ok(res.body.Channel, 'relasi Channel tidak disertakan')
        assert.ok(res.body.CustomerGroup, 'relasi CustomerGroup tidak disertakan')
    })

    test('kode memuat prefix group+area+channel dan tahun', async () => {
        const res = await post('/api/customers', payloadValid())
        assert.strictEqual(res.status, 201)
        dibuat.push(res.body.id)

        const group = opts.customerGroups.find(g => g.id === res.body.customer_group_id)
        const area = opts.areas.find(a => a.id === res.body.area_id)
        const channel = opts.channels.find(c => c.id === res.body.channel_id)
        const yy = String(new Date().getFullYear() % 100).padStart(2, '0')

        assert.strictEqual(
            res.body.code.split('-')[0],
            `${group.code}${area.code}${channel.code}`
        )
        assert.ok(res.body.code.split('-')[1].startsWith(yy))
    })

    test('dua simpan berurutan menghasilkan nomor berbeda dan naik', async () => {
        const a = await post('/api/customers', payloadValid())
        const b = await post('/api/customers', payloadValid())

        assert.strictEqual(a.status, 201)
        assert.strictEqual(b.status, 201)
        dibuat.push(a.body.id, b.body.id)

        const seq = (code) => Number(code.split('-')[1].slice(2))

        assert.notStrictEqual(a.body.code, b.body.code)
        assert.strictEqual(seq(b.body.code), seq(a.body.code) + 1)
    })

    test('kolom channel legacy dibiarkan null', async () => {
        const res = await post('/api/customers', payloadValid())
        assert.strictEqual(res.status, 201)
        dibuat.push(res.body.id)

        assert.strictEqual(res.body.channel, null)
    })

    test('customer baru muncul di GET /api/customers', async () => {
        const res = await post('/api/customers', payloadValid())
        assert.strictEqual(res.status, 201)
        dibuat.push(res.body.id)

        const all = await get('/api/customers')
        assert.ok(
            all.body.some(c => c.id === res.body.id),
            'customer baru tidak muncul di daftar — area/channel di luar cakupan?'
        )
    })

})
