const router =
    require('express').Router()

const bcrypt =
    require('bcryptjs')

const User =
    require('../models/user.model')

const Area =
    require('../models/area.model')

const Channel =
    require('../models/channel.model')

const auth =
    require('../middleware/auth.middleware')

require('../models/relations')

const {
    sendError,
    sendServerError,
} = require('../utils/response.util')

const {
    generateTempPassword,
} = require('../utils/password.util')

const {
    assertUserManagement,
    USER_ROLES,
} = require('../utils/access.util')

const {
    parseId,
} = require('../utils/id.util')




// ======================
// GET USERS
// ======================

router.get(

    '/',

    auth,

    async (req, res) => {

        try {

            const loginUser =
                await User.findByPk(
                    req.user.id
                )

            let whereCondition = {}

            // ======================
            // SUPERVISOR
            // ======================

            if (

                loginUser.role ===
                'SUPERVISOR'

            ) {

                whereCondition = {

                    role:
                        'SPG',

                    supervisor_id:
                        loginUser.id,

                    area_id:
                        loginUser.area_id,

                    channel_id:
                        loginUser.channel_id

                }

            }

            // ======================
            // MANAGER
            // ======================

            if (

                loginUser.role ===
                'MANAGER'

            ) {

                whereCondition = {

                    area_id:
                        loginUser.area_id,

                    channel_id:
                        loginUser.channel_id

                }

            }


            const data =
                await User.findAll({

                    where:
                        whereCondition,

                    attributes: {

                        exclude: [
                            'password'
                        ]

                    },

                    include: [

                        {
                            model: Area
                        },

                        {
                            model: Channel
                        },

                        {
                            model: User,
                            as: 'Supervisor',

                            attributes: [
                                'id',
                                'name',
                                'role'
                            ]
                        }


                    ]



                })



            res.json(data)




        }

        catch (err) {

            console.log(err)

            res.status(500).json({

                error:
                    err.message

            })

        }

    }

)






// ======================
// CREATE USER
// ======================

router.post(

    '/',

    auth,

    async (req, res) => {

        try {

            const gerbang = assertUserManagement(req.user)

            if (gerbang) {
                return sendError(res, gerbang.status, gerbang.message)
            }

            const {

                code,

                name,

                email,

                password,

                role,

                area_id,

                channel_id,

                supervisor_id



            } = req.body

            // Ditolak di sini supaya jadi 400 yang jelas, bukan 500 dari
            // MySQL saat nilainya tidak cocok dengan ENUM kolomnya.
            if (role !== undefined && !USER_ROLES.includes(role)) {
                return sendError(
                    res,
                    400,
                    'Role tidak dikenal.'
                )
            }

            // HASH PASSWORD
            const hashedPassword =
                await bcrypt.hash(

                    password,

                    10

                )

            // CREATE USER
            const user =
                await User.create({

                    code,

                    name,

                    email,

                    password:
                        hashedPassword,

                    role,

                    area_id:
                        area_id || null,

                    channel_id:
                        channel_id || null,

                    supervisor_id:
                        supervisor_id || null

                })

            // Password TIDAK BOLEH ikut terkirim: instance dari create()
            // memuat hash bcrypt-nya, dan toJSON() menyertakan seluruh
            // kolom.
            const {
                password: _password,
                ...userWithoutPassword
            } = user.toJSON()

            res.json({

                message:
                    'User berhasil dibuat',

                user:
                    userWithoutPassword

            })

        }

        catch (err) {

            console.log(err)

            res.status(500).json({

                error:
                    err.message,

                detail:
                    err.errors

            })

        }

    }

)


// ======================
// ACTIVE / INACTIVE USER
// ======================

router.put(

    '/:id/status',

    auth,

    async (req, res) => {

        try {

            const gerbang = assertUserManagement(req.user)

            if (gerbang) {
                return sendError(res, gerbang.status, gerbang.message)
            }

            // parseId, bukan Number(req.params.id): MySQL mengoersi
            // '2abc' menjadi 2 saat dibandingkan dengan kolom id, tapi
            // Number('2abc') adalah NaN sehingga tidak akan pernah sama
            // dengan req.user.id. Penjaga yang membandingkan nilai
            // mentah bisa dilewati hanya dengan menambahkan huruf ke
            // URL, sementara findByPk tetap menyasar baris yang sama.
            const id = parseId(req.params.id)

            if (id === null) {
                return sendError(res, 400, 'Id user tidak valid.')
            }

            // Jumlah administrator aktif tidak boleh bisa mencapai nol.
            // Karena pelakunya selalu tetap administrator aktif,
            // invarian itu dijaga oleh bentuk aturan ini — tanpa COUNT
            // dan tanpa kondisi balapan antara dua admin.
            if (id === req.user.id) {
                return sendError(
                    res,
                    400,
                    'Anda tidak bisa mengubah status akun Anda sendiri.'
                )
            }

            const user =
                await User.findByPk(

                    id

                )

            if (!user) {

                return res.status(404).json({

                    message:
                        'User tidak ditemukan'

                })

            }

            user.status =

                user.status === 'ACTIVE'

                    ?

                    'INACTIVE'

                    :

                    'ACTIVE'

            await user.save()

            // Password TIDAK BOLEH ikut terkirim: toJSON() Sequelize
            // menyertakan seluruh kolom, termasuk hash bcrypt.
            const {
                password: _password,
                ...userWithoutPassword
            } = user.toJSON()

            res.json({

                message:
                    'Status user berhasil diupdate',

                data:
                    userWithoutPassword

            })

        }

        catch (err) {

            console.log(err)

            res.status(500).json({

                error:
                    err.message

            })

        }

    }

)


