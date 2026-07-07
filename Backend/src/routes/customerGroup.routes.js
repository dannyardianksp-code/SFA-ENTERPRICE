const router = require('express').Router()

const CustomerGroup =
    require('../models/customerGroup.model')

const auth =
    require('../middleware/auth.middleware')

router.get(
    '/',
    auth,
    async (req, res) => {

        const data =
            await CustomerGroup.findAll()

        res.json(data)

    }
)

module.exports = router