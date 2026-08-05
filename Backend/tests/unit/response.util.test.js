const { test, describe, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert')

const {
    sendError,
    sendServerError,
} = require('../../src/utils/response.util')


const makeRes = () => ({
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
})


describe('sendError', () => {

    test('memakai status dan pesan yang diberikan', () => {
        const res = makeRes()

        sendError(res, 404, 'Customer tidak ditemukan.')

        assert.strictEqual(res.statusCode, 404)
        assert.deepStrictEqual(res.body, {
            message: 'Customer tidak ditemukan.',
        })
    })

    // Client (mobile) HANYA membaca field `message`. Kalau key-nya
    // berubah jadi `error`, semua pesan berhenti sampai ke user.
    test('key-nya selalu `message`, tidak pernah `error`', () => {
        const res = makeRes()

        sendError(res, 400, 'Apa saja')

        assert.ok('message' in res.body)
        assert.ok(!('error' in res.body))
        assert.deepStrictEqual(Object.keys(res.body), ['message'])
    })

})


describe('sendServerError', () => {

    const originalEnv = process.env.NODE_ENV

    // console.error dibungkam supaya output tes tidak penuh
    // stack trace yang memang disengaja.
    let originalConsoleError

    beforeEach(() => {
        originalConsoleError = console.error
        console.error = () => {}
    })

    afterEach(() => {
        console.error = originalConsoleError
        process.env.NODE_ENV = originalEnv
    })

    test('selalu 500', () => {
        const res = makeRes()

        sendServerError(res, new Error('apa pun'), 'TEST')

        assert.strictEqual(res.statusCode, 500)
    })

    test('development menampilkan pesan asli untuk debugging', () => {
        process.env.NODE_ENV = 'development'
        const res = makeRes()

        sendServerError(
            res,
            new Error('SequelizeDatabaseError: Unknown column x'),
            'TEST'
        )

        assert.match(res.body.message, /Unknown column x/)
    })

    // Pesan exception bisa membocorkan nama tabel, kolom, dan
    // bentuk query ke siapa pun yang memanggil API.
    test('production menyembunyikan detail teknis', () => {
        process.env.NODE_ENV = 'production'
        const res = makeRes()

        sendServerError(
            res,
            new Error('SequelizeDatabaseError: Unknown column secret_col'),
            'TEST'
        )

        assert.ok(!res.body.message.includes('secret_col'))
        assert.ok(!res.body.message.includes('Sequelize'))
        assert.strictEqual(
            res.body.message,
            'Terjadi kesalahan pada server. Silakan coba lagi.'
        )
    })

    test('error tanpa message tetap menghasilkan pesan generik', () => {
        process.env.NODE_ENV = 'development'
        const res = makeRes()

        sendServerError(res, {}, 'TEST')

        assert.strictEqual(typeof res.body.message, 'string')
        assert.ok(res.body.message.length > 0)
    })

    test('error null tidak melempar', () => {
        process.env.NODE_ENV = 'development'
        const res = makeRes()

        sendServerError(res, null, 'TEST')

        assert.strictEqual(res.statusCode, 500)
        assert.strictEqual(typeof res.body.message, 'string')
    })

    test('bentuk body-nya hanya { message }', () => {
        const res = makeRes()

        sendServerError(res, new Error('x'), 'TEST')

        assert.deepStrictEqual(Object.keys(res.body), ['message'])
    })

})
