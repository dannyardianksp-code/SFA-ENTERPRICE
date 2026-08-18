const { test, describe } = require('node:test')
const assert = require('node:assert')

const {
    isLockConflictError,
    applyLockWaitTimeout,
    restoreLockWaitTimeout,
    withShortLockWait,
    BATAS_TUNGGU_LOCK_DETIK,
} = require('../../src/utils/lock.util')


/**
 * Bentuk error di bawah BUKAN karangan. Keduanya direkam dari MariaDB
 * 10.6.22 lewat Sequelize 6.37.8 + mysql2 3.22.3 dengan dua transaksi
 * sungguhan yang berebut lock atas baris buangan:
 *
 *   name    : 'SequelizeDatabaseError'
 *   code    : undefined   <-- di level ATAS tidak ada
 *   errno   : undefined   <-- di level ATAS tidak ada
 *   parent  : { code: 'ER_LOCK_WAIT_TIMEOUT', errno: 1205, sqlState: 'HY000' }
 *   original: objek yang SAMA dengan parent
 *
 * Itulah sebabnya pemeriksaannya harus menembus ke parent/original.
 * Pencocokan pada err.code saja akan selalu meleset.
 */
const errorDibungkus = (code, errno, sqlState) => {

    const asli = new Error(
        code === 'ER_LOCK_DEADLOCK'
            ? 'Deadlock found when trying to get lock; try restarting transaction'
            : 'Lock wait timeout exceeded; try restarting transaction'
    )

    asli.code = code
    asli.errno = errno
    asli.sqlState = sqlState

    const bungkus = new Error(asli.message)

    bungkus.name = 'SequelizeDatabaseError'
    bungkus.parent = asli
    bungkus.original = asli

    return bungkus

}


describe('isLockConflictError mengenali kontensi lock', () => {

    test('ER_LOCK_WAIT_TIMEOUT yang dibungkus Sequelize', () => {

        const err = errorDibungkus('ER_LOCK_WAIT_TIMEOUT', 1205, 'HY000')

        // Prasyarat bentuknya, supaya tes ini gagal berisik kalau
        // suatu saat Sequelize mulai menaikkan code ke level atas dan
        // helper-nya jadi lebih longgar dari yang dibutuhkan.
        assert.strictEqual(err.code, undefined)

        assert.strictEqual(isLockConflictError(err), true)

    })

    test('ER_LOCK_DEADLOCK yang dibungkus Sequelize', () => {

        const err = errorDibungkus('ER_LOCK_DEADLOCK', 1213, '40001')

        assert.strictEqual(isLockConflictError(err), true)

    })

    test('varian angka: hanya errno 1205, tanpa code teks', () => {

        const asli = new Error('Lock wait timeout exceeded')
        asli.errno = 1205

        const bungkus = new Error(asli.message)
        bungkus.parent = asli
        bungkus.original = asli

        assert.strictEqual(isLockConflictError(bungkus), true)

    })

    test('varian angka: hanya errno 1213, tanpa code teks', () => {

        const asli = new Error('Deadlock found')
        asli.errno = 1213

        const bungkus = new Error(asli.message)
        bungkus.parent = asli
        bungkus.original = asli

        assert.strictEqual(isLockConflictError(bungkus), true)

    })

    test('angka yang justru ditaruh di code, bukan di errno', () => {

        // Driver yang berbeda menaruh angkanya di field yang berbeda.
        // Keduanya dicocokkan supaya deteksinya tidak bergantung pada
        // kebiasaan satu versi driver.
        const asli = new Error('Lock wait timeout exceeded')
        asli.code = 1205

        const bungkus = new Error(asli.message)
        bungkus.parent = asli

        assert.strictEqual(isLockConflictError(bungkus), true)

    })

    test('error mysql2 mentah yang belum dibungkus', () => {

        const asli = new Error('Deadlock found')
        asli.code = 'ER_LOCK_DEADLOCK'
        asli.errno = 1213

        assert.strictEqual(isLockConflictError(asli), true)

    })

})


