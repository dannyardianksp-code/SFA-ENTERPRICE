const { test, describe } = require('node:test')
const assert = require('node:assert')

const {
    assertUserManagement,
    wouldRemoveLastActiveAdministrator,
    USER_MANAGER_ROLES,
    USER_ROLES,
} = require('../../src/utils/access.util')


describe('assertUserManagement', () => {

    test('ADMINISTRATOR boleh', () => {
        assert.strictEqual(
            assertUserManagement({ id: 2, role: 'ADMINISTRATOR' }),
            null
        )
    })

    test('role lain ditolak 403', () => {
        for (const role of ['MD', 'SUPERVISOR', 'MANAGER']) {
            const hasil = assertUserManagement({ id: 1, role })

            assert.ok(hasil, `${role} seharusnya ditolak`)
            assert.strictEqual(hasil.status, 403)
            assert.match(hasil.message, /administrator/i)
        }
    })

    // Gagal tertutup. User kosong TIDAK boleh diperlakukan sebagai role
    // tak terbatas.
    test('user kosong ditolak, bukan diloloskan', () => {
        for (const kosong of [null, undefined]) {
            const hasil = assertUserManagement(kosong)

            assert.ok(hasil, 'user kosong seharusnya ditolak')
            assert.strictEqual(hasil.status, 403)
        }
    })

    // Allowlist, bukan blacklist: role yang belum pernah ada pun ditolak
    // secara bawaan.
    test('role tidak dikenal ditolak', () => {
        for (const role of ['DIREKTUR', '', null, undefined, 'ADMIN']) {
            const hasil = assertUserManagement({ id: 1, role })

            assert.ok(hasil, `role ${JSON.stringify(role)} seharusnya ditolak`)
            assert.strictEqual(hasil.status, 403)
        }
    })

})


/**
 * Diuji di sini, bukan lewat e2e, dan itu keputusan sadar.
 *
 * Cabang penolakannya hanya bisa tercapai kalau jumlah administrator
 * aktif tinggal satu. Sementara itu route-nya sendiri sudah memastikan
 * pemanggilnya ADMINISTRATOR aktif dan sasarannya bukan dirinya sendiri,
 * sehingga di request yang berurutan jumlahnya SELALU minimal dua —
 * cabang 409 memang hanya terjadi saat dua request berlomba dan yang satu
 * sudah commit. Untuk membuat keadaan itu lewat HTTP, database dev harus
 * tinggal punya satu administrator aktif, artinya kedua akun
 * administrator sungguhan (id 2 dan 29) harus diturunkan lebih dulu —
 * yang dilarang.
 *
 * Jadi keputusannya diuji di sini dengan angka yang disuntikkan, dan
 * yang diuji e2e adalah transaksi serta locking read yang memasok angka
 * itu.
 */
describe('wouldRemoveLastActiveAdministrator', () => {

    const ADMIN_AKTIF = { role: 'ADMINISTRATOR', status: 'ACTIVE' }

    test('menurunkan administrator aktif terakhir ditolak', () => {
        assert.strictEqual(
            wouldRemoveLastActiveAdministrator(
                ADMIN_AKTIF,
                { role: 'MD' },
                1
            ),
            true
        )
    })

    test('menonaktifkan administrator aktif terakhir ditolak', () => {
        assert.strictEqual(
            wouldRemoveLastActiveAdministrator(
                ADMIN_AKTIF,
                { status: 'INACTIVE' },
                1
            ),
            true
        )
    })

    // Nol berarti invariannya sudah rusak sebelum request ini. Menolak
    // tetap lebih benar daripada meloloskan.
    test('jumlah nol juga ditolak, bukan diloloskan', () => {
        assert.strictEqual(
            wouldRemoveLastActiveAdministrator(
                ADMIN_AKTIF,
                { role: 'MD' },
                0
            ),
            true
        )
    })

    test('masih ada administrator lain maka diperbolehkan', () => {
        for (const jumlah of [2, 3, 11]) {
            assert.strictEqual(
                wouldRemoveLastActiveAdministrator(
                    ADMIN_AKTIF,
                    { role: 'MD' },
                    jumlah
                ),
                false,
                `jumlah ${jumlah} seharusnya diperbolehkan`
            )
        }
    })

    // Form user di web mengirim kembali seluruh objeknya. Administrator
    // terakhir yang sekadar mengubah namanya sendiri tetap ikut mengirim
    // role dan status yang sama, dan itu tidak mengurangi apa pun.
    test('mengirim role dan status yang sama tidak dihitung sebagai perubahan', () => {
        assert.strictEqual(
            wouldRemoveLastActiveAdministrator(
                ADMIN_AKTIF,
                { role: 'ADMINISTRATOR', status: 'ACTIVE' },
                1
            ),
            false
        )
    })

    // Field yang tidak dikirim tidak ditulis Sequelize, jadi ia bukan
    // perubahan. Kalau ini dianggap perubahan, administrator terakhir
    // tidak bisa lagi diedit sama sekali.
    test('perubahan kosong tidak menghitung apa pun', () => {
        assert.strictEqual(
            wouldRemoveLastActiveAdministrator(ADMIN_AKTIF, {}, 1),
            false
        )
    })

    test('sasaran yang bukan administrator aktif tidak pernah menyentuh lantai', () => {
        const bukan = [
            { role: 'MD', status: 'ACTIVE' },
            { role: 'MANAGER', status: 'ACTIVE' },
            { role: 'ADMINISTRATOR', status: 'INACTIVE' },
            { role: 'ADMINISTRATOR', status: null },
        ]

        for (const target of bukan) {
            assert.strictEqual(
                wouldRemoveLastActiveAdministrator(
                    target,
                    { role: 'MD', status: 'INACTIVE' },
                    1
                ),
                false,
                `${JSON.stringify(target)} seharusnya tidak dihitung`
            )
        }
    })

    // Sasaran yang tidak ada bukan administrator yang hilang. Handler
    // /status menjawab 404 untuk kasus ini, dan lantai administrator
    // tidak boleh mendahuluinya dengan 409 yang menyesatkan.
    test('sasaran kosong tidak dianggap menghabiskan administrator', () => {
        for (const kosong of [null, undefined]) {
            assert.strictEqual(
                wouldRemoveLastActiveAdministrator(
                    kosong,
                    { role: 'MD' },
                    1
                ),
                false
            )
        }
    })

})


describe('konstanta role', () => {

    test('USER_MANAGER_ROLES hanya ADMINISTRATOR', () => {
        assert.deepStrictEqual(USER_MANAGER_ROLES, ['ADMINISTRATOR'])
    })

    // Harus sama persis dengan enum di kolom users.role. Kalau meleset,
    // role yang sah ditolak 400 atau role yang tidak sah lolos ke MySQL
    // dan gagal sebagai 500.
    test('USER_ROLES sama dengan ENUM database', () => {
        assert.deepStrictEqual(
            [...USER_ROLES].sort(),
            ['ADMINISTRATOR', 'GENERAL MANAGER', 'MANAGER', 'MD', 'REGIONAL MANAGER', 'SUPERVISOR']
        )
    })

})
