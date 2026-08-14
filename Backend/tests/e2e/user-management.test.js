require('dotenv').config({ quiet: true })

const { test, describe, before, after } = require('node:test')
const assert = require('node:assert')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const mysql = require('mysql2/promise')

const BASE = process.env.TEST_BASE_URL || 'http://localhost:1000'

// User sungguhan, dipakai hanya sebagai pemanggil. Tidak ada satu pun
// tes di berkas ini yang mengubah data mereka.
const SPG = 1
const ADMIN = 2

// Password user sungguhan TIDAK BOLEH diubah tes mana pun, jadi seluruh
// perubahan diarahkan ke user sementara yang dibuat berkas ini sendiri.
const SEMENTARA = {
    code: 'UJI-AUTHZ-14082026',
    name: 'User Uji Otorisasi',
    email: 'uji.authz.14082026@contoh.invalid',
    password: 'RahasiaUji123',
}

let db
let idSementara

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

before(async () => {
    try {
        await fetch(BASE + '/api/users', { method: 'GET' })
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

    // code dan email keduanya punya unique index. Sisa dari tes yang
    // pernah mati di tengah harus dibersihkan dulu, kalau tidak INSERT
    // di bawah gagal dan kegagalannya terbaca seperti masalah koneksi.
    await db.query('DELETE FROM users WHERE code = ?', [SEMENTARA.code])

    // status ditulis eksplisit 'ACTIVE'. Kalau dibiarkan kosong dan
    // defaultnya berubah suatu saat, tes "token ditolak setelah
    // dinonaktifkan" akan lulus karena penyiapan datanya, bukan karena
    // perbaikannya.
    const [hasil] = await db.query(
        `INSERT INTO users (code, name, email, password, role, status)
         VALUES (?, ?, ?, ?, 'SPG', 'ACTIVE')`,
        [
            SEMENTARA.code,
            SEMENTARA.name,
            SEMENTARA.email,
            await bcrypt.hash(SEMENTARA.password, 10),
        ]
    )

    idSementara = hasil.insertId
})

after(async () => {
    if (db) {
        await db.query('DELETE FROM users WHERE code = ?', [SEMENTARA.code])
        await db.end()
    }
})


describe('middleware menolak akun nonaktif', () => {

    const statusDi = async (id) => {
        const [baris] = await db.query(
            'SELECT status FROM users WHERE id = ?',
            [id]
        )

        return baris[0].status
    }

    test('token user aktif diterima', async () => {
        const { status } = await kirim('GET', '/api/users', idSementara)

        assert.notStrictEqual(status, 401)
    })

    test('dinonaktifkan lalu token yang sama ditolak 401', async () => {
        const toggle = await kirim(
            'PUT',
            `/api/users/${idSementara}/status`,
            ADMIN
        )

        assert.strictEqual(toggle.status, 200)

        // Kolomnya harus benar-benar berubah. Tanpa pemeriksaan ini,
        // tesnya juga lulus pada handler yang mengembalikan 200 tanpa
        // menulis apa pun — bug yang sedang diperbaiki.
        assert.strictEqual(await statusDi(idSementara), 'INACTIVE')

        const { status } = await kirim('GET', '/api/users', idSementara)

        assert.strictEqual(
            status,
            401,
            'token yang tadinya bekerja harus ditolak setelah dinonaktifkan'
        )
    })

    test('diaktifkan kembali lalu token yang sama diterima lagi', async () => {
        await kirim('PUT', `/api/users/${idSementara}/status`, ADMIN)

        assert.strictEqual(await statusDi(idSementara), 'ACTIVE')

        const { status } = await kirim('GET', '/api/users', idSementara)

        assert.notStrictEqual(status, 401)
    })

    test('token untuk id yang tidak ada ditolak 401', async () => {
        const { status } = await kirim('GET', '/api/users', 99999999)

        assert.strictEqual(status, 401)
    })

})


describe('gerbang login untuk akun nonaktif', () => {

    const login = async (email, password) => {
        const res = await fetch(BASE + '/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        })

        return { status: res.status, data: await res.json() }
    }

    before(async () => {
        await db.query(
            'UPDATE users SET status = ? WHERE id = ?',
            ['INACTIVE', idSementara]
        )
    })

    after(async () => {
        await db.query(
            'UPDATE users SET status = ? WHERE id = ?',
            ['ACTIVE', idSementara]
        )
    })

    test('password benar tapi akun nonaktif ditolak 403', async () => {
        const { status, data } = await login(
            SEMENTARA.email,
            SEMENTARA.password
        )

        assert.strictEqual(status, 403)
        assert.match(data.message, /tidak aktif/i)
    })

    // Pemeriksaan status HARUS terjadi setelah password diperiksa.
    // Kalau tidak, siapa pun bisa mengetahui email mana yang terdaftar
    // hanya dengan menebak — persis kebocoran yang dicegah oleh pesan
    // login yang sengaja dibuat identik.
    test('password salah pada akun nonaktif tetap 401 generik', async () => {
        const { status, data } = await login(
            SEMENTARA.email,
            'PasswordYangSalah'
        )

        assert.strictEqual(
            status,
            401,
            'status akun tidak boleh bocor sebelum password diperiksa'
        )
        assert.match(data.message, /Email atau password salah/i)
    })

    test('status NULL juga ditolak, bukan diloloskan', async () => {
        await db.query(
            'UPDATE users SET status = NULL WHERE id = ?',
            [idSementara]
        )

        const { status } = await login(
            SEMENTARA.email,
            SEMENTARA.password
        )

        assert.strictEqual(status, 403)

        await db.query(
            'UPDATE users SET status = ? WHERE id = ?',
            ['INACTIVE', idSementara]
        )
    })

})
