const router = require('express').Router()
const controller = require('../controllers/attendance.controller')
const auth = require('../middleware/auth.middleware')
const upload = require('../middleware/upload.middleware')

router.post('/checkin', auth, upload.single('photo'), controller.checkIn)

module.exports = router
