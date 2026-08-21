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

// ======================
// CREATE
// ======================

exports.create = async (req, res) => {

    try {

        const data = {

            visit_id:
                req.body.visit_id,

            activity_id:
                req.body.activity_id,

            product_name:
                req.body.product_name,

            qty:
                req.body.qty,

            expired_date:
                req.body.expired_date,

            normal_price:
                req.body.normal_price,

            promo_price:
                req.body.promo_price,

            notes:
                req.body.notes,

            photo_url:
                req.file

                    ?

                    `/uploads/${req.file.filename}`

                    :

                    null

        }

        const activity =

            await VisitActivity.create(data)

        res.json(activity)

    }

    catch (err) {

        return sendServerError(
            res,
            err,
            'CREATE VISIT ACTIVITY'
        )

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

