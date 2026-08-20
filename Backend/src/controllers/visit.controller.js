const Visit = require('../models/visit.model')
const Customer = require('../models/customer.model')
const User = require('../models/user.model')
const CustomerGroup = require('../models/customerGroup.model')
const Product = require('../models/product.model')
const { getDistance } = require('geolib')
const VisitPlan = require('../models/visitPlan.model')
const { Op } = require('sequelize')

const {
    sendError,
    sendServerError,
} = require('../utils/response.util')

const {
    resolveSubordinateUserIds,
    ownerWhere,
    assertWithinSubtree,
} = require('../utils/access.util')

const { parseId } = require('../utils/id.util')



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

            return sendError(
                res,
                403,
                'Customer ini berada di luar wilayah Anda.'
            )

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

        return sendServerError(res, err, 'VISIT CHECK-IN')

    }

}

// GET VISIT HISTORY
exports.getAll = async (req, res) => {

    try {

        // User dimuat dari database, bukan dipercaya dari token: token
        // yang rolenya sudah berubah di database tidak boleh menentukan
        // apa yang terlihat.
        const loginUser = await User.findByPk(req.user.id)

        if (!loginUser) {
            return sendError(res, 404, 'User tidak ditemukan.')
        }

        const bolehDilihat =
            await resolveSubordinateUserIds(loginUser)

        const where = ownerWhere(bolehDilihat)

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

        return sendServerError(res, err, 'GET VISIT')

    }

}

// GET PRODUCTS BY VISIT ID
exports.getProducts = async (req, res) => {

    try {

        const id = parseId(req.params.id)

        if (id === null) {
            return sendError(res, 400, 'Id kunjungan tidak valid.')
        }

        const visit = await Visit.findByPk(id, {

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

        if (!visit) {
            return sendError(res, 404, 'Kunjungan tidak ditemukan.')
        }

        const bolehDilihat =
            await resolveSubordinateUserIds(req.user)

        const gerbang =
            assertWithinSubtree(bolehDilihat, visit.user_id)

        if (gerbang) {
            return sendError(res, gerbang.status, gerbang.message)
        }

        // Relasi mana pun di rantai ini bisa kosong kalau datanya belum
        // lengkap. Tanpa penjaga ini, customer tanpa group menjadi 500
        // alih-alih daftar kosong.
        const products =
            visit.Customer?.CustomerGroup?.Products ?? []

        res.json(products)

    } catch (err) {

        return sendServerError(res, err, 'GET VISIT PRODUCTS')

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
                        { model: User, attributes: ['id', 'name'] }
                    ]
                }
            )

        if (!data) {
            return sendError(res, 404, 'Kunjungan tidak ditemukan.')
        }

        const loginUser = await User.findByPk(req.user.id)

        if (!loginUser) {
            return sendError(res, 404, 'User tidak ditemukan.')
        }

        // null berarti tidak dibatasi. Untuk yang lain: pemilik atau
        // siapa pun di dalam subtree-nya.
        const bolehDilihat =
            await resolveSubordinateUserIds(loginUser)

        const gerbang =
            assertWithinSubtree(bolehDilihat, data.user_id)

        if (gerbang) {
            return sendError(res, gerbang.status, gerbang.message)
        }

        res.json(data)

    } catch (err) {

        return sendServerError(res, err, 'VISIT')

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

            return sendServerError(res, err, 'VISIT CHECK-OUT')

        }

    }