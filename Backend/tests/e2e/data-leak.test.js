require('dotenv').config({ quiet: true })

const { test, describe, before, after } = require('node:test')
const assert = require('node:assert')
const jwt = require('jsonwebtoken')
const mysql = require('mysql2/promise')

const BASE = process.env.TEST_BASE_URL || 'http://localhost:1000'

// Akun sungguhan, dipakai HANYA sebagai pemanggil baca-saja. Tidak ada
// satu pun tes di berkas ini yang menjadikannya sasaran tulis.
const SPG = 1               // anak dari 3
const ADMIN = 2
const SUPERVISOR = 3        // anak dari 30; punya 1, 37, 38
const MANAGER = 30          // punya 3, 31, 33 dan cucunya
const SPG_LUAR = 34         // anak dari 33 — di luar subtree 3

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

    test('ADMINISTRATOR melihat semuanya', async () => {
        const { data } = await kirim('GET', '/api/users', ADMIN)

        assert.strictEqual(daftarDari(data).length, 11)
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
