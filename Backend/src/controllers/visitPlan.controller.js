
const { Op } =
    require('sequelize')

const XLSX = require('xlsx')

const fs = require('fs')

const VisitPlan =
    require('../models/visitPlan.model')

const User =
    require('../models/user.model')

const Customer =
    require('../models/customer.model')

const Visit =
    require('../models/visit.model')

const { sendError, sendServerError } =
    require('../utils/response.util')

const {
    localDateString,
    addDaysLocal,
} = require('../utils/date.util')

const {
    resolveSubordinateUserIds,
    PLAN_WRITER_ROLES,
    ownerWhere,
    assertWithinSubtree,
} = require('../utils/access.util')

const { parseId } =
    require('../utils/id.util')



// ======================
// GET ALL
// ======================

/**
 * Rentang tanggal yang dilihat SPG: hari ini dan besok.
 *
 * Dua hari, bukan satu — sales perlu bisa bersiap untuk besok. Ini
 * keputusan produk yang sebelumnya terjadi secara kebetulan lewat
 * Op.between; sekarang eksplisit dan dijaga tes.
 *
 * Fungsi murni dan diekspor supaya batas bulan serta batas tahun bisa
 * diuji tanpa database.
 */
const spgDateRange = (now = new Date()) => [
    localDateString(now),
    addDaysLocal(now, 1),
]

exports.getAll =
    async (req, res) => {

        try {

            const loginUser =
                await User.findByPk(

                    req.user.id

                )

            if (!loginUser) {
                return sendError(res, 404, 'User tidak ditemukan.')
            }

            let whereCondition = {}

            // Satu aturan untuk "data siapa yang boleh saya lihat":
            // rantai supervisor_id, bukan area. SPG boleh punya berapa
            // pun area — ikatan ke atasannya tetap satu.
            //
            // null berarti tidak dibatasi, jadi kunci user_id tidak
            // dipasang sama sekali. Memasangnya dengan array kosong akan
            // membuat administrator melihat nol.
            const bolehDilihat =
                await resolveSubordinateUserIds(loginUser)

            Object.assign(whereCondition, ownerWhere(bolehDilihat))

            // SPG melihat rencana hari ini dan besok. Rentangnya
            // eksplisit lewat spgDateRange — sebelumnya tanggalnya
            // dihitung UTC, sehingga tiap pagi 00:00-07:00 WIB yang
            // muncul adalah kemarin + hari ini.
            //
            // PERINGATAN: cabang ini menimpa whereCondition SELURUHNYA,
            // termasuk klausa user_id dari ownerWhere(bolehDilihat) di
            // atas -- dan itu memang disengaja, BUKAN celah. Ia hanya
            // aman karena SPG adalah role daun: subtree-nya persis
            // [dirinya sendiri], sehingga user_id: loginUser.id di sini
            // MENULIS ULANG batasan yang sama persis dengan yang sudah
            // dihasilkan ownerWhere, bukan melonggarkannya. Menghapus
            // `user_id: loginUser.id` sebagai "redundan" akan membuka
            // kembali kebocoran: whereCondition tersisa hanya
            // { visit_date: {...} } tanpa batasan pemilik sama sekali,
            // dan SPG mana pun akan melihat jadwal SEMUA orang pada
            // rentang tanggal itu.
            if (loginUser.role === 'SPG') {

                const [hariIni, besok] = spgDateRange()

                whereCondition = {

                    user_id: loginUser.id,

                    visit_date: {

                        [Op.between]: [hariIni, besok]

                    }

                }

            }

            const data =
                await VisitPlan.findAll({

                    where: whereCondition,

                    include: [

                        {
                            model: User,
                            attributes: ['name']
                        },

                        {
                            model: Customer,

                            attributes: [

                                'id',

                                'name',

                                // code & address dipakai baris daftar
                                // di mobile — tanpa keduanya layar
                                // perlu request kedua per baris.
                                'code',

                                'address',

                                'latitude',

                                'longitude'

                            ]
                        },

                        {
                            model: Visit
                        }

                    ],

                    order: [

                        ['visit_date', 'ASC']

                    ]

                })

            // Array telanjang, sama dengan /api/customers. Tidak ada
            // konsumen yang memakai bentuk { data } — modul visit di
            // mobile masih kosong saat perubahan ini dibuat.
            res.json(data)

        } catch (err) {

            return sendServerError(
                res,
                err,
                'GET ALL VISIT PLAN'
            )

        }

    }

