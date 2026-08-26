require('dotenv').config({ quiet: true })

const { test, describe, before, after } = require('node:test')
const assert = require('node:assert')
const jwt = require('jsonwebtoken')
const mysql = require('mysql2/promise')
const fs = require('fs')
const path = require('path')

const BASE = process.env.TEST_BASE_URL || 'http://localhost:1000'

const SPG = 1
const SPG_LAIN = 34

let db
const attendanceIdsDibuat = []
const mulaiUji = Date.now()

// id user "sekali pakai" yang dipakai beberapa test di bawah untuk
// mengisolasi skenario (tanpa foto, koordinat rusak, tanpa lokasi,
// race condition, checkout) dari SPG/SPG_LAIN yang datanya dipakai
// test lain. Server ini cuma punya 11 user sungguhan (id tertinggi
// 38), jadi baris usernya sendiri harus disiapkan di sini dulu --
// auth middleware memuat ulang user dari database tiap request, dan
// token untuk id yang tidak ada ditolak 401 sebelum sempat menyentuh
// controller checkin/checkout sama sekali.
const USER_ID_SEMENTARA = [999, 998, 997, 996, 995, 994, 993, 992, 991, 990]

const tokenUntuk = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '15m' })

/** Kirim multipart/form-data lewat fetch bawaan Node. */
const kirimDenganFoto = async (userId, fields, sertakanFoto, endpoint) => {
    const form = new FormData()

    for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) form.append(key, String(value))
    }

    if (sertakanFoto) {
        const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xd9]) // JPEG minimal
        form.append('photo', new Blob([buffer], { type: 'image/jpeg' }), 'uji-absen.jpg')
    }

    const headers = {}

    if (userId !== null) {
        headers.Authorization = 'Bearer ' + tokenUntuk(userId)
    }

    const res = await fetch(BASE + endpoint, {
        method: 'POST',
        headers,
        body: form,
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

    // ON DUPLICATE KEY UPDATE membuat ini aman dijalankan berkali-kali
    // (mis. sesi sebelumnya berhenti sebelum after() sempat jalan) --
    // baris yang sudah ada cukup dipastikan ACTIVE, bukan gagal karena
    // id/email/code bentrok.
    for (const id of USER_ID_SEMENTARA) {
        await db.query(
            `INSERT INTO users (id, code, name, email, password, role, status)
             VALUES (?, ?, ?, ?, ?, 'SPG', 'ACTIVE')
             ON DUPLICATE KEY UPDATE status = 'ACTIVE'`,
            [
                id,
                `ATTN-TEST-${id}`,
                `USER SEMENTARA TES ABSEN ${id}`,
                `attn-test-${id}@contoh.test`,
                'hash-tidak-dipakai',
            ]
        )
    }
})

after(async () => {
    if (db) {
        for (const id of attendanceIdsDibuat) {
            const [rows] = await db.query(
                'SELECT clock_in_photo_url, clock_out_photo_url FROM attendances WHERE id = ?',
                [id]
            )

            for (const kolom of ['clock_in_photo_url', 'clock_out_photo_url']) {
                const url = rows[0]?.[kolom]
                if (!url) continue

                const nama = url.replace('/uploads/', '')
                const lokasi = path.join(__dirname, '..', '..', 'uploads', nama)

                if (fs.existsSync(lokasi)) fs.unlinkSync(lokasi)
            }

            await db.query('DELETE FROM attendances WHERE id = ?', [id])
        }

        // Sapuan tambahan -- menutup jalur penolakan yang menulis
        // berkas ke disk sebelum baris database sempat tercipta (kelas
        // bug yang sama dengan temuan final review activity-input).
        const dirUpload = path.join(__dirname, '..', '..', 'uploads')
        for (const nama of fs.readdirSync(dirUpload)) {
            if (!nama.endsWith('-uji-absen.jpg')) continue
            const waktuBerkas = Number(nama.split('-')[0])
            if (Number.isFinite(waktuBerkas) && waktuBerkas >= mulaiUji) {
                fs.unlinkSync(path.join(dirUpload, nama))
            }
        }

        // Baris attendances milik id sementara sudah tuntas lewat loop
        // attendanceIdsDibuat di atas -- di sini tinggal buang user
        // sementaranya sendiri.
        for (const id of USER_ID_SEMENTARA) {
            await db.query('DELETE FROM users WHERE id = ?', [id])
        }

        await db.end()
    }
})


