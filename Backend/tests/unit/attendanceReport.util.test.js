const { test, describe } = require('node:test')
const assert = require('node:assert')

const {
    resolveTimezoneFromUser,
    timezoneLabel,
    formatTanggalLokal,
    formatJamLokal,
    buildReportRow,
    summarize,
} = require('../../src/utils/attendanceReport.util')


describe('resolveTimezoneFromUser', () => {

    test('AssignedAreas[0] menang kalau ada', () => {
        const user = {
            AssignedAreas: [{ timezone: 'Asia/Makassar' }, { timezone: 'Asia/Jayapura' }],
            Area: { timezone: 'Asia/Jakarta' },
        }
        assert.strictEqual(resolveTimezoneFromUser(user), 'Asia/Makassar')
    })

    test('fallback ke Area (area_id legacy) kalau AssignedAreas kosong', () => {
        const user = { AssignedAreas: [], Area: { timezone: 'Asia/Jayapura' } }
        assert.strictEqual(resolveTimezoneFromUser(user), 'Asia/Jayapura')
    })

    test('default Asia/Jakarta kalau user tidak punya area sama sekali', () => {
        assert.strictEqual(resolveTimezoneFromUser({ AssignedAreas: [], Area: null }), 'Asia/Jakarta')
    })

    test('user null/undefined -> default, tidak melempar', () => {
        assert.strictEqual(resolveTimezoneFromUser(null), 'Asia/Jakarta')
        assert.strictEqual(resolveTimezoneFromUser(undefined), 'Asia/Jakarta')
    })

})


describe('timezoneLabel', () => {

    test('3 zona dikenal', () => {
        assert.strictEqual(timezoneLabel('Asia/Jakarta'), 'WIB')
        assert.strictEqual(timezoneLabel('Asia/Makassar'), 'WITA')
        assert.strictEqual(timezoneLabel('Asia/Jayapura'), 'WIT')
    })

    test('timezone tidak dikenal dibalas apa adanya', () => {
        assert.strictEqual(timezoneLabel('Asia/Singapore'), 'Asia/Singapore')
    })

})


describe('formatTanggalLokal', () => {

    test('DATEONLY tidak pernah mundur sehari di WIB/WITA/WIT (semua di depan UTC)', () => {
        // "2026-11-16" di-parse sebagai 2026-11-16T00:00:00Z
        assert.strictEqual(formatTanggalLokal('2026-11-16', 'Asia/Jakarta'), '16 Nov 2026')
        assert.strictEqual(formatTanggalLokal('2026-11-16', 'Asia/Makassar'), '16 Nov 2026')
        assert.strictEqual(formatTanggalLokal('2026-11-16', 'Asia/Jayapura'), '16 Nov 2026')
    })

    test('null/kosong -> null', () => {
        assert.strictEqual(formatTanggalLokal(null, 'Asia/Jakarta'), null)
        assert.strictEqual(formatTanggalLokal('', 'Asia/Jakarta'), null)
    })

})


describe('formatJamLokal', () => {

    test('timestamp ISO diformat ke jam:menit zona yang diberikan', () => {
        // 22:00 UTC = 05:00 keesokan hari di WIB (+7)
        assert.strictEqual(formatJamLokal('2026-11-15T22:00:00.000Z', 'Asia/Jakarta'), '05:00')
        // sama momen, WITA (+8) = 06:00
        assert.strictEqual(formatJamLokal('2026-11-15T22:00:00.000Z', 'Asia/Makassar'), '06:00')
    })

    test('null -> null (belum check-in/out)', () => {
        assert.strictEqual(formatJamLokal(null, 'Asia/Jakarta'), null)
    })

})


describe('buildReportRow', () => {

    const baseRow = {
        id: 1,
        user_id: 5,
        tanggal: '2026-11-16',
        clock_in_time: '2026-11-16T01:00:00.000Z',
        clock_in_latitude: '-6.9',
        clock_in_longitude: '107.6',
        clock_in_photo_url: '/uploads/a.jpg',
        clock_out_time: null,
        clock_out_latitude: null,
        clock_out_longitude: null,
        clock_out_photo_url: null,
    }

    test('baris belum checkout -> status BELUM_PULANG', () => {
        const hasil = buildReportRow(baseRow, { name: 'BUDI', area_name: 'Bandung' }, 'Asia/Jakarta')

        assert.strictEqual(hasil.status, 'BELUM_PULANG')
        assert.strictEqual(hasil.user_name, 'BUDI')
        assert.strictEqual(hasil.area_name, 'Bandung')
        assert.strictEqual(hasil.timezone_label, 'WIB')
        assert.strictEqual(hasil.clock_out_display, null)
        assert.strictEqual(hasil.clock_in_display, '08:00')
    })

    test('baris sudah checkout -> status LENGKAP', () => {
        const row = { ...baseRow, clock_out_time: '2026-11-16T10:00:00.000Z' }
        const hasil = buildReportRow(row, { name: 'BUDI', area_name: 'Bandung' }, 'Asia/Jakarta')

        assert.strictEqual(hasil.status, 'LENGKAP')
        assert.strictEqual(hasil.clock_out_display, '17:00')
    })

    test('userInfo kosong tidak melempar, name/area_name null', () => {
        const hasil = buildReportRow(baseRow, null, 'Asia/Jakarta')
        assert.strictEqual(hasil.user_name, null)
        assert.strictEqual(hasil.area_name, null)
    })

})


describe('summarize', () => {

    test('hitung hadir (semua baris) dan belum_pulang (status BELUM_PULANG saja)', () => {
        const rows = [
            { status: 'LENGKAP' },
            { status: 'BELUM_PULANG' },
            { status: 'LENGKAP' },
        ]

        assert.deepStrictEqual(summarize(rows), { hadir: 3, belum_pulang: 1 })
    })

    test('array kosong -> nol-nol, bukan error', () => {
        assert.deepStrictEqual(summarize([]), { hadir: 0, belum_pulang: 0 })
    })

})
