const { test, describe } = require('node:test')
const assert = require('node:assert')

const {
    ACTIVITY_FIELD_RULES,
    validateActivityFields,
} = require('../../src/utils/activity-field-rules.util')


describe('ACTIVITY_FIELD_RULES', () => {

    test('punya tepat 11 kunci, id 1 sampai 11', () => {
        const kunci = Object.keys(ACTIVITY_FIELD_RULES)
            .map(Number)
            .sort((a, b) => a - b)

        assert.deepStrictEqual(kunci, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    })

    test('tiap aturan punya required dan optional berupa array', () => {
        for (const id of Object.keys(ACTIVITY_FIELD_RULES)) {
            const aturan = ACTIVITY_FIELD_RULES[id]

            assert.ok(Array.isArray(aturan.required), `id ${id}: required bukan array`)
            assert.ok(Array.isArray(aturan.optional), `id ${id}: optional bukan array`)
        }
    })

})


describe('validateActivityFields', () => {

    // Tipe 11 = FOTO. Wajib: photo. Opsional: notes.
    test('tipe FOTO dengan foto: valid', () => {
        assert.strictEqual(
            validateActivityFields(11, {}, true),
            null
        )
    })

    test('tipe FOTO tanpa foto: ditolak', () => {
        const hasil = validateActivityFields(11, {}, false)

        assert.ok(hasil)
        assert.match(hasil, /foto/i)
    })

    // Tipe 4 = STOCK. Wajib: product_name, qty, expired_date.
    test('tipe STOCK dengan semua field wajib: valid', () => {
        const hasil = validateActivityFields(
            4,
            { product_name: 'Kara 65ml', qty: '10', expired_date: '2026-12-01' },
            false
        )

        assert.strictEqual(hasil, null)
    })

    test('tipe STOCK tanpa qty: ditolak, pesan menyebut qty', () => {
        const hasil = validateActivityFields(
            4,
            { product_name: 'Kara 65ml', expired_date: '2026-12-01' },
            false
        )

        assert.ok(hasil)
        assert.match(hasil, /qty/i)
    })

    test('tipe STOCK dengan qty bukan angka: ditolak', () => {
        const hasil = validateActivityFields(
            4,
            { product_name: 'Kara 65ml', qty: 'abc', expired_date: '2026-12-01' },
            false
        )

        assert.ok(hasil)
    })

    test('qty negatif ditolak walau field-nya sedang opsional', () => {
        // Tipe 1 = DISPLAY SEWA. qty ada di daftar optional, bukan
        // required -- tapi kalau DIKIRIM, tetap harus valid.
        const hasil = validateActivityFields(
            1,
            { product_name: 'Kara 65ml', qty: '-5' },
            true
        )

        assert.ok(hasil)
    })

    test('qty kosong (tidak dikirim) pada tipe yang qty-nya optional: valid', () => {
        const hasil = validateActivityFields(
            1,
            { product_name: 'Kara 65ml' },
            true
        )

        assert.strictEqual(hasil, null)
    })

    test('activity_id tidak dikenal: ditolak', () => {
        const hasil = validateActivityFields(999, {}, true)

        assert.ok(hasil)
    })

    // Tipe 3 = COMPETITOR. Wajib: notes, photo.
    test('tipe COMPETITOR tanpa notes: ditolak', () => {
        const hasil = validateActivityFields(3, {}, true)

        assert.ok(hasil)
        assert.match(hasil, /notes/i)
    })

})