// ======================
// CREATE
// ======================

exports.create =
    async (req, res) => {

        try {

            // Gerbang role dulu, sebelum data apa pun disentuh.
            // update dan delete sudah punya ini sejak sub-proyek
            // visit-plan; create tidak punya apa pun.
            if (!PLAN_WRITER_ROLES.includes(req.user.role)) {
                return sendError(
                    res,
                    403,
                    'Hanya supervisor ke atas yang boleh membuat jadwal kunjungan.'
                )
            }

            const { user_id, customer_id, visit_date } = req.body

            if (
                user_id === undefined ||
                customer_id === undefined ||
                visit_date === undefined
            ) {
                return sendError(
                    res,
                    400,
                    'user_id, customer_id, dan visit_date wajib diisi.'
                )
            }

            // Dinormalkan SEBELUM gerbang kepemilikan, bukan sesudah.
            // assertWithinSubtree mengembalikan "boleh" seketika saat
            // subordinateIds === null (ADMINISTRATOR) TANPA PERNAH
            // melihat user_id -- jadi untuk administrator, validasi
            // inilah satu-satunya yang berdiri antara id yang cacat dan
            // tabelnya. Tanpa ini: user_id: null gagal di database
            // (kolom NOT NULL, sql_mode STRICT_TRANS_TABLES) dan
            // tersurat sebagai 500; user_id: 0 justru LOLOS NOT NULL
            // dan tersimpan sebagai baris yatim, karena visit_plans
            // tidak punya foreign key sama sekali.
            const targetUserId = parseId(user_id)
            const targetCustomerId = parseId(customer_id)

            if (targetUserId === null || targetCustomerId === null) {
                return sendError(
                    res,
                    400,
                    'user_id dan customer_id harus id yang sah.'
                )
            }

            const bolehDilihat =
                await resolveSubordinateUserIds(req.user)

            const gerbang =
                assertWithinSubtree(bolehDilihat, targetUserId)

            if (gerbang) {
                return sendError(res, gerbang.status, gerbang.message)
            }

            // Diperiksa SETELAH gerbang kepemilikan, sengaja: pemanggil
            // yang di luar subtree-nya tidak perlu diberi tahu apakah
            // id targetnya ada atau tidak -- ia sudah ditolak 403 lebih
            // dulu di atas.
            //
            // visit_plans TIDAK PUNYA foreign key sama sekali (diverifikasi
            // langsung ke information_schema.KEY_COLUMN_USAGE). parseId di
            // atas hanya memastikan bentuknya "bilangan bulat >= 1" --
            // ADMINISTRATOR (subordinateIds === null, lolos gerbang di atas
            // tanpa pernah melihat targetUserId) yang mengirim id yang sah
            // secara bentuk tapi tidak ada barisnya akan menulis baris
            // yatim yang menunjuk user atau customer yang tidak pernah ada,
            // dan tidak ada apa pun di bawahnya yang menangkap itu.
            const [pemilik, pelanggan] = await Promise.all([
                User.findByPk(targetUserId),
                Customer.findByPk(targetCustomerId),
            ])

            if (!pemilik || !pelanggan) {
                return sendError(
                    res,
                    400,
                    'user_id atau customer_id tidak ditemukan.'
                )
            }

            // Daftar field EKSPLISIT menggantikan { ...req.body }.
            // Spread hanya dibatasi oleh atribut yang dideklarasikan
            // model, dan user_id ada di antaranya — itulah lubang
            // kepemilikannya. Daftar eksplisit membuat kolom baru di
            // masa depan tidak otomatis bisa ditulis klien.
            //
            // user_id dan customer_id memakai nilai yang sudah
            // dinormalkan parseId, bukan req.body mentah -- keduanya
            // sudah dipastikan bilangan bulat positif di atas.
            //
            // status dipaksa PENDING dan TIDAK diambil dari body: update
            // dan delete menolak jadwal non-PENDING, sehingga jadwal
            // yang lahir COMPLETED terkunci selamanya.
            const data =
                await VisitPlan.create({

                    user_id: targetUserId,

                    customer_id: targetCustomerId,

                    visit_date,

                    status: 'PENDING'

                })

            res.json(data)

        } catch (err) {

            return sendServerError(
                res,
                err,
                'VISIT PLAN'
            )

        }

    }

// ======================
// UPDATE
// ======================

