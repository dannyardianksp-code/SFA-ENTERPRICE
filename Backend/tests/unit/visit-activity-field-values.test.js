const { test, describe } = require('node:test')
const assert = require('node:assert')

const { validateDanSusunFieldValues } = require('../../src/controllers/visitActivity.controller')

// Menggantikan tests/unit/activity-field-rules.test.js (dihapus) --
// field activity sekarang dari database (activity_field_definitions),
// bukan hardcode ACTIVITY_FIELD_RULES, jadi field definitions di sini
// dibikin langsung sebagai fixture, bukan diimpor dari konstanta tetap.

describe('validateDanSusunFieldValues', () => {

    const fieldFoto = { id: 1, label: 'Foto', field_type: 'PHOTO', required: true }
    const fieldCatatan = { id: 2, label: 'Catatan', field_type: 'TEXT', required: false }
    const fieldNama = { id: 3, label: 'Nama Produk', field_type: 'TEXT', required: true }
    const fieldQty = { id: 4, label: 'Qty', field_type: 'NUMBER', required: true }
    const fieldTanggal = { id: 5, label: 'Tanggal Kadaluarsa', field_type: 'DATE', required: true }
    const fieldPromo = { id: 6, label: 'Jenis Promo', field_type: 'DROPDOWN', required: false, options: ['Diskon', 'Bundling'] }

    const fileFoto = (fieldId) => [{ fieldname: `photo_${fieldId}`, filename: 'abc-uji.jpg' }]

    test('PHOTO wajib dengan file: valid, field_values berisi path upload', () => {
        const hasil = validateDanSusunFieldValues([fieldFoto], {}, fileFoto(1))

        assert.strictEqual(hasil.error, undefined)
        assert.strictEqual(hasil.fieldValues[1], '/uploads/abc-uji.jpg')
    })

    test('PHOTO wajib tanpa file: ditolak', () => {
        const hasil = validateDanSusunFieldValues([fieldFoto], {}, [])

        assert.ok(hasil.error)
        assert.match(hasil.error, /foto/i)
    })

    test('PHOTO opsional tanpa file: valid, tidak ada key di field_values', () => {
        const fotoOpsional = { ...fieldFoto, required: false }
        const hasil = validateDanSusunFieldValues([fotoOpsional], {}, [])

        assert.strictEqual(hasil.error, undefined)
        assert.strictEqual(hasil.fieldValues[1], undefined)
    })

    test('file terlampir dengan fieldname salah tidak dianggap mengisi field PHOTO', () => {
        const hasil = validateDanSusunFieldValues(
            [fieldFoto],
            {},
            [{ fieldname: 'photo_999', filename: 'salah.jpg' }]
        )

        assert.ok(hasil.error)
    })

    test('TEXT wajib terisi: valid', () => {
        const hasil = validateDanSusunFieldValues(
            [fieldNama],
            { values: JSON.stringify({ 3: 'Kara 65ml' }) },
            []
        )

        assert.strictEqual(hasil.error, undefined)
        assert.strictEqual(hasil.fieldValues[3], 'Kara 65ml')
    })

    test('TEXT wajib kosong: ditolak, pesan menyebut label field', () => {
        const hasil = validateDanSusunFieldValues(
            [fieldNama],
            { values: JSON.stringify({}) },
            []
        )

        assert.ok(hasil.error)
        assert.match(hasil.error, /Nama Produk/)
    })

    test('TEXT opsional kosong: valid, tidak ada key di field_values', () => {
        const hasil = validateDanSusunFieldValues(
            [fieldCatatan],
            { values: JSON.stringify({}) },
            []
        )

        assert.strictEqual(hasil.error, undefined)
        assert.strictEqual(hasil.fieldValues[2], undefined)
    })

    test('NUMBER valid: dikonversi jadi number, bukan string', () => {
        const hasil = validateDanSusunFieldValues(
            [fieldQty],
            { values: JSON.stringify({ 4: '10' }) },
            []
        )

        assert.strictEqual(hasil.error, undefined)
        assert.strictEqual(hasil.fieldValues[4], 10)
        assert.strictEqual(typeof hasil.fieldValues[4], 'number')
    })

    test('NUMBER bukan angka: ditolak', () => {
        const hasil = validateDanSusunFieldValues(
            [fieldQty],
            { values: JSON.stringify({ 4: 'abc' }) },
            []
        )

        assert.ok(hasil.error)
        assert.match(hasil.error, /angka/i)
    })

    test('DATE disimpan apa adanya sebagai string', () => {
        const hasil = validateDanSusunFieldValues(
            [fieldTanggal],
            { values: JSON.stringify({ 5: '2026-12-01' }) },
            []
        )

        assert.strictEqual(hasil.error, undefined)
        assert.strictEqual(hasil.fieldValues[5], '2026-12-01')
    })

    test('DROPDOWN dengan pilihan valid: diterima', () => {
        const hasil = validateDanSusunFieldValues(
            [fieldPromo],
            { values: JSON.stringify({ 6: 'Diskon' }) },
            []
        )

        assert.strictEqual(hasil.error, undefined)
        assert.strictEqual(hasil.fieldValues[6], 'Diskon')
    })

    test('DROPDOWN dengan pilihan di luar options: ditolak', () => {
        const hasil = validateDanSusunFieldValues(
            [fieldPromo],
            { values: JSON.stringify({ 6: 'Bukan Pilihan' }) },
            []
        )

        assert.ok(hasil.error)
    })

    test('values berupa JSON rusak: ditolak dengan pesan jelas, bukan exception', () => {
        const hasil = validateDanSusunFieldValues(
            [fieldNama],
            { values: '{bukan json valid' },
            []
        )

        assert.ok(hasil.error)
        assert.match(hasil.error, /json/i)
    })

    test('activity dengan banyak field campuran: semua tervalidasi dan tersusun', () => {
        const hasil = validateDanSusunFieldValues(
            [fieldNama, fieldQty, fieldTanggal, fieldFoto],
            { values: JSON.stringify({ 3: 'Produk X', 4: 5, 5: '2026-01-01' }) },
            fileFoto(1)
        )

        assert.strictEqual(hasil.error, undefined)
        assert.deepStrictEqual(hasil.fieldValues, {
            3: 'Produk X',
            4: 5,
            5: '2026-01-01',
            1: '/uploads/abc-uji.jpg',
        })
    })

})
