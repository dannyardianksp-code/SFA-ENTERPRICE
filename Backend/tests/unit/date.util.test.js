const { test, describe } = require('node:test')
const assert = require('node:assert')

const {
    BUSINESS_TIMEZONE,
    localDateString,
    addDaysLocal,
} = require('../../src/utils/date.util')


describe('localDateString', () => {

    test('zona bisnisnya Asia/Jakarta', () => {
        assert.strictEqual(BUSINESS_TIMEZONE, 'Asia/Jakarta')
    })

    test('siang hari UTC menghasilkan tanggal yang sama', () => {
        const siang = new Date('2026-08-10T10:00:00Z')

        assert.strictEqual(localDateString(siang), '2026-08-10')
    })

    // INI BUG YANG DIPERBAIKI. 22:00 UTC sudah 05:00 tanggal 11 di
    // Jakarta. toISOString() masih menyebutnya tanggal 10, sehingga MD
    // yang membuka aplikasi jam 6 pagi melihat kemarin + hari ini,
    // bukan hari ini + besok — justru pada jam sales mulai kerja.
    test('malam UTC sudah tanggal berikutnya di Jakarta', () => {
        const malam = new Date('2026-08-10T22:00:00Z')

        assert.strictEqual(
            malam.toISOString().split('T')[0],
            '2026-08-10',
            'pembanding: inilah yang dihasilkan cara yang salah'
        )

        assert.strictEqual(localDateString(malam), '2026-08-11')
    })

    test('tepat tengah malam Jakarta', () => {
        // 17:00 UTC = 00:00 tanggal berikutnya di Jakarta.
        const tengahMalam = new Date('2026-08-10T17:00:00Z')

        assert.strictEqual(localDateString(tengahMalam), '2026-08-11')
    })

    test('satu detik sebelum tengah malam Jakarta masih hari sebelumnya', () => {
        const hampir = new Date('2026-08-10T16:59:59Z')

        assert.strictEqual(localDateString(hampir), '2026-08-10')
    })

    test('selalu berbentuk YYYY-MM-DD dengan nol di depan', () => {
        assert.strictEqual(
            localDateString(new Date('2026-01-05T10:00:00Z')),
            '2026-01-05'
        )
    })

})


describe('addDaysLocal', () => {

    test('menambah satu hari', () => {
        const acuan = new Date('2026-08-10T10:00:00Z')

        assert.strictEqual(addDaysLocal(acuan, 1), '2026-08-11')
    })

    // Batas bulan dan tahun adalah tempat aritmetika tanggal patah.
    test('melewati batas bulan', () => {
        const acuan = new Date('2026-08-31T10:00:00Z')

        assert.strictEqual(addDaysLocal(acuan, 1), '2026-09-01')
    })

    test('melewati batas tahun', () => {
        const acuan = new Date('2026-12-31T10:00:00Z')

        assert.strictEqual(addDaysLocal(acuan, 1), '2027-01-01')
    })

    // Gabungan dua hal yang paling mudah salah: pergantian tahun DAN
    // jam malam UTC yang di Jakarta sudah tahun berikutnya.
    test('batas tahun pada jam malam UTC', () => {
        const acuan = new Date('2026-12-31T22:00:00Z')

        assert.strictEqual(localDateString(acuan), '2027-01-01')
        assert.strictEqual(addDaysLocal(acuan, 1), '2027-01-02')
    })

    test('menambah dua hari', () => {
        const acuan = new Date('2026-08-10T10:00:00Z')

        assert.strictEqual(addDaysLocal(acuan, 2), '2026-08-12')
    })

    test('tidak mengubah Date yang dikirim', () => {
        const acuan = new Date('2026-08-10T10:00:00Z')
        const sebelum = acuan.getTime()

        addDaysLocal(acuan, 5)

        assert.strictEqual(acuan.getTime(), sebelum)
    })

})
