const router = require('express').Router()
const controller = require('../controllers/visit.controller')
const auth = require('../middleware/auth.middleware')

router.post('/checkin', auth, controller.checkIn)
router.get('/', auth, controller.getAll)
router.get('/:id/products', auth, controller.getProducts)
router.get('/:id', auth, controller.getById)
router.post('/:id/checkout', auth, controller.checkOut)

module.exports = router