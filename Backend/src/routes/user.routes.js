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

const db =
    require('../config/database')

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
    wouldRemoveLastActiveAdministrator,
    USER_ROLES,
} = require('../utils/access.util')

const {
    parseId,
} = require('../utils/id.util')

const {
    isLockConflictError,
    withShortLockWait,
} = require('../utils/lock.util')


/**
 * Jawaban seragam untuk kedua handler saat transaksinya kalah balapan
 * lock.
 *
 * 503, bukan 409. Lantai administrator sudah memakai 409 untuk penolakan
 * yang TIDAK boleh diulang — mengulangnya akan ditolak lagi selamanya
 * sampai ada administrator lain diangkat. Kontensi lock kebalikannya:
 * permintaannya sah dan kemungkinan besar berhasil kalau dikirim ulang.
 * Memberi keduanya 409 berarti klien tidak bisa membedakan "jangan
 * diulang" dari "ulangi saja", padahal itu satu-satunya hal yang perlu
 * diketahui klien di sini.
 *
 * 503 juga lebih jujur soal sebabnya: server yang sementara tidak bisa
 * menyelesaikan permintaan yang valid, bukan permintaan yang bentrok
 * dengan keadaan sumber daya. Retry-After membuat sinyal itu bisa dibaca
 * mesin, bukan hanya manusia yang membaca pesannya.
 */
const sendLockConflict = (res) => {

    res.set('Retry-After', '1')

    return sendError(
        res,
        503,
        'Sistem sedang memproses perubahan akun lain. Silakan coba lagi.'
    )

}


/**
 * Query yang sama dipakai kedua handler yang bisa mengurangi jumlah
 * administrator aktif, dan SELALU dijalankan lebih dulu di dalam
 * transaksinya.
 *
 * Sengaja satu tempat: dua handler yang mengambil lock atas baris yang
 * sama dengan urutan berbeda tidak berakhir sebagai penolakan yang rapi,
 * melainkan sebagai deadlock MySQL yang muncul di klien sebagai 500.
 *
 * `lock: t.LOCK.UPDATE` menghasilkan SELECT ... FOR UPDATE. Inilah yang
 * membuat pemeriksaan lantai administrator benar saat dua request
 * berjalan bersamaan: transaksi kedua menunggu yang pertama commit, lalu
 * membaca ulang dan melihat jumlah yang sudah berkurang. Tanpa lock,
 * keduanya membaca angka yang sama dan sama-sama lolos.
 *
 * Kolom role dan status TIDAK berindeks, jadi FOR UPDATE di sini adalah
 * full scan yang mengunci setiap baris users beserta gap-nya, bukan hanya
 * kedua baris administrator. Diukur langsung: selama transaksi ini
 * terbuka, UPDATE atas baris SPG yang tidak berkaitan pun terblokir
 * sampai ER_LOCK_WAIT_TIMEOUT.
 *
 * JANGAN menambahkan index (role, status) untuk mempersempitnya tanpa
 * membaca catatan di tests/README.md lebih dulu. Sudah dicoba dan diukur:
 * index itu memang mempersempit lock bacanya, tapi UPDATE yang menulis
 * kolom role harus ikut memelihara entri index sekundernya, dan itu
 * membuat dua administrator yang saling menurunkan role berakhir
 * ER_LOCK_DEADLOCK pada 5 dari 6 percobaan — padahal tanpa index angkanya
 * 0 dari 8. Deadlock lebih buruk daripada lock yang lebar: yang satu
 * menggagalkan operasi yang sebelumnya berhasil, yang lain hanya
 * memperlambatnya.
 *
 * Yang MEMANG membatasi kerusakan lock lebar ini adalah batas tunggu
 * per-sesi di withShortLockWait: pemegang koneksi menyerah setelah 5
 * detik, bukan 50, sehingga pool tidak kering.
 */
const hitungAdminAktifTerkunci = async (t) => {

    const baris = await User.findAll({

        where: {
            role: 'ADMINISTRATOR',
            status: 'ACTIVE',
        },

        attributes: ['id'],

        transaction: t,

        lock: t.LOCK.UPDATE,

    })

    return baris.length

}




// ======================
// GET USERS
// ======================

