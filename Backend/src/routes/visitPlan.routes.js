const router =
    require('express').Router()

const controller =
    require('../controllers/visitPlan.controller')

const auth =
    require('../middleware/auth.middleware')

const upload =
    require('../middleware/upload.middleware')

const VisitPlan =
    require('../models/visitPlan.model')

const User =
    require('../models/user.model')

const Customer =
    require('../models/customer.model')

const Visit =
    require('../models/visit.model')

const { Op } = require('sequelize')

// GET ALL
router.get(

    '/',

    auth,
    controller.getAll,

)

// CREATE
router.post(
    '/',
    auth,
    controller.create,

)

//upload excel//

router.post(
    '/upload',
    auth,
    upload.single('file'),
    controller.uploadExcel
)

//download tempalte//

router.get(
    '/template',
    auth,
    controller.downloadTemplate
)

// UPDATE dan DELETE (protected). Keduanya memeriksa status SEBELUM
// menyentuh data, dan menolak SPG — jadwal adalah target, bukan milik
// yang ditarget.
router.put('/:id', auth, controller.update)

router.delete('/:id', auth, controller.delete)


module.exports = router