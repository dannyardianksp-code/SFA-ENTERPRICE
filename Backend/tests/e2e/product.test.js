require('dotenv').config({ quiet: true })

const { test, describe, before, after } = require('node:test')
const assert = require('node:assert')
const jwt = require('jsonwebtoken')
const mysql = require('mysql2/promise')

const BASE = process.env.TEST_BASE_URL || 'http://localhost:1000'
const SPG = 1

let db
const produkIdsDibuat = []

const tokenUntuk = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '15m' })

const kirim = async (method, path, body) => {
    const res = await fetch(BASE + path, {
        method,
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + tokenUntuk(SPG),
        },
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

before(async () => {
    try {
        await fetch(BASE + '/api/activities')
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
})

after(async () => {
    if (db) {
        for (const id of produkIdsDibuat) {
            await db.query('DELETE FROM products WHERE id = ?', [id])
        }

        await db.end()
    }
})


describe('GET /api/products', () => {

    test('mengembalikan array telanjang, tiap item memuat category dan photo_url', async () => {
        const { status, data } = await kirim('GET', '/api/products')

        assert.strictEqual(status, 200)
        assert.ok(Array.isArray(data))
        assert.ok(data.length > 0, 'tidak ada produk sama sekali di database')
        assert.ok('category' in data[0], 'key category tidak ada di respons')
        assert.ok('photo_url' in data[0], 'key photo_url tidak ada di respons')
    })

})


describe('POST /api/products', () => {

    test('field eksplisit tersimpan, field tak dikenal (mis. id) diabaikan', async () => {
        const { status, data } = await kirim('POST', '/api/products', {
            id: 99999, // harus diabaikan -- id auto increment, bukan dari klien
            code: 'UJI-PRODUK-001',
            name: 'Produk Uji',
            price: 12345,
            uom: 'PCS',
            category: 'PROMOSI',
            photo_url: '/uploads/uji-produk.jpg',
        })

        assert.strictEqual(status, 200)
        assert.notStrictEqual(data.id, 99999, 'id dari body tidak boleh dipakai')

        produkIdsDibuat.push(data.id)

        const [rows] = await db.query(
            'SELECT code, name, category, photo_url FROM products WHERE id = ?',
            [data.id]
        )

        assert.strictEqual(rows[0].code, 'UJI-PRODUK-001')
        assert.strictEqual(rows[0].category, 'PROMOSI')
        assert.strictEqual(rows[0].photo_url, '/uploads/uji-produk.jpg')
    })

    test('category kosong tersimpan null (default JUAL diterapkan di klien, bukan database)', async () => {
        const { status, data } = await kirim('POST', '/api/products', {
            code: 'UJI-PRODUK-002',
            name: 'Produk Uji Tanpa Kategori',
            price: 1000,
            uom: 'PCS',
        })

        assert.strictEqual(status, 200)
        produkIdsDibuat.push(data.id)

        const [rows] = await db.query(
            'SELECT category FROM products WHERE id = ?',
            [data.id]
        )

        assert.strictEqual(rows[0].category, null)
    })

    test('category COMPETITOR tersimpan apa adanya', async () => {
        const { status, data } = await kirim('POST', '/api/products', {
            code: 'UJI-PRODUK-004',
            name: 'Produk Kompetitor Uji',
            price: 1000,
            uom: 'PCS',
            category: 'COMPETITOR',
        })

        assert.strictEqual(status, 200)
        produkIdsDibuat.push(data.id)

        const [rows] = await db.query(
            'SELECT category FROM products WHERE id = ?',
            [data.id]
        )

        assert.strictEqual(rows[0].category, 'COMPETITOR')
    })

})


describe('PUT /api/products/:id', () => {

    test('memperbarui category dan photo_url', async () => {
        const buat = await kirim('POST', '/api/products', {
            code: 'UJI-PRODUK-003',
            name: 'Produk Uji Update',
            price: 5000,
            uom: 'PCS',
            category: 'JUAL',
        })

        produkIdsDibuat.push(buat.data.id)

        const { status } = await kirim('PUT', `/api/products/${buat.data.id}`, {
            code: 'UJI-PRODUK-003',
            name: 'Produk Uji Update',
            price: 5000,
            uom: 'PCS',
            category: 'PROMOSI',
            photo_url: '/uploads/uji-produk-3.jpg',
        })

        assert.strictEqual(status, 200)

        const [rows] = await db.query(
            'SELECT category, photo_url FROM products WHERE id = ?',
            [buat.data.id]
        )

        assert.strictEqual(rows[0].category, 'PROMOSI')
        assert.strictEqual(rows[0].photo_url, '/uploads/uji-produk-3.jpg')
    })

})
