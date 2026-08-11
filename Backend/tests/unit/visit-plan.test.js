const { test, describe } = require('node:test')
const assert = require('node:assert')

const {
    spgDateRange,
} = require('../../src/controllers/visitPlan.controller')


describe('spgDateRange', () => {

    test('mengembalikan hari ini dan besok', () => {
        const acuan = new Date('2026-08-10T10:00:00Z')

        assert.deepStrictEqual(
            spgDateRange(acuan),
            ['2026-08-10', '2026-08-11']
        )
    })

    test('dua tanggal, bukan lebih', () => {
        assert.strictEqual(
            spgDateRange(new Date('2026-08-10T10:00:00Z')).length,
            2
        )
    })

    // Jam malam UTC sudah tanggal berikutnya di Jakarta. Ini yang
    // dulu keliru dan membuat SPG melihat rencana kemarin.
    test('jam malam UTC memakai tanggal Jakarta', () => {
        const malam = new Date('2026-08-10T22:00:00Z')

        assert.deepStrictEqual(
            spgDateRange(malam),
            ['2026-08-11', '2026-08-12']
        )
    })

    test('melewati batas bulan', () => {
        const acuan = new Date('2026-08-31T10:00:00Z')

        assert.deepStrictEqual(
            spgDateRange(acuan),
            ['2026-08-31', '2026-09-01']
        )
    })

    test('melewati batas tahun', () => {
        const acuan = new Date('2026-12-31T10:00:00Z')

        assert.deepStrictEqual(
            spgDateRange(acuan),
            ['2026-12-31', '2027-01-01']
        )
    })

})