router.get(

    '/',

    auth,

    async (req, res) => {

        try {

            // Dibaca dari req.user, bukan dimuat ulang: middleware auth
            // sudah mengambil baris segar dari database setiap request.
            // Memuat ulang di sini hanya menambah satu query yang bisa
            // mengembalikan null — dan `null.role` di bawah akan menjadi
            // 500 tanpa sebab yang jelas.
            let whereCondition = {}

            // ======================
            // SUPERVISOR
            // ======================

            if (

                req.user.role ===
                'SUPERVISOR'

            ) {

                whereCondition = {

                    role:
                        'SPG',

                    supervisor_id:
                        req.user.id,

                    area_id:
                        req.user.area_id,

                    channel_id:
                        req.user.channel_id

                }

            }

            // ======================
            // MANAGER
            // ======================

            if (

                req.user.role ===
                'MANAGER'

            ) {

                whereCondition = {

                    area_id:
                        req.user.area_id,

                    channel_id:
                        req.user.channel_id

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

            // Larangan menonaktifkan diri sendiri. Ini MENGURANGI peluang
            // nol administrator, tapi tidak menutupnya: penjaga ini hanya
            // melihat pemanggil vs sasaran, sedangkan dua administrator
            // yang saling menonaktifkan pada milidetik yang sama
            // sama-sama lolos. Lantai administrator dijaga oleh transaksi
            // di bawah, bukan oleh baris ini.
            if (id === req.user.id) {
                return sendError(
                    res,
                    400,
                    'Anda tidak bisa mengubah status akun Anda sendiri.'
                )
            }

            // Baca-lalu-tulis harus berada dalam SATU transaksi dengan
            // locking read. Tanpa itu, admin 2 menonaktifkan admin 29 dan
            // admin 29 menonaktifkan admin 2 dalam beberapa milidetik
            // yang sama: keduanya lolos setiap pemeriksaan (sasaran
            // masing-masing bukan dirinya sendiri), kedua UPDATE commit,
            // dan tidak ada administrator aktif yang tersisa. Reset
            // password pun ADMINISTRATOR-saja, jadi tidak ada jalur
            // pemulihan selain akses langsung ke database.
            // withShortLockWait: batas tunggu lock dipendekkan di dalam
            // transaksi ini saja. Yang kalah balapan harus MELEPAS koneksi
            // pool-nya dengan cepat — menunggu 50 detik sambil memegang
            // koneksi adalah cara lima administrator menghabiskan pool
            // (max = 5) dan menjatuhkan traffic yang tidak berkaitan,
            // termasuk login mobile.
            const hasil = await db.transaction(withShortLockWait(async (t) => {

                // Locking read DULU, sebelum baris sasaran, dengan query
                // yang persis sama seperti di PUT /:id — urutan lock yang
                // berbeda antar handler berakhir sebagai deadlock, bukan
                // sebagai penolakan.
                const jumlahAdminAktif =
                    await hitungAdminAktifTerkunci(t)

                const user = await User.findByPk(id, {

                    transaction: t,

                    lock: t.LOCK.UPDATE,

                })

                if (!user) {

                    return {
                        status: 404,
                        message: 'User tidak ditemukan',
                    }

                }

                const statusBaru =

                    user.status === 'ACTIVE'

                        ?

                        'INACTIVE'

                        :

                        'ACTIVE'

                if (
                    wouldRemoveLastActiveAdministrator(
                        user,
                        { status: statusBaru },
                        jumlahAdminAktif
                    )
                ) {

                    return {
                        status: 409,
                        message:
                            'Ini administrator aktif terakhir. Angkat administrator lain lebih dulu sebelum menonaktifkannya.',
                    }

                }

                await user.update(
                    { status: statusBaru },
                    { transaction: t }
                )

                // Password TIDAK BOLEH ikut terkirim: toJSON() Sequelize
                // menyertakan seluruh kolom, termasuk hash bcrypt.
                const {
                    password: _password,
                    ...userWithoutPassword
                } = user.toJSON()

                return { data: userWithoutPassword }

            }))

            if (hasil.status) {
                return sendError(res, hasil.status, hasil.message)
            }

            res.json({

                message:
                    'Status user berhasil diupdate',

                data:
                    hasil.data

            })

        }

        catch (err) {

            // Diperiksa SEBELUM cabang 500. Kalah balapan lock bukan bug,
            // dan 500 tidak memberi tahu pemanggil bahwa mengulang akan
            // berhasil.
            if (isLockConflictError(err)) {
                return sendLockConflict(res)
            }

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

            // parseId juga di route yang belum punya penjaga apa pun.
            // Invariannya dijaga secara struktural, bukan per-route:
            // selama SEMUA route :id menormalkan idnya, penjaga yang
            // ditambahkan siapa pun besok tidak bisa lagi salah
            // membandingkan nilai yang berbeda dari yang dieksekusi
            // `where`. GET /api/users/2abc sebelumnya mengembalikan baris
            // id 2 karena MySQL mengoersi stringnya.
            const id = parseId(req.params.id)

            if (id === null) {
                return sendError(res, 400, 'Id user tidak valid.')
            }

            const data =
                await User.findByPk(

                    id,

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
            // sekadar mengubah namanya sendiri tetap ikut mengirim role,
            // email, dan code yang sama. Menolak berdasarkan keberadaan
            // field akan menguncinya dari mengedit namanya sendiri.
            //
            // Ini penjaga per-request dan hanya melihat pemanggil vs
            // sasaran; lantai administrator aktif dijaga oleh transaksi di
            // bawah, bukan oleh blok ini.
            if (targetId === req.user.id) {

                if (
                    role !== undefined &&
                    role !== req.user.role
                ) {
                    return sendError(
                        res,
                        400,
                        'Anda tidak bisa mengubah role akun Anda sendiri.'
                    )
                }

                // email adalah identitas login, jadi mengubahnya sendiri
                // adalah cara mengunci diri sendiri keluar yang tidak
                // ketahuan sampai tokennya kedaluwarsa — dan token
                // berlaku 1 hari. Barisnya tetap ADMINISTRATOR dan ACTIVE
                // sehingga lantai administrator di bawah tidak melihat
                // apa pun yang salah, padahal tidak ada lagi
                // administrator yang bisa login untuk mereset password
                // siapa pun. Sunting profil sendiri memang di luar
                // lingkup endpoint ini.
                if (
                    email !== undefined &&
                    email !== req.user.email
                ) {
                    return sendError(
                        res,
                        400,
                        'Anda tidak bisa mengubah email akun Anda sendiri.'
                    )
                }

                // Dinormalkan `|| null` persis seperti saat ditulis di
                // bawah, supaya form yang mengirim string kosong untuk
                // code yang memang NULL tidak terbaca sebagai perubahan.
                if (
                    code !== undefined &&
                    (code || null) !== (req.user.code || null)
                ) {
                    return sendError(
                        res,
                        400,
                        'Anda tidak bisa mengubah code akun Anda sendiri.'
                    )
                }

            }

            // Baca-lalu-tulis harus berada dalam SATU transaksi dengan
            // locking read. Tanpa itu, admin 2 mengirim
            // PUT /api/users/29 {role:'SPG'} dan admin 29 mengirim
            // PUT /api/users/2 {role:'SPG'} dalam beberapa milidetik yang
            // sama: keduanya lolos setiap pemeriksaan di atas (sasaran
            // masing-masing bukan dirinya sendiri), kedua UPDATE commit,
            // dan nol administrator tersisa. Reset password pun
            // ADMINISTRATOR-saja, jadi tidak ada jalur pemulihan selain
            // akses langsung ke database.
            // withShortLockWait: alasannya sama seperti di PUT /:id/status
            // — yang kalah balapan lock harus melepas koneksi pool-nya
            // dalam hitungan detik, bukan menahannya sampai 50 detik dan
            // mengeringkan pool untuk request yang tidak berkaitan.
            const hasil = await db.transaction(withShortLockWait(async (t) => {

                // Locking read DULU, sebelum baris sasaran, dengan query
                // yang persis sama seperti di PUT /:id/status — urutan
                // lock yang berbeda antar handler berakhir sebagai
                // deadlock, bukan sebagai penolakan.
                const jumlahAdminAktif =
                    await hitungAdminAktifTerkunci(t)

                const target = await User.findByPk(targetId, {

                    transaction: t,

                    lock: t.LOCK.UPDATE,

                })

                if (
                    wouldRemoveLastActiveAdministrator(
                        target,
                        { role },
                        jumlahAdminAktif
                    )
                ) {

                    return {
                        status: 409,
                        message:
                            'Ini administrator aktif terakhir. Angkat administrator lain lebih dulu sebelum menurunkan rolenya.',
                    }

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

                        },

                        transaction: t

                    }

                )

                return null

            }))

            if (hasil) {
                return sendError(res, hasil.status, hasil.message)
            }

            res.json({

                message:
                    'User updated'

            })

        }

        catch (err) {

            // Diperiksa SEBELUM cabang 500. Kalah balapan lock bukan bug,
            // dan 500 tidak memberi tahu pemanggil bahwa mengulang akan
            // berhasil.
            if (isLockConflictError(err)) {
                return sendLockConflict(res)
            }

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

            // Gerbang yang SAMA dengan route penulisan user lainnya.
            // Sebelumnya route ini mengulang aturannya sendiri: memuat
            // ulang pemanggil dari database (padahal middleware auth
            // sudah memasok baris segar), memeriksa rolenya inline, dan
            // menjawab dengan pesan yang berbeda. Dua tempat yang
            // menghitung wewenang yang sama akan berbeda pada perubahan
            // berikutnya — dan reset password adalah pengambilalihan akun
            // yang sah, jadi cabang yang tertinggal di sini paling mahal.
            //
            // Cabang 404 "akun Anda tidak ditemukan" ikut hilang: ia
            // sudah tidak bisa dicapai sejak middleware menolak 401 untuk
            // user yang tidak ada.
            const gerbang = assertUserManagement(req.user)

            if (gerbang) {
                return sendError(res, gerbang.status, gerbang.message)
            }

            // parseId juga di sini: tanpa penormalan, `2abc` mereset
            // password baris id 2 karena MySQL mengoersi stringnya.
            const id = parseId(req.params.id)

            if (id === null) {
                return sendError(res, 400, 'Id user tidak valid.')
            }

            // Diperiksa SETELAH otorisasi: pemanggil yang tidak berhak
            // tidak perlu diberi tahu apakah id targetnya ada.
            const user =
                await User.findByPk(id)

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