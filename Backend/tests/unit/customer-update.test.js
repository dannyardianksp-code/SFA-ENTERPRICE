const { test, describe } = require('node:test')
const assert = require('node:assert')

const {
    validateUpdatePayload,
    validateLocationPayload,
    MAX_LOCATION_ACCURACY_METERS,
} = require('../../src/controllers/customer.controller')


// Customer yang tersimpan, sebagai pembanding field terkunci.
const tersimpan = {
    code: 'SWAJKTMT-260003',
    customer_group_id: 5,
    area_id: 1,
    channel_id: 2,
}


describe('validateUpdatePayload — field teks', () => {

    test('payload minimal yang sah', () => {
        const { errors, values } = validateUpdatePayload(
            { name: 'TOKO BARU' },
            tersimpan
        )

        assert.deepStrictEqual(errors, [])
        assert.strictEqual(values.name, 'TOKO BARU')
    })

    test('nama wajib diisi', () => {
        for (const name of [undefined, '', '   ']) {
            const { errors } = validateUpdatePayload({ name }, tersimpan)

            assert.ok(
                errors.some(e => /Nama toko wajib/.test(e)),
                `name=${JSON.stringify(name)} seharusnya ditolak`
            )
        }
    })

    test('nama dipangkas spasinya', () => {
        const { values } = validateUpdatePayload(
            { name: '  TOKO  ' },
            tersimpan
        )

        assert.strictEqual(values.name, 'TOKO')
    })

    test('batas panjang name, owner_name, phone', () => {
        const { errors } = validateUpdatePayload({
            name: 'A'.repeat(101),
            owner_name: 'B'.repeat(101),
            phone: '1'.repeat(31),
        }, tersimpan)

        assert.ok(errors.some(e => /Nama toko maksimal 100/.test(e)))
        assert.ok(errors.some(e => /Nama pemilik maksimal 100/.test(e)))
        assert.ok(errors.some(e => /Nomor telepon maksimal 30/.test(e)))
    })

    test('tepat di batas panjang diterima', () => {
        const { errors } = validateUpdatePayload({
            name: 'A'.repeat(100),
            owner_name: 'B'.repeat(100),
            phone: '1'.repeat(30),
        }, tersimpan)

        assert.deepStrictEqual(errors, [])
    })

    // `?.` menjaga null/undefined, BUKAN tipe. body.address?.trim()
    // melempar TypeError bila address berupa angka, dan itu jadi 500
    // tanpa penjelasan. Regresi ini pernah benar-benar terjadi.
    test('field non-string tidak melempar TypeError', () => {
        assert.doesNotThrow(() => {
            validateUpdatePayload({
                name: 'TOKO',
                address: 12345,
                owner_name: { nama: 'x' },
                phone: ['0812'],
            }, tersimpan)
        })
    })

    test('field non-string jadi null, bukan hasil String()-nya', () => {
        const { values } = validateUpdatePayload({
            name: 'TOKO',
            address: 12345,
        }, tersimpan)

        assert.strictEqual(values.address, null)
    })

    test('string kosong jadi null, bukan string kosong', () => {
        const { values } = validateUpdatePayload({
            name: 'TOKO',
            address: '   ',
            owner_name: '',
        }, tersimpan)

        assert.strictEqual(values.address, null)
        assert.strictEqual(values.ownerName, null)
    })

    // PUT berarti ganti seluruhnya. Field opsional yang tidak dikirim
    // memang dikosongkan — perilaku yang disengaja, bukan kelalaian.
    test('field opsional yang tidak dikirim jadi null', () => {
        const { values } = validateUpdatePayload(
            { name: 'TOKO' },
            tersimpan
        )

        assert.strictEqual(values.address, null)
        assert.strictEqual(values.ownerName, null)
        assert.strictEqual(values.phone, null)
    })

})


describe('validateUpdatePayload — class_id (bisa diubah, BUKAN field terkunci)', () => {

    test('tidak dikirim: jadi null, tidak error', () => {
        const { errors, values } = validateUpdatePayload({ name: 'TOKO' }, tersimpan)

        assert.deepStrictEqual(errors, [])
        assert.strictEqual(values.classId, null)
    })

    test('dikirim beda dari sebelumnya: tetap lolos (bukan LOCKED_FIELDS)', () => {
        const { errors, values } = validateUpdatePayload(
            { name: 'TOKO', class_id: 3 },
            { ...tersimpan, class_id: 1 }
        )

        assert.deepStrictEqual(errors, [])
        assert.strictEqual(values.classId, 3)
    })

})


