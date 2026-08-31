require('dotenv').config({ quiet: true })

const { test, describe, before, after } = require('node:test')
const assert = require('node:assert')
const jwt = require('jsonwebtoken')
const mysql = require('mysql2/promise')
const fs = require('fs')
const path = require('path')

const BASE = process.env.TEST_BASE_URL || 'http://localhost:1000'

let db
const attendanceIdsDibuat = []
const mulaiUji = Date.now()

// id user "sekali pakai" yang dipakai SEMUA test di bawah untuk
// mengisolasi skenario (checkin/checkout normal, tanpa foto, koordinat
// rusak, tanpa lokasi, race condition, getToday, dst) satu sama lain.
// Berkas ini SEMPAT memakai akun sungguhan (id 1 dan 34) untuk sebagian
// test -- itu berbahaya karena bisa menghapus absen sungguhan pegawai
// hari itu, jadi sekarang semua diganti fixture sintetis. Server ini
// cuma punya 11 user sungguhan (id tertinggi 38), jadi baris usernya
// sendiri harus disiapkan di sini dulu -- auth middleware memuat ulang
// user dari database tiap request, dan token untuk id yang tidak ada
// ditolak 401 sebelum sempat menyentuh controller checkin/checkout/
// getToday sama sekali.
const USER_ID_SEMENTARA = [999, 998, 997, 996, 995, 994, 993, 992, 991, 990, 989, 988, 987, 986, 985, 984]

const tokenUntuk = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '15m' })

