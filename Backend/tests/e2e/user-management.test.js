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


describe('gerbang role pada penulisan user', () => {

    const KODE_SELUNDUPAN = 'UJI-SELUNDUP-14082026'
    const KODE_ROLE_SALAH = 'UJI-ROLE-SALAH-14082026'

    after(async () => {
        await db.query(
            'DELETE FROM users WHERE code = ?',
            [KODE_SELUNDUPAN]
        )
        await db.query(
            'DELETE FROM users WHERE code = ?',
            [KODE_ROLE_SALAH]
        )
    })

    const adaDiDatabase = async (code) => {
        const [baris] = await db.query(
            'SELECT id FROM users WHERE code = ?',
            [code]
        )

        return baris.length > 0
    }

    const roleDi = async (id) => {
        const [baris] = await db.query(
            'SELECT role FROM users WHERE id = ?',
            [id]
        )

        return baris[0].role
    }

    test('SPG tidak boleh membuat user', async () => {
        const { status } = await kirim('POST', '/api/users', SPG, {
            code: KODE_SELUNDUPAN,
            name: 'Administrator Selundupan',
            email: 'selundup.14082026@contoh.invalid',
            password: 'apa saja',
            role: 'ADMINISTRATOR',
        })

        assert.strictEqual(status, 403)

        // Diperiksa langsung ke database. Tanpa ini, tesnya juga lulus
        // pada handler yang menyimpan barisnya lebih dulu lalu
        // mengembalikan 403.
        assert.strictEqual(
            await adaDiDatabase(KODE_SELUNDUPAN),
            false,
            'baris tidak boleh tersimpan saat ditolak'
        )
    })

    test('SPG tidak boleh menaikkan role dirinya sendiri', async () => {
        const { status } = await kirim(
            'PUT',
            `/api/users/${idSementara}`,
            idSementara,
            { name: SEMENTARA.name, role: 'ADMINISTRATOR' }
        )

        assert.strictEqual(status, 403)
        assert.strictEqual(await roleDi(idSementara), 'SPG')
    })

    // Unit test sudah membuktikan helper-nya menolak ketiga role, tapi
    // hanya e2e yang membuktikan helper itu benar-benar terpasang di
    // route ini.
    test('SUPERVISOR dan MANAGER juga ditolak', async () => {
        const SUPERVISOR = 3
        const MANAGER = 30

        for (const pemanggil of [SUPERVISOR, MANAGER]) {
            const { status } = await kirim('POST', '/api/users', pemanggil, {
                code: KODE_SELUNDUPAN,
                name: 'Administrator Selundupan',
                email: 'selundup.14082026@contoh.invalid',
                password: 'apa saja',
                role: 'ADMINISTRATOR',
            })

            assert.strictEqual(
                status,
                403,
                `user ${pemanggil} seharusnya ditolak`
            )
        }

        assert.strictEqual(await adaDiDatabase(KODE_SELUNDUPAN), false)
    })

    test('ADMINISTRATOR boleh membuat user', async () => {
        const { status } = await kirim('POST', '/api/users', ADMIN, {
            code: KODE_SELUNDUPAN,
            name: 'User Dibuat Admin',
            email: 'selundup.14082026@contoh.invalid',
            password: 'RahasiaUji123',
            role: 'SPG',
        })

        assert.strictEqual(status, 200)
        assert.strictEqual(await adaDiDatabase(KODE_SELUNDUPAN), true)
    })

    test('role tidak dikenal ditolak 400, bukan 500', async () => {
        const { status } = await kirim('POST', '/api/users', ADMIN, {
            code: KODE_ROLE_SALAH,
            name: 'Role Salah',
            email: 'role.salah.14082026@contoh.invalid',
            password: 'RahasiaUji123',
            role: 'DIREKTUR',
        })

        assert.strictEqual(status, 400)

        // Sama seperti tes penolakan role di atas: tanpa ini, tesnya
        // juga lulus pada handler yang menyimpan barisnya lebih dulu
        // baru memvalidasi role-nya.
        assert.strictEqual(await adaDiDatabase(KODE_ROLE_SALAH), false)
    })

    test('role tidak dikenal pada PUT juga ditolak 400', async () => {
        const { status } = await kirim(
            'PUT',
            `/api/users/${idSementara}`,
            ADMIN,
            { name: SEMENTARA.name, role: 'DIREKTUR' }
        )

        assert.strictEqual(status, 400)
        assert.strictEqual(await roleDi(idSementara), 'SPG')
    })

    // MySQL mengoersi '2abc' menjadi 2 saat dibandingkan dengan kolom
    // id, tapi Number('2abc') di JavaScript adalah NaN. Penjaga yang
    // membandingkan req.params.id mentah-mentah bisa dilewati hanya
    // dengan menambahkan huruf ke URL, sementara where-nya tetap
    // menyasar baris yang sama. Diperiksa langsung ke database, bukan
    // hanya status, supaya bug ini tidak bisa lolos diam-diam.
    test('id dengan akhiran huruf tidak melewati penjaga role sendiri', async () => {
        const [baris] = await db.query(
            'SELECT name FROM users WHERE id = ?',
            [ADMIN]
        )

        const { status } = await kirim(
            'PUT',
            `/api/users/${ADMIN}abc`,
            ADMIN,
            { name: baris[0].name, role: 'SPG' }
        )

        assert.strictEqual(status, 400)
        assert.strictEqual(await roleDi(ADMIN), 'ADMINISTRATOR')
    })

})


