require('dotenv').config({ quiet: true })

const { test, describe, before, after } = require('node:test')
const assert = require('node:assert')
const jwt = require('jsonwebtoken')

const BASE = process.env.TEST_BASE_URL || 'http://localhost:1000'
const USER_ID = Number(process.env.TEST_USER_ID || 1)

const authHeader = () => ({
    Authorization: 'Bearer ' + jwt.sign(
        { id: USER_ID, role: 'SPG' },
        process.env.JWT_SECRET,
        { expiresIn: '10m' }
    ),
})

const get = async (path) => {
    const res = await fetch(BASE + path, { headers: authHeader() })
    const text = await res.text()
    let body
    try { body = JSON.parse(text) } catch { body = text }
    return { status: res.status, body }
}

const kirim = async (method, path, body) => {
    const res = await fetch(BASE + path, {
        method,
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    const text = await res.text()
    let parsed
    try { parsed = JSON.parse(text) } catch { parsed = text }
    return { status: res.status, body: parsed }
}

before(async () => {
    try {
        const res = await fetch(BASE + '/')
        assert.strictEqual(res.status, 200)
    } catch {
        throw new Error(
            `Server tidak bisa dihubungi di ${BASE}.\n` +
            `Jalankan "npm run dev" lebih dulu.`
        )
    }
})

describe('GET /api/customers/:id — field audit', () => {

    // Customer mana pun yang terlihat oleh user tes. Tidak diubah,
    // hanya dibaca.
    const idPertama = async () => {
        const res = await get('/api/customers')
        assert.strictEqual(res.status, 200)
        assert.ok(res.body.length > 0, 'user tes tidak melihat customer apa pun')
        return res.body[0].id
    }

    test('respons memuat updated_at dan updated_by', async () => {
        const res = await get('/api/customers/' + await idPertama())

        assert.strictEqual(res.status, 200)
        assert.ok('updated_at' in res.body, 'kolom updated_at belum ada')
        assert.ok('updated_by' in res.body, 'kolom updated_by belum ada')
    })

    // Customer lama belum pernah diedit, jadi UpdatedBy null — yang
    // penting key-nya ADA, supaya mobile tidak perlu menebak.
    test('respons memuat relasi UpdatedBy', async () => {
        const res = await get('/api/customers/' + await idPertama())

        assert.ok('UpdatedBy' in res.body, 'relasi UpdatedBy tidak di-include')
    })

    test('respons memuat ketiga relasi klasifikasi', async () => {
        const res = await get('/api/customers/' + await idPertama())

        assert.ok(res.body.Area, 'Area tidak di-include')
        assert.ok(res.body.Channel, 'Channel tidak di-include')
        assert.ok('CustomerGroup' in res.body, 'CustomerGroup tidak di-include')
    })

})


describe('PUT /api/customers/:id', () => {

    const dibuat = []
    let target = null

    // Tesnya MEMBUAT customer sendiri lalu mengeditnya. Tidak menyentuh
    // customer yang sudah ada — mengedit data nyata di database dev
    // sama saja merusaknya.
    before(async () => {
        const opts = (await get('/api/customers/form-options')).body

        const group = opts.customerGroups.find(g => g.code)
        assert.ok(group, 'tidak ada customer group yang punya code')
        assert.ok(opts.areas.length > 0, 'tidak ada area')
        assert.ok(opts.channels.length > 0, 'tidak ada channel')

        const res = await kirim('POST', '/api/customers', {
            name: 'TES EDIT JANGAN DIPAKAI',
            customer_group_id: group.id,
            area_id: opts.areas[0].id,
            channel_id: opts.channels[0].id,
            latitude: '-6.200000',
            longitude: '106.816666',
            location_accuracy: 5,
            address: 'ALAMAT AWAL',
            owner_name: 'PEMILIK AWAL',
            phone: '0811111111',
        })

        assert.strictEqual(res.status, 201, JSON.stringify(res.body))

        target = res.body
        dibuat.push(target.id)
    })

    after(async () => {
        if (dibuat.length === 0) return

        const mysql = require('mysql2/promise')
        const c = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
        })
        await c.query('DELETE FROM customers WHERE id IN (?)', [dibuat])
        await c.end()

        console.log(`  (bersih-bersih: ${dibuat.length} customer tes dihapus)`)
    })

    test('tanpa token ditolak 401', async () => {
        const res = await fetch(`${BASE}/api/customers/${target.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'X' }),
        })

        assert.strictEqual(res.status, 401)
    })

    test('id tidak ada ditolak 404', async () => {
        const res = await kirim('PUT', '/api/customers/99999999', {
            name: 'TOKO',
        })

        assert.strictEqual(res.status, 404)
    })

    test('nama kosong ditolak 400', async () => {
        const res = await kirim('PUT', `/api/customers/${target.id}`, {
            name: '   ',
        })

        assert.strictEqual(res.status, 400)
        assert.match(res.body.message, /Nama toko wajib/)
    })

    test('mengubah area ditolak 400', async () => {
        const res = await kirim('PUT', `/api/customers/${target.id}`, {
            name: 'TOKO',
            area_id: target.area_id + 1000,
        })

        assert.strictEqual(res.status, 400)
        assert.match(res.body.message, /Area tidak bisa diubah/)
    })

    test('mengirim area dengan nilai sama diterima', async () => {
        const res = await kirim('PUT', `/api/customers/${target.id}`, {
            name: 'TOKO NILAI SAMA',
            code: target.code,
            area_id: target.area_id,
            channel_id: target.channel_id,
            customer_group_id: target.customer_group_id,
        })

        assert.strictEqual(res.status, 200, JSON.stringify(res.body))
    })

    test('simpan berhasil dan mengembalikan nilai baru', async () => {
        const res = await kirim('PUT', `/api/customers/${target.id}`, {
            name: 'TES EDIT SUDAH BERUBAH',
            address: 'ALAMAT BARU',
            owner_name: 'PEMILIK BARU',
            phone: '0822222222',
        })

        assert.strictEqual(res.status, 200, JSON.stringify(res.body))
        assert.strictEqual(res.body.name, 'TES EDIT SUDAH BERUBAH')
        assert.strictEqual(res.body.address, 'ALAMAT BARU')
        assert.strictEqual(res.body.owner_name, 'PEMILIK BARU')
        assert.strictEqual(res.body.phone, '0822222222')
    })

    test('kode dan klasifikasi tidak berubah setelah edit', async () => {
        const res = await get(`/api/customers/${target.id}`)

        assert.strictEqual(res.body.code, target.code)
        assert.strictEqual(res.body.area_id, target.area_id)
        assert.strictEqual(res.body.channel_id, target.channel_id)
        assert.strictEqual(res.body.customer_group_id, target.customer_group_id)
    })

    test('updated_at dan updated_by terisi', async () => {
        const res = await get(`/api/customers/${target.id}`)

        assert.ok(res.body.updated_at, 'updated_at masih kosong')
        assert.strictEqual(res.body.updated_by, USER_ID)
        assert.ok(res.body.UpdatedBy, 'relasi UpdatedBy kosong')
        assert.ok(res.body.UpdatedBy.name, 'nama pengubah kosong')
        assert.strictEqual(
            res.body.UpdatedBy.password,
            undefined,
            'kolom password ikut terkirim'
        )
    })

    test('respons memuat keempat relasi', async () => {
        const res = await kirim('PUT', `/api/customers/${target.id}`, {
            name: 'TES EDIT RELASI',
        })

        assert.ok(res.body.Area, 'Area tidak ada')
        assert.ok(res.body.Channel, 'Channel tidak ada')
        assert.ok(res.body.CustomerGroup, 'CustomerGroup tidak ada')
        assert.ok(res.body.UpdatedBy, 'UpdatedBy tidak ada')
    })

    // PUT berarti ganti seluruhnya. Ini mendokumentasikan perilakunya
    // supaya tidak ada yang mengiranya bug.
    test('field opsional yang tidak dikirim dikosongkan', async () => {
        const res = await kirim('PUT', `/api/customers/${target.id}`, {
            name: 'TES EDIT TANPA OPSIONAL',
        })

        assert.strictEqual(res.status, 200)
        assert.strictEqual(res.body.address, null)
        assert.strictEqual(res.body.owner_name, null)
        assert.strictEqual(res.body.phone, null)
    })

})