describe('POST /api/attendances/checkin', () => {

    before(async () => {
        // Bersihkan absen SPG hari ini kalau kebetulan sudah ada dari
        // pengujian manual/sesi sebelumnya -- test ini butuh mulai dari
        // kondisi "belum absen".
        const mysqlLib = require('mysql2/promise')
        const c = await mysqlLib.createConnection({
            host: process.env.DB_HOST, user: process.env.DB_USER,
            password: process.env.DB_PASS, database: process.env.DB_NAME,
        })
        await c.query(
            'DELETE FROM attendances WHERE user_id = ? AND tanggal = CURDATE()',
            [SPG]
        )
        await c.end()
    })

    test('absen masuk berhasil, baris tercipta dengan tanggal hari ini', async () => {
        const { status, data } = await kirimDenganFoto(
            SPG,
            { latitude: '-6.2', longitude: '106.8', accuracy: '15' },
            true,
            '/api/attendances/checkin'
        )

        assert.strictEqual(status, 200)
        assert.ok(data.clock_in_time)
        assert.ok(data.clock_in_photo_url)

        attendanceIdsDibuat.push(data.id)

        const [rows] = await db.query(
            'SELECT tanggal FROM attendances WHERE id = ?',
            [data.id]
        )
        const tanggalHariIni = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

        assert.strictEqual(
            new Date(rows[0].tanggal).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }),
            tanggalHariIni
        )
    })

    test('absen masuk dobel di hari yang sama ditolak 400', async () => {
        const pertama = await kirimDenganFoto(
            SPG_LAIN,
            { latitude: '-6.2', longitude: '106.8', accuracy: '15' },
            true,
            '/api/attendances/checkin'
        )
        assert.strictEqual(pertama.status, 200)
        attendanceIdsDibuat.push(pertama.data.id)

        const kedua = await kirimDenganFoto(
            SPG_LAIN,
            { latitude: '-6.2', longitude: '106.8', accuracy: '15' },
            true,
            '/api/attendances/checkin'
        )

        assert.strictEqual(kedua.status, 400)
        assert.match(kedua.data.message, /sudah absen masuk/i)

        const [rows] = await db.query(
            'SELECT COUNT(*) n FROM attendances WHERE user_id = ? AND tanggal = CURDATE()',
            [SPG_LAIN]
        )
        assert.strictEqual(rows[0].n, 1)
    })

    test('absen masuk tanpa foto ditolak 400', async (t) => {
        const c = await mysql.createConnection({
            host: process.env.DB_HOST, user: process.env.DB_USER,
            password: process.env.DB_PASS, database: process.env.DB_NAME,
        })
        await c.query('DELETE FROM attendances WHERE user_id = ? AND tanggal = CURDATE()', [999])
        await c.end()

        const { status } = await kirimDenganFoto(
            999,
            { latitude: '-6.2', longitude: '106.8', accuracy: '15' },
            false,
            '/api/attendances/checkin'
        )

        assert.strictEqual(status, 400)
    })

    test('koordinat rusak ditolak 400, berkas foto tidak bocor ke disk', async () => {
        const c = await mysql.createConnection({
            host: process.env.DB_HOST, user: process.env.DB_USER,
            password: process.env.DB_PASS, database: process.env.DB_NAME,
        })
        await c.query('DELETE FROM attendances WHERE user_id = ? AND tanggal = CURDATE()', [998])
        await c.end()

        const dirUpload = path.join(__dirname, '..', '..', 'uploads')
        const sebelum = fs.readdirSync(dirUpload)

        const { status } = await kirimDenganFoto(
            998,
            { latitude: 'bukan-angka', longitude: '106.8', accuracy: '15' },
            true,
            '/api/attendances/checkin'
        )

        assert.strictEqual(status, 400)

        const sesudah = fs.readdirSync(dirUpload)
        assert.deepStrictEqual(
            sesudah.filter(n => !sebelum.includes(n)),
            [],
            'berkas foto tertinggal di disk setelah penolakan'
        )
    })

    test('tanpa lokasi sama sekali tetap diterima (lokasi opsional, bukan gerbang)', async () => {
        const c = await mysql.createConnection({
            host: process.env.DB_HOST, user: process.env.DB_USER,
            password: process.env.DB_PASS, database: process.env.DB_NAME,
        })
        await c.query('DELETE FROM attendances WHERE user_id = ? AND tanggal = CURDATE()', [997])
        await c.end()

        const { status, data } = await kirimDenganFoto(
            997,
            {},
            true,
            '/api/attendances/checkin'
        )

        assert.strictEqual(status, 200)
        attendanceIdsDibuat.push(data.id)
    })

    test('dua request checkin nyaris bersamaan: tepat satu sukses, satu lagi 400 bersih (bukan 500)', async () => {
        const c = await mysql.createConnection({
            host: process.env.DB_HOST, user: process.env.DB_USER,
            password: process.env.DB_PASS, database: process.env.DB_NAME,
        })
        await c.query('DELETE FROM attendances WHERE user_id = ? AND tanggal = CURDATE()', [996])
        await c.end()

        const [hasil1, hasil2] = await Promise.all([
            kirimDenganFoto(996, { latitude: '-6.2', longitude: '106.8' }, true, '/api/attendances/checkin'),
            kirimDenganFoto(996, { latitude: '-6.2', longitude: '106.8' }, true, '/api/attendances/checkin'),
        ])

        const sukses = [hasil1, hasil2].filter(h => h.status === 200)
        const ditolak = [hasil1, hasil2].filter(h => h.status === 400)

        assert.strictEqual(sukses.length, 1, 'seharusnya tepat satu yang sukses')
        assert.strictEqual(ditolak.length, 1, 'seharusnya tepat satu yang ditolak 400 (bukan 500)')

        attendanceIdsDibuat.push(sukses[0].data.id)

        const [rows] = await db.query(
            'SELECT COUNT(*) n FROM attendances WHERE user_id = ? AND tanggal = CURDATE()',
            [996]
        )
        assert.strictEqual(rows[0].n, 1)
    })

})

