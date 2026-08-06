const { test, describe } = require('node:test')
const assert = require('node:assert')

const {
    assertAreaChannelAccess,
} = require('../../src/utils/access.util')


describe('assertAreaChannelAccess', () => {

    const spg = {
        role: 'SPG',
        channel_id: 2,
        area_id: null,
        AssignedAreas: [{ id: 1 }, { id: 5 }],
    }

    test('SPG boleh di salah satu area yang di-assign', () => {
        assert.strictEqual(assertAreaChannelAccess(spg, 5, 2), null)
    })

    test('SPG ditolak 403 di luar area', () => {
        const hasil = assertAreaChannelAccess(spg, 9, 2)

        assert.strictEqual(hasil.status, 403)
        assert.match(hasil.message, /wilayah Anda/)
    })

    test('SPG ditolak 403 di channel lain', () => {
        const hasil = assertAreaChannelAccess(spg, 1, 7)

        assert.strictEqual(hasil.status, 403)
        assert.match(hasil.message, /jangkauan Anda/)
    })

    test('SUPERVISOR juga dibatasi', () => {
        const spv = { ...spg, role: 'SUPERVISOR' }

        assert.strictEqual(assertAreaChannelAccess(spv, 1, 2), null)
        assert.strictEqual(assertAreaChannelAccess(spv, 9, 2).status, 403)
    })

    // Nilai role yang sah di kolom users.role adalah versi panjang.
    // Model User masih menulis ADMIN/SPV dan itu usang.
    test('ADMINISTRATOR dan MANAGER tidak dibatasi', () => {
        for (const role of ['ADMINISTRATOR', 'MANAGER']) {
            const user = { role, channel_id: 99, AssignedAreas: [] }

            assert.strictEqual(
                assertAreaChannelAccess(user, 12345, 54321),
                null,
                `${role} seharusnya tidak dibatasi`
            )
        }
    })

    // JSON tidak menjamin tipe. Tanpa koersi, "5" !== 5 dan sales
    // ditolak tanpa sebab.
    test('id berupa string tetap cocok dengan id berupa angka', () => {
        assert.strictEqual(assertAreaChannelAccess(spg, '5', '2'), null)
    })

    test('fallback area_id dipakai kalau AssignedAreas kosong', () => {
        const lama = {
            role: 'SPG',
            channel_id: 2,
            area_id: 3,
            AssignedAreas: [],
        }

        assert.strictEqual(assertAreaChannelAccess(lama, 3, 2), null)
        assert.strictEqual(assertAreaChannelAccess(lama, 4, 2).status, 403)
    })

    // Gagal tertutup. User kosong TIDAK boleh diperlakukan sebagai
    // role tak terbatas.
    test('user kosong ditolak, bukan diloloskan', () => {
        for (const kosong of [null, undefined]) {
            const hasil = assertAreaChannelAccess(kosong, 1, 2)

            assert.ok(hasil, 'user kosong seharusnya ditolak')
            assert.strictEqual(hasil.status, 403)
        }
    })

})
