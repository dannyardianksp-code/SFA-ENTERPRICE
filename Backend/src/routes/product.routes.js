const router = require('express').Router()
const controller = require('../controllers/product.controller')
const auth = require('../middleware/auth.middleware')

router.get('/', auth, controller.getAll)
router.post('/', auth, controller.create)
router.put('/:id', auth, controller.update)

module.exports = router