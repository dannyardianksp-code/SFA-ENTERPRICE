
const { Op } = require('sequelize')

const Customer =
    require('../models/customer.model')

const Area =
    require('../models/area.model')

const Channel =
    require('../models/channel.model')

const User =
    require('../models/user.model')

// ======================
// GET ALL CUSTOMER
// ======================

exports.getAll =
    async (req, res) => {

        try {

            const user =
                await User.findByPk(

                    req.user.id,

                    { include: [Area] }

                )

            let whereCondition = {}

            // ROLE YANG DIBATASI
            const restrictedRoles = [

                'SPG',

                'SUPERVISOR'

            ]

            if (

                restrictedRoles.includes(
                    user.role
                )

            ) {

                whereCondition = {

                    area_id:
                        user.area_id,

                    channel_id:
                        user.channel_id

                }

            }

            // if (

            //     restrictedRoles.includes(
            //         user.role
            //     )

            // ) {

            //     whereCondition = {

            //         area_id: { [Op.in]: areaIds },

            //         channel_id:
            //             user.channel_id

            //     }

            // }

            const data =
                await Customer.findAll({

                    where:
                        whereCondition,

                    include: [

                        {
                            model: Area
                        },

                        {
                            model: Channel
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

// ======================
// CREATE CUSTOMER
// ======================

exports.create =
    async (req, res) => {

        try {

            const data =
                await Customer.create(

                    req.body

                )

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