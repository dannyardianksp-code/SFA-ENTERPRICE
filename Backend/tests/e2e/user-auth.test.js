require('dotenv').config({ quiet: true })

const { test, describe, before, after } = require('node:test')
const assert = require('node:assert')
const jwt = require('jsonwebtoken')

const {
    PASSWORD_ALPHABET,
    PASSWORD_LENGTH,
} = require('../../src/utils/password.util')

const BASE = process.env.TEST_BASE_URL || 'http://localhost:1000'

// User acuan di database dev.
const DANNY = 1          // SPG
const ADMIN = 2          // ADMINISTRATOR
const JAKARTA = 3        // SUPERVISOR
const MANAGER = 30       // MANAGER

const tokenUntuk = (id, role) =>
    jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '15m' })

const kirim = async (method, path, userId, role, body) => {
    const headers = { 'Content-Type': 'application/json' }

    if (userId !== null) {
        headers.Authorization = 'Bearer ' + tokenUntuk(userId, role)
    }

    const res = await fetch(BASE + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    })

    const text = await res.text()
    let parsed
    try { parsed = JSON.parse(text) } catch { parsed = text }

    return { status: res.status, body: parsed }
}

const db = async () => {
    const mysql = require('mysql2/promise')
    return mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
    })
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


describe('PUT /api/users/:id/reset-password', () => {

    let targetId = null
    let targetEmail = null

    /**
     * Tesnya membuat user sasaran sendiri dan tidak pernah menyentuh
     * password user sungguhan.
     *
     * Alasannya bukan kerapian: mereset password Danny membuat pemilik
     * repo tidak bisa login di emulator, dan kalau tes ini mati di
     * tengah, akun itu tertinggal dengan password acak yang tidak
     * diketahui siapa pun — termasuk tesnya sendiri.
     *
     * code dan email keduanya punya unique index, jadi nilainya diberi
     * penanda waktu supaya pasti tidak bertabrakan. status dibiarkan
     * default 'ACTIVE' — auth.controller menolak login untuk 'INACTIVE',
     * dan tes login di bawah akan gagal sambil menuduh reset password.
     */
    before(async () => {
        const penanda = Date.now()

        targetEmail = `zz-test-reset-${penanda}@contoh.test`

        const c = await db()

        const [hasil] = await c.query(
            `INSERT INTO users (code, name, email, password, role)
             VALUES (?, ?, ?, ?, 'SPG')`,
            [
                `ZZTEST${penanda}`,
                'TARGET RESET PASSWORD (TES)',
                targetEmail,
                'hash-lama-yang-tidak-dipakai',
            ]
        )

        await c.end()

        targetId = hasil.insertId
    })

    after(async () => {
        if (targetId === null) return

        const c = await db()
        await c.query('DELETE FROM users WHERE id = ?', [targetId])
        await c.end()

        console.log('  (bersih-bersih: 1 user tes dihapus)')
    })

    const hashDi = async (id) => {
        const c = await db()
        const [rows] = await c.query(
            'SELECT password FROM users WHERE id = ?',
            [id]
        )
        await c.end()

        return rows[0].password
    }

    test('tanpa token ditolak 401', async () => {
        const res = await kirim(
            'PUT',
            `/api/users/${targetId}/reset-password`,
            null
        )

        assert.strictEqual(res.status, 401)
    })

    // INI lubangnya: sebelum perbaikan, SPG mana pun bisa mereset
    // password ADMINISTRATOR lalu login sebagai administrator.
    test('SPG ditolak 403', async () => {
        const res = await kirim(
            'PUT',
            `/api/users/${targetId}/reset-password`,
            DANNY,
            'SPG'
        )

        assert.strictEqual(res.status, 403)
        assert.ok(res.body.message, 'tidak ada field message')
    })

    test('SUPERVISOR ditolak 403', async () => {
        const res = await kirim(
            'PUT',
            `/api/users/${targetId}/reset-password`,
            JAKARTA,
            'SUPERVISOR'
        )

        assert.strictEqual(res.status, 403)
    })

    test('MANAGER ditolak 403', async () => {
        const res = await kirim(
            'PUT',
            `/api/users/${targetId}/reset-password`,
            MANAGER,
            'MANAGER'
        )

        assert.strictEqual(res.status, 403)
    })

    // Role diambil dari database, bukan dari token. Token SPG yang
    // mengaku ADMINISTRATOR tidak boleh dipercaya.
    test('token SPG yang mengaku ADMINISTRATOR tetap ditolak 403', async () => {
        const res = await kirim(
            'PUT',
            `/api/users/${targetId}/reset-password`,
            DANNY,
            'ADMINISTRATOR'
        )

        assert.strictEqual(res.status, 403)
    })

    test('SPG yang ditolak tidak mengubah password apa pun', async () => {
        const sebelum = await hashDi(targetId)

        await kirim(
            'PUT',
            `/api/users/${targetId}/reset-password`,
            DANNY,
            'SPG'
        )

        assert.strictEqual(
            await hashDi(targetId),
            sebelum,
            'password berubah padahal permintaannya ditolak'
        )
    })

    test('id tidak ada ditolak 404 untuk administrator', async () => {
        const res = await kirim(
            'PUT',
            '/api/users/99999999/reset-password',
            ADMIN,
            'ADMINISTRATOR'
        )

        assert.strictEqual(res.status, 404)
    })

    test('administrator berhasil, passwordnya acak dan sesuai alfabet', async () => {
        const res = await kirim(
            'PUT',
            `/api/users/${targetId}/reset-password`,
            ADMIN,
            'ADMINISTRATOR'
        )

        assert.strictEqual(res.status, 200, JSON.stringify(res.body))
        assert.ok(res.body.password, 'password tidak dikembalikan')

        assert.strictEqual(
            res.body.password.length,
            PASSWORD_LENGTH,
            `panjangnya ${res.body.password.length}`
        )

        for (const c of res.body.password) {
            assert.ok(
                PASSWORD_ALPHABET.includes(c),
                `karakter ${JSON.stringify(c)} di luar alfabet`
            )
        }

        assert.notStrictEqual(
            res.body.password,
            '123456',
            'password masih nilai tetap yang lama'
        )
    })

    test('hash di database benar-benar berubah', async () => {
        const sebelum = await hashDi(targetId)

        const res = await kirim(
            'PUT',
            `/api/users/${targetId}/reset-password`,
            ADMIN,
            'ADMINISTRATOR'
        )

        assert.strictEqual(res.status, 200)

        assert.notStrictEqual(
            await hashDi(targetId),
            sebelum,
            'hash tidak berubah'
        )
    })

    // Tanpa tes ini kita hanya membuktikan hash-nya berubah, bukan bahwa
    // hasilnya berguna. Hash yang berubah menjadi nilai yang tidak cocok
    // dengan password mana pun akan lolos semua tes di atas.
    test('password baru benar-benar bisa dipakai login', async () => {
        const reset = await kirim(
            'PUT',
            `/api/users/${targetId}/reset-password`,
            ADMIN,
            'ADMINISTRATOR'
        )

        assert.strictEqual(reset.status, 200)

        const login = await kirim(
            'POST',
            '/api/auth/login',
            null,
            null,
            { email: targetEmail, password: reset.body.password }
        )

        assert.strictEqual(
            login.status,
            200,
            `login gagal: ${JSON.stringify(login.body)}`
        )

        assert.ok(login.body.token, 'login tidak mengembalikan token')
    })

    test('password lama tidak bisa dipakai lagi setelah reset', async () => {
        const reset = await kirim(
            'PUT',
            `/api/users/${targetId}/reset-password`,
            ADMIN,
            'ADMINISTRATOR'
        )

        const passwordLama = reset.body.password

        await kirim(
            'PUT',
            `/api/users/${targetId}/reset-password`,
            ADMIN,
            'ADMINISTRATOR'
        )

        const login = await kirim(
            'POST',
            '/api/auth/login',
            null,
            null,
            { email: targetEmail, password: passwordLama }
        )

        assert.strictEqual(login.status, 401)
    })

})

describe('GET /api/users/:id/areas', () => {

    // Route ini sebelumnya didaftarkan TANPA middleware auth sama
    // sekali, jadi siapa pun tanpa token bisa membaca penugasan area
    // user mana pun. Dari 42 pendaftaran route di src/routes, hanya
    // register, login, dan route ini yang tanpa auth — dua yang pertama
    // memang seharusnya.
    test('tanpa token ditolak 401', async () => {
        const res = await fetch(`${BASE}/api/users/${DANNY}/areas`)

        assert.strictEqual(res.status, 401)
    })

    // Jalur yang benar tidak boleh rusak oleh penambahan middleware.
    test('dengan token yang sah tetap berhasil', async () => {
        const res = await kirim(
            'GET',
            `/api/users/${DANNY}/areas`,
            DANNY,
            'SPG'
        )

        assert.strictEqual(res.status, 200, JSON.stringify(res.body))
    })

})
