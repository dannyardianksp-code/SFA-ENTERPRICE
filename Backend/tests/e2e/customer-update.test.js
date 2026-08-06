require('dotenv').config({ quiet: true })

const { test, describe, before } = require('node:test')
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
