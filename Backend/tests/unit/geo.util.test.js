const { test, describe } = require('node:test')
const assert = require('node:assert')

const {
    parseCoordinate,
    isValidLatitude,
    isValidLongitude,
    withDistanceWithinRadius,
} = require('../../src/utils/geo.util')


describe('parseCoordinate', () => {

    test('string angka menjadi number', () => {
        assert.strictEqual(
            parseCoordinate('-6.125722840252188'),
            -6.125722840252188
        )
    })

    // Ini alasan utama helper-nya ada: Number("") === 0, sehingga
    // koordinat kosong akan terbaca sebagai titik 0,0 di Samudra
    // Atlantik dan customer-nya muncul dengan jarak ~5000 km.
    test('string kosong menjadi null, BUKAN 0', () => {
        assert.strictEqual(parseCoordinate(''), null)
    })

    test('hanya spasi menjadi null', () => {
        assert.strictEqual(parseCoordinate('   '), null)
    })

    test('null dan undefined menjadi null', () => {
        assert.strictEqual(parseCoordinate(null), null)
        assert.strictEqual(parseCoordinate(undefined), null)
    })

    test('teks non-angka menjadi null', () => {
        assert.strictEqual(parseCoordinate('abc'), null)
    })

    test('Infinity menjadi null', () => {
        assert.strictEqual(parseCoordinate('Infinity'), null)
    })

    // 0 adalah koordinat yang sah (khatulistiwa / meridian utama)
    test('angka 0 tetap 0', () => {
        assert.strictEqual(parseCoordinate('0'), 0)
    })

})


describe('validasi rentang koordinat', () => {

    test('latitude di luar -90..90 ditolak', () => {
        assert.strictEqual(isValidLatitude(91), false)
        assert.strictEqual(isValidLatitude(-91), false)
    })

    test('latitude di dalam rentang diterima', () => {
        assert.strictEqual(isValidLatitude(-6.12), true)
        assert.strictEqual(isValidLatitude(0), true)
    })

    test('longitude di luar -180..180 ditolak', () => {
        assert.strictEqual(isValidLongitude(181), false)
        assert.strictEqual(isValidLongitude(-181), false)
    })

    test('longitude di dalam rentang diterima', () => {
        assert.strictEqual(isValidLongitude(106.78), true)
    })

    test('null ditolak', () => {
        assert.strictEqual(isValidLatitude(null), false)
        assert.strictEqual(isValidLongitude(null), false)
    })

})


describe('withDistanceWithinRadius', () => {

    // Koordinat nyata supaya jaraknya bisa dicek terhadap
    // geografi sungguhan, bukan angka karangan.
    const MONAS = {
        latitude: -6.1753924,
        longitude: 106.8271528,
    }

    const customers = [
        { id: 1, name: 'MAJU JAYA',        latitude: '-6.125722840252188', longitude: '106.78554763944275' },
        { id: 2, name: 'ALFAMART DEPOK',   latitude: '-6.4025',            longitude: '106.7942' },
        { id: 3, name: 'TANPA KOORDINAT',  latitude: null,                 longitude: null },
        { id: 4, name: 'KOORDINAT KOSONG', latitude: '',                   longitude: '' },
        { id: 5, name: 'KOTA TUA',         latitude: '-6.1352',            longitude: '106.8133' },
        { id: 6, name: 'SURABAYA',         latitude: '-7.2575',            longitude: '112.7521' },
    ]

    test('hasil terurut dari terdekat', () => {
        const hasil = withDistanceWithinRadius(customers, MONAS, 50)
        const jarak = hasil.map(c => c.distance)

        assert.deepStrictEqual(
            jarak,
            [...jarak].sort((a, b) => a - b)
        )
    })

    test('customer tanpa koordinat dibuang', () => {
        const hasil = withDistanceWithinRadius(customers, MONAS, 1000)
        const ids = hasil.map(c => c.id)

        assert.ok(!ids.includes(3), 'id 3 (null) seharusnya dibuang')
        assert.ok(!ids.includes(4), 'id 4 (string kosong) seharusnya dibuang')
    })

    test('di luar radius dibuang', () => {
        const hasil = withDistanceWithinRadius(customers, MONAS, 10)
        const ids = hasil.map(c => c.id)

        assert.ok(ids.includes(5), 'KOTA TUA (~5km) harus lolos')
        assert.ok(!ids.includes(2), 'DEPOK (~25km) harus dibuang')
        assert.ok(!ids.includes(6), 'SURABAYA (~600km) harus dibuang')
    })

    test('radius lebih besar memasukkan lebih banyak', () => {
        const kecil = withDistanceWithinRadius(customers, MONAS, 10)
        const besar = withDistanceWithinRadius(customers, MONAS, 50)

        assert.ok(besar.length > kecil.length)
        assert.ok(besar.map(c => c.id).includes(2), 'DEPOK harus masuk radius 50')
    })

    test('jarak masuk akal secara geografis', () => {
        const hasil = withDistanceWithinRadius(customers, MONAS, 50)
        const kotaTua = hasil.find(c => c.id === 5)

        // Kota Tua memang sekitar 4-6 km dari Monas
        assert.ok(
            kotaTua.distance > 4 && kotaTua.distance < 6,
            `jarak Monas->Kota Tua = ${kotaTua.distance} km, di luar dugaan`
        )
    })

    test('semua hasil punya distance berupa number', () => {
        const hasil = withDistanceWithinRadius(customers, MONAS, 50)

        assert.ok(hasil.every(c => typeof c.distance === 'number'))
    })

    test('field asli customer ikut terbawa', () => {
        const hasil = withDistanceWithinRadius(customers, MONAS, 50)

        assert.ok(hasil.every(c => c.name !== undefined && c.id !== undefined))
    })

    // distance 0 itu falsy — kalau difilter dengan truthy check,
    // customer di posisi yang sama dengan user akan hilang.
    test('jarak 0 km TIDAK dibuang', () => {
        const origin = {
            latitude: -6.125722840252188,
            longitude: 106.78554763944275,
        }

        const hasil = withDistanceWithinRadius(
            [customers[0]],
            origin,
            10
        )

        assert.strictEqual(hasil.length, 1)
        assert.strictEqual(hasil[0].distance, 0)
    })

    test('list kosong menghasilkan list kosong', () => {
        assert.deepStrictEqual(
            withDistanceWithinRadius([], MONAS, 10),
            []
        )
    })

})
