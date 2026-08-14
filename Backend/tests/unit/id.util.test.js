const { test, describe } = require('node:test')
const assert = require('node:assert')

const { parseId } = require('../../src/utils/id.util')


describe('parseId', () => {

    test("'2' menjadi 2", () => {
        assert.strictEqual(parseId('2'), 2)
    })

    test('2 (angka) menjadi 2', () => {
        assert.strictEqual(parseId(2), 2)
    })

    // Inilah alasan helper ini ada: MySQL mengoersi string ke angka saat
    // dibandingkan dengan kolom numerik, jadi `WHERE id = '2abc'` tetap
    // cocok dengan baris id 2 walau Number('2abc') di JavaScript adalah
    // NaN. Tanpa penyaringan ini, penjaga yang membandingkan id dengan
    // Number(req.params.id) bisa dilewati hanya dengan menambahkan huruf
    // ke URL, sementara query where-nya tetap menyasar baris yang sama.
    test("'2abc' ditolak, bukan diam-diam jadi 2", () => {
        assert.strictEqual(parseId('2abc'), null)
    })

    test("'abc' ditolak", () => {
        assert.strictEqual(parseId('abc'), null)
    })

    test("string kosong ditolak", () => {
        assert.strictEqual(parseId(''), null)
    })

    test("'2.5' ditolak", () => {
        assert.strictEqual(parseId('2.5'), null)
    })

    test("'0' ditolak", () => {
        assert.strictEqual(parseId('0'), null)
    })

    test("'-1' ditolak", () => {
        assert.strictEqual(parseId('-1'), null)
    })

    test('null ditolak', () => {
        assert.strictEqual(parseId(null), null)
    })

    test('undefined ditolak', () => {
        assert.strictEqual(parseId(undefined), null)
    })

    test('array kosong ditolak', () => {
        assert.strictEqual(parseId([]), null)
    })

    test('object kosong ditolak', () => {
        assert.strictEqual(parseId({}), null)
    })

})
