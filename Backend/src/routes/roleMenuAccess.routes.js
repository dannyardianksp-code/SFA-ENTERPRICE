const router = require('express').Router()

const auth = require('../middleware/auth.middleware')
const controller = require('../controllers/roleMenuAccess.controller')

// Dua-duanya '/' -- express membedakan berdasar METHOD, bukan cuma
// path, jadi GET dan PUT di path yang sama tidak bentrok.
router.get('/', auth, controller.getAll)
router.get('/mine', auth, controller.getMine)
router.put('/', auth, controller.saveForRole)

module.exports = router
