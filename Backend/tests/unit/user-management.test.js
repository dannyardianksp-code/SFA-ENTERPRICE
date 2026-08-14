const { test, describe } = require('node:test')
const assert = require('node:assert')

const {
    assertUserManagement,
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
        for (const role of ['SPG', 'SUPERVISOR', 'MANAGER']) {
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
            ['ADMINISTRATOR', 'MANAGER', 'SPG', 'SUPERVISOR']
        )
    })

})
