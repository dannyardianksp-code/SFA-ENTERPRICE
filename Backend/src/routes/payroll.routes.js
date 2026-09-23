const router = require('express').Router()

const auth = require('../middleware/auth.middleware')

const controller = require('../controllers/payroll.controller')

router.get('/', auth, controller.getAll)
router.put('/:userId/rate', auth, controller.setDailyRate)
router.put('/:userId/hari-kerja', auth, controller.setHariKerja)

module.exports = router
