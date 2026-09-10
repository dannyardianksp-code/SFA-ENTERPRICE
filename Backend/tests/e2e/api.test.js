require('dotenv').config({ quiet: true })

const { test, describe, before } = require('node:test')
const assert = require('node:assert')
const jwt = require('jsonwebtoken')

/**
 * Tes end-to-end terhadap server yang SEDANG BERJALAN + database.
 *
 * Jalankan lebih dulu:  npm run dev
 * Lalu:                 npm run test:e2e
 *
 * Token ditandatangani langsung dari JWT_SECRET supaya tes tidak
 * perlu password dan tidak menulis apa pun ke database.
 */

const BASE = process.env.TEST_BASE_URL || 'http://localhost:1000'

// User id 1 dipakai karena punya AssignedAreas di data dev.
// Ganti lewat TEST_USER_ID kalau data Anda berbeda.
const USER_ID = Number(process.env.TEST_USER_ID || 1)

// Koordinat yang dekat dengan data customer dev
const LAT = -6.125722840252188
const LNG = 106.78554763944275

const authHeader = () => ({
    Authorization: 'Bearer ' + jwt.sign(
        { id: USER_ID, role: 'MD' },
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

const post = async (path, payload) => {
    const res = await fetch(BASE + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
            `Jalankan "npm run dev" lebih dulu, lalu ulangi "npm run test:e2e".`
        )
    }
})


describe('POST /api/auth/login', () => {

    test('field kosong ditolak 400', async () => {
        const res = await post('/api/auth/login', {})

        assert.strictEqual(res.status, 400)
        assert.match(res.body.message, /wajib diisi/)
    })

    test('hanya email ditolak 400', async () => {
        const res = await post('/api/auth/login', {
            email: 'a@b.com',
        })

        assert.strictEqual(res.status, 400)
    })

    test('email tidak terdaftar ditolak 401', async () => {
        const res = await post('/api/auth/login', {
            email: 'tidakada-xyz@nowhere.test',
            password: 'apapun',
        })

        assert.strictEqual(res.status, 401)
    })

    // Pesan HARUS identik antara "email tidak ada" dan "password
    // salah". Kalau berbeda, penyerang bisa memetakan email mana
    // yang terdaftar (user enumeration) sebelum menebak password.
    test('pesan identik untuk email salah dan password salah', async () => {
        const emailSalah = await post('/api/auth/login', {
            email: 'tidakada-xyz@nowhere.test',
            password: 'apapun',
        })

        const passwordSalah = await post('/api/auth/login', {
            email: process.env.TEST_EMAIL || 'danny@mail.com',
            password: 'password-yang-pasti-salah',
        })

        assert.strictEqual(emailSalah.status, 401)
        assert.strictEqual(passwordSalah.status, 401)
        assert.strictEqual(
            emailSalah.body.message,
            passwordSalah.body.message,
            'pesan berbeda -> membocorkan email mana yang terdaftar'
        )
    })

})


describe('auth middleware', () => {

    test('tanpa token ditolak 401', async () => {
        const res = await get('/api/customers/nearby', false)

        assert.strictEqual(res.status, 401)
    })

    test('token tidak valid ditolak 401', async () => {
        const res = await fetch(BASE + '/api/customers/nearby', {
            headers: { Authorization: 'Bearer token-ngawur' },
        })

        assert.strictEqual(res.status, 401)
    })

})


describe('GET /api/customers/nearby - validasi', () => {

    const kasus = [
        ['tanpa parameter', '', /latitude dan longitude/],
        ['hanya latitude', '?latitude=-6.12', /latitude dan longitude/],
        ['latitude kosong', '?latitude=&longitude=106.78', /latitude dan longitude/],
        ['latitude bukan angka', '?latitude=abc&longitude=106.78', /latitude dan longitude/],
        ['latitude 91', '?latitude=91&longitude=106.78', /rentang/],
        ['longitude 181', '?latitude=-6.12&longitude=181', /rentang/],
        ['radius 0', '?latitude=-6.12&longitude=106.78&radius=0', /radius/],
        ['radius negatif', '?latitude=-6.12&longitude=106.78&radius=-5', /radius/],
    ]

    for (const [label, query, pola] of kasus) {
        test(`${label} ditolak 400`, async () => {
            const res = await get('/api/customers/nearby' + query)

            assert.strictEqual(res.status, 400)
            assert.match(res.body.message, pola)
        })
    }

})


describe('GET /api/customers/nearby - jalur sukses', () => {

    let hasil

    before(async () => {
        hasil = await get(
            `/api/customers/nearby?latitude=${LAT}&longitude=${LNG}&radius=50`
        )
    })

    test('mengembalikan 200', () => {
        assert.strictEqual(hasil.status, 200)
    })

    // Dulu cabang "user tanpa area" mengembalikan objek
    // { success, message, data } sehingga client yang memanggil
    // .filter() langsung error.
    test('bentuknya array telanjang, bukan objek pembungkus', () => {
        assert.ok(
            Array.isArray(hasil.body),
            `dapat ${typeof hasil.body}: ${JSON.stringify(hasil.body).slice(0, 200)}`
        )
    })

    test('setiap item punya distance berupa number', () => {
        if (hasil.body.length === 0) return

        assert.ok(hasil.body.every(c => typeof c.distance === 'number'))
    })

    // Bentuk respons harus sama dengan /customers, termasuk relasi
    // Channel. Kalau hilang, baris channel di mobile tampil "-".
    test('menyertakan relasi Channel dan Area', () => {
        if (hasil.body.length === 0) return

        assert.ok(hasil.body.every(c => c.Channel !== undefined), 'Channel hilang')
        assert.ok(hasil.body.every(c => c.Area !== undefined), 'Area hilang')
    })

    test('terurut dari jarak terdekat', () => {
        const jarak = hasil.body.map(c => c.distance)

        assert.deepStrictEqual(jarak, [...jarak].sort((a, b) => a - b))
    })

    test('semua hasil berada di dalam radius', () => {
        assert.ok(hasil.body.every(c => c.distance <= 50))
    })

    test('radius kecil mengembalikan lebih sedikit atau sama', async () => {
        const kecil = await get(
            `/api/customers/nearby?latitude=${LAT}&longitude=${LNG}&radius=1`
        )

        assert.ok(kecil.body.length <= hasil.body.length)
    })

    test('titik yang jauh mengembalikan array kosong', async () => {
        // Surabaya, ~600 km dari data customer dev
        const jauh = await get(
            '/api/customers/nearby?latitude=-7.2575&longitude=112.7521&radius=10'
        )

        assert.strictEqual(jauh.status, 200)
        assert.deepStrictEqual(jauh.body, [])
    })

    test('tanpa parameter radius memakai default 10 km', async () => {
        const def = await get(
            `/api/customers/nearby?latitude=${LAT}&longitude=${LNG}`
        )

        assert.strictEqual(def.status, 200)
        assert.ok(def.body.every(c => c.distance <= 10))
    })

})


describe('GET /api/customers', () => {

    test('mengembalikan array', async () => {
        const res = await get('/api/customers')

        assert.strictEqual(res.status, 200)
        assert.ok(Array.isArray(res.body))
    })

    // getAll dan getNearbyCustomers harus memakai aturan hak akses
    // area yang sama (resolveAccessibleAreaIds). Kalau berbeda,
    // sales melihat kumpulan customer yang berbeda di dua layar.
    test('cakupan area sama dengan /customers/nearby', async () => {
        const all = await get('/api/customers')
        const nearby = await get(
            `/api/customers/nearby?latitude=${LAT}&longitude=${LNG}&radius=20000`
        )

        const areaAll = [...new Set(all.body.map(c => c.area_id))].sort()
        const areaNearby = [...new Set(nearby.body.map(c => c.area_id))].sort()

        assert.deepStrictEqual(areaNearby, areaAll)
    })

    test('detail by id mengembalikan customer yang benar', async () => {
        const all = await get('/api/customers')

        if (all.body.length === 0) return

        const id = all.body[0].id
        const one = await get('/api/customers/' + id)

        assert.strictEqual(one.status, 200)
        assert.strictEqual(one.body.id, id)
    })

    test('id yang tidak ada mengembalikan 404 dengan message', async () => {
        const res = await get('/api/customers/999999')

        assert.strictEqual(res.status, 404)
        assert.match(res.body.message, /tidak ditemukan/)
    })

})


describe('GET /api/products', () => {

    // getAll produk dulunya tanpa try/catch, sehingga error DB
    // menghasilkan halaman HTML dari Express, bukan JSON.
    test('mengembalikan JSON, bukan HTML', async () => {
        const res = await get('/api/products')

        assert.strictEqual(res.status, 200)
        assert.notStrictEqual(typeof res.body, 'string')
    })

})
