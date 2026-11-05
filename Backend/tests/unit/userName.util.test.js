const { test, describe } = require('node:test')
const assert = require('node:assert')

const { paksaHurufBesar } = require('../../src/utils/userName.util')


describe('paksaHurufBesar', () => {

    test('huruf kecil/campur jadi semua besar', () => {
        assert.strictEqual(paksaHurufBesar('Budi Santoso'), 'BUDI SANTOSO')
        assert.strictEqual(paksaHurufBesar('budi santoso'), 'BUDI SANTOSO')
    })

    test('spasi di depan/belakang dibuang', () => {
        assert.strictEqual(paksaHurufBesar('  Budi Santoso  '), 'BUDI SANTOSO')
    })

    test('sudah huruf besar tetap apa adanya', () => {
        assert.strictEqual(paksaHurufBesar('BUDI SANTOSO'), 'BUDI SANTOSO')
    })

    test('undefined dikembalikan apa adanya -- field tidak dikirim, bukan "ubah jadi kosong"', () => {
        assert.strictEqual(paksaHurufBesar(undefined), undefined)
    })

    test('nilai bukan string (null, angka) dikembalikan apa adanya', () => {
        assert.strictEqual(paksaHurufBesar(null), null)
        assert.strictEqual(paksaHurufBesar(5), 5)
    })

})
