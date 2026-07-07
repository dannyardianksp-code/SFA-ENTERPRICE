const Visit = require('../models/visit.model')
const Customer = require('../models/customer.model')
const User = require('../models/user.model')
const CustomerGroup = require('../models/customerGroup.model')
const Product = require('../models/product.model')
const { getDistance } = require('geolib')
const VisitPlan = require('../models/visitPlan.model')



// CHECK-IN

exports.checkIn = async (

    req,
    res
) => {


    try {

        const {
            customer_id,
            visit_plan_id,
            latitude,
            longitude
        } = req.body

        const user_id =
            req.user.id

        // GET VISIT PLAN
        const plan =
            await VisitPlan.findByPk(
                visit_plan_id
            )

        const user =
            await User.findByPk(
                req.user.id
            )


        if (!plan) {

            return res.status(404).json({
                message:
                    'Visit plan tidak ditemukan'
            })

        }
        if (plan.status !== 'PENDING') {
            return res.status(400).json({
                message: 'Visit already started'
            })
        }

        // GET CUSTOMER
        const customer =
            await Customer.findByPk(
                customer_id
            )

        if (!customer) {

            return res.status(404).json({
                message:
                    'Customer tidak ditemukan'
            })

        }

        // HITUNG JARAK
        const distance =
            getDistance(

                {
                    latitude:
                        parseFloat(latitude),

                    longitude:
                        parseFloat(longitude)
                },

                {
                    latitude:
                        parseFloat(
                            customer.latitude
                        ),

                    longitude:
                        parseFloat(
                            customer.longitude
                        )
                }

            )

        // VALIDASI
        if (distance > 50) {

            return res.status(400).json({

                message:
                    `Terlalu jauh dari toko (${distance} meter)`,

                distance

            })

        }

        const existingVisit =
            await Visit.findOne({

                where: {

                    user_id,

                    customer_id,

                    checkout_time: null

                }

            })

        if (existingVisit) {

            return res.json({

                message:
                    'Visit masih berjalan',

                data: existingVisit

            })

        }

        if (

            user.area_id
            !==
            customer.area_id

        ) {

            return res.status(403).json({

                error:
                    'Customer outside your territory'

            })

        }
        if (

            user.role === 'SPG'

            ||

            user.role === 'SUPERVISOR'

        ) {

            if (

                customer.area_id !==
                user.area_id

                ||

                customer.channel_id !==
                user.channel_id

            ) {

                return res.status(403).json({

                    message:
                        'Customer beda territory'

                })

            }

        }




        // SAVE VISIT
        const visit =

            await Visit.create({

                user_id:
                    req.user.id,

                customer_id,

                visit_plan_id,

                latitude,

                longitude,

                checkin_time:
                    new Date()


            })

        await VisitPlan.update(

            {

                status:
                    'ON VISIT'

            },

            {

                where: {

                    id:
                        visit_plan_id

                }

            }

        )

        res.json({

            message:
                'Check-in berhasil',

            distance,

            data: visit

        })

    } catch (err) {

        res.status(500).json({
            error: err.message
        })

    }

}

const { Op } = require('sequelize')

// GET VISIT HISTORY
exports.getAll = async (req, res) => {

    try {


        const where = {}

        // Jika SPG, hanya tampilkan visit miliknya

        if (req.user.role === 'SPG') {

            where.user_id = req.user.id

        }

        else if (req.user.role === 'SUPERVISOR') {

            const bawahanSupervisor =
                await User.findAll({
                    where: {
                        supervisor_id: req.user.id
                    },
                    attributes: ['id']
                })

            const bawahanIds =
                bawahanSupervisor.map(
                    u => u.id
                )

            where.user_id = {

                [Op.in]: bawahanIds

            }

        }

        const data = await Visit.findAll({

            where,

            include: [

                { model: User, attributes: ['name'] },

                { model: Customer, attributes: ['name'] }

            ],

            order: [['checkin_time', 'DESC']]

        })

        res.json(data)

    } catch (err) {

        console.error(err)

        res.status(500).json({

            message: 'Server Error'

        })

    }

}

// GET PRODUCTS BY VISIT ID
exports.getProducts = async (req, res) => {

    try {

        const visit = await Visit.findByPk(req.params.id, {

            include: [
                {
                    model: Customer,
                    include: [
                        {
                            model: CustomerGroup,
                            include: [Product]
                        }
                    ]
                }
            ]

        })

        const products =
            visit.Customer.CustomerGroup.Products

        res.json(products)

    } catch (err) {

        res.status(500).json({
            error: err.message
        })

    }

}

exports.getById = async (
    req,
    res
) => {

    try {

        const data =
            await Visit.findByPk(
                req.params.id,
                {
                    include: [
                        Customer,
                        User
                    ]
                }
            )

        res.json(data)

    } catch (err) {

        res.status(500).json({
            error: err.message
        })

    }

}

exports.checkOut =
    async (req, res) => {

        try {

            const visit =
                await Visit.findByPk(
                    req.params.id
                )

            if (!visit) {

                return res.status(404).json({

                    message:
                        'Visit tidak ditemukan'

                })

            }

            visit.checkout_time =
                new Date()

            await visit.save()

            res.json({

                message:
                    'Check-out berhasil',

                data: visit

            })

            await VisitPlan.update(

                {

                    status: 'COMPLETED'

                },

                {

                    where: {
                        id: visit.visit_plan_id
                    }

                }

            )

        } catch (err) {

            res.status(500).json({

                error: err.message

            })

        }

    }