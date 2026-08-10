const { test, describe } = require('node:test')
const assert = require('node:assert')

const {
    validateCreatePayload,
} = require('../../src/controllers/customer.controller')

const valid = {
    name: 'TOKO BARU JAYA',
    customer_group_id: 1,
    area_id: 1,
    channel_id: 2,
    latitude: '-6.125722840252188',
    longitude: '106.78554763944275',
    location_accuracy: 12.5,
}

const errorsFor = (patch) =>
    validateCreatePayload({ ...valid, ...patch }).errors

describe('validateCreatePayload — payload valid', () => {

    test('tanpa error', () => {
        assert.deepStrictEqual(validateCreatePayload(valid).errors, [])
    })

    test('mengembalikan nilai terparse', () => {
        const { values } = validateCreatePayload(valid)

        assert.strictEqual(values.latitude, -6.125722840252188)
        assert.strictEqual(values.longitude, 106.78554763944275)
        assert.strictEqual(values.locationAccuracy, 12.5)
        assert.strictEqual(values.name, 'TOKO BARU JAYA')
    })

    test('field opsional boleh kosong', () => {
        assert.deepStrictEqual(
            validateCreatePayload({ ...valid, address: '', owner_name: null }).errors,
            []
        )
    })

    test('name di-trim', () => {
        const { values } = validateCreatePayload({ ...valid, name: '  TOKO  ' })
        assert.strictEqual(values.name, 'TOKO')
    })

    // ?. hanya menjaga null/undefined, bukan tipe. Tanpa penjagaan
    // typeof, nilai non-string melempar TypeError yang berakhir
    // sebagai 500 opaque alih-alih 400 yang menjelaskan.
    test('field opsional bertipe non-string tidak melempar', () => {
        for (const nilai of [12345, true, {}, [], 0, false]) {
            assert.doesNotThrow(
                () => validateCreatePayload({ ...valid, address: nilai }),
                `address = ${JSON.stringify(nilai)} seharusnya tidak melempar`
            )
            assert.doesNotThrow(
                () => validateCreatePayload({ ...valid, owner_name: nilai }),
                `owner_name = ${JSON.stringify(nilai)} seharusnya tidak melempar`
            )
            assert.doesNotThrow(
                () => validateCreatePayload({ ...valid, phone: nilai }),
                `phone = ${JSON.stringify(nilai)} seharusnya tidak melempar`
            )
        }
    })

    test('field opsional bertipe non-string menjadi null', () => {
        const { values } = validateCreatePayload({ ...valid, address: 12345 })

        assert.strictEqual(values.address, null)
    })

})

describe('validateCreatePayload — field wajib', () => {

    for (const field of [
        'name', 'customer_group_id', 'area_id',
        'channel_id', 'latitude', 'longitude', 'location_accuracy',
    ]) {
        test(`${field} kosong ditolak`, () => {
            const errors = errorsFor({ [field]: undefined })
            assert.ok(errors.length > 0, `${field} kosong seharusnya ditolak`)
        })
    }

    test('name hanya spasi ditolak', () => {
        assert.ok(errorsFor({ name: '   ' }).length > 0)
    })

    test('id bukan angka ditolak', () => {
        assert.ok(errorsFor({ area_id: 'abc' }).length > 0)
    })

})

describe('validateCreatePayload — batas panjang', () => {

    // MySQL non-strict memotong diam-diam, sehingga nama toko bisa
    // tersimpan terpenggal tanpa ada yang tahu.
    test('name lebih dari 100 karakter ditolak', () => {
        assert.ok(errorsFor({ name: 'A'.repeat(101) }).length > 0)
    })

    test('name tepat 100 karakter diterima', () => {
        assert.deepStrictEqual(errorsFor({ name: 'A'.repeat(100) }), [])
    })

    test('owner_name lebih dari 100 ditolak', () => {
        assert.ok(errorsFor({ owner_name: 'A'.repeat(101) }).length > 0)
    })

    test('phone lebih dari 30 ditolak', () => {
        assert.ok(errorsFor({ phone: '0'.repeat(31) }).length > 0)
    })

})

describe('validateCreatePayload — koordinat', () => {

    test('latitude di luar rentang ditolak', () => {
        assert.ok(errorsFor({ latitude: '91' }).length > 0)
        assert.ok(errorsFor({ latitude: '-91' }).length > 0)
    })

    test('longitude di luar rentang ditolak', () => {
        assert.ok(errorsFor({ longitude: '181' }).length > 0)
    })

    test('koordinat bukan angka ditolak', () => {
        assert.ok(errorsFor({ latitude: 'abc' }).length > 0)
    })

    test('koordinat string kosong ditolak, tidak dianggap 0', () => {
        assert.ok(errorsFor({ latitude: '' }).length > 0)
    })

})

describe('validateCreatePayload — akurasi', () => {

    test('20 m diterima', () => {
        assert.deepStrictEqual(errorsFor({ location_accuracy: 20 }), [])
    })

    test('50 m diterima (batas atas toleransi)', () => {
        assert.deepStrictEqual(errorsFor({ location_accuracy: 50 }), [])
    })

    test('50.01 m ditolak', () => {
        assert.ok(errorsFor({ location_accuracy: 50.01 }).length > 0)
    })

    test('180 m ditolak', () => {
        const errors = errorsFor({ location_accuracy: 180 })
        assert.ok(errors.length > 0)
        assert.ok(errors.some(e => /akurasi/i.test(e)), 'pesan tidak menyebut akurasi')
    })

    test('akurasi negatif ditolak', () => {
        assert.ok(errorsFor({ location_accuracy: -5 }).length > 0)
    })

})
