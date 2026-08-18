require('dotenv').config({ quiet: true })

const { test, describe, before, after } = require('node:test')
const assert = require('node:assert')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const mysql = require('mysql2/promise')

const BASE = process.env.TEST_BASE_URL || 'http://localhost:1000'

// User sungguhan, dipakai HANYA sebagai pemanggil — tidak pernah sebagai
// sasaran tulis. Setiap tes yang perlu menulis ke akun ADMINISTRATOR
// membuat administrator sekali pakainya sendiri dan menghapusnya lewat id
// yang ditangkap saat insert.
//
// Bukan kerapian: kalau sebuah penjaga regresi, request yang seharusnya
// ditolak akan BERHASIL. Assertion-nya gagal dengan berisik, tapi barisnya
// tidak dikembalikan siapa pun — dan akun administrator yang terlanjur
// jadi SPG tidak punya jalur pemulihan, karena reset password pun
// ADMINISTRATOR-saja. Percobaan sebelumnya menonaktifkan akun
// administrator asli lewat berkas ini, dan 401 yang dihasilkannya menjalar
// ke blok tes lain yang sedang berjalan bersamaan.
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
    //
    // Dibersihkan lewat KEDUA kunci unik, bukan hanya code: baris sisa
    // yang code-nya sudah tertimpa NULL tetap menahan email-nya, dan
    // INSERT-nya akan gagal karena kunci yang tidak ikut diperiksa.
    await db.query(
        'DELETE FROM users WHERE code = ? OR email = ?',
        [SEMENTARA.code, SEMENTARA.email]
    )

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

        // Dihapus lewat id yang ditangkap saat insert. PUT /api/users/:id
        // menulis code sebagai `code || null`, jadi baris ini bisa
        // kehilangan code-nya di jalur tertentu dan pembersihan yang
        // bergantung pada kolom itu akan meninggalkannya. Penghapusan
        // lewat kedua kunci unik tetap dijalankan sebagai jaring untuk
        // run sebelumnya yang mati sebelum id-nya tertangkap.
        if (idSementara) {
            await db.query('DELETE FROM users WHERE id = ?', [idSementara])
        }

        await db.query(
            'DELETE FROM users WHERE code = ? OR email = ?',
            [SEMENTARA.code, SEMENTARA.email]
        )

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
    const EMAIL_SELUNDUPAN = 'selundup.14082026@contoh.invalid'

    const KODE_ROLE_SALAH = 'UJI-ROLE-SALAH-14082026'
    const EMAIL_ROLE_SALAH = 'role.salah.14082026@contoh.invalid'

    const bersihkan = async () => {
        await db.query(
            `DELETE FROM users
             WHERE code IN (?, ?) OR email IN (?, ?)`,
            [
                KODE_SELUNDUPAN,
                KODE_ROLE_SALAH,
                EMAIL_SELUNDUPAN,
                EMAIL_ROLE_SALAH,
            ]
        )
    }

    // Blok ini SEBELUMNYA hanya punya after. Kalau prosesnya mati antara
    // INSERT-nya 'ADMINISTRATOR boleh membuat user' dan after itu, barisnya
    // bertahan — pembersihan di level berkas hanya menyentuh SEMENTARA.code.
    // Pada run berikutnya 'SPG tidak boleh membuat user' gagal pada
    // assertion "baris tidak boleh ada" dan 'ADMINISTRATOR boleh membuat
    // user' mendapat 500 dari unique index alih-alih 200, sehingga regresi
    // sungguhan tidak bisa dibedakan dari sisa yang basi.
    //
    // Dibersihkan lewat KEDUA kunci unik keduanya, bukan hanya code:
    // email pun punya unique index dan bisa menahan INSERT sendirian.
    before(bersihkan)

    after(bersihkan)

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
            email: EMAIL_SELUNDUPAN,
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
                email: EMAIL_SELUNDUPAN,
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
            email: EMAIL_SELUNDUPAN,
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
            email: EMAIL_ROLE_SALAH,
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

})