describe('validateUpdatePayload — field terkunci', () => {

    test('tidak dikirim sama sekali: lolos', () => {
        const { errors } = validateUpdatePayload(
            { name: 'TOKO' },
            tersimpan
        )

        assert.deepStrictEqual(errors, [])
    })

    // Klien yang mengirim balik seluruh objek customer tidak dihukum.
    test('dikirim dengan nilai sama: lolos', () => {
        const { errors } = validateUpdatePayload({
            name: 'TOKO',
            code: 'SWAJKTMT-260003',
            customer_group_id: 5,
            area_id: 1,
            channel_id: 2,
        }, tersimpan)

        assert.deepStrictEqual(errors, [])
    })

    // JSON tidak menjamin tipe: "1" harus dianggap sama dengan 1.
    test('nilai sama tapi bertipe string: lolos', () => {
        const { errors } = validateUpdatePayload({
            name: 'TOKO',
            area_id: '1',
            channel_id: '2',
            customer_group_id: '5',
        }, tersimpan)

        assert.deepStrictEqual(errors, [])
    })

    test('code dengan spasi di ujung: lolos', () => {
        const { errors } = validateUpdatePayload({
            name: 'TOKO',
            code: '  SWAJKTMT-260003  ',
        }, tersimpan)

        assert.deepStrictEqual(errors, [])
    })

    test('area_id berbeda ditolak dan menyebut Area', () => {
        const { errors } = validateUpdatePayload({
            name: 'TOKO',
            area_id: 9,
        }, tersimpan)

        assert.ok(errors.some(e => /^Area tidak bisa diubah/.test(e)), errors.join(' | '))
    })

    test('channel_id berbeda ditolak dan menyebut Channel', () => {
        const { errors } = validateUpdatePayload({
            name: 'TOKO',
            channel_id: 9,
        }, tersimpan)

        assert.ok(errors.some(e => /^Channel tidak bisa diubah/.test(e)), errors.join(' | '))
    })

    test('customer_group_id berbeda ditolak', () => {
        const { errors } = validateUpdatePayload({
            name: 'TOKO',
            customer_group_id: 9,
        }, tersimpan)

        assert.ok(errors.some(e => /^Customer group tidak bisa diubah/.test(e)), errors.join(' | '))
    })

    test('code berbeda ditolak', () => {
        const { errors } = validateUpdatePayload({
            name: 'TOKO',
            code: 'PALSU-260099',
        }, tersimpan)

        assert.ok(errors.some(e => /^Kode customer tidak bisa diubah/.test(e)), errors.join(' | '))
    })

})


describe('validateLocationPayload', () => {

    const sah = {
        latitude: '-6.200000',
        longitude: '106.816666',
        location_accuracy: 8,
    }

    test('payload sah', () => {
        const { errors, values } = validateLocationPayload(sah)

        assert.deepStrictEqual(errors, [])
        assert.strictEqual(values.latitude, -6.2)
        assert.strictEqual(values.longitude, 106.816666)
        assert.strictEqual(values.locationAccuracy, 8)
    })

    // Number("") === 0. Koordinat kosong pernah terbaca sebagai titik
    // 0°,0° di Samudra Atlantik.
    test('koordinat kosong ditolak, bukan dianggap 0', () => {
        for (const kosong of ['', '   ', null, undefined]) {
            const { errors } = validateLocationPayload({
                ...sah,
                latitude: kosong,
            })

            assert.ok(
                errors.some(e => /Koordinat lokasi tidak valid/.test(e)),
                `latitude=${JSON.stringify(kosong)} seharusnya ditolak`
            )
        }
    })

    test('koordinat di luar rentang ditolak', () => {
        const kasus = [
            { latitude: '91', longitude: '106' },
            { latitude: '-91', longitude: '106' },
            { latitude: '-6', longitude: '181' },
            { latitude: '-6', longitude: '-181' },
        ]

        for (const k of kasus) {
            const { errors } = validateLocationPayload({ ...sah, ...k })

            assert.ok(
                errors.some(e => /Koordinat lokasi tidak valid/.test(e)),
                `${JSON.stringify(k)} seharusnya ditolak`
            )
        }
    })

    test('akurasi wajib dikirim', () => {
        const { location_accuracy, ...tanpaAkurasi } = sah
        const { errors } = validateLocationPayload(tanpaAkurasi)

        assert.ok(errors.some(e => /Akurasi lokasi wajib/.test(e)))
    })

    test('akurasi negatif ditolak', () => {
        const { errors } = validateLocationPayload({
            ...sah,
            location_accuracy: -1,
        })

        assert.ok(errors.some(e => /Akurasi lokasi tidak valid/.test(e)))
    })

    test('akurasi tepat di batas diterima', () => {
        const { errors } = validateLocationPayload({
            ...sah,
            location_accuracy: MAX_LOCATION_ACCURACY_METERS,
        })

        assert.deepStrictEqual(errors, [])
    })

    test('akurasi satu meter di atas batas ditolak', () => {
        const { errors } = validateLocationPayload({
            ...sah,
            location_accuracy: MAX_LOCATION_ACCURACY_METERS + 1,
        })

        assert.ok(errors.some(e => /terlalu rendah/.test(e)), errors.join(' | '))
    })

    // Akurasi datang sebagai string dari DECIMAL(7,2) maupun dari JSON.
    test('akurasi berupa string tetap dibaca sebagai angka', () => {
        const { errors, values } = validateLocationPayload({
            ...sah,
            location_accuracy: '12.50',
        })

        assert.deepStrictEqual(errors, [])
        assert.strictEqual(values.locationAccuracy, 12.5)
    })

    test('tidak menyentuh field teks sama sekali', () => {
        const { values } = validateLocationPayload({
            ...sah,
            name: 'TOKO',
            address: 'ALAMAT',
        })

        assert.deepStrictEqual(
            Object.keys(values).sort(),
            ['latitude', 'locationAccuracy', 'longitude']
        )
    })

})