/** Field visit plan yang boleh diubah. Sisanya diabaikan. */
const UPDATABLE_FIELDS = ['customer_id', 'visit_date']

exports.update =
    async (req, res) => {

        try {

            const visitPlan =
                await VisitPlan.findByPk(req.params.id)

            if (!visitPlan) {
                return sendError(
                    res,
                    404,
                    'Visit Plan tidak ditemukan.'
                )
            }

            const loginUser =
                await User.findByPk(req.user.id)

            if (!loginUser) {
                return sendError(res, 404, 'User tidak ditemukan.')
            }

            // Jadwal adalah target. Target yang bisa diubah sendiri oleh
            // yang ditarget berhenti berfungsi sebagai target.
            //
            // Allowlist, bukan blacklist: role NULL, nilai warisan, atau
            // role baru apa pun tidak otomatis mendapat hak tulis.
            if (!PLAN_WRITER_ROLES.includes(loginUser.role)) {
                return sendError(
                    res,
                    403,
                    'Hanya supervisor ke atas yang boleh mengubah visit plan.'
                )
            }

            const bolehDilihat =
                await resolveSubordinateUserIds(loginUser)

            const gerbang =
                assertWithinSubtree(bolehDilihat, visitPlan.user_id)

            if (gerbang) {
                return sendError(res, gerbang.status, gerbang.message)
            }

            // Status diperiksa SEBELUM data disentuh. Sebelumnya
            // datanya diubah dulu lalu 400 dikirim — penolakan datang
            // setelah datanya rusak.
            if (visitPlan.status !== 'PENDING') {
                return sendError(
                    res,
                    400,
                    `Visit plan yang berstatus ${visitPlan.status} tidak bisa diubah.`
                )
            }

            // Hanya field yang benar-benar dikirim. Sebelumnya `notes`
            // ikut ditulis — kolom yang tidak ada di tabel maupun model,
            // jadi Sequelize mengabaikannya diam-diam.
            const perubahan = {}

            for (const field of UPDATABLE_FIELDS) {
                if (req.body[field] !== undefined) {
                    perubahan[field] = req.body[field]
                }
            }

            if (Object.keys(perubahan).length === 0) {
                return sendError(
                    res,
                    400,
                    'Tidak ada field yang bisa diubah pada permintaan ini.'
                )
            }

            await visitPlan.update(perubahan)

            res.json({
                message: 'Visit Plan berhasil diupdate'
            })

        }

        catch (err) {

            return sendServerError(
                res,
                err,
                'UPDATE VISIT PLAN'
            )

        }

    }

// ======================
// DELETE
// ======================

exports.delete =
    async (req, res) => {

        try {

            const visitPlan =
                await VisitPlan.findByPk(req.params.id)

            if (!visitPlan) {
                return sendError(
                    res,
                    404,
                    'Visit Plan tidak ditemukan.'
                )
            }

            const loginUser =
                await User.findByPk(req.user.id)

            if (!loginUser) {
                return sendError(res, 404, 'User tidak ditemukan.')
            }

            // Allowlist, bukan blacklist: role NULL, nilai warisan, atau
            // role baru apa pun tidak otomatis mendapat hak tulis.
            if (!PLAN_WRITER_ROLES.includes(loginUser.role)) {
                return sendError(
                    res,
                    403,
                    'Hanya supervisor ke atas yang boleh mengubah visit plan.'
                )
            }

            const bolehDilihat =
                await resolveSubordinateUserIds(loginUser)

            const gerbang =
                assertWithinSubtree(bolehDilihat, visitPlan.user_id)

            if (gerbang) {
                return sendError(res, gerbang.status, gerbang.message)
            }

            // Diperiksa SEBELUM destroy. Sebelumnya barisnya dihapus
            // dulu, lalu 400 dikirim — datanya sudah hilang.
            if (visitPlan.status !== 'PENDING') {
                return sendError(
                    res,
                    400,
                    `Visit plan yang berstatus ${visitPlan.status} tidak bisa dihapus.`
                )
            }

            await visitPlan.destroy()

            res.json({
                message: 'Visit Plan berhasil dihapus'
            })

        }

        catch (err) {

            return sendServerError(
                res,
                err,
                'DELETE VISIT PLAN'
            )

        }

    }

// ======================
// UPLOAD EXCEL
// ======================