describe('administrator tidak boleh mengubah role dirinya sendiri', () => {

    const roleDi = async (id) => {
        const [baris] = await db.query(
            'SELECT role FROM users WHERE id = ?',
            [id]
        )

        return baris[0].role
    }

    let namaAsli
    let dataAsli

    before(async () => {
        const [baris] = await db.query(
            'SELECT name, code, area_id, channel_id, supervisor_id FROM users WHERE id = ?',
            [ADMIN]
        )

        namaAsli = baris[0].name

        // Handler PUT menulis area_id/channel_id/supervisor_id/code
        // sebagai `field || null` — kalau field itu tidak dikirim, kolom
        // aslinya akan ikut tertimpa NULL. Nilai-nilai ini dikirim balik
        // apa adanya supaya tes ini tidak diam-diam menghapus data akun
        // administrator sungguhan.
        dataAsli = {
            code: baris[0].code,
            area_id: baris[0].area_id,
            channel_id: baris[0].channel_id,
            supervisor_id: baris[0].supervisor_id,
        }
    })

    test('menurunkan role sendiri ditolak 400', async () => {
        const { status } = await kirim(
            'PUT',
            `/api/users/${ADMIN}`,
            ADMIN,
            { name: namaAsli, role: 'SPG' }
        )

        assert.strictEqual(status, 400)
        assert.strictEqual(await roleDi(ADMIN), 'ADMINISTRATOR')
    })

    // Form user di web mengirim kembali seluruh objeknya, jadi admin
    // yang sekadar mengubah namanya sendiri tetap ikut mengirim role
    // yang sama. Larangan yang membandingkan keberadaan field — bukan
    // nilainya — akan mengunci admin dari mengedit namanya sendiri.
    test('mengirim role yang sama sambil mengubah field lain tetap boleh', async () => {
        const { status } = await kirim(
            'PUT',
            `/api/users/${ADMIN}`,
            ADMIN,
            {
                name: namaAsli,
                role: 'ADMINISTRATOR',
                code: dataAsli.code,
                area_id: dataAsli.area_id,
                channel_id: dataAsli.channel_id,
                supervisor_id: dataAsli.supervisor_id,
            }
        )

        assert.strictEqual(status, 200)
        assert.strictEqual(await roleDi(ADMIN), 'ADMINISTRATOR')

        const [baris] = await db.query(
            'SELECT code, area_id, channel_id, supervisor_id FROM users WHERE id = ?',
            [ADMIN]
        )

        assert.deepStrictEqual(
            baris[0],
            dataAsli,
            'PUT tanpa perubahan tidak boleh menimpa kolom lain dengan NULL'
        )
    })

})