// ======================
// GET USER BY ID
// ======================

router.get(

    '/:id',

    auth,

    async (req, res) => {

        try {

            const data =
                await User.findByPk(

                    req.params.id,

                    {

                        attributes: {

                            exclude: [
                                'password'
                            ]

                        }

                    }

                )

            if (!data) {

                return res.status(404).json({

                    message:
                        'User tidak ditemukan'

                })

            }

            res.json(data)




        }

        catch (err) {

            console.log(err)

            res.status(500).json({

                error:
                    err.message

            })

        }

    }

)


// ======================
// UPDATE USER
// ======================

router.put(

    '/:id',

    auth,

    async (req, res) => {

        try {

            const gerbang = assertUserManagement(req.user)

            if (gerbang) {
                return sendError(res, gerbang.status, gerbang.message)
            }

            // MySQL mengoersi string ke angka saat dibandingkan dengan
            // kolom numerik: WHERE id = '2abc' tetap cocok dengan baris
            // id 2. Kalau penjaga di bawah membandingkan req.params.id
            // mentah-mentah, '2abc' akan lolos dari penjaga (NaN tidak
            // pernah sama dengan apa pun) padahal where-nya tetap
            // menyasar baris yang sama. Menormalkan sekali di sini dan
            // memakai hasilnya di keduanya menutup celah itu.
            const targetId = parseId(req.params.id)

            if (targetId === null) {
                return sendError(res, 400, 'Id user tidak valid.')
            }

            const {

                code,

                name,

                email,

                role,

                area_id,

                channel_id,

                supervisor_id



            } = req.body

            if (role !== undefined && !USER_ROLES.includes(role)) {
                return sendError(
                    res,
                    400,
                    'Role tidak dikenal.'
                )
            }

            // Membandingkan NILAI, bukan keberadaan field: form user di
            // web mengirim kembali seluruh objeknya, sehingga admin yang
            // sekadar mengubah namanya sendiri tetap ikut mengirim role
            // yang sama. Menolak berdasarkan keberadaan field akan
            // menguncinya dari mengedit namanya sendiri.
            //
            // Karena pelakunya selalu tetap administrator aktif, jumlah
            // administrator aktif tidak pernah bisa mencapai nol.
            if (
                targetId === req.user.id &&
                role !== undefined &&
                role !== req.user.role
            ) {
                return sendError(
                    res,
                    400,
                    'Anda tidak bisa mengubah role akun Anda sendiri.'
                )
            }

            await User.update(

                {

                    name,

                    email,

                    role,

                    area_id:
                        area_id || null,

                    channel_id:
                        channel_id || null,

                    supervisor_id:
                        supervisor_id || null,

                    code:
                        code || null

                },

                {

                    where: {

                        id:
                            targetId

                    }

                }

            )

            res.json({

                message:
                    'User updated'

            })

        }

        catch (err) {

            console.log(err)

            res.status(500).json({

                error:
                    err.message

            })

        }

    }

)


// ======================
// RESET PASSWORD
// ======================

router.put(

    '/:id/reset-password',

    auth,

    async (req, res) => {

        try {

            // Role diambil dari database, bukan dari token: token yang
            // rolenya sudah berubah di database tidak boleh menentukan
            // wewenang.
            const loginUser =
                await User.findByPk(req.user.id)

            if (!loginUser) {

                return sendError(
                    res,
                    404,
                    'Akun Anda tidak ditemukan.'
                )

            }

            // Allowlist, bukan blacklist: role NULL, nilai warisan, atau
            // role baru apa pun ditolak secara bawaan.
            //
            // Reset password adalah pengambilalihan akun yang sah —
            // siapa pun yang bisa melakukannya bisa menjadi orang itu.
            if (loginUser.role !== 'ADMINISTRATOR') {

                return sendError(
                    res,
                    403,
                    'Hanya administrator yang boleh mereset password.'
                )

            }

            // Diperiksa SETELAH otorisasi: pemanggil yang tidak berhak
            // tidak perlu diberi tahu apakah id targetnya ada.
            const user =
                await User.findByPk(req.params.id)

            if (!user) {

                return sendError(
                    res,
                    404,
                    'User tidak ditemukan.'
                )

            }

            const password = generateTempPassword()

            user.password =
                await bcrypt.hash(password, 10)

            await user.save()

            res.json({

                message:
                    'Password berhasil direset',

                password

            })

        }

        catch (err) {

            return sendServerError(
                res,
                err,
                'RESET PASSWORD'
            )

        }

    }

)


module.exports =
    router