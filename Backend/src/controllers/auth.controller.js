const User = require('../models/user.model')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const {
    sendError,
    sendServerError,
} = require('../utils/response.util')

// Dipakai untuk email tidak terdaftar MAUPUN password salah.
// Membedakan keduanya membocorkan email mana yang terdaftar
// (user enumeration), sehingga penyerang bisa menyusun daftar
// akun yang valid sebelum mencoba menebak password.
const INVALID_CREDENTIALS_MESSAGE =
    'Email atau password salah.'

// LOGIN
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            return sendError(
                res,
                400,
                'Email dan password wajib diisi.'
            )
        }

        // Tipe diperiksa terpisah, karena cek falsy di atas hanya
        // menangkap yang kosong. `{ "email": { "a": 1 } }` lolos begitu
        // saja lalu meledak di findOne sebagai 500 — pada endpoint yang
        // bisa dipanggil tanpa autentikasi, jadi siapa pun bisa
        // memicunya. `["a@b.c","d@e.f"]` lebih buruk lagi: Sequelize
        // mengubahnya menjadi klausa IN, sehingga satu password bisa
        // dicoba terhadap sekumpulan email sekaligus.
        //
        // `?.` tidak menolong di sini: ia menjaga null dan undefined,
        // bukan tipe.
        if (
            typeof email !== 'string' ||
            typeof password !== 'string'
        ) {
            return sendError(
                res,
                400,
                'Email dan password harus berupa teks.'
            )
        }

        const user = await User.findOne({ where: { email } })

        // 401, bukan 404: dari sisi client ini "kredensial ditolak",
        // bukan "resource tidak ada".
        if (!user) {
            return sendError(
                res,
                401,
                INVALID_CREDENTIALS_MESSAGE
            )
        }

        const isMatch = await bcrypt.compare(password, user.password)

        if (!isMatch) {
            return sendError(
                res,
                401,
                INVALID_CREDENTIALS_MESSAGE
            )
        }

        // Diperiksa setelah password, bukan sebelumnya: kalau ditolak
        // lebih dulu, siapa pun bisa mengetahui email mana yang
        // terdaftar hanya dengan menebak. Itu kebocoran yang sama dengan
        // yang dicegah oleh pesan login yang sengaja dibuat identik.
        //
        // Allowlist, bukan `=== 'INACTIVE'`: kolomnya boleh NULL, dan
        // NULL harus ditolak.
        if (user.status !== 'ACTIVE') {
            return sendError(
                res,
                403,
                'Akun Anda tidak aktif. Silakan hubungi administrator.'
            )
        }

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        )

        res.json({

            token,

            user: {

                id: user.id,

                name: user.name,

                role: user.role

            }

        })
    } catch (err) {
        return sendServerError(res, err, 'LOGIN')
    }
}
