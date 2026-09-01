const router = require('express').Router()
const controller = require('../controllers/userLocation.controller')
const auth = require('../middleware/auth.middleware')

router.post('/ping', auth, controller.ping)
router.get('/', auth, controller.getAll)

module.exports = router
