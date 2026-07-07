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



        res.status(500).json({

            error: err.message,

            detail: err

        })

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

        let visitWhere = {}

        // ======================
        // SPG
        // ======================

        if (

            loginUser.role === 'SPG'

        ) {

            visitWhere = {

                user_id:
                    loginUser.id

            }

        }

        // ======================
        // SUPERVISOR
        // ======================

        if (

            loginUser.role === 'SUPERVISOR'

        ) {

            const spgIds =

                await User.findAll({

                    where: {

                        supervisor_id:
                            loginUser.id

                    },

                    attributes: ['id']

                })

            visitWhere = {

                user_id: {

                    [Op.in]:

                        spgIds.map(

                            u => u.id

                        )

                }

            }

        }

        // ======================
        // MANAGER
        // ======================

        if (

            loginUser.role === 'MANAGER'

        ) {

            const users =

                await User.findAll({

                    where: {

                        area_id:
                            loginUser.area_id,

                        channel_id:
                            loginUser.channel_id

                    },

                    attributes: ['id']

                })

            visitWhere = {

                user_id: {

                    [Op.in]:

                        users.map(

                            u => u.id

                        )

                }

            }

        }

        const {

            startDate,

            endDate,

            product,

            sales

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
                                model: User
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

        console.log(err)

        res.status(500).json({

            error: err.message,

            detail: err

        })

    }

}

// ======================
// GET BY VISIT
// ======================

exports.getByVisit =
    async (req, res) => {

        try {

            const data =

                await VisitActivity.findAll({

                    where: {

                        visit_id:
                            req.params.id

                    },

                    include: [

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

            console.log(err)

            res.status(500).json({

                error: err.message,

                detail: err

            })

        }

    }

