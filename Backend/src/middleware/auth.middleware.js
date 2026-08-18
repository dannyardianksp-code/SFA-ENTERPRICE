const jwt = require('jsonwebtoken')

const User = require('../models/user.model')

const { sendServerError } = require('../utils/response.util')


/**
 * User dimuat dari database setiap request, bukan dibaca dari payload
 * token. Token berlaku 1 hari, sedangkan role yang diturunkan dan akun
 * yang dinonaktifkan harus berlaku sekarang, bukan besok.
 *
 * Akibatnya req.user adalah baris database yang segar, sehingga handler
 * boleh membaca req.user.role tanpa memuat ulang sendiri.
 */
module.exports = async (req, res, next) => {

    const token = req.headers.authorization?.split(' ')[1]

    if (!token) {
        return res.status(401).json({ message: 'No token' })
    }

    let decoded

    // Dipisah dari blok database di bawah dengan sengaja: satu try yang
    // membungkus keduanya akan mengubah database yang sedang mati
    // menjadi 401 "Invalid token", sehingga setiap klien logout dan
    // penyebab sebenarnya tidak terlihat di mana pun.
    //
    // Pemisahan itu saja tidak cukup. jwt.verify juga melempar untuk
    // sebab yang bukan salah klien sama sekali — terutama JWT_SECRET yang
    // tidak terpasang ('secretOrPublicKey must have a value') dan secret
    // yang baru dirotasi. Karena itu setiap sebab dicatat dan hanya dua
    // nama error yang tetap 401.
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET)
    } catch (err) {

        // Selalu dicatat. Sebelumnya err dibuang tanpa jejak, sehingga
        // deploy dengan JWT_SECRET hilang tidak meninggalkan satu baris
        // pun di log server — hanya seluruh user di lapangan yang
        // tiba-tiba ter-logout.
        console.error('[AUTH TOKEN]', err)

        // Dua nama ini benar-benar masalah klien: TokenExpiredError
        // (sesinya habis) dan JsonWebTokenError (tanda tangan salah atau
        // token cacat). 401 di sini benar — mobile memang harus
        // mengeluarkan usernya dan meminta login ulang.
        if (
            err.name === 'TokenExpiredError' ||
            err.name === 'JsonWebTokenError'
        ) {
            return res.status(401).json({ message: 'Invalid token' })
        }

        // Sisanya masalah server, bukan klien. Sebagai 401, JWT_SECRET
        // yang hilang membuat SETIAP request terautentikasi ditolak, dan
        // interceptor mobile membaca 401 non-login sebagai sesi
        // kedaluwarsa lalu me-logout seluruh user di lapangan sekaligus.
        // Sebagai 500, klien mencoba lagi dan sesinya tetap utuh sampai
        // konfigurasinya dibetulkan.
        return sendServerError(res, err, 'AUTH TOKEN')

    }

    let user

    try {

        user = await User.findByPk(decoded.id)

    } catch (err) {
        return sendServerError(res, err, 'AUTH MIDDLEWARE')
    }

    if (!user) {
        return res.status(401).json({ message: 'Sesi tidak berlaku.' })
    }

    // Allowlist, bukan `=== 'INACTIVE'`. Kolomnya varchar yang boleh
    // NULL, jadi NULL dan nilai warisan apa pun harus ditolak,
    // bukan diloloskan.
    //
    // 401 dan bukan 403 walau tokennya sah: mobile hanya memicu
    // logout pada 401. Dengan 403, sales yang dinonaktifkan tidak
    // dikeluarkan dari aplikasi — ia terjebak di layar yang setiap
    // requestnya gagal.
    //
    // Login sendiri tetap menjawab 403 untuk kondisi yang sama, dan itu
    // memang berbeda dengan sengaja: interceptor mobile mengecualikan
    // login dari pemicu logout, jadi 401 di sana hanya akan menghapus
    // sesi yang belum ada sambil menyembunyikan alasannya dari user.
    if (user.status !== 'ACTIVE') {
        return res.status(401).json({
            message: 'Akun Anda dinonaktifkan.',
        })
    }

    req.user = user

    // Di LUAR try mana pun dengan sengaja. Kalau next() dipanggil di
    // dalam try, exception dari handler mana pun di hilir akan tertangkap
    // catch milik middleware ini dan terlaporkan sebagai kegagalan auth —
    // konteks lognya salah dan penyebab aslinya jadi lebih sulit dicari.
    next()

}
