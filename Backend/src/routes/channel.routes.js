const router =
    require('express').Router()

const Channel =
    require('../models/channel.model')

const auth =
    require('../middleware/auth.middleware')

router.get(

    '/',

    auth,

    async (req, res) => {

        const data =
            await Channel.findAll()

        res.json(data)

    }

)

module.exports =
    router