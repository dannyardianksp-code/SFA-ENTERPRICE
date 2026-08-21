const { test, describe } = require('node:test')
const assert = require('node:assert')

const { nullableUpdate } = require('../../src/utils/update.util')


describe('nullableUpdate', () => {

    // String kosong adalah yang dikirim web ketika select supervisor
    // atau channel dikosongkan dengan sengaja. Itu berarti NULL.
    test('string kosong menjadi null', () => {
        assert.strictEqual(nullableUpdate(''), null)
    })

    test('string berisi spasi saja juga menjadi null', () => {
        assert.strictEqual(nullableUpdate('   '), null)
    })

    // 0 itu falsy, dan pola lama `field || null` membuangnya.
    test('angka nol tetap nol, bukan null', () => {
        assert.strictEqual(nullableUpdate(0), 0)
    })

    test('string "0" tetap "0"', () => {
        assert.strictEqual(nullableUpdate('0'), '0')
    })

    test('nilai biasa lolos apa adanya', () => {
        assert.strictEqual(nullableUpdate(5), 5)
        assert.strictEqual(nullableUpdate('5'), '5')
        assert.strictEqual(nullableUpdate('ABC-001'), 'ABC-001')
    })

    test('null tetap null', () => {
        assert.strictEqual(nullableUpdate(null), null)
    })

})