// Lokasi sekarang wajib di checkin/checkout (lihat attendance.controller.js)
// -- dipakai di semua test yang TIDAK sedang menguji validasi lokasi itu
// sendiri, supaya tidak gagal karena alasan yang tidak relevan dengan
// yang sedang diuji.
const LOKASI_VALID = { latitude: '-6.2', longitude: '106.8', accuracy: '15' }

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
        // Bersihkan absen id fixture 987 hari ini kalau kebetulan sudah
        // ada dari pengujian manual/sesi sebelumnya -- test ini butuh
        // mulai dari kondisi "belum absen".
        const mysqlLib = require('mysql2/promise')
        const c = await mysqlLib.createConnection({
            host: process.env.DB_HOST, user: process.env.DB_USER,
            password: process.env.DB_PASS, database: process.env.DB_NAME,
        })
        await c.query(
            'DELETE FROM attendances WHERE user_id = ? AND tanggal = CURDATE()',
            [987]
        )
        await c.end()
    })

    test('absen masuk berhasil, baris tercipta dengan tanggal hari ini', async () => {
        const { status, data } = await kirimDenganFoto(
            987,
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
            984,
            { latitude: '-6.2', longitude: '106.8', accuracy: '15' },
            true,
            '/api/attendances/checkin'
        )
        assert.strictEqual(pertama.status, 200)
        attendanceIdsDibuat.push(pertama.data.id)

        const kedua = await kirimDenganFoto(
            984,
            { latitude: '-6.2', longitude: '106.8', accuracy: '15' },
            true,
            '/api/attendances/checkin'
        )

        assert.strictEqual(kedua.status, 400)
        assert.match(kedua.data.message, /sudah absen masuk/i)

        const [rows] = await db.query(
            'SELECT COUNT(*) n FROM attendances WHERE user_id = ? AND tanggal = CURDATE()',
            [984]
        )
        assert.strictEqual(rows[0].n, 1)
    })

    test('absen masuk tanpa foto ditolak 400', async () => {
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

    test('tanpa lokasi sama sekali ditolak 400 (lokasi wajib, bukan opsional)', async () => {
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

        assert.strictEqual(status, 400)
        assert.match(data.message, /lokasi wajib/i)
    })

    test('dua request checkin nyaris bersamaan: tepat satu sukses, satu lagi 400 bersih (bukan 500)', async () => {
        const c = await mysql.createConnection({
            host: process.env.DB_HOST, user: process.env.DB_USER,
            password: process.env.DB_PASS, database: process.env.DB_NAME,
        })
        await c.query('DELETE FROM attendances WHERE user_id = ? AND tanggal = CURDATE()', [996])
        await c.end()

        const [hasil1, hasil2] = await Promise.all([
            kirimDenganFoto(996, LOKASI_VALID, true, '/api/attendances/checkin'),
            kirimDenganFoto(996, LOKASI_VALID, true, '/api/attendances/checkin'),
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
            994, LOKASI_VALID, true, '/api/attendances/checkin'
        )
        assert.strictEqual(masuk.status, 200)
        attendanceIdsDibuat.push(masuk.data.id)

        const pulang = await kirimDenganFoto(
            994, LOKASI_VALID, true, '/api/attendances/checkout'
        )

        assert.strictEqual(pulang.status, 200)
        assert.ok(pulang.data.clock_out_time)
        assert.ok(pulang.data.clock_out_photo_url)
        assert.strictEqual(pulang.data.id, masuk.data.id)
    })

    test('absen pulang dobel ditolak 400', async () => {
        await bersihkanHariIni(993)

        const masuk = await kirimDenganFoto(993, LOKASI_VALID, true, '/api/attendances/checkin')
        assert.strictEqual(masuk.status, 200)
        attendanceIdsDibuat.push(masuk.data.id)

        const pulangPertama = await kirimDenganFoto(993, LOKASI_VALID, true, '/api/attendances/checkout')
        assert.strictEqual(pulangPertama.status, 200)

        // checkOut mencari attendance TERBUKA (clock_out_time null) milik
        // user ini -- begitu absen pertama sudah ditutup, tidak ada lagi
        // baris terbuka untuk dicari sama sekali, jadi pesannya "belum
        // absen masuk" (bukan "sudah absen pulang"). Pesannya kurang pas
        // untuk skenario ini, tapi tetap 400 -- tidak dalam scope
        // perubahan lokasi ini untuk membedakan pesannya lebih jauh.
        const pulangKedua = await kirimDenganFoto(993, LOKASI_VALID, true, '/api/attendances/checkout')
        assert.strictEqual(pulangKedua.status, 400)
        assert.match(pulangKedua.data.message, /belum absen masuk/i)
    })

    test('absen pulang tanpa foto ditolak 400', async () => {
        await bersihkanHariIni(992)

        const masuk = await kirimDenganFoto(992, LOKASI_VALID, true, '/api/attendances/checkin')
        assert.strictEqual(masuk.status, 200)
        attendanceIdsDibuat.push(masuk.data.id)

        const { status } = await kirimDenganFoto(992, {}, false, '/api/attendances/checkout')
        assert.strictEqual(status, 400)
    })

    test('dua pegawai berbeda absen hari yang sama tidak saling bentrok', async () => {
        await bersihkanHariIni(991)
        await bersihkanHariIni(990)

        const a = await kirimDenganFoto(991, LOKASI_VALID, true, '/api/attendances/checkin')
        const b = await kirimDenganFoto(990, LOKASI_VALID, true, '/api/attendances/checkin')

        assert.strictEqual(a.status, 200)
        assert.strictEqual(b.status, 200)
        assert.notStrictEqual(a.data.id, b.data.id)

        attendanceIdsDibuat.push(a.data.id, b.data.id)

        const pulangA = await kirimDenganFoto(991, LOKASI_VALID, true, '/api/attendances/checkout')
        assert.strictEqual(pulangA.status, 200)
        assert.strictEqual(pulangA.data.id, a.data.id)

        // Milik B TIDAK ikut ter-checkout oleh request milik A.
        const [rowB] = await db.query(
            'SELECT clock_out_time FROM attendances WHERE id = ?',
            [b.data.id]
        )
        assert.strictEqual(rowB[0].clock_out_time, null)
    })

    test('dua request checkout nyaris bersamaan: tepat satu sukses, satu lagi 400 bersih, nol berkas yatim', async () => {
        await bersihkanHariIni(986)

        const masuk = await kirimDenganFoto(986, LOKASI_VALID, true, '/api/attendances/checkin')
        assert.strictEqual(masuk.status, 200)
        attendanceIdsDibuat.push(masuk.data.id)

        const dirUpload = path.join(__dirname, '..', '..', 'uploads')
        const sebelum = fs.readdirSync(dirUpload)

        const [hasil1, hasil2] = await Promise.all([
            kirimDenganFoto(986, LOKASI_VALID, true, '/api/attendances/checkout'),
            kirimDenganFoto(986, LOKASI_VALID, true, '/api/attendances/checkout'),
        ])

        const sukses = [hasil1, hasil2].filter(h => h.status === 200)
        const ditolak = [hasil1, hasil2].filter(h => h.status === 400)

        assert.strictEqual(sukses.length, 1, 'seharusnya tepat satu yang sukses')
        assert.strictEqual(ditolak.length, 1, 'seharusnya tepat satu yang ditolak 400 (bukan 500 atau 200 keduanya)')

        // Berkas foto dari request yang DITOLAK harus ikut terhapus
        // (fs.unlinkSync di jalur affected-rows-0), jadi hanya SATU
        // berkas foto baru yang bertahan -- milik request yang sukses.
        const sesudah = fs.readdirSync(dirUpload)
        const berkasBaru = sesudah.filter(n => !sebelum.includes(n))
        assert.strictEqual(berkasBaru.length, 1, `seharusnya cuma 1 berkas baru bertahan, ada: ${JSON.stringify(berkasBaru)}`)
    })

})

describe('GET /api/attendances/today', () => {

    const bersihkanHariIni = async (userId) => {
        const c = await mysql.createConnection({
            host: process.env.DB_HOST, user: process.env.DB_USER,
            password: process.env.DB_PASS, database: process.env.DB_NAME,
        })
        await c.query('DELETE FROM attendances WHERE user_id = ? AND tanggal = CURDATE()', [userId])
        await c.end()
    }

    const get = async (userId) => {
        const res = await fetch(BASE + '/api/attendances/today', {
            headers: { Authorization: 'Bearer ' + tokenUntuk(userId) },
        })
        const text = await res.text()
        let body
        try { body = JSON.parse(text) } catch { body = text }
        return { status: res.status, body }
    }

    // getToday balikin { today, staleUnresolved } (lihat
    // attendance.controller.js), bukan `today` mentah -- test ini
    // sebelumnya masih mengasumsikan bentuk lama dan sudah lama gagal
    // diam-diam (endpoint-nya diubah bentuk di commit b92b5e7 tanpa ikut
    // memperbarui test ini). Ditemukan & dibenarkan sekalian di sini.
    test('null sebelum absen masuk', async () => {
        await bersihkanHariIni(989)

        const { status, body } = await get(989)

        assert.strictEqual(status, 200)
        assert.strictEqual(body.today, null)
        assert.strictEqual(body.staleUnresolved, null)
    })

    test('baris lengkap setelah absen masuk', async () => {
        await bersihkanHariIni(988)

        const masuk = await kirimDenganFoto(988, LOKASI_VALID, true, '/api/attendances/checkin')
        assert.strictEqual(masuk.status, 200)
        attendanceIdsDibuat.push(masuk.data.id)

        const { status, body } = await get(988)

        assert.strictEqual(status, 200)
        assert.strictEqual(body.today.id, masuk.data.id)
        assert.ok(body.today.clock_in_time)
        assert.strictEqual(body.today.clock_out_time, null)
    })

    test('setelah checkin dan checkout, GET /today menunjukkan keduanya terisi', async () => {
        await bersihkanHariIni(985)

        const masuk = await kirimDenganFoto(985, LOKASI_VALID, true, '/api/attendances/checkin')
        assert.strictEqual(masuk.status, 200)
        attendanceIdsDibuat.push(masuk.data.id)

        const pulang = await kirimDenganFoto(985, LOKASI_VALID, true, '/api/attendances/checkout')
        assert.strictEqual(pulang.status, 200)

        const { status, body } = await get(985)

        assert.strictEqual(status, 200)
        assert.ok(body.today.clock_in_time, 'clock_in_time seharusnya terisi')
        assert.ok(body.today.clock_out_time, 'clock_out_time seharusnya terisi')
    })

})
