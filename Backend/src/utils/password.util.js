const crypto = require('crypto')

/**
 * Alfabet password sementara.
 *
 * Tanpa 0, O, 1, l, I, 5, S, o, dan s — administrator membacakan password
 * ini ke sales lewat telepon, dan "l" versus "1" adalah panggilan telepon
 * kedua. Huruf L besar dipertahankan: ia tidak tertukar dengan apa pun.
 */
const PASSWORD_ALPHABET =
    'ABCDEFGHJKLMNPQRTUVWXYZabcdefghijkmnpqrtuvwxyz2346789'

const PASSWORD_LENGTH = 10

/**
 * Password sementara acak.
 *
 * crypto.randomInt, bukan Math.random: yang kedua tidak kriptografis dan
 * keluarannya bisa diprediksi dari keluaran sebelumnya. Untuk nilai yang
 * memberi akses ke sebuah akun, itu bukan sifat yang bisa ditawar.
 *
 * randomInt juga bebas dari bias modulo — ia menolak dan mengulang
 * pengambilan yang jatuh di luar rentang yang rata.
 */
const generateTempPassword = () =>
    Array.from(
        { length: PASSWORD_LENGTH },
        () => PASSWORD_ALPHABET[
            crypto.randomInt(PASSWORD_ALPHABET.length)
        ]
    ).join('')


module.exports = {
    PASSWORD_ALPHABET,
    PASSWORD_LENGTH,
    generateTempPassword,
}