describe('isLockConflictError gagal tertutup ke arah bukan-konflik', () => {

    // Arah kegagalan yang benar. Error tak dikenal yang dianggap konflik
    // lock akan dijawab "silakan coba lagi" — pemanggil mengulang, gagal
    // lagi dengan pesan yang sama, dan bug sungguhannya tidak pernah
    // terlihat sebagai 500 oleh siapa pun.

    test('error database lain (ER_DUP_ENTRY 1062) bukan konflik lock', () => {

        const err = errorDibungkus('ER_DUP_ENTRY', 1062, '23000')

        assert.strictEqual(isLockConflictError(err), false)

    })

    test('ER_NO_SUCH_TABLE bukan konflik lock', () => {

        const err = errorDibungkus('ER_NO_SUCH_TABLE', 1146, '42S02')

        assert.strictEqual(isLockConflictError(err), false)

    })

    test('Error biasa tanpa code apa pun bukan konflik lock', () => {

        assert.strictEqual(isLockConflictError(new Error('boom')), false)

    })

    test('TypeError dari bug kode sendiri bukan konflik lock', () => {

        const err = new TypeError(
            "Cannot read properties of undefined (reading 'role')"
        )

        assert.strictEqual(isLockConflictError(err), false)

    })

    test('null dan undefined tidak melempar dan bukan konflik lock', () => {

        assert.strictEqual(isLockConflictError(null), false)
        assert.strictEqual(isLockConflictError(undefined), false)

    })

    test('nilai primitif tidak melempar dan bukan konflik lock', () => {

        assert.strictEqual(isLockConflictError('ER_LOCK_DEADLOCK'), false)
        assert.strictEqual(isLockConflictError(1213), false)
        assert.strictEqual(isLockConflictError(0), false)
        assert.strictEqual(isLockConflictError(false), false)

    })

    test('pesan yang mengandung kata deadlock tapi tanpa kode ditolak', () => {

        // Deteksi berbasis kode, bukan substring pesan. Error validasi
        // yang kebetulan menyebut kata "deadlock" tidak boleh terbaca
        // sebagai kontensi lock.
        const err = new Error(
            'Deadlock found when trying to get lock; try restarting transaction'
        )

        assert.strictEqual(isLockConflictError(err), false)

    })

})


describe('applyLockWaitTimeout memakai koneksi transaksi', () => {

    const transaksiPalsu = () => {

        const tercatat = []

        const t = {
            finished: undefined,
            sequelize: {
                query: async (sql, options) => {
                    tercatat.push({ sql, options })
                },
            },
        }

        return { t, tercatat }

    }

    test('mengirim SET SESSION dengan transaksi yang sama', async () => {

        const { t, tercatat } = transaksiPalsu()

        await applyLockWaitTimeout(t)

        assert.strictEqual(tercatat.length, 1)

        assert.strictEqual(
            tercatat[0].sql,
            `SET SESSION innodb_lock_wait_timeout = ${BATAS_TUNGGU_LOCK_DETIK}`
        )

        // Inti perbaikannya: tanpa `transaction: t`, Sequelize mengambil
        // koneksi lain dari pool dan setelannya tidak berlaku untuk
        // transaksi yang sedang berjalan.
        assert.strictEqual(tercatat[0].options.transaction, t)

    })

    test('menolak nilai yang bukan bilangan bulat positif', async () => {

        const { t, tercatat } = transaksiPalsu()

        // Nilainya masuk ke SQL lewat interpolasi, jadi penolakan ini
        // yang menutup jalan penyisipan teks.
        for (const jahat of ['5; DROP TABLE users', 0, -1, 1.5, NaN, null]) {

            await assert.rejects(
                () => applyLockWaitTimeout(t, jahat),
                TypeError
            )

        }

        assert.strictEqual(tercatat.length, 0)

    })

})


