const router = require('express').Router()
const controller = require('../controllers/order.controller')
const auth = require('../middleware/auth.middleware')

router.post('/', auth, controller.create)
router.get('/', auth, controller.getAll)

module.exports = router