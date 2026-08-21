require('dotenv').config({ quiet: true })

const { test, describe, before, after } = require('node:test')
const assert = require('node:assert')
const jwt = require('jsonwebtoken')
const mysql = require('mysql2/promise')

const BASE = process.env.TEST_BASE_URL || 'http://localhost:1000'

// Hierarki sungguhan: supervisor 3 -> SPG 1, 37, 38. SPG 34 di bawah
// supervisor 33, di luar subtree 3.
const SPG = 1
const SPG_LAIN = 37       // sama-sama anak supervisor 3
const SPG_LUAR = 34       // di luar subtree supervisor 3
const SUPERVISOR = 3

let db
const visitPlanIdsDibuat = []
const visitIdsDibuat = []

const tokenUntuk = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '15m' })

const kirim = async (method, path, userId, body) => {
    const headers = { 'Content-Type': 'application/json' }

    if (userId !== null) {
        headers.Authorization = 'Bearer ' + tokenUntuk(userId)
    }

    const res = await fetch(BASE + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    })

    let data = null

    try {
        data = await res.json()
    } catch {
        data = null
    }

    return { status: res.status, data }
}

/**
 * Customer sungguhan dengan koordinat yang bisa dipakai menghitung
 * jarak -- bukan customer 97/123 yang dilindungi.
 */
const ambilCustomerUji = async () => {
    const [rows] = await db.query(
        `SELECT id, latitude, longitude, area_id, channel_id
         FROM customers
         WHERE id NOT IN (97, 123)
           AND latitude IS NOT NULL
           AND longitude IS NOT NULL
         LIMIT 1`
    )

    return rows[0] ?? null
}

const buatPlanUntuk = async (userId, customerId) => {
    const [hasil] = await db.query(
        `INSERT INTO visit_plans (user_id, customer_id, visit_date, status)
         VALUES (?, ?, CURDATE(), 'PENDING')`,
        [userId, customerId]
    )

    visitPlanIdsDibuat.push(hasil.insertId)

    return hasil.insertId
}

before(async () => {
    try {
        await fetch(BASE + '/api/users')
    } catch {
        throw new Error(
            `Server tidak menjawab di ${BASE}. Jalankan "npm run dev" lebih dulu.`
        )
    }

    db = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
    })
})

after(async () => {
    if (db) {
        for (const id of visitIdsDibuat) {
            await db.query('DELETE FROM visits WHERE id = ?', [id])
        }

        for (const id of visitPlanIdsDibuat) {
            await db.query('DELETE FROM visit_plans WHERE id = ?', [id])
        }

        await db.end()
    }
})


