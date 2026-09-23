const router = require('express').Router()

const auth = require('../middleware/auth.middleware')

const controller = require('../controllers/incentiveRule.controller')

router.get('/', auth, controller.getAll)
router.get('/progress', auth, controller.getProgress)
router.post('/', auth, controller.create)
router.put('/:id', auth, controller.update)
router.put('/:id/toggle', auth, controller.toggleAktif)
router.delete('/:id', auth, controller.remove)

module.exports = router
