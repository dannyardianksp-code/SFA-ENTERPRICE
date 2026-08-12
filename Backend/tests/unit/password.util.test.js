const { test, describe } = require('node:test')
const assert = require('node:assert')

const {
    PASSWORD_ALPHABET,
    PASSWORD_LENGTH,
    generateTempPassword,
} = require('../../src/utils/password.util')

/**
 * Karakter yang sengaja dibuang. Administrator membacakan password ini ke
 * sales lewat telepon, dan "l" versus "1" adalah panggilan telepon kedua.
 */
const KARAKTER_TERLARANG = '0O1lI5Sos'


describe('PASSWORD_ALPHABET', () => {

    test('tidak memuat karakter yang mudah tertukar', () => {
        for (const c of KARAKTER_TERLARANG) {
            assert.ok(
                !PASSWORD_ALPHABET.includes(c),
                `alfabet masih memuat ${JSON.stringify(c)}`
            )
        }
    })

    // Karakter kembar diam-diam memiringkan distribusinya: yang kembar
    // muncul dua kali lebih sering daripada yang lain.
    test('tidak ada karakter kembar', () => {
        const unik = new Set(PASSWORD_ALPHABET)

        assert.strictEqual(
            unik.size,
            PASSWORD_ALPHABET.length,
            'ada karakter yang muncul lebih dari sekali'
        )
    })

    test('cukup besar untuk password yang tidak mudah ditebak', () => {
        assert.ok(
            PASSWORD_ALPHABET.length >= 50,
            `alfabet hanya ${PASSWORD_ALPHABET.length} karakter`
        )
    })

})


describe('generateTempPassword', () => {

    test('panjangnya tepat PASSWORD_LENGTH', () => {
        assert.strictEqual(generateTempPassword().length, PASSWORD_LENGTH)
    })

    test('PASSWORD_LENGTH bernilai 10', () => {
        assert.strictEqual(PASSWORD_LENGTH, 10)
    })

    test('setiap karakter berasal dari alfabet', () => {
        for (const c of generateTempPassword()) {
            assert.ok(
                PASSWORD_ALPHABET.includes(c),
                `karakter ${JSON.stringify(c)} di luar alfabet`
            )
        }
    })

    test('dua panggilan menghasilkan nilai berbeda', () => {
        assert.notStrictEqual(
            generateTempPassword(),
            generateTempPassword()
        )
    })

    // Sekali jalan tidak membuktikan apa pun tentang generator acak.
    // 200 panggilan x 10 karakter = 2000 pengambilan; kalau ada jalur
    // yang bisa menghasilkan karakter di luar alfabet — misalnya indeks
    // yang kadang keluar batas dan menghasilkan undefined — ia akan
    // muncul di sini.
    test('200 panggilan tidak pernah keluar dari alfabet', () => {
        for (let i = 0; i < 200; i++) {
            const pw = generateTempPassword()

            assert.strictEqual(pw.length, PASSWORD_LENGTH)

            for (const c of pw) {
                assert.ok(
                    PASSWORD_ALPHABET.includes(c),
                    `panggilan ${i}: karakter ${JSON.stringify(c)} di luar alfabet`
                )
            }
        }
    })

    // Kalau indeksnya tidak pernah mencapai ujung alfabet, karakter
    // terakhir tidak akan pernah muncul. 2000 pengambilan dari 53
    // karakter membuat itu praktis mustahil terjadi secara kebetulan.
    test('seluruh rentang alfabet terpakai', () => {
        const terpakai = new Set()

        for (let i = 0; i < 200; i++) {
            for (const c of generateTempPassword()) {
                terpakai.add(c)
            }
        }

        assert.ok(
            terpakai.has(PASSWORD_ALPHABET[0]),
            'karakter pertama alfabet tidak pernah muncul'
        )

        assert.ok(
            terpakai.has(PASSWORD_ALPHABET[PASSWORD_ALPHABET.length - 1]),
            'karakter terakhir alfabet tidak pernah muncul'
        )
    })

})