describe('gerbang pada penonaktifan akun', () => {

    // Administrator sekali pakai, dibuat khusus untuk dua tes larangan
    // diri sendiri di bawah. assertUserManagement hanya memeriksa role,
    // jadi administrator sekali pakai ini lolos gerbang yang sama persis
    // seperti akun ADMIN sungguhan — tapi kalau larangan diri sendirinya
    // pernah rusak (regresi), yang ternonaktifkan hanya baris sekali
    // pakai ini, bukan akun administrator sungguhan. ADMIN dan SPG
    // sungguhan di berkas ini hanya dipakai sebagai pemanggil baca-saja
    // pada tes lain, tidak pernah sebagai sasaran tulis.
    const ADMIN_SEMENTARA = {
        code: 'UJI-AUTHZ-STATUS-14082026',
        email: 'uji.authz.status.14082026@contoh.invalid',
    }

    let idAdminSementara

    const statusDi = async (id) => {
        const [baris] = await db.query(
            'SELECT status FROM users WHERE id = ?',
            [id]
        )

        return baris[0].status
    }

    before(async () => {
        // Sisa dari tes yang pernah mati di tengah harus dibersihkan
        // dulu, sama seperti pembersihan SEMENTARA di level berkas.
        await db.query(
            'DELETE FROM users WHERE code = ? OR email = ?',
            [ADMIN_SEMENTARA.code, ADMIN_SEMENTARA.email]
        )

        const [hasil] = await db.query(
            `INSERT INTO users (code, name, email, password, role, status)
             VALUES (?, ?, ?, ?, 'ADMINISTRATOR', 'ACTIVE')`,
            [
                ADMIN_SEMENTARA.code,
                'Admin Uji Gerbang Status',
                ADMIN_SEMENTARA.email,
                await bcrypt.hash('RahasiaUjiAdminStatus123', 10),
            ]
        )

        idAdminSementara = hasil.insertId
    })

    after(async () => {
        // Dihapus lewat id yang sudah ditangkap saat insert, bukan
        // lewat code atau email: pelajaran dari Task 5 adalah PUT bisa
        // menimpa kolom lain jadi NULL di jalur tertentu, jadi
        // pembersihan tidak boleh bergantung pada kolom itu masih utuh.
        if (idAdminSementara) {
            await db.query(
                'DELETE FROM users WHERE id = ?',
                [idAdminSementara]
            )
        }
    })

    test('SPG tidak boleh menonaktifkan siapa pun', async () => {
        const { status } = await kirim(
            'PUT',
            `/api/users/${idSementara}/status`,
            SPG
        )

        assert.strictEqual(status, 403)
        assert.strictEqual(
            await statusDi(idSementara),
            'ACTIVE',
            'status tidak boleh berubah saat ditolak'
        )
    })

    // Karena pelaku setiap perubahan selalu tetap administrator aktif,
    // jumlah administrator aktif tidak pernah bisa mencapai nol. Tanpa
    // ini, dua klik salah mengunci semua orang keluar secara permanen —
    // reset password sendiri sudah ADMINISTRATOR-saja.
    test('administrator tidak boleh menonaktifkan dirinya sendiri', async () => {
        const { status } = await kirim(
            'PUT',
            `/api/users/${idAdminSementara}/status`,
            idAdminSementara
        )

        assert.strictEqual(status, 400)
        assert.strictEqual(await statusDi(idAdminSementara), 'ACTIVE')
    })

    test('user yang tidak ada tetap 404 bagi administrator', async () => {
        const { status } = await kirim(
            'PUT',
            '/api/users/99999999/status',
            ADMIN
        )

        assert.strictEqual(status, 404)
    })

    // Pemanggil yang tidak berhak tidak perlu diberi tahu apakah id
    // targetnya ada.
    test('SPG mendapat 403, bukan 404, untuk id yang tidak ada', async () => {
        const { status } = await kirim(
            'PUT',
            '/api/users/99999999/status',
            SPG
        )

        assert.strictEqual(status, 403)
    })

    // parseId menolak '<id>abc' pada pemeriksaan format sebelum sampai
    // ke pembanding req.user.id ataupun ke findByPk sama sekali — bukan
    // pada pembanding larangan diri sendiri, seperti nama tes versi
    // sebelumnya keliru menyiratkan. Tanpa penormalan ini, Number('2abc')
    // adalah NaN (tidak pernah cocok dengan req.user.id secara
    // JavaScript) sementara MySQL tetap mengoersi '2abc' menjadi baris
    // id 2 pada WHERE id = ?, sehingga penjaga bisa dilewati sekaligus
    // barisnya tetap ter-toggle. Diperiksa langsung ke database, bukan
    // hanya status, supaya administrator sekali pakai ini tidak
    // diam-diam ikut berubah.
    test('id non-numerik ditolak sebelum lookup atau toggle apa pun', async () => {
        const { status } = await kirim(
            'PUT',
            `/api/users/${idAdminSementara}abc/status`,
            idAdminSementara
        )

        assert.strictEqual(status, 400)
        assert.strictEqual(await statusDi(idAdminSementara), 'ACTIVE')
    })

})

describe('register dihapus', () => {

    const KODE_ORANG_ASING = 'orang.asing.14082026@contoh.invalid'

    after(async () => {
        await db.query(
            'DELETE FROM users WHERE email = ?',
            [KODE_ORANG_ASING]
        )
    })

    // Endpoint ini berjalan tanpa autentikasi. Ia hanya bisa membuat
    // SPG, tapi SPG itulah satu-satunya prasyarat untuk seluruh jalur
    // eskalasi di berkas ini — rantainya jadi tidak butuh kredensial
    // apa pun.
    test('POST /api/auth/register tidak ada lagi', async () => {
        const res = await fetch(BASE + '/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Orang Asing',
                email: KODE_ORANG_ASING,
                password: 'RahasiaUji123',
            }),
        })

        assert.strictEqual(res.status, 404)
    })

    test('tidak ada baris yang tercipta dari percobaan itu', async () => {
        const [baris] = await db.query(
            'SELECT id FROM users WHERE email = ?',
            [KODE_ORANG_ASING]
        )

        assert.strictEqual(baris.length, 0)
    })

})
