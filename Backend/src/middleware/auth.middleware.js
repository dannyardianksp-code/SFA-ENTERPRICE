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
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET)
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' })
    }

    try {

        const user = await User.findByPk(decoded.id)

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
        if (user.status !== 'ACTIVE') {
            return res.status(401).json({
                message: 'Akun Anda dinonaktifkan.',
            })
        }

        req.user = user

        next()

    } catch (err) {
        return sendServerError(res, err, 'AUTH MIDDLEWARE')
    }

}
