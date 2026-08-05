const { test, describe } = require('node:test')
const assert = require('node:assert')

const controller =
    require('../../src/controllers/customer.controller')


/**
 * Menguji cabang validasi getNearbyCustomers TANPA database.
 *
 * Semua validasi parameter terjadi sebelum User.findByPk dipanggil,
 * jadi cabang-cabang ini bisa diuji dengan req/res palsu. Untuk
 * jalur yang menyentuh DB, lihat tests/e2e/.
 */
const makeRes = () => ({
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
})

const callNearby = async (query) => {
    const res = makeRes()

    await controller.getNearbyCustomers(
        { query, user: { id: 1 } },
        res
    )

    return res
}


describe('getNearbyCustomers - parameter wajib', () => {

    test('tanpa parameter apa pun ditolak', async () => {
        const res = await callNearby({})

        assert.strictEqual(res.statusCode, 400)
        assert.match(res.body.message, /latitude dan longitude/)
    })

    test('hanya latitude ditolak', async () => {
        const res = await callNearby({ latitude: '-6.12' })

        assert.strictEqual(res.statusCode, 400)
    })

    test('hanya longitude ditolak', async () => {
        const res = await callNearby({ longitude: '106.78' })

        assert.strictEqual(res.statusCode, 400)
    })

    test('latitude string kosong ditolak', async () => {
        const res = await callNearby({
            latitude: '',
            longitude: '106.78',
        })

        assert.strictEqual(res.statusCode, 400)
    })

    test('latitude bukan angka ditolak', async () => {
        const res = await callNearby({
            latitude: 'abc',
            longitude: '106.78',
        })

        assert.strictEqual(res.statusCode, 400)
    })

})


describe('getNearbyCustomers - rentang koordinat', () => {

    test('latitude di atas 90 ditolak', async () => {
        const res = await callNearby({
            latitude: '91',
            longitude: '106.78',
        })

        assert.strictEqual(res.statusCode, 400)
        assert.match(res.body.message, /rentang/)
    })

    test('latitude di bawah -90 ditolak', async () => {
        const res = await callNearby({
            latitude: '-91',
            longitude: '106.78',
        })

        assert.strictEqual(res.statusCode, 400)
    })

    test('longitude di atas 180 ditolak', async () => {
        const res = await callNearby({
            latitude: '-6.12',
            longitude: '181',
        })

        assert.strictEqual(res.statusCode, 400)
        assert.match(res.body.message, /rentang/)
    })

    test('longitude di bawah -180 ditolak', async () => {
        const res = await callNearby({
            latitude: '-6.12',
            longitude: '-181',
        })

        assert.strictEqual(res.statusCode, 400)
    })

})


describe('getNearbyCustomers - radius', () => {

    test('radius 0 ditolak', async () => {
        const res = await callNearby({
            latitude: '-6.12',
            longitude: '106.78',
            radius: '0',
        })

        assert.strictEqual(res.statusCode, 400)
        assert.match(res.body.message, /radius/)
    })

    test('radius negatif ditolak', async () => {
        const res = await callNearby({
            latitude: '-6.12',
            longitude: '106.78',
            radius: '-5',
        })

        assert.strictEqual(res.statusCode, 400)
    })

})


describe('getNearbyCustomers - bentuk error response', () => {

    // Mobile membaca field `message` lewat getApiErrorMessage().
    test('semua error validasi memakai key `message`', async () => {
        const kasus = [
            {},
            { latitude: '91', longitude: '106' },
            { latitude: '-6', longitude: '106', radius: '0' },
        ]

        for (const query of kasus) {
            const res = await callNearby(query)

            assert.strictEqual(
                typeof res.body.message,
                'string',
                `query ${JSON.stringify(query)} tidak menghasilkan message string`
            )
            assert.ok(!('error' in res.body))
        }
    })

})
