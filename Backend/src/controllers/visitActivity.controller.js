const fs = require('fs')

const { Op } =
    require('sequelize')

const VisitActivity =
    require('../models/visitActivity.model')

const Visit =
    require('../models/visit.model')

const Customer =
    require('../models/customer.model')

const User =
    require('../models/user.model')

const Activity =
    require('../models/activity.model')

const { sendError, sendServerError } =
    require('../utils/response.util')

const {
    resolveSubordinateUserIds,
    ownerWhere,
} = require('../utils/access.util')

const { parseId } =
    require('../utils/id.util')

const {
    ACTIVITY_FIELD_RULES,
    validateActivityFields,
} = require('../utils/activity-field-rules.util')

// ======================
// CREATE
// ======================

exports.create = async (req, res) => {

    try {

        const visitId = parseId(req.body.visit_id)

        if (visitId === null) {
            // Multer sudah menulis berkasnya ke disk sebelum handler ini
            // sempat memeriksa apa pun. /uploads disajikan tanpa
            // autentikasi (lihat tests/README.md), jadi berkas yang tidak
            // dihapus di sini menjadi bisa dibaca siapa pun tanpa token --
            // penolakan yang tidak membersihkan dirinya sendiri sama saja
            // dengan menerima uploadnya.
            if (req.file) fs.unlinkSync(req.file.path)
            return sendError(res, 400, 'Id kunjungan tidak valid.')
        }

        const visit = await Visit.findByPk(visitId)

        if (!visit) {
            // Sama seperti di atas -- kunjungan tidak ditemukan tidak
            // boleh meninggalkan berkas yang sudah terlanjur ditulis
            // multer sebelum baris ini dievaluasi.
            if (req.file) fs.unlinkSync(req.file.path)
            return sendError(res, 404, 'Kunjungan tidak ditemukan.')
        }

        // Personal, sama seperti checkIn -- SPG mencatat activity
        // kunjungannya sendiri, bukan milik orang lain.
        if (visit.user_id !== req.user.id) {
            // Sama seperti di atas -- penolakan kepemilikan bukan alasan
            // untuk membiarkan berkas yang sudah tertulis ke disk.
            if (req.file) fs.unlinkSync(req.file.path)
            return sendError(res, 403, 'Kunjungan ini bukan milik Anda.')
        }

        const activityId = parseId(req.body.activity_id)

        if (activityId === null) {
            return sendError(res, 400, 'Id tipe activity tidak valid.')
        }

        const pesanValidasi = validateActivityFields(
            activityId,
            req.body,
            Boolean(req.file)
        )

        if (pesanValidasi) {
            // Sama seperti di atas -- validasi field yang gagal juga
            // tidak boleh meninggalkan berkas yatim di /uploads.
            if (req.file) fs.unlinkSync(req.file.path)
            return sendError(res, 400, pesanValidasi)
        }

        // Field eksplisit, bukan spread req.body -- pelajaran yang sama
        // dari POST /api/visit-plans di sub-proyek kebocoran data.
        const activity = await VisitActivity.create({
            visit_id: visitId,
            activity_id: activityId,
            product_name: req.body.product_name || null,
            qty: req.body.qty ? Number(req.body.qty) : null,
            expired_date: req.body.expired_date || null,
            normal_price: req.body.normal_price || null,
            promo_price: req.body.promo_price || null,
            notes: req.body.notes || null,
            photo_url: req.file ? `/uploads/${req.file.filename}` : null,
        })

        // Dimuat ulang dengan include Activity supaya bentuk responsnya
        // sama dengan getAll/getByVisit -- mobile langsung dapat nama
        // tipe tanpa request kedua.
        const hasil = await VisitActivity.findByPk(activity.id, {
            include: [{ model: Activity, as: 'Activity' }],
        })

        res.json(hasil)

    } catch (err) {
        return sendServerError(res, err, 'CREATE VISIT ACTIVITY')
    }

}

// ======================
// GET ALL
// ======================

exports.getAll = async (req, res) => {

    try {


        const loginUser =

            await User.findByPk(

                req.user.id

            )

        if (!loginUser) {
            return sendError(res, 404, 'User tidak ditemukan.')
        }

        // Satu aturan: rantai supervisor_id. null berarti tidak
        // dibatasi, jadi visitWhere dibiarkan kosong — tapi
        // `required: true` pada include Visit di bawah TETAP, karena itu
        // yang menjamin activity tanpa kunjungan induk tidak ikut
        // terkirim.
        const bolehDilihat =
            await resolveSubordinateUserIds(loginUser)

        const visitWhere = ownerWhere(bolehDilihat)

        const {

            startDate,

            endDate,

            product

        } = req.query

        const whereCondition = {}

        // ======================
        // FILTER DATE
        // ======================

        if (

            startDate &&
            endDate

        ) {

            whereCondition.created_at = {

                [Op.between]: [

                    new Date(startDate),

                    new Date(endDate)

                ]

            }

        }

        if (product) {

            whereCondition.product_name = {

                [Op.substring]:
                    product

            }

        }



        const data =

            await VisitActivity.findAll({

                where:
                    whereCondition,

                include: [

                    // ======================
                    // VISIT
                    // ======================

                    {

                        model: Visit,

                        required: true,

                        where: visitWhere,

                        include: [

                            {
                                model: Customer
                            },

                            {
                                model: User,
                                attributes: ['id', 'name']
                            }

                        ]

                    },

                    // ======================
                    // ACTIVITY
                    // ======================

                    {

                        model: Activity,

                        as: 'Activity'

                    }

                ],

                order: [

                    ['created_at', 'DESC']

                ]

            })




        res.json(data)



    }

    catch (err) {

        return sendServerError(
            res,
            err,
            'GET ALL VISIT ACTIVITY'
        )

    }

}

// ======================
// GET BY VISIT
// ======================

exports.getByVisit =
    async (req, res) => {

        try {

            const id = parseId(req.params.id)

            if (id === null) {
                return sendError(res, 400, 'Id kunjungan tidak valid.')
            }

            const bolehDilihat =
                await resolveSubordinateUserIds(req.user)

            const data =

                await VisitActivity.findAll({

                    where: {

                        visit_id: id

                    },

                    include: [

                        {
                            model: Visit,

                            // required: true WAJIB. Tanpa itu Sequelize
                            // menghasilkan LEFT JOIN, dan baris activity
                            // yang visit_id-nya menunjuk kunjungan tidak
                            // ada — atau di luar subtree — tetap lolos
                            // dengan Visit: null.
                            required: true,

                            where: ownerWhere(bolehDilihat),
                        },

                        // Include asli, dipertahankan supaya
                        // sfa-web/app/visit-detail/[id]/page.tsx tetap
                        // dapat a.Activity?.name.
                        {

                            model: Activity,

                            as: 'Activity'

                        }

                    ],

                    order: [

                        ['created_at', 'DESC']

                    ]

                })

            res.json(data)

        }

        catch (err) {

            return sendServerError(
                res,
                err,
                'VISIT ACTIVITY'
            )

        }

    }

