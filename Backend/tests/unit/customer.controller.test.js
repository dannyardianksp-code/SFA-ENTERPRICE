const { test, describe } = require('node:test')
const assert = require('node:assert')

const controller =
    require('../../src/controllers/customer.controller')

const User = require('../../src/models/user.model')
const Area = require('../../src/models/area.model')
const Channel = require('../../src/models/channel.model')
const CustomerGroup = require('../../src/models/customerGroup.model')
const Customer = require('../../src/models/customer.model')
const db = require('../../src/config/database')


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


/**
 * exports.create — cabang catch-and-retry saat unique index menabrak.
 *
 * Pendekatan "insert manual lalu POST sungguhan" TIDAK bisa memaksa
 * tabrakan nyata: nextSequenceForYear di-query ulang di awal SETIAP
 * percobaan, jadi baris yang disisipkan sebelum request dikirim sudah
 * ikut terhitung pada percobaan pertama dan tidak pernah menabrak
 * unique index (dibuktikan lewat reproduksi manual — lihat laporan
 * Task 5, "Fix round 1"). Race sungguhan hanya terjadi kalau baris lain
 * masuk PERSIS di antara SELECT MAX dan INSERT satu request yang sama,
 * yang tidak bisa dipicu deterministik lewat HTTP end-to-end.
 *
 * Jadi cabang ini diuji di sini dengan monkey-patch: `Customer.create`
 * dibuat gagal sekali dengan error bernama persis
 * `SequelizeUniqueConstraintError`, lalu dipulihkan sebelum test
 * berikutnya. Kalau ejaan nama errornya salah, atau nomor urut tidak
 * dihitung ulang di setiap percobaan, tes ini gagal.
 */
describe('exports.create — retry saat unique index menabrak', () => {

    test('percobaan pertama gagal unique, kedua berhasil dengan kode berbeda', async () => {

        const original = {
            userFindByPk: User.findByPk,
            groupFindByPk: CustomerGroup.findByPk,
            areaFindByPk: Area.findByPk,
            channelFindByPk: Channel.findByPk,
            customerCreate: Customer.create,
            customerFindByPk: Customer.findByPk,
            dbQuery: db.query,
        }

        const createCalls = []
        let dbQueryCallCount = 0

        try {

            // Role di luar ['SPG', 'SUPERVISOR'] supaya cabang pembatasan
            // area/channel dilewati — bukan itu yang sedang diuji di sini.
            User.findByPk = async () => ({
                id: 1,
                role: 'ADMIN',
                channel_id: null,
                AssignedAreas: [],
            })

            CustomerGroup.findByPk = async () => ({ id: 1, code: 'IDM', name: 'Grup Uji' })
            Area.findByPk = async () => ({ id: 1, code: 'JKT', name: 'Area Uji' })
            Channel.findByPk = async () => ({ id: 1, code: 'MT', name: 'Channel Uji' })

            // Mensimulasikan baris lain yang "masuk" tepat di antara
            // percobaan: MAX naik satu setiap kali nextSequenceForYear
            // dipanggil ulang, persis seperti query nyata akan melihat
            // baris baru pada percobaan berikutnya.
            db.query = async () => {
                dbQueryCallCount += 1
                return [{ maxSeq: 5 + (dbQueryCallCount - 1) }]
            }

            Customer.create = async (payload) => {
                createCalls.push(payload.code)

                if (createCalls.length === 1) {
                    const err = new Error('Duplicate entry for key uq_customers_code')
                    err.name = 'SequelizeUniqueConstraintError'
                    throw err
                }

                return { id: 999, ...payload }
            }

            Customer.findByPk = async (id) => ({
                id,
                code: createCalls[createCalls.length - 1],
                Area: { id: 1, code: 'JKT', name: 'Area Uji' },
                Channel: { id: 1, code: 'MT', name: 'Channel Uji' },
                CustomerGroup: { id: 1, code: 'IDM', name: 'Grup Uji' },
            })

            const res = makeRes()

            await controller.create(
                {
                    user: { id: 1 },
                    body: {
                        name: 'Toko Uji Retry',
                        customer_group_id: 1,
                        area_id: 1,
                        channel_id: 1,
                        latitude: '-6.2',
                        longitude: '106.8',
                        location_accuracy: 10,
                    },
                },
                res
            )

            assert.strictEqual(res.statusCode, 201, JSON.stringify(res.body))
            assert.strictEqual(
                createCalls.length,
                2,
                'Customer.create harusnya dipanggil tepat 2x (gagal lalu berhasil)'
            )
            assert.notStrictEqual(
                createCalls[0],
                createCalls[1],
                'kode percobaan kedua harus beda — nomor urut wajib dihitung ulang, bukan diulang mentah-mentah'
            )

            const seq = (code) => Number(code.split('-')[1].slice(2))
            assert.strictEqual(
                seq(createCalls[1]),
                seq(createCalls[0]) + 1,
                'nomor urut percobaan kedua harus naik satu dari percobaan pertama'
            )

        } finally {

            User.findByPk = original.userFindByPk
            CustomerGroup.findByPk = original.groupFindByPk
            Area.findByPk = original.areaFindByPk
            Channel.findByPk = original.channelFindByPk
            Customer.create = original.customerCreate
            Customer.findByPk = original.customerFindByPk
            db.query = original.dbQuery

        }

    })

    test('error selain SequelizeUniqueConstraintError langsung dilempar, tidak diulang', async () => {

        const original = {
            userFindByPk: User.findByPk,
            groupFindByPk: CustomerGroup.findByPk,
            areaFindByPk: Area.findByPk,
            channelFindByPk: Channel.findByPk,
            customerCreate: Customer.create,
            dbQuery: db.query,
        }

        let createCallCount = 0

        try {

            User.findByPk = async () => ({
                id: 1,
                role: 'ADMIN',
                channel_id: null,
                AssignedAreas: [],
            })

            CustomerGroup.findByPk = async () => ({ id: 1, code: 'IDM', name: 'Grup Uji' })
            Area.findByPk = async () => ({ id: 1, code: 'JKT', name: 'Area Uji' })
            Channel.findByPk = async () => ({ id: 1, code: 'MT', name: 'Channel Uji' })

            db.query = async () => [{ maxSeq: 5 }]

            Customer.create = async () => {
                createCallCount += 1
                const err = new Error('Koneksi database terputus')
                err.name = 'SequelizeConnectionError'
                throw err
            }

            const res = makeRes()

            await controller.create(
                {
                    user: { id: 1 },
                    body: {
                        name: 'Toko Uji Error Lain',
                        customer_group_id: 1,
                        area_id: 1,
                        channel_id: 1,
                        latitude: '-6.2',
                        longitude: '106.8',
                        location_accuracy: 10,
                    },
                },
                res
            )

            assert.strictEqual(res.statusCode, 500)
            assert.strictEqual(
                createCallCount,
                1,
                'error selain unique constraint tidak boleh memicu retry'
            )

        } finally {

            User.findByPk = original.userFindByPk
            CustomerGroup.findByPk = original.groupFindByPk
            Area.findByPk = original.areaFindByPk
            Channel.findByPk = original.channelFindByPk
            Customer.create = original.customerCreate
            db.query = original.dbQuery

        }

    })

})
