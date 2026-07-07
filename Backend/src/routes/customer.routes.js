const router = require('express').Router()

const controller = require('../controllers/customer.controller')
const Area = require('../models/area.model')
const auth = require('../middleware/auth.middleware')

// GET semua customer (protected)
router.get('/', auth, controller.getAll)

// CREATE customer (protected)
router.post('/', auth, controller.create)

module.exports = router