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

            res.json({

                message:
                    'User berhasil dibuat',

                user

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

            const user =
                await User.findByPk(

                    req.params.id

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

            res.json({

                message:
                    'Status user berhasil diupdate',

                data:
                    user

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

            const {

                code,

                name,

                email,

                role,

                area_id,

                channel_id,

                supervisor_id



            } = req.body

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
                            req.params.id

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

            const user =
                await User.findByPk(

                    req.params.id

                )

            if (!user) {

                return res.status(404).json({

                    message:
                        'User tidak ditemukan'

                })

            }

            const hash =
                await bcrypt.hash(

                    '123456',

                    10

                )

            user.password =
                hash

            await user.save()

            res.json({

                message:
                    'Password berhasil direset',

                password:
                    '123456'

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


module.exports =
    router