describe('POST /api/visits/checkin', () => {

    let customerUji

    before(async () => {
        customerUji = await ambilCustomerUji()
    })

    const koordinatBaik = () => ({
        latitude: Number(customerUji.latitude),
        longitude: Number(customerUji.longitude),
        accuracy: 15,
    })

    test('SPG check-in ke plan miliknya sendiri berhasil', async (t) => {
        if (!customerUji) {
            t.skip('tidak ada customer dengan koordinat di database')
            return
        }

        const planId = await buatPlanUntuk(SPG, customerUji.id)

        const { status, data } = await kirim(
            'POST',
            '/api/visits/checkin',
            SPG,
            { visit_plan_id: planId, ...koordinatBaik() }
        )

        assert.strictEqual(status, 200)

        visitIdsDibuat.push(data.data.id)

        const [row] = await db.query(
            'SELECT location_accuracy, customer_id FROM visits WHERE id = ?',
            [data.data.id]
        )

        assert.strictEqual(Number(row[0].location_accuracy), 15)

        // customer_id dikunci dari plan, dibuktikan sama dengan yang
        // dipakai membuat plan -- bukan dari body request (body di
        // tes ini memang tidak mengirim customer_id sama sekali).
        assert.strictEqual(row[0].customer_id, customerUji.id)
    })

    test('SPG check-in ke plan milik SPG lain ditolak 403', async (t) => {
        if (!customerUji) {
            t.skip('tidak ada customer dengan koordinat di database')
            return
        }

        const planId = await buatPlanUntuk(SPG_LAIN, customerUji.id)

        const { status } = await kirim(
            'POST',
            '/api/visits/checkin',
            SPG,
            { visit_plan_id: planId, ...koordinatBaik() }
        )

        assert.strictEqual(status, 403)

        const [visits] = await db.query(
            'SELECT id FROM visits WHERE visit_plan_id = ?',
            [planId]
        )

        assert.strictEqual(visits.length, 0)
    })

    test('akurasi buruk ditolak walau jarak dekat', async (t) => {
        if (!customerUji) {
            t.skip('tidak ada customer dengan koordinat di database')
            return
        }

        const planId = await buatPlanUntuk(SPG, customerUji.id)

        const { status, data } = await kirim(
            'POST',
            '/api/visits/checkin',
            SPG,
            {
                visit_plan_id: planId,
                latitude: Number(customerUji.latitude),
                longitude: Number(customerUji.longitude),
                accuracy: 120,
            }
        )

        assert.strictEqual(status, 400)
        assert.match(data.message, /akurasi/i)

        const [visits] = await db.query(
            'SELECT id FROM visits WHERE visit_plan_id = ?',
            [planId]
        )

        assert.strictEqual(visits.length, 0)
    })

    test('jarak jauh dengan akurasi baik tetap ditolak', async (t) => {
        if (!customerUji) {
            t.skip('tidak ada customer dengan koordinat di database')
            return
        }

        const planId = await buatPlanUntuk(SPG, customerUji.id)

        const { status } = await kirim(
            'POST',
            '/api/visits/checkin',
            SPG,
            {
                visit_plan_id: planId,
                // Jauh dari customerUji dengan sengaja -- 1 derajat
                // lintang/bujur kira-kira 111 km.
                latitude: Number(customerUji.latitude) + 1,
                longitude: Number(customerUji.longitude) + 1,
                accuracy: 10,
            }
        )

        assert.strictEqual(status, 400)
    })

    test('customer_id yang dikirim di body diabaikan', async (t) => {
        if (!customerUji) {
            t.skip('tidak ada customer dengan koordinat di database')
            return
        }

        const [customerLain] = await db.query(
            'SELECT id FROM customers WHERE id NOT IN (?, 97, 123) LIMIT 1',
            [customerUji.id]
        )

        if (!customerLain[0]) {
            t.skip('tidak ada customer kedua untuk uji pemalsuan')
            return
        }

        const planId = await buatPlanUntuk(SPG, customerUji.id)

        const { status, data } = await kirim(
            'POST',
            '/api/visits/checkin',
            SPG,
            {
                visit_plan_id: planId,
                customer_id: customerLain[0].id,
                ...koordinatBaik(),
            }
        )

        assert.strictEqual(status, 200)

        visitIdsDibuat.push(data.data.id)

        const [row] = await db.query(
            'SELECT customer_id FROM visits WHERE id = ?',
            [data.data.id]
        )

        // Tercatat memakai customer dari PLAN, bukan dari body.
        assert.strictEqual(row[0].customer_id, customerUji.id)
    })

    test('plan berstatus bukan PENDING ditolak', async (t) => {
        if (!customerUji) {
            t.skip('tidak ada customer dengan koordinat di database')
            return
        }

        const planId = await buatPlanUntuk(SPG, customerUji.id)

        await db.query(
            "UPDATE visit_plans SET status = 'COMPLETED' WHERE id = ?",
            [planId]
        )

        const { status } = await kirim(
            'POST',
            '/api/visits/checkin',
            SPG,
            { visit_plan_id: planId, ...koordinatBaik() }
        )

        assert.strictEqual(status, 400)
    })

    test('plan yang tidak ada menghasilkan 404', async () => {
        const { status } = await kirim(
            'POST',
            '/api/visits/checkin',
            SPG,
            { visit_plan_id: 99999999, ...koordinatBaik() }
        )

        assert.strictEqual(status, 404)
    })

})
