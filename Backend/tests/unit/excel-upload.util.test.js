const { test, describe } = require('node:test')
const assert = require('node:assert')

const {
    isAllowedExcelName,
    normalizePrefix,
    sanitizeFileName,
    subfolderFor,
    nextAvailableName,
} = require('../../src/utils/excelUpload.util')


describe('isAllowedExcelName', () => {

    test('terima xlsx/xls/xlsm/csv, huruf besar juga', () => {
        for (const nama of ['a.xlsx', 'b.XLS', 'c.xlsm', 'd.Csv']) {
            assert.strictEqual(isAllowedExcelName(nama), true, nama)
        }
    })

    test('tolak ekstensi lain dan nama kosong', () => {
        for (const nama of ['a.pdf', 'xlsx', 'a.xlsx.exe', '', null]) {
            assert.strictEqual(isAllowedExcelName(nama), false, String(nama))
        }
    })

})


describe('normalizePrefix', () => {

    test('kosong = root bucket', () => {
        assert.strictEqual(normalizePrefix(''), '')
        assert.strictEqual(normalizePrefix('  /  '), '')
        assert.strictEqual(normalizePrefix(null), '')
    })

    test('buang slash depan, tambah slash belakang', () => {
        assert.strictEqual(normalizePrefix('/excel-upload'), 'excel-upload/')
        assert.strictEqual(normalizePrefix('data/sales/'), 'data/sales/')
    })

    test('backslash dan slash ganda dirapikan', () => {
        assert.strictEqual(normalizePrefix('data\\\\sales//excel'), 'data/sales/excel/')
    })

    test('segmen .. ditolak', () => {
        assert.strictEqual(normalizePrefix('data/../rahasia'), null)
    })

})


describe('sanitizeFileName', () => {

    test('buang path fakepath browser', () => {
        assert.strictEqual(sanitizeFileName('C:\\fakepath\\Target Sales.xlsx'), 'Target Sales.xlsx')
    })

    test('karakter aneh jadi underscore', () => {
        assert.strictEqual(sanitizeFileName('Promo#KSP&Q4?.xlsx'), 'Promo_KSP_Q4_.xlsx')
    })

    test('nama kosong / dot-file diberi awalan', () => {
        assert.strictEqual(sanitizeFileName('.xlsx'), 'file.xlsx')
        assert.strictEqual(sanitizeFileName(''), 'file')
    })

})


describe('subfolderFor', () => {

    test('YEAR_MONTH pakai bulan WIB, bukan UTC', () => {
        // 31 Okt 20:00 UTC = 1 Nov 03:00 WIB
        assert.strictEqual(subfolderFor('YEAR_MONTH', new Date('2026-10-31T20:00:00Z')), '2026/11/')
    })

    test('NONE = tanpa sub-folder', () => {
        assert.strictEqual(subfolderFor('NONE', new Date()), '')
    })

})


describe('nextAvailableName', () => {

    test('nama bebas dipakai apa adanya', () => {
        assert.strictEqual(nextAvailableName('a.xlsx', () => false), 'a.xlsx')
    })

    test('nama terpakai diberi akhiran _(n) berikutnya', () => {
        const terpakai = new Set(['a.xlsx', 'a_(2).xlsx'])
        assert.strictEqual(nextAvailableName('a.xlsx', (n) => terpakai.has(n)), 'a_(3).xlsx')
    })

})