describe('penjaga identitas diri sendiri pada PUT /api/users/:id', () => {

    // Administrator sekali pakai, sama seperti pola di blok
    // 'gerbang pada penonaktifan akun'. Blok ini SEBELUMNYA menyasar akun
    // ADMIN sungguhan (id 2) sebagai sasaran TULIS dan hanya punya before,
    // tanpa after yang memulihkannya. Assertion-nya benar hari ini, tapi
    // kalau penjaganya regresi maka request-nya BERHASIL: User.update
    // berjalan dengan where id = 2, sehingga role administrator sungguhan
    // menjadi SPG dan code, area_id, channel_id, supervisor_id-nya
    // tertimpa NULL. Assertion-nya gagal dengan berisik, tapi tidak ada
    // yang mengembalikan barisnya.
    //
    // assertUserManagement hanya memeriksa role, jadi administrator sekali
    // pakai ini lolos gerbang yang sama persis. code dan email-nya dibuat
    // berbeda dari baris sekali pakai mana pun di berkas ini supaya tidak
    // bertabrakan di unique index.
    const ADMIN_SENDIRI = {
        code: 'UJI-AUTHZ-DIRI-14082026',
        email: 'uji.authz.diri.14082026@contoh.invalid',
        name: 'Admin Uji Penjaga Diri Sendiri',
    }

    let idAdminSendiri

    const kolomDi = async (id, kolom) => {
        const [baris] = await db.query(
            `SELECT ${kolom} AS nilai FROM users WHERE id = ?`,
            [id]
        )

        return baris[0].nilai
    }

    before(async () => {
        // Sisa dari run yang pernah mati di tengah, lewat KEDUA kunci unik.
        await db.query(
            'DELETE FROM users WHERE code = ? OR email = ?',
            [ADMIN_SENDIRI.code, ADMIN_SENDIRI.email]
        )

        const [hasil] = await db.query(
            `INSERT INTO users (code, name, email, password, role, status)
             VALUES (?, ?, ?, ?, 'ADMINISTRATOR', 'ACTIVE')`,
            [
                ADMIN_SENDIRI.code,
                ADMIN_SENDIRI.name,
                ADMIN_SENDIRI.email,
                await bcrypt.hash('RahasiaUjiAdminDiri123', 10),
            ]
        )

        idAdminSendiri = hasil.insertId
    })

    after(async () => {
        // Lewat id yang ditangkap saat insert, bukan lewat code atau
        // email: justru code dan email itulah yang diuji di blok ini, dan
        // handler PUT menulis code sebagai `code || null`. Pembersihan
        // tidak boleh bergantung pada kolom yang request di bawah bisa
        // mengubah.
        if (idAdminSendiri) {
            await db.query(
                'DELETE FROM users WHERE id = ?',
                [idAdminSendiri]
            )
        }
    })

    test('menurunkan role sendiri ditolak 400', async () => {
        const { status } = await kirim(
            'PUT',
            `/api/users/${idAdminSendiri}`,
            idAdminSendiri,
            { name: ADMIN_SENDIRI.name, role: 'SPG' }
        )

        assert.strictEqual(status, 400)
        assert.strictEqual(
            await kolomDi(idAdminSendiri, 'role'),
            'ADMINISTRATOR'
        )
    })

    // email adalah identitas login, dan handler PUT menulisnya tanpa
    // penjaga apa pun sebelum perbaikan ini — penjaga lama hanya menutup
    // role. Berurutan, tanpa balapan: administrator menurunkan
    // administrator LAIN (boleh, akun lain), lalu salah mengetik emailnya
    // sendiri sambil menyunting namanya. role dikirim tidak berubah
    // sehingga penjaga lama lolos. Dalam satu hari tokennya kedaluwarsa
    // dan tidak ada lagi administrator yang bisa login untuk mereset
    // password siapa pun.
    test('mengubah email sendiri ditolak 400', async () => {
        const { status } = await kirim(
            'PUT',
            `/api/users/${idAdminSendiri}`,
            idAdminSendiri,
            {
                name: ADMIN_SENDIRI.name,
                email: 'salah.ketik.14082026@contoh.invalid',
                role: 'ADMINISTRATOR',
                code: ADMIN_SENDIRI.code,
            }
        )

        assert.strictEqual(status, 400)

        // Diperiksa langsung ke database, bukan hanya status: handler yang
        // menulis dulu lalu menolak tetap mengunci akunnya keluar.
        assert.strictEqual(
            await kolomDi(idAdminSendiri, 'email'),
            ADMIN_SENDIRI.email,
            'email tidak boleh berubah saat ditolak'
        )
    })

    test('mengubah code sendiri ditolak 400', async () => {
        const { status } = await kirim(
            'PUT',
            `/api/users/${idAdminSendiri}`,
            idAdminSendiri,
            {
                name: ADMIN_SENDIRI.name,
                email: ADMIN_SENDIRI.email,
                role: 'ADMINISTRATOR',
                code: 'UJI-AUTHZ-DIRI-CODE-LAIN',
            }
        )

        assert.strictEqual(status, 400)
        assert.strictEqual(
            await kolomDi(idAdminSendiri, 'code'),
            ADMIN_SENDIRI.code
        )
    })

    // Form user di web mengirim kembali seluruh objeknya, jadi admin yang
    // sekadar mengubah namanya sendiri tetap ikut mengirim role, email,
    // dan code yang sama. Larangan yang membandingkan KEBERADAAN field —
    // bukan nilainya — akan mengunci admin dari mengedit namanya sendiri.
    test('mengirim role, email, dan code sendiri apa adanya sambil mengubah nama tetap boleh', async () => {
        const namaBaru = 'Admin Uji Penjaga Diri Sendiri (diubah)'

        const { status } = await kirim(
            'PUT',
            `/api/users/${idAdminSendiri}`,
            idAdminSendiri,
            {
                name: namaBaru,
                role: 'ADMINISTRATOR',
                email: ADMIN_SENDIRI.email,
                code: ADMIN_SENDIRI.code,
            }
        )

        assert.strictEqual(status, 200)

        // Namanya harus benar-benar tersimpan. Tanpa ini tesnya juga lulus
        // pada handler yang mengembalikan 200 tanpa menulis apa pun.
        assert.strictEqual(await kolomDi(idAdminSendiri, 'name'), namaBaru)

        assert.strictEqual(
            await kolomDi(idAdminSendiri, 'role'),
            'ADMINISTRATOR'
        )
        assert.strictEqual(
            await kolomDi(idAdminSendiri, 'email'),
            ADMIN_SENDIRI.email
        )
        assert.strictEqual(
            await kolomDi(idAdminSendiri, 'code'),
            ADMIN_SENDIRI.code
        )
    })

    // MySQL mengoersi '<id>abc' menjadi <id> saat dibandingkan dengan
    // kolom id, tapi Number('<id>abc') di JavaScript adalah NaN. Penjaga
    // yang membandingkan req.params.id mentah-mentah bisa dilewati hanya
    // dengan menambahkan huruf ke URL, sementara where-nya tetap menyasar
    // baris yang sama. parseId menolaknya di pemeriksaan format, sebelum
    // pembanding req.user.id maupun findByPk.
    //
    // Sasarannya administrator sekali pakai, bukan akun ADMIN sungguhan:
    // kalau parseId regresi, request ini BERHASIL dan menulis role SPG
    // plus NULL ke empat kolom lain pada baris sasarannya.
    test('id dengan akhiran huruf ditolak 400 sebelum penjaga atau where', async () => {
        const { status } = await kirim(
            'PUT',
            `/api/users/${idAdminSendiri}abc`,
            idAdminSendiri,
            { name: ADMIN_SENDIRI.name, role: 'SPG' }
        )

        assert.strictEqual(status, 400)
        assert.strictEqual(
            await kolomDi(idAdminSendiri, 'role'),
            'ADMINISTRATOR'
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

    const bersihkan = async () => {
        await db.query(
            'DELETE FROM users WHERE email = ?',
            [KODE_ORANG_ASING]
        )
    }

    // Pre-clean, bukan cuma after. Tanpa ini, satu baris sisa dari run
    // yang mati di tengah — atau dari zaman register masih ada — membuat
    // 'tidak ada baris yang tercipta dari percobaan itu' gagal dan
    // menuduh route yang sudah benar.
    before(bersihkan)

    after(bersihkan)

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


describe('lantai administrator aktif di bawah dua request bersamaan', () => {

    // DUA administrator sekali pakai, dibuat berkas ini sendiri. Akun
    // administrator sungguhan tidak boleh ikut, baik sebagai sasaran
    // maupun sebagai bagian dari skenarionya.
    const ADMIN_A = {
        code: 'UJI-AUTHZ-LANTAI-A-14082026',
        email: 'uji.authz.lantai.a.14082026@contoh.invalid',
    }

    const ADMIN_B = {
        code: 'UJI-AUTHZ-LANTAI-B-14082026',
        email: 'uji.authz.lantai.b.14082026@contoh.invalid',
    }

    let idA
    let idB

    const jumlahAdminAktif = async () => {
        const [baris] = await db.query(
            `SELECT COUNT(*) AS n FROM users
             WHERE role = 'ADMINISTRATOR' AND status = 'ACTIVE'`
        )

        return baris[0].n
    }

    const buatAdmin = async (spek) => {
        await db.query(
            'DELETE FROM users WHERE code = ? OR email = ?',
            [spek.code, spek.email]
        )

        const [hasil] = await db.query(
            `INSERT INTO users (code, name, email, password, role, status)
             VALUES (?, ?, ?, ?, 'ADMINISTRATOR', 'ACTIVE')`,
            [
                spek.code,
                'Admin Uji Lantai ' + spek.code,
                spek.email,
                await bcrypt.hash('RahasiaUjiLantai123', 10),
            ]
        )

        return hasil.insertId
    }

    before(async () => {
        idA = await buatAdmin(ADMIN_A)
        idB = await buatAdmin(ADMIN_B)
    })

    after(async () => {
        for (const id of [idA, idB]) {
            if (id) {
                await db.query('DELETE FROM users WHERE id = ?', [id])
            }
        }
    })

    // APA yang dibuktikan tes ini, dan apa yang TIDAK.
    //
    // Membuktikan: dua transaksi yang keduanya mengambil
    // SELECT ... FOR UPDATE atas himpunan administrator aktif lalu menulis
    // ke baris yang berbeda tidak saling mematikan. Kalau urutan lock-nya
    // berbeda antar handler, MySQL membatalkan salah satunya sebagai
    // deadlock dan klien melihat 500 — bukan penolakan yang rapi. Itu
    // risiko nyata yang dibawa perbaikan ini, dan hanya jalur bersamaan
    // yang bisa memperlihatkannya. Sekaligus membuktikan jalur normal
    // (menurunkan administrator LAIN saat masih ada yang lain) tetap
    // berhasil setelah dibungkus transaksi.
    //
    // TIDAK membuktikan: bahwa cabang 409-nya menyala. Lantai
    // administrator dihitung global, dan database dev selalu punya dua
    // akun administrator sungguhan, jadi jumlahnya di sini turun dari
    // empat ke dua — tidak pernah menyentuh satu. Membuat keadaan yang
    // menyalakan 409 menuntut kedua administrator sungguhan diturunkan
    // lebih dulu, yang dilarang, dan menonaktifkannya pernah membuat 401
    // menjalar ke berkas tes lain yang berjalan bersamaan. Keputusan
    // tolak/terima itu ditutup unit test atas
    // wouldRemoveLastActiveAdministrator di
    // tests/unit/user-management.test.js.
    //
    // Assertion "masih ada administrator aktif" karena itu memang lemah di
    // sini. Ia tetap ada sebagai penjaga invarian: kalau suatu saat
    // seseorang mengubah lantainya menjadi per-request lagi, tes ini tidak
    // akan menangkapnya, tapi tes yang menangkapnya harus dibangun di
    // atas assertion ini.
    test('dua administrator yang saling menurunkan role tidak berakhir deadlock', async () => {
        const sebelum = await jumlahAdminAktif()

        assert.ok(
            sebelum >= 2,
            `butuh minimal 2 administrator aktif, ada ${sebelum}`
        )

        const [a, b] = await Promise.all([
            kirim('PUT', `/api/users/${idB}`, idA, {
                name: 'B diturunkan A',
                role: 'SPG',
                code: ADMIN_B.code,
                email: ADMIN_B.email,
            }),
            kirim('PUT', `/api/users/${idA}`, idB, {
                name: 'A diturunkan B',
                role: 'SPG',
                code: ADMIN_A.code,
                email: ADMIN_A.email,
            }),
        ])

        for (const [nama, hasil] of [['A->B', a], ['B->A', b]]) {
            assert.ok(
                hasil.status < 500,
                `${nama} mengembalikan ${hasil.status}: ` +
                `deadlock atau error server, bukan penolakan yang rapi ` +
                `(${JSON.stringify(hasil.data)})`
            )

            // 200 kalau masih ada administrator lain, 409 kalau ia yang
            // terakhir. Tidak ada hasil sah yang lain.
            assert.ok(
                [200, 409].includes(hasil.status),
                `${nama} mengembalikan ${hasil.status}, ` +
                `harusnya 200 atau 409`
            )
        }

        assert.ok(
            await jumlahAdminAktif() >= 1,
            'tidak boleh ada nol administrator aktif'
        )
    })

    test('dua penonaktifan bersamaan juga tidak berakhir deadlock', async () => {
        // Dikembalikan menjadi administrator aktif lewat mysql2, karena
        // tes sebelumnya menurunkan keduanya.
        await db.query(
            `UPDATE users SET role = 'ADMINISTRATOR', status = 'ACTIVE'
             WHERE id IN (?, ?)`,
            [idA, idB]
        )

        const [a, b] = await Promise.all([
            kirim('PUT', `/api/users/${idB}/status`, idA),
            kirim('PUT', `/api/users/${idA}/status`, idB),
        ])

        for (const [nama, hasil] of [['A->B', a], ['B->A', b]]) {
            assert.ok(
                [200, 409].includes(hasil.status),
                `${nama} mengembalikan ${hasil.status}, ` +
                `harusnya 200 atau 409 (${JSON.stringify(hasil.data)})`
            )
        }

        assert.ok(
            await jumlahAdminAktif() >= 1,
            'tidak boleh ada nol administrator aktif'
        )
    })

    // Jalur normal harus tetap bekerja setelah dibungkus transaksi. Tanpa
    // ini, transaksi yang selalu rollback juga akan melewatkan tes-tes di
    // atas.
    test('menurunkan administrator lain tetap berhasil saat masih ada yang lain', async () => {
        await db.query(
            `UPDATE users SET role = 'ADMINISTRATOR', status = 'ACTIVE'
             WHERE id IN (?, ?)`,
            [idA, idB]
        )

        const { status } = await kirim('PUT', `/api/users/${idB}`, idA, {
            name: 'B diturunkan berurutan',
            role: 'SPG',
            code: ADMIN_B.code,
            email: ADMIN_B.email,
        })

        assert.strictEqual(status, 200)

        const [baris] = await db.query(
            'SELECT role FROM users WHERE id = ?',
            [idB]
        )

        assert.strictEqual(
            baris[0].role,
            'SPG',
            'transaksi harus commit, bukan diam-diam rollback'
        )
    })

})


describe('penanganan kegagalan verifikasi token', () => {

    const ambil = async (token) => {
        const res = await fetch(BASE + '/api/users', {
            headers: { Authorization: 'Bearer ' + token },
        })

        return res.status
    }

    // Dua cabang 401 yang benar-benar masalah klien.
    //
    // Cabang 500-nya — JWT_SECRET hilang atau tidak sah, yang membuat
    // jwt.verify melempar 'secretOrPublicKey must have a value' —
    // SENGAJA tidak diuji di sini. Memicunya menuntut JWT_SECRET dihapus
    // dari environment proses server, dan itu akan mematikan setiap tes
    // lain dalam run yang sama, termasuk tes ini. Ia terverifikasi lewat
    // pembacaan kode di src/middleware/auth.middleware.js.
    //
    // Yang penting justru bahwa kedua kasus di bawah TETAP 401: kalau
    // pencabangan err.name terlalu lebar, sesi yang benar-benar
    // kedaluwarsa akan menjadi 500 dan mobile tidak akan pernah meminta
    // login ulang.
    test('token cacat ditolak 401', async () => {
        assert.strictEqual(await ambil('ini-bukan-jwt'), 401)
    })

    test('token dengan tanda tangan salah ditolak 401', async () => {
        const palsu = jwt.sign(
            { id: idSementara },
            'secret-yang-bukan-milik-server'
        )

        assert.strictEqual(await ambil(palsu), 401)
    })

    test('token kedaluwarsa ditolak 401', async () => {
        const kedaluwarsa = jwt.sign(
            { id: idSementara },
            process.env.JWT_SECRET,
            { expiresIn: '-10s' }
        )

        assert.strictEqual(await ambil(kedaluwarsa), 401)
    })

})


describe('parseId di seluruh route :id', () => {

    // GET /:id dan PUT /:id/reset-password sempat meneruskan
    // req.params.id mentah-mentah ke database. Terverifikasi sebelum
    // perbaikan: GET /api/users/2abc mengembalikan baris admin id 2.
    //
    // Keduanya belum punya penjaga yang bisa dilewati, jadi ini bukan
    // celah yang bisa dieksploitasi hari ini. Tesnya ada supaya invarian
    // "penjaga dan klausa where selalu melihat nilai yang sama" berlaku
    // secara struktural, dan supaya orang yang menambahkan penjaga besok
    // tidak menghidupkan ulang celah yang baru saja ditutup.
    test('GET /api/users/<id>abc ditolak 400, bukan mengembalikan baris <id>', async () => {
        const { status } = await kirim(
            'GET',
            `/api/users/${idSementara}abc`,
            ADMIN
        )

        assert.strictEqual(status, 400)
    })

    test('GET /api/users/<id> yang sah tetap 200', async () => {
        const { status } = await kirim(
            'GET',
            `/api/users/${idSementara}`,
            ADMIN
        )

        assert.strictEqual(status, 200)
    })

    // Sasarannya user sekali pakai, BUKAN akun sungguhan: kalau parseId
    // regresi, request ini berhasil dan mereset password baris sasarannya.
    // Tidak satu pun tes boleh mengubah password user sungguhan.
    test('PUT /api/users/<id>abc/reset-password ditolak 400 tanpa mengubah password', async () => {
        const hashDi = async () => {
            const [baris] = await db.query(
                'SELECT password FROM users WHERE id = ?',
                [idSementara]
            )

            return baris[0].password
        }

        const sebelum = await hashDi()

        const { status } = await kirim(
            'PUT',
            `/api/users/${idSementara}abc/reset-password`,
            ADMIN
        )

        assert.strictEqual(status, 400)

        assert.strictEqual(
            await hashDi(),
            sebelum,
            'password berubah padahal id-nya tidak sah'
        )
    })

})


describe('validasi tipe pada POST /api/auth/login', () => {

    const login = async (email, password) => {
        const res = await fetch(BASE + '/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        })

        return { status: res.status, data: await res.json() }
    }

    // Penjaganya sempat memeriksa truthiness saja, sehingga objek lolos
    // sampai ke User.findOne dan pulang sebagai 500 — pada endpoint yang
    // bisa dipanggil tanpa autentikasi sama sekali.
    test('email berupa objek ditolak 400, bukan 500', async () => {
        const { status } = await login({ a: 1 }, 'apa saja')

        assert.strictEqual(status, 400)
    })

    // Array lebih buruk daripada 500: Sequelize mengubahnya menjadi
    // klausa IN, sehingga satu password bisa dicoba terhadap sekumpulan
    // email sekaligus tanpa error apa pun.
    test('email berupa array ditolak 400, bukan menjadi klausa IN', async () => {
        const { status } = await login(
            [SEMENTARA.email, 'lain.14082026@contoh.invalid'],
            SEMENTARA.password
        )

        assert.strictEqual(
            status,
            400,
            'array email tidak boleh diperlakukan sebagai daftar kandidat'
        )
    })

    test('password berupa objek juga ditolak 400', async () => {
        const { status } = await login(SEMENTARA.email, { a: 1 })

        assert.strictEqual(status, 400)
    })

    // Jalur normal tidak boleh rusak oleh pemeriksaan tipe: email yang
    // tidak terdaftar tetap 401 generik, bukan 400.
    test('email teks yang tidak terdaftar tetap 401 generik', async () => {
        const { status, data } = await login(
            'tidak.terdaftar.14082026@contoh.invalid',
            'apa saja'
        )

        assert.strictEqual(status, 401)
        assert.match(data.message, /Email atau password salah/i)
    })

})