describe('restoreLockWaitTimeout tidak pernah melempar', () => {

    test('memulihkan ke DEFAULT pada transaksi yang masih hidup', async () => {

        const tercatat = []

        const t = {
            finished: undefined,
            sequelize: {
                query: async (sql, options) => {
                    tercatat.push({ sql, options })
                },
            },
        }

        await restoreLockWaitTimeout(t)

        assert.strictEqual(
            tercatat[0].sql,
            'SET SESSION innodb_lock_wait_timeout = DEFAULT'
        )

        assert.strictEqual(tercatat[0].options.transaction, t)

    })

    test('melewati transaksi yang sudah ditutup tanpa mengirim query', async () => {

        // Sequelize me-rollback sendiri saat ER_LOCK_DEADLOCK dan menandai
        // finished; query apa pun setelah itu melempar error BARU yang
        // akan menimpa error lock yang sedang naik.
        const tercatat = []

        const t = {
            finished: 'rollback',
            sequelize: {
                query: async (sql) => {
                    tercatat.push(sql)
                },
            },
        }

        await restoreLockWaitTimeout(t)

        assert.deepStrictEqual(tercatat, [])

    })

    test('menelan error dari query pemulihan itu sendiri', async () => {

        const t = {
            finished: undefined,
            sequelize: {
                query: async () => {
                    throw new Error('koneksi sudah hilang')
                },
            },
        }

        // Tidak boleh melempar: dipanggil dari finally.
        await restoreLockWaitTimeout(t)

    })

    test('t kosong tidak melempar', async () => {

        await restoreLockWaitTimeout(null)
        await restoreLockWaitTimeout(undefined)

    })

})


describe('withShortLockWait memasang lalu memulihkan', () => {

    const transaksiPalsu = () => {

        const tercatat = []

        const t = {
            finished: undefined,
            sequelize: {
                query: async (sql) => {
                    tercatat.push(sql)
                },
            },
        }

        return { t, tercatat }

    }

    test('urutannya: pasang, kerja, pulihkan', async () => {

        const { t, tercatat } = transaksiPalsu()

        const hasil = await withShortLockWait(async (diberi) => {

            tercatat.push('KERJA')

            // Transaksinya diteruskan ke callback, bukan disembunyikan.
            assert.strictEqual(diberi, t)

            return { ok: true }

        })(t)

        assert.deepStrictEqual(hasil, { ok: true })

        assert.deepStrictEqual(tercatat, [
            `SET SESSION innodb_lock_wait_timeout = ${BATAS_TUNGGU_LOCK_DETIK}`,
            'KERJA',
            'SET SESSION innodb_lock_wait_timeout = DEFAULT',
        ])

    })

    test('error dari kerja naik utuh, dan pemulihan tetap jalan', async () => {

        const { t, tercatat } = transaksiPalsu()

        const meledak = errorDibungkus('ER_LOCK_DEADLOCK', 1213, '40001')

        await assert.rejects(
            () => withShortLockWait(async () => { throw meledak })(t),

            // Error ASLI, bukan error dari pemulihan. Kalau pemulihannya
            // sampai menimpa error ini, handler kehilangan satu-satunya
            // penanda bahwa yang terjadi adalah kontensi lock, dan
            // jawabannya turun jadi 500.
            (e) => {
                assert.strictEqual(e, meledak)
                assert.strictEqual(isLockConflictError(e), true)
                return true
            }
        )

        assert.strictEqual(
            tercatat[tercatat.length - 1],
            'SET SESSION innodb_lock_wait_timeout = DEFAULT'
        )

    })

    test('pemulihan yang gagal tidak menutupi error asli', async () => {

        let pertama = true

        const t = {
            finished: undefined,
            sequelize: {
                query: async () => {
                    if (pertama) {
                        pertama = false
                        return
                    }
                    throw new Error('pemulihan gagal')
                },
            },
        }

        const asli = new Error('kegagalan asli')

        await assert.rejects(
            () => withShortLockWait(async () => { throw asli })(t),
            (e) => e === asli
        )

    })

})
