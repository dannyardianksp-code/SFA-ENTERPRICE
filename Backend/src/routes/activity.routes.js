const router = require('express').Router()

const Activity =
    require('../models/activity.model')

const auth =
    require('../middleware/auth.middleware')


// GET
router.get(
    '/',
    auth,
    async (req, res) => {

        const data =
            await Activity.findAll({

                order: [
                    ['ID', 'ASC']
                ]

            })

        res.json(data)

    }
)


// CREATE
router.post(
    '/',
    auth,
    async (req, res) => {

        const data =
            await Activity.create({

                code: req.body.code,
                name: req.body.name

            })

        res.json(data)

    }
)

module.exports = router