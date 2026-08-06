const { test, describe } = require('node:test')
const assert = require('node:assert')

const {
    formatCustomerCode,
    isValidCodeSegment,
    CUSTOMER_CODE_PATTERN,
} = require('../../src/utils/customer-code.util')

const valid = {
    groupCode: 'IDM',
    areaCode: 'JKT',
    channelCode: 'MT',
    year: 26,
    sequence: 1,
}

describe('formatCustomerCode', () => {

    test('merakit kode sesuai format', () => {
        assert.strictEqual(formatCustomerCode(valid), 'IDMJKTMT-260001')
    })

    test('nomor urut di-pad 4 digit', () => {
        assert.strictEqual(
            formatCustomerCode({ ...valid, sequence: 42 }),
            'IDMJKTMT-260042'
        )
        assert.strictEqual(
            formatCustomerCode({ ...valid, sequence: 9999 }),
            'IDMJKTMT-269999'
        )
    })

    test('tahun di-pad 2 digit', () => {
        assert.strictEqual(
            formatCustomerCode({ ...valid, year: 7 }),
            'IDMJKTMT-070001'
        )
    })

    test('kode channel 3 huruf tetap jalan', () => {
        assert.strictEqual(
            formatCustomerCode({ ...valid, channelCode: 'IND' }),
            'IDMJKTIND-260001'
        )
    })

    test('hasil selalu cocok CUSTOMER_CODE_PATTERN', () => {
        const kasus = [
            valid,
            { ...valid, channelCode: 'IND' },
            { ...valid, sequence: 9999 },
            { ...valid, groupCode: 'HRH', areaCode: 'BDG', channelCode: 'GT' },
        ]

        for (const k of kasus) {
            assert.match(formatCustomerCode(k), CUSTOMER_CODE_PATTERN)
        }
    })

    // Tanda hubung di kode group akan menambah pemisah dan merusak pola,
    // sehingga pencarian nomor tertinggi ikut salah.
    test('menolak kode ber-tanda-hubung', () => {
        assert.throws(
            () => formatCustomerCode({ ...valid, groupCode: 'HARI-HARI' }),
            /hanya huruf A-Z/
        )
    })

    test('menolak kode berangka', () => {
        assert.throws(
            () => formatCustomerCode({ ...valid, areaCode: 'JK1' }),
            /hanya huruf A-Z/
        )
    })

    test('menolak kode huruf kecil', () => {
        assert.throws(
            () => formatCustomerCode({ ...valid, groupCode: 'idm' }),
            /hanya huruf A-Z/
        )
    })

    test('menolak kode kosong atau null', () => {
        assert.throws(() => formatCustomerCode({ ...valid, groupCode: '' }), /hanya huruf A-Z/)
        assert.throws(() => formatCustomerCode({ ...valid, areaCode: null }), /hanya huruf A-Z/)
    })

    test('menolak nomor urut di luar 1..9999', () => {
        assert.throws(() => formatCustomerCode({ ...valid, sequence: 0 }), /nomor urut/)
        assert.throws(() => formatCustomerCode({ ...valid, sequence: 10000 }), /nomor urut/)
        assert.throws(() => formatCustomerCode({ ...valid, sequence: 1.5 }), /nomor urut/)
    })

    test('menolak tahun di luar 0..99', () => {
        assert.throws(() => formatCustomerCode({ ...valid, year: 100 }), /tahun/)
        assert.throws(() => formatCustomerCode({ ...valid, year: -1 }), /tahun/)
    })

})

// isValidCodeSegment adalah versi TANPA-melempar dari pengecekan yang
// sama di formatCustomerCode. Dipakai controller SEBELUM loop retry,
// supaya kode tidak valid bisa dibalas 400, bukan lolos jadi Error
// yang tertangkap sebagai 500 opaque (lihat customer.controller.js).
describe('isValidCodeSegment', () => {

    test('menerima huruf A-Z murni', () => {
        assert.strictEqual(isValidCodeSegment('IDM'), true)
        assert.strictEqual(isValidCodeSegment('MT'), true)
        assert.strictEqual(isValidCodeSegment('IND'), true)
    })

    test('menolak yang mengandung angka', () => {
        assert.strictEqual(isValidCodeSegment('99'), false)
        assert.strictEqual(isValidCodeSegment('M9'), false)
        assert.strictEqual(isValidCodeSegment(123), false)
    })

    test('menolak huruf kecil', () => {
        assert.strictEqual(isValidCodeSegment('idm'), false)
    })

    test('menolak tanda hubung', () => {
        assert.strictEqual(isValidCodeSegment('HARI-HARI'), false)
    })

    test('menolak string kosong, null, dan undefined', () => {
        assert.strictEqual(isValidCodeSegment(''), false)
        assert.strictEqual(isValidCodeSegment(null), false)
        assert.strictEqual(isValidCodeSegment(undefined), false)
    })

})