exports.uploadExcel = async (req, res) => {

    try {

        // Gerbang role dulu, sebelum file apa pun dibaca -- sama seperti
        // create. Endpoint ini dulu tidak punya penjaga sama sekali: SPG
        // mana pun bisa mengunggah spreadsheet berisi kode sales siapa
        // saja dan membuat jadwal kunjungan untuk seluruh perusahaan.
        if (!PLAN_WRITER_ROLES.includes(req.user.role)) {
            return sendError(
                res,
                403,
                'Hanya supervisor ke atas yang boleh membuat jadwal kunjungan.'
            )
        }

        const workbook =
            XLSX.readFile(req.file.path)

        const sheet =
            workbook.Sheets[
            workbook.SheetNames[0]
            ]

        const rows =
            XLSX.utils.sheet_to_json(sheet)

        console.log(rows[0])

        let inserted = 0
        let duplicate = 0

        const errors = []

        // Diambil SEKALI di sini, di luar loop baris -- satu query untuk
        // seluruh file, bukan satu query per baris. Baris spreadsheet
        // bisa berjumlah ratusan; menghitung ulang subtree pemanggil
        // untuk tiap baris akan membebani database tanpa mengubah
        // jawabannya sama sekali, karena subtree pemanggil tidak
        // berubah selama satu request berjalan.
        const bolehDilihat =
            await resolveSubordinateUserIds(req.user)

        for (const row of rows) {

            //--------------------------------
            // Ambil data dari Excel
            //--------------------------------

            const salesCode =
                row["Sales Code"]

            const customerCode =
                row["Customer Code"]

            const excelDate =
                row["Visit Date"]

            //--------------------------------
            // Convert Excel Date
            //--------------------------------

            const jsDate =
                XLSX.SSF.parse_date_code(excelDate)

            const visitDate =
                `${jsDate.y}-${String(jsDate.m).padStart(2, '0')}-${String(jsDate.d).padStart(2, '0')}`

            //--------------------------------
            // SALES
            //--------------------------------

            const user =
                await User.findOne({

                    where: {

                        code: salesCode

                    }

                })

            if (!user) {

                errors.push({

                    row,

                    reason: 'Sales Code tidak ditemukan'

                })

                continue

            }

            //--------------------------------
            // KEPEMILIKAN
            //--------------------------------

            // Baris ini di luar jangkauan pemanggil. Baris lain dalam
            // file yang sama tetap diproses -- satu baris di luar
            // subtree tidak boleh menggagalkan seluruh upload, sama
            // seperti Sales Code atau Customer Code yang tidak
            // ditemukan di atas dan di bawah.
            const gerbangBaris =
                assertWithinSubtree(bolehDilihat, user.id)

            if (gerbangBaris) {

                errors.push({

                    row,

                    reason: 'Sales Code di luar jangkauan Anda'

                })

                continue

            }

            //--------------------------------
            // CUSTOMER
            //--------------------------------

            const customer =
                await Customer.findOne({

                    where: {

                        code: customerCode

                    }

                })

            if (!customer) {

                errors.push({

                    row,

                    reason: 'Customer Code tidak ditemukan'

                })

                continue

            }


            //--------------------------------
            // DUPLICATE
            //--------------------------------

            const exist =
                await VisitPlan.findOne({

                    where: {

                        user_id: user.id,

                        customer_id: customer.id,

                        visit_date: visitDate

                    }

                })

            if (exist) {

                duplicate++

                continue

            }

            //--------------------------------
            // INSERT
            //--------------------------------

            await VisitPlan.create({

                user_id: user.id,

                customer_id: customer.id,

                visit_date: visitDate,

                status: "PENDING"

            })

            inserted++

        }

        //--------------------------------

        fs.unlinkSync(req.file.path)

        //--------------------------------

        res.json({

            success: true,

            total:
                rows.length,

            inserted,

            duplicate,

            failed:
                errors.length,

            errors

        })

    }

    catch (err) {

        return sendServerError(
            res,
            err,
            'UPLOAD VISIT PLAN EXCEL'
        )

    }

}


// ======================
// DOWNLOAD TEMPLATE
// ======================

const path = require('path')
exports.downloadTemplate = (req, res) => {


    const filePath = path.join(

        process.cwd(),

        'templates',

        'visit-plan-template.xlsx'

    )

    console.log(filePath)

    console.log(fs.existsSync(filePath))

    res.download(filePath)

}

exports.spgDateRange = spgDateRange