describe('POST /api/attendances/checkout', () => {

    const bersihkanHariIni = async (userId) => {
        const c = await mysql.createConnection({
            host: process.env.DB_HOST, user: process.env.DB_USER,
            password: process.env.DB_PASS, database: process.env.DB_NAME,
        })
        await c.query('DELETE FROM attendances WHERE user_id = ? AND tanggal = CURDATE()', [userId])
        await c.end()
    }

    test('absen pulang sebelum absen masuk ditolak 400', async () => {
        await bersihkanHariIni(995)

        const { status, data } = await kirimDenganFoto(
            995,
            {},
            true,
            '/api/attendances/checkout'
        )

        assert.strictEqual(status, 400)
        assert.match(data.message, /belum absen masuk/i)
    })

    test('absen pulang berhasil setelah absen masuk', async () => {
        await bersihkanHariIni(994)

        const masuk = await kirimDenganFoto(
            994, { latitude: '-6.2', longitude: '106.8' }, true, '/api/attendances/checkin'
        )
        assert.strictEqual(masuk.status, 200)
        attendanceIdsDibuat.push(masuk.data.id)

        const pulang = await kirimDenganFoto(
            994, { latitude: '-6.2', longitude: '106.8' }, true, '/api/attendances/checkout'
        )

        assert.strictEqual(pulang.status, 200)
        assert.ok(pulang.data.clock_out_time)
        assert.ok(pulang.data.clock_out_photo_url)
        assert.strictEqual(pulang.data.id, masuk.data.id)
    })

    test('absen pulang dobel ditolak 400', async () => {
        await bersihkanHariIni(993)

        const masuk = await kirimDenganFoto(993, {}, true, '/api/attendances/checkin')
        attendanceIdsDibuat.push(masuk.data.id)

        const pulangPertama = await kirimDenganFoto(993, {}, true, '/api/attendances/checkout')
        assert.strictEqual(pulangPertama.status, 200)

        const pulangKedua = await kirimDenganFoto(993, {}, true, '/api/attendances/checkout')
        assert.strictEqual(pulangKedua.status, 400)
        assert.match(pulangKedua.data.message, /sudah absen pulang/i)
    })

    test('absen pulang tanpa foto ditolak 400', async () => {
        await bersihkanHariIni(992)

        const masuk = await kirimDenganFoto(992, {}, true, '/api/attendances/checkin')
        attendanceIdsDibuat.push(masuk.data.id)

        const { status } = await kirimDenganFoto(992, {}, false, '/api/attendances/checkout')
        assert.strictEqual(status, 400)
    })

    test('dua pegawai berbeda absen hari yang sama tidak saling bentrok', async () => {
        await bersihkanHariIni(991)
        await bersihkanHariIni(990)

        const a = await kirimDenganFoto(991, {}, true, '/api/attendances/checkin')
        const b = await kirimDenganFoto(990, {}, true, '/api/attendances/checkin')

        assert.strictEqual(a.status, 200)
        assert.strictEqual(b.status, 200)
        assert.notStrictEqual(a.data.id, b.data.id)

        attendanceIdsDibuat.push(a.data.id, b.data.id)

        const pulangA = await kirimDenganFoto(991, {}, true, '/api/attendances/checkout')
        assert.strictEqual(pulangA.status, 200)
        assert.strictEqual(pulangA.data.id, a.data.id)

        // Milik B TIDAK ikut ter-checkout oleh request milik A.
        const [rowB] = await db.query(
            'SELECT clock_out_time FROM attendances WHERE id = ?',
            [b.data.id]
        )
        assert.strictEqual(rowB[0].clock_out_time, null)
    })

})
