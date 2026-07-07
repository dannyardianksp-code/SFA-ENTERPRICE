const router =
    require('express').Router()

const Area =
    require('../models/area.model')

const auth =
    require('../middleware/auth.middleware')

router.get(

    '/',

    auth,

    async (req, res) => {

        const data =
            await Area.findAll()

        res.json(data)

    }

)

module.exports =
